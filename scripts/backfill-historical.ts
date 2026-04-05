/**
 * One-time historical data backfill script.
 *
 * Fetches 10-year daily close history from Dhan API for ALL stocks
 * in the database and writes to the HistoricalPrice table.
 *
 * Run locally (no Vercel timeouts):
 *   npx tsx scripts/backfill-historical.ts
 *
 * Takes ~15-25 minutes for ~8000 stocks.
 * Safe to re-run — skips stocks that already have data.
 * Safe to Ctrl+C — progress is saved per-stock.
 */

import 'dotenv/config';
import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';

// ── Config ──
const CONCURRENT = 5;        // Parallel Dhan API requests
const DELAY_MS = 400;         // Delay between batches (rate limit safety)
const MIN_DATA_POINTS = 10;   // Stocks with fewer points need backfill
const API_TIMEOUT = 8000;     // Per-request timeout

// ── Setup ──
const DATABASE_URL = process.env.DATABASE_URL;
const DHAN_TOKEN = process.env.DHAN_ACCESS_TOKEN;
const DHAN_CLIENT = process.env.DHAN_CLIENT_ID;

if (!DATABASE_URL) { console.error('Missing DATABASE_URL in .env'); process.exit(1); }
if (!DHAN_TOKEN) { console.error('Missing DHAN_ACCESS_TOKEN in .env'); process.exit(1); }
if (!DHAN_CLIENT) { console.error('Missing DHAN_CLIENT_ID in .env'); process.exit(1); }

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter }) as unknown as PrismaClient;

const api: AxiosInstance = axios.create({
  baseURL: 'https://api.dhan.co/v2',
  headers: {
    'access-token': DHAN_TOKEN,
    'client-id': DHAN_CLIENT,
    'Content-Type': 'application/json',
  },
  timeout: API_TIMEOUT,
});

// ── Graceful shutdown ──
let stopped = false;
process.on('SIGINT', () => {
  console.log('\n\nStopping gracefully (finishing current batch)...');
  stopped = true;
});

// ── Progress display ──
function progress(done: number, total: number, ok: number, fail: number, noData: number, startMs: number) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(0);
  const rate = done > 0 ? (done / ((Date.now() - startMs) / 1000)).toFixed(1) : '0';
  const eta = done > 0 ? Math.round(((total - done) / (done / ((Date.now() - startMs) / 1000)))).toString() : '?';

  process.stdout.write(
    `\r  [${pct.toString().padStart(3)}%] ${done}/${total} | ` +
    `${ok} ok, ${fail} failed, ${noData} no-data | ` +
    `${rate}/s | ${elapsed}s elapsed, ~${eta}s left   `
  );
}

// ── Main ──
async function main() {
  console.log('');
  console.log('  ========================================');
  console.log('  Historical Data Backfill (10-year)');
  console.log('  ========================================');
  console.log('');

  // 1. Find stocks needing backfill
  console.log('  Finding stocks that need historical data...');

  const needBackfill = await prisma.$queryRawUnsafe<Array<{
    securityId: number;
    exchangeSegment: string;
    currentPoints: number;
  }>>(`
    SELECT sm."securityId", sm."exchangeSegment",
           COALESCE(array_length(hp.closes, 1), 0)::int AS "currentPoints"
    FROM "StockMaster" sm
    LEFT JOIN "HistoricalPrice" hp
      ON sm."securityId" = hp."securityId"
      AND sm."exchangeSegment" = hp."exchangeSegment"
    WHERE hp.id IS NULL
       OR array_length(hp.closes, 1) IS NULL
       OR array_length(hp.closes, 1) < ${MIN_DATA_POINTS}
    ORDER BY sm.exchange ASC, sm."securityId" ASC
  `);

  const [{ total: totalCount }] = await prisma.$queryRawUnsafe<[{ total: bigint }]>(
    `SELECT COUNT(*)::bigint AS total FROM "StockMaster"`
  );
  const totalStocks = Number(totalCount);
  const alreadyDone = totalStocks - needBackfill.length;

  console.log(`  Total stocks in DB:      ${totalStocks}`);
  console.log(`  Already have history:    ${alreadyDone}`);
  console.log(`  Need backfill:           ${needBackfill.length}`);
  console.log('');

  if (needBackfill.length === 0) {
    console.log('  All stocks already have historical data!');
    await prisma.$disconnect();
    return;
  }

  // 2. Calculate date range (10 years back)
  const now = new Date();
  const ago = new Date();
  ago.setFullYear(ago.getFullYear() - 10);
  const fromDate = ago.toISOString().split('T')[0];
  const toDate = now.toISOString().split('T')[0];

  console.log(`  Date range: ${fromDate} to ${toDate}`);
  console.log(`  Concurrency: ${CONCURRENT} | Delay: ${DELAY_MS}ms`);
  console.log('  Press Ctrl+C to stop (progress is saved).');
  console.log('');

  const startMs = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let noData = 0;

  // 3. Process in concurrent batches
  for (let i = 0; i < needBackfill.length && !stopped; i += CONCURRENT) {
    const batch = needBackfill.slice(i, i + CONCURRENT);

    const results = await Promise.allSettled(
      batch.map(async ({ securityId, exchangeSegment }) => {
        try {
          const resp = await api.post('/charts/historical', {
            securityId: String(securityId),
            exchangeSegment,
            instrument: 'EQUITY',
            expiryCode: 0,
            fromDate,
            toDate,
          });

          if (resp.data?.close?.length > 0 && resp.data?.timestamp?.length > 0) {
            return {
              securityId,
              exchangeSegment,
              closes: resp.data.close as number[],
              timestamps: resp.data.timestamp as number[],
            };
          }
          return { securityId, exchangeSegment, closes: null, timestamps: null };
        } catch {
          return null; // API error
        }
      })
    );

    // Write results to DB
    for (const r of results) {
      processed++;

      if (r.status !== 'fulfilled' || !r.value) {
        failed++;
        continue;
      }

      const { securityId, exchangeSegment, closes, timestamps } = r.value;

      if (!closes || closes.length === 0) {
        // Dhan has no data — insert a marker so we don't retry
        try {
          const marker = new Array(MIN_DATA_POINTS).fill(0);
          await prisma.$executeRawUnsafe(
            `INSERT INTO "HistoricalPrice" (id, "securityId", "exchangeSegment", closes, timestamps, "lastDate", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4::double precision[], $5::double precision[], 'NO_DATA', NOW(), NOW())
             ON CONFLICT ("securityId", "exchangeSegment") DO NOTHING`,
            randomUUID(), securityId, exchangeSegment, marker, marker
          );
        } catch {}
        noData++;
        continue;
      }

      // Write full historical data
      const lastDate = new Date(timestamps[timestamps.length - 1] * 1000)
        .toISOString()
        .split('T')[0];

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "HistoricalPrice" (id, "securityId", "exchangeSegment", closes, timestamps, "lastDate", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4::double precision[], $5::double precision[], $6, NOW(), NOW())
           ON CONFLICT ("securityId", "exchangeSegment") DO UPDATE SET
             closes = $4::double precision[],
             timestamps = $5::double precision[],
             "lastDate" = $6,
             "updatedAt" = NOW()`,
          randomUUID(), securityId, exchangeSegment, closes, timestamps, lastDate
        );
        succeeded++;
      } catch (e) {
        failed++;
      }
    }

    progress(processed, needBackfill.length, succeeded, failed, noData, startMs);

    // Rate limit pause
    if (i + CONCURRENT < needBackfill.length && !stopped) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // 4. Summary
  const totalSec = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log('\n');
  console.log('  ========================================');
  console.log('  Backfill Summary');
  console.log('  ========================================');
  console.log(`  Processed:   ${processed}`);
  console.log(`  Succeeded:   ${succeeded} (with historical data)`);
  console.log(`  No data:     ${noData} (Dhan has no history)`);
  console.log(`  Failed:      ${failed} (API/DB errors)`);
  console.log(`  Time:        ${totalSec}s`);
  console.log('');

  if (stopped) {
    console.log('  Stopped early. Re-run to continue from where you left off.');
  } else if (failed > 0) {
    console.log('  Some stocks failed. Re-run to retry them.');
  } else {
    console.log('  All done! Now deploy to Vercel so the sync engine picks up the new data.');
    console.log('  Or call: GET /api/cron/snapshot?secret=YOUR_SECRET&forceReload=true');
  }

  console.log('');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('\nFatal error:', e);
  process.exit(1);
});
