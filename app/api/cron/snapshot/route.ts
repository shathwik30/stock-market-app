/**
 * GET /api/cron/snapshot
 *
 * Cron endpoint — runs the sync engine in a LOOP for maximum data freshness.
 * During a 55-second window, it cycles through:
 *   - NSE quotes → compute → write (every cycle)
 *   - BSE quotes → compute → write (every 3rd cycle)
 *
 * Result: ~8-10 NSE refreshes per minute, ~3 BSE refreshes per minute.
 * Each refresh writes to LiveQuote + MarketStats — API routes serve instantly.
 *
 * SETUP:
 *   Vercel Cron (Pro): add to vercel.json, 1-minute interval
 *   External: cron-job.org / UptimeRobot, ping every 1 minute
 *   URL: https://your-app.vercel.app/api/cron/snapshot?secret=YOUR_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { runSyncLoop } from '@/lib/sync/engine';

const CRON_SECRET = process.env.CRON_SECRET || '';

// Vercel Pro: allow up to 60s for the sync loop
export const maxDuration = 60;

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
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  const hhmm = ist.getUTCHours() * 100 + ist.getUTCMinutes();

  if (day === 0 || day === 6 || hhmm < 914 || hhmm > 1535) {
    return NextResponse.json({ skipped: true, reason: 'Outside market hours' });
  }

  try {
    // Run sync loop for up to 55 seconds (5s buffer before cron timeout)
    const { cycles, results } = await runSyncLoop(55_000);

    const totalQuotes = results.reduce((sum, r) => sum + r.quotesUpdated, 0);
    const elapsed = Date.now() - t0;

    return NextResponse.json({
      ok: true,
      cycles,
      totalQuotesWritten: totalQuotes,
      elapsed: `${elapsed}ms`,
      avgCycleMs: cycles > 0 ? Math.round(elapsed / cycles) : 0,
      results: results.map((r) => ({
        cycle: r.cycle,
        quotes: r.quotesUpdated,
        elapsed: `${r.elapsed}ms`,
      })),
    });
  } catch (error) {
    console.error('[Cron] Sync loop error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
