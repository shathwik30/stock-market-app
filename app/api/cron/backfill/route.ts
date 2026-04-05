/**
 * GET /api/cron/backfill
 *
 * One-time historical data backfill endpoint.
 * Fetches 10-year daily close history from Dhan API for stocks
 * missing historical data in the database.
 *
 * Call repeatedly (e.g. every 1 min from Google Apps Script) until
 * the response shows done: true. Runs OUTSIDE market hours too —
 * historical data is always available from Dhan.
 *
 * After backfill is complete, call /api/cron/snapshot?secret=XXX&forceReload=true
 * to make the sync engine reload historical data from DB.
 *
 * Query params:
 *   secret = CRON_SECRET for auth
 *   batch  = stocks per invocation (default: 30, max: 50)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';

const CRON_SECRET = process.env.CRON_SECRET || '';
export const maxDuration = 10;

const DHAN_BASE = 'https://api.dhan.co/v2';
const CONCURRENT = 5;
const MIN_DATA_POINTS = 10; // Stocks with fewer points are considered "needing backfill"
const BUDGET_MS = 7500; // Leave 2.5s for cold start + response overhead

let _api: AxiosInstance | null = null;
function getApi(): AxiosInstance {
  if (!_api) {
    _api = axios.create({
      baseURL: DHAN_BASE,
      headers: {
        'access-token': process.env.DHAN_ACCESS_TOKEN || '',
        'client-id': process.env.DHAN_CLIENT_ID || '',
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
  }
  return _api;
}

export async function GET(request: NextRequest) {
  const t0 = Date.now();

  // Auth
  const secret = request.nextUrl.searchParams.get('secret');
  const authHeader = request.headers.get('authorization');
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (CRON_SECRET && secret !== CRON_SECRET && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchSize = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get('batch') || '30')));

  try {
    // Find stocks needing historical backfill:
    //   - No HistoricalPrice row at all
    //   - Row with < MIN_DATA_POINTS closes (stubs from daily sync)
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
      LIMIT ${batchSize}
    `);

    // Total remaining + total stocks (for progress display)
    const [[{ remaining: remainingCount }], [{ total: totalCount }]] = await Promise.all([
      prisma.$queryRawUnsafe<[{ remaining: bigint }]>(`
        SELECT COUNT(*)::bigint AS remaining
        FROM "StockMaster" sm
        LEFT JOIN "HistoricalPrice" hp
          ON sm."securityId" = hp."securityId"
          AND sm."exchangeSegment" = hp."exchangeSegment"
        WHERE hp.id IS NULL
           OR array_length(hp.closes, 1) IS NULL
           OR array_length(hp.closes, 1) < ${MIN_DATA_POINTS}
      `),
      prisma.$queryRawUnsafe<[{ total: bigint }]>(
        `SELECT COUNT(*)::bigint AS total FROM "StockMaster"`
      ),
    ]);

    const remaining = Number(remainingCount);
    const totalStocks = Number(totalCount);
    const completed = totalStocks - remaining;

    if (needBackfill.length === 0) {
      return NextResponse.json({
        ok: true,
        done: true,
        message: 'All stocks have historical data! Call /api/cron/snapshot?secret=XXX&forceReload=true to reload.',
        completed,
        totalStocks,
        remaining: 0,
        elapsed: `${Date.now() - t0}ms`,
      });
    }

    // 10-year date range
    const now = new Date();
    const ago = new Date();
    ago.setFullYear(ago.getFullYear() - 10);
    const fromDate = ago.toISOString().split('T')[0];
    const toDate = now.toISOString().split('T')[0];

    const api = getApi();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let noData = 0;

    for (let i = 0; i < needBackfill.length; i += CONCURRENT) {
      if (Date.now() - t0 > BUDGET_MS) break;

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
                points: resp.data.close.length,
              };
            }
            return { securityId, exchangeSegment, closes: null, timestamps: null, points: 0 };
          } catch (e) {
            console.error(`[Backfill] API error ${securityId}/${exchangeSegment}:`, e instanceof Error ? e.message : '');
            return null;
          }
        })
      );

      for (const r of results) {
        processed++;

        if (r.status !== 'fulfilled' || !r.value) {
          failed++;
          continue;
        }

        const { securityId, exchangeSegment, closes, timestamps, points } = r.value;

        if (!closes || points === 0) {
          // Dhan has no historical data for this stock — create a marker stub
          // so it's not retried forever (10 empty points to exceed threshold)
          try {
            const markerCloses = new Array(MIN_DATA_POINTS).fill(0);
            const markerTimestamps = new Array(MIN_DATA_POINTS).fill(0);
            const uuid = randomUUID();
            await prisma.$executeRawUnsafe(
              `INSERT INTO "HistoricalPrice" (id, "securityId", "exchangeSegment", closes, timestamps, "lastDate", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4::double precision[], $5::double precision[], 'NO_DATA', NOW(), NOW())
               ON CONFLICT ("securityId", "exchangeSegment") DO NOTHING`,
              uuid, securityId, exchangeSegment, markerCloses, markerTimestamps
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
          const uuid = randomUUID();
          await prisma.$executeRawUnsafe(
            `INSERT INTO "HistoricalPrice" (id, "securityId", "exchangeSegment", closes, timestamps, "lastDate", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4::double precision[], $5::double precision[], $6, NOW(), NOW())
             ON CONFLICT ("securityId", "exchangeSegment") DO UPDATE SET
               closes = $4::double precision[],
               timestamps = $5::double precision[],
               "lastDate" = $6,
               "updatedAt" = NOW()`,
            uuid, securityId, exchangeSegment, closes, timestamps, lastDate
          );
          succeeded++;
        } catch (e) {
          console.error(`[Backfill] DB write error ${securityId}:`, e instanceof Error ? e.message : '');
          failed++;
        }
      }

      // Brief pause between concurrent batches to respect rate limits
      if (i + CONCURRENT < needBackfill.length && Date.now() - t0 < BUDGET_MS) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    const elapsed = Date.now() - t0;
    const newRemaining = remaining - succeeded - noData;

    console.log(
      `[Backfill] ${succeeded} backfilled, ${noData} no-data, ${failed} failed ` +
        `(${newRemaining} remaining of ${totalStocks}) in ${elapsed}ms`
    );

    return NextResponse.json({
      ok: true,
      done: newRemaining <= 0,
      processed,
      succeeded,
      noData,
      failed,
      remaining: Math.max(0, newRemaining),
      completed: completed + succeeded + noData,
      totalStocks,
      elapsed: `${elapsed}ms`,
    });
  } catch (error) {
    console.error('[Backfill] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
