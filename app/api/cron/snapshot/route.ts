import { NextRequest, NextResponse } from 'next/server';
import { getQuotesForSegment, QuoteData } from '@/lib/dhan/marketData';
import { getScripMaster } from '@/lib/dhan/scripMaster';
import {
  ensureHistoricalLoaded,
  ensureSnapshotsLoaded,
  storeSnapshot,
  syncDailyFromQuotes,
  startPopulation,
} from '@/lib/dhan/historicalService';

const CRON_SECRET = process.env.CRON_SECRET || '';

// Vercel Pro: allow up to 60s for cold starts
export const maxDuration = 60;

/**
 * Lightweight cron endpoint — fetches NSE quotes, stores price snapshots,
 * syncs daily closes, and triggers background historical population.
 *
 * HOW INTRADAY % CHANGES WORK:
 * - Each call stores a price snapshot (timestamp + all stock prices)
 * - Snapshots accumulate in DB over the trading day
 * - When calcChanges() needs "5min ago" price, it finds the snapshot
 *   closest to 5 minutes ago and reads that stock's price
 * - So: more frequent calls = more accurate intraday % changes
 * - Ideal: 1 call/minute = snapshots every minute = accurate 5min/15min/30min/1hr/2hr changes
 *
 * SETUP OPTIONS:
 * 1. Vercel Cron (Pro plan): add to vercel.json, minimum 1-minute interval
 * 2. External service (free): cron-job.org, UptimeRobot — ping every 1 minute
 *    URL: https://your-app.vercel.app/api/cron/snapshot?secret=YOUR_SECRET
 *
 * NSE only for speed (~2-3s). BSE handled by /api/market/live when users request it.
 */
export async function GET(request: NextRequest) {
  const t0 = Date.now();

  // Auth: accept CRON_SECRET from query param OR Vercel's cron authorization header
  const secret = request.nextUrl.searchParams.get('secret');
  const authHeader = request.headers.get('authorization');
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (CRON_SECRET && secret !== CRON_SECRET && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if within Indian market hours (9:14 AM - 3:35 PM IST, Mon-Fri)
  // Start 1 min early to capture pre-open snapshot
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  const hhmm = ist.getUTCHours() * 100 + ist.getUTCMinutes();

  if (day === 0 || day === 6 || hhmm < 914 || hhmm > 1535) {
    return NextResponse.json({ skipped: true, reason: 'Outside market hours' });
  }

  try {
    // 1. Load scrip master (cached in-memory 1hr, DB 24hr)
    const stocks = await getScripMaster('NSE');
    const ids = stocks.map((s) => s.securityId);

    // 2. All 3 in parallel: historical load + snapshot recovery + quote fetch
    const [, , quotes] = await Promise.all([
      ensureHistoricalLoaded('NSE_EQ'),
      ensureSnapshotsLoaded(),
      getQuotesForSegment('NSE_EQ', ids),
    ]);

    // 3. Store snapshot (memory + DB, deduplicates if < 20s since last)
    storeSnapshot(quotes);

    // 4. Daily sync — append today's close (fire-and-forget)
    syncDailyFromQuotes(quotes, 'NSE_EQ').catch(() => {});

    // 5. Background populate missing historical data (fire-and-forget)
    startPopulation(stocks.map((s) => ({ securityId: s.securityId, exchangeSegment: s.exchangeSegment })));

    const elapsed = Date.now() - t0;

    return NextResponse.json({
      ok: true,
      stocks: quotes.size,
      elapsed: `${elapsed}ms`,
      snapshot: now.toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Snapshot error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
