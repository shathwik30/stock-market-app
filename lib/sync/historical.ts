/**
 * Historical price data management.
 * Loads from DB into memory on cold start, syncs daily from live quotes,
 * and populates missing stocks in the background.
 */

import { prisma } from '@/lib/prisma';
import { getState } from './state';
import { fetchHistoricalBatch } from './dhan-api';
import { randomUUID } from 'crypto';
import type { DhanQuote, Segment } from './types';

function ckey(id: number, seg: string): string {
  return `${seg}:${id}`;
}

/**
 * Load historical data from PostgreSQL into memory — ONCE per segment.
 * Concurrent callers share the same promise (no duplicate loads).
 */
export async function ensureHistoricalLoaded(segment: string): Promise<void> {
  const g = getState();
  if (g.historicalLoaded[segment]) return;

  if (!g.historicalLoadPromise[segment]) {
    g.historicalLoadPromise[segment] = (async () => {
      try {
        const docs = await prisma.historicalPrice.findMany({
          where: { exchangeSegment: segment },
          select: { securityId: true, exchangeSegment: true, closes: true, timestamps: true },
        });

        for (const d of docs) {
          g.historicalMem.set(ckey(d.securityId, d.exchangeSegment), {
            closes: d.closes,
            timestamps: d.timestamps,
          });
        }

        g.historicalLoaded[segment] = true;
        console.log(`[Sync:Hist] Loaded ${docs.length} ${segment} records from DB`);
      } catch (e) {
        console.error(`[Sync:Hist] DB load error for ${segment}:`, e);
        g.historicalLoadPromise[segment] = null;
      }
    })();
  }

  await g.historicalLoadPromise[segment];
}

/**
 * Daily sync: append today's close from live quotes. Zero Dhan historical API calls.
 */
export async function syncDailyFromQuotes(
  quotes: Map<number, DhanQuote>,
  segment: string
): Promise<number> {
  const g = getState();
  const updates: { securityId: number; segment: string; close: number; ts: number; tradeDate: string }[] = [];

  for (const [id, q] of quotes.entries()) {
    const key = ckey(id, segment);
    const hist = g.historicalMem.get(key);
    if (!hist || hist.closes.length === 0) continue;

    const ltt = q.last_trade_time;
    if (!ltt) continue;
    const parts = ltt.split(' ')[0]?.split('/');
    if (!parts || parts.length !== 3) continue;
    const tradeDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

    const lastTs = hist.timestamps[hist.timestamps.length - 1];
    const lastStr = lastTs ? new Date(lastTs * 1000).toISOString().split('T')[0] : '';
    if (tradeDate <= lastStr) continue;

    const ts = Math.floor(new Date(tradeDate).getTime() / 1000);
    hist.closes.push(q.last_price);
    hist.timestamps.push(ts);

    updates.push({ securityId: id, segment, close: q.last_price, ts, tradeDate });
  }

  if (updates.length > 0) {
    try {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.$executeRawUnsafe(
            `UPDATE "HistoricalPrice"
             SET closes = array_cat(closes, ARRAY[$1::double precision]),
                 timestamps = array_cat(timestamps, ARRAY[$2::double precision]),
                 "lastDate" = $3,
                 "updatedAt" = NOW()
             WHERE "securityId" = $4 AND "exchangeSegment" = $5`,
            u.close, u.ts, u.tradeDate, u.securityId, u.segment
          )
        )
      );
      console.log(`[Sync:Hist] Daily sync: ${updates.length} stocks updated for ${segment}`);
    } catch { /* non-critical */ }
  }

  return updates.length;
}

/**
 * Background-populate stocks that have no historical data yet.
 * Fetches 10-year history from Dhan API at 5 stocks/sec.
 */
export function startPopulation(
  items: { securityId: number; exchangeSegment: string }[]
): void {
  const g = getState();
  if (g.isPopulating) return;

  const missing = items.filter((i) => !g.historicalMem.has(ckey(i.securityId, i.exchangeSegment)));
  if (missing.length === 0) return;

  g.isPopulating = true;
  g.populationProgress = { completed: 0, total: missing.length };
  console.log(`[Sync:Hist] Background population: ${missing.length} stocks`);

  const now = new Date();
  const ago = new Date();
  ago.setFullYear(ago.getFullYear() - 10);

  fetchHistoricalBatch(
    missing.map((m) => ({
      securityId: m.securityId,
      exchangeSegment: m.exchangeSegment as Segment,
    })),
    ago.toISOString().split('T')[0],
    now.toISOString().split('T')[0],
    (id, seg, data) => {
      g.historicalMem.set(ckey(id, seg), { closes: data.close, timestamps: data.timestamp });
      const uuid = randomUUID();
      prisma.$executeRawUnsafe(
        `INSERT INTO "HistoricalPrice" (id, "securityId", "exchangeSegment", closes, timestamps, "lastDate", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4::double precision[], $5::double precision[], $6, NOW(), NOW())
         ON CONFLICT ("securityId", "exchangeSegment") DO UPDATE SET
           closes = $4::double precision[],
           timestamps = $5::double precision[],
           "lastDate" = $6,
           "updatedAt" = NOW()`,
        uuid, id, seg, data.close, data.timestamp, now.toISOString().split('T')[0]
      ).catch(() => {});
    },
    (done, total) => {
      g.populationProgress = { completed: done, total };
      if (done % 200 === 0 || done === total) {
        console.log(`[Sync:Hist] Population: ${done}/${total}`);
      }
    }
  )
    .then(() => {
      g.isPopulating = false;
      console.log(`[Sync:Hist] Population complete (${g.historicalMem.size} total)`);
    })
    .catch(() => {
      g.isPopulating = false;
    });
}

export function getPopulationStatus() {
  const g = getState();
  return {
    isPopulating: g.isPopulating,
    progress: g.populationProgress,
    cachedCount: g.historicalMem.size,
  };
}
