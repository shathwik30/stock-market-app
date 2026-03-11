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
import { startEnrichment } from '@/lib/dhan/stockEnrichment';
import { ensureHistoricalLoaded, syncDailyFromQuotes, startPopulation, getPopulationStatus } from './historical';
import { ensureSnapshotsLoaded, storeSnapshot } from './snapshots';
import { writeLiveQuotes, writeMarketStats } from './writer';
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

  // 6. Daily close sync (fire-and-forget per segment)
  for (const seg of segments) {
    const segQuotes = new Map<number, DhanQuote>();
    for (const s of stocks.filter((st) => st.exchangeSegment === seg)) {
      const q = allQuotes.get(s.securityId);
      if (q) segQuotes.set(s.securityId, q);
    }
    syncDailyFromQuotes(segQuotes, seg).catch(() => {});
  }

  // 7. Compute all % changes + write to LiveQuote table (the core of the redesign)
  const computed = await writeLiveQuotes(stocks, allQuotes);

  // 8. Write pre-computed market stats
  //    For "Both" mode, also write individual exchange stats
  await writeMarketStats(exchange, computed);
  if (exchange === 'Both') {
    const nseComputed = computed.filter((c) => c.stock.exchange === 'NSE');
    const bseComputed = computed.filter((c) => c.stock.exchange === 'BSE');
    if (nseComputed.length > 0) await writeMarketStats('NSE', nseComputed);
    if (bseComputed.length > 0) await writeMarketStats('BSE', bseComputed);
  }

  // 9. Trigger background jobs (non-blocking)
  startPopulation(stocks.map((s) => ({ securityId: s.securityId, exchangeSegment: s.exchangeSegment })));
  startEnrichment(50).catch(() => {});

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
 * Run sync in a LOOP until the deadline.
 * Designed for cron endpoints: maximizes the number of refresh cycles
 * within the allowed execution time (typically 55s of a 60s cron window).
 *
 * NSE is synced every cycle. BSE every 3rd cycle (less critical).
 */
export async function runSyncLoop(
  maxDurationMs: number = 55_000
): Promise<{ cycles: number; results: SyncResult[] }> {
  const state = getState();

  // Prevent concurrent sync loops
  if (state.syncLock) {
    console.log('[Sync:Engine] Sync already running, skipping');
    return { cycles: 0, results: [] };
  }
  state.syncLock = true;

  const deadline = Date.now() + maxDurationMs;
  const results: SyncResult[] = [];
  let cycle = 0;

  try {
    while (Date.now() < deadline - 6000) { // 6s buffer for safety
      // Always sync NSE (primary exchange)
      const nseResult = await runSingleSync('NSE');
      nseResult.cycle = ++cycle;
      results.push(nseResult);

      // Sync BSE every 2nd cycle (maximized — 1 req/sec is the hard cap)
      if (cycle % 2 === 0 && Date.now() < deadline - 8000) {
        const bseResult = await runSingleSync('BSE');
        bseResult.cycle = cycle;
        results.push(bseResult);
      }

      // Brief pause between cycles
      if (Date.now() < deadline - 6000) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  } catch (e) {
    console.error('[Sync:Engine] Loop error:', e instanceof Error ? e.message : e);
  } finally {
    state.syncLock = false;
  }

  console.log(`[Sync:Engine] Loop finished: ${cycle} cycles in ${maxDurationMs}ms window`);
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

  if (latest && Date.now() - new Date(latest.syncedAt).getTime() > 60_000) {
    // Stale data: trigger background sync (don't block the response)
    const state = getState();
    if (!state.syncLock) {
      console.log('[Sync:Engine] Data stale — triggering background sync');
      runSingleSync(exchange).catch(() => {});
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
