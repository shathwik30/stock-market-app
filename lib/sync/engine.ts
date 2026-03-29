/**
 * Sync Engine — the heart of the redesigned data architecture.
 *
 * Instead of fetching from Dhan API on every user request, the engine:
 * 1. Runs in a loop during cron windows (up to 55s per invocation)
 * 2. Fetches ALL quotes, computes ALL % changes, writes to LiveQuote table
 * 3. API routes just read from DB — instant, zero-lag responses
 *
 * Rate limit strategy: 1 Dhan call per second (hard cap), 1000 IDs per call.
 * NSE (~2700 stocks) = 3 calls = ~3s. BSE (~5300) = 6 calls = ~6s.
 * In a 55s window: ~8 NSE refreshes + ~4 BSE refreshes per minute.
 */

import { getState } from './state';
import { fetchQuotes } from './dhan-api';
import { getScripMaster, deduplicateByIsin, type ScripInfo } from '@/lib/dhan/scripMaster';
import { ensureHistoricalLoaded, syncDailyFromQuotes, startPopulation, getPopulationStatus } from './historical';
import { ensureSnapshotsLoaded, storeSnapshot } from './snapshots';
import { writeLiveQuotes, writeMarketStats, writeCombinedMarketStats } from './writer';
import type { Exchange, Segment, SyncResult, DhanQuote } from './types';

/**
 * Run a SINGLE sync cycle for the given exchange.
 * Fetches quotes → computes → writes to DB.
 * Returns in ~4-8s depending on stock count and rate limits.
 */
export async function runSingleSync(exchange: Exchange): Promise<SyncResult> {
  const t0 = Date.now();

  // 1. Get stock list (from in-memory cache → DB → CSV, cascade)
  let stocks = await getScripMaster(exchange === 'Both' ? 'Both' : exchange);
  if (exchange === 'Both') stocks = deduplicateByIsin(stocks);

  // 2. Group by exchange segment
  const bySegment: Record<string, ScripInfo[]> = {};
  for (const s of stocks) {
    (bySegment[s.exchangeSegment] ??= []).push(s);
  }
  const segments = Object.keys(bySegment);

  // 3. Load historical + snapshots in parallel (fast after first load)
  await Promise.all([
    ...segments.map((seg) => ensureHistoricalLoaded(seg)),
    ensureSnapshotsLoaded(),
  ]);

  // 4. Fetch ALL quotes from Dhan API (rate-limited, ~1s per batch of 1000)
  const allQuotes = new Map<number, DhanQuote>();
  for (const [seg, segStocks] of Object.entries(bySegment)) {
    const ids = segStocks.map((s) => s.securityId);
    const quotes = await fetchQuotes(seg as Segment, ids);
    for (const [id, q] of quotes) allQuotes.set(id, q);
  }

  // 5. Store price snapshot for intraday % changes
  storeSnapshot(allQuotes);

  // 6. Daily close sync — awaited for data integrity (bulk SQL, fast on Neon)
  for (const seg of segments) {
    const segQuotes = new Map<number, DhanQuote>();
    for (const s of stocks.filter((st) => st.exchangeSegment === seg)) {
      const q = allQuotes.get(s.securityId);
      if (q) segQuotes.set(s.securityId, q);
    }
    try {
      await syncDailyFromQuotes(segQuotes, seg);
    } catch (e) {
      console.error(`[Sync:Engine] Daily sync error for ${seg}:`, e instanceof Error ? e.message : e);
    }
  }

  // 7. Compute all % changes + write to LiveQuote table (the core of the redesign)
  const computed = await writeLiveQuotes(stocks, allQuotes);

  // 8. Write pre-computed market stats (skip if no quotes — protects against after-hours zeroing)
  if (computed.length > 0) {
    await writeMarketStats(exchange, computed);
    if (exchange === 'Both') {
      const nseComputed = computed.filter((c) => c.stock.exchange === 'NSE');
      const bseComputed = computed.filter((c) => c.stock.exchange === 'BSE');
      if (nseComputed.length > 0) await writeMarketStats('NSE', nseComputed);
      if (bseComputed.length > 0) await writeMarketStats('BSE', bseComputed);
    }

    // Always update combined 'Both' stats from latest NSE + BSE data
    await writeCombinedMarketStats();
  }

  // 9. Trigger background historical population (non-blocking)
  startPopulation(stocks.map((s) => ({ securityId: s.securityId, exchangeSegment: s.exchangeSegment })));

  // Update sync timestamp
  const state = getState();
  state.lastSyncAt = Date.now();

  const elapsed = Date.now() - t0;
  console.log(`[Sync:Engine] Cycle complete: ${computed.length} stocks in ${elapsed}ms`);

  return {
    quotesUpdated: computed.length,
    snapshotStored: true,
    statsUpdated: true,
    elapsed,
    cycle: 0,
  };
}

/**
 * Run a single sync cycle for the cron endpoint.
 * Alternates NSE/BSE based on IST minute (deterministic, survives cold starts).
 * BSE on even minutes, NSE on odd → each exchange synced every 2 minutes.
 */
export async function runSyncLoop(): Promise<{ cycles: number; results: SyncResult[] }> {
  const state = getState();

  // Prevent concurrent sync loops
  if (state.syncLock) {
    console.log('[Sync:Engine] Sync already running, skipping');
    return { cycles: 0, results: [] };
  }
  state.syncLock = true;

  const results: SyncResult[] = [];
  let cycle = 0;

  try {
    // Determine exchange from IST minute — deterministic, survives cold starts.
    // BSE on even minutes, NSE on odd → each gets synced every 2 minutes.
    const now = new Date();
    const istMinute = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).getUTCMinutes();
    const exchange: Exchange = istMinute % 2 === 0 ? 'BSE' : 'NSE';

    const result = await runSingleSync(exchange);
    result.cycle = ++cycle;
    results.push(result);
  } catch (e) {
    console.error('[Sync:Engine] Loop error:', e instanceof Error ? e.message : e);
  } finally {
    state.syncLock = false;
  }

  console.log(`[Sync:Engine] Cycle complete: synced ${results[0]?.quotesUpdated || 0} stocks`);
  return { cycles: cycle, results };
}

/**
 * Ensure data exists in LiveQuote table.
 * If empty (first ever load), runs a single blocking sync.
 * If stale (> 60s), triggers a non-blocking background sync.
 * Called by API routes to guarantee data availability.
 */
export async function ensureDataReady(exchange: Exchange): Promise<void> {
  const { prisma: db } = await import('@/lib/prisma');

  // Check if LiveQuote has any data for this exchange
  const exchangeFilter = exchange === 'Both' ? {} : { exchange };
  const count = await db.liveQuote.count({ where: exchangeFilter });

  if (count === 0) {
    // First load: blocking sync (user waits ~5-10s, but only once)
    console.log('[Sync:Engine] No data in LiveQuote — running initial sync...');
    await runSingleSync(exchange);
    return;
  }

  // Check staleness
  const latest = await db.liveQuote.findFirst({
    where: exchangeFilter,
    orderBy: { syncedAt: 'desc' },
    select: { syncedAt: true },
  });

  if (latest && Date.now() - new Date(latest.syncedAt).getTime() > 120_000) {
    // Stale data (>2 min): trigger background sync (don't block the response)
    // Normal freshness is handled by the cron endpoint every minute
    const state = getState();
    if (!state.syncLock) {
      console.log('[Sync:Engine] Data stale (>2min) — triggering background sync');
      runSingleSync(exchange).catch((e) => {
        console.error('[Sync:Engine] Background sync failed:', e instanceof Error ? e.message : e);
      });
    }
  }
}

/**
 * Get the current sync status for API responses.
 */
export function getSyncStatus() {
  const state = getState();
  const pop = getPopulationStatus();
  return {
    isRunning: state.syncLock,
    lastSyncAt: state.lastSyncAt > 0 ? new Date(state.lastSyncAt).toISOString() : null,
    historicalPopulating: pop.isPopulating,
    historicalProgress: pop.progress,
    cachedCount: pop.cachedCount,
  };
}
