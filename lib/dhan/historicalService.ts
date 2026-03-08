import { prisma } from '@/lib/prisma';
import { fetchHistoricalBatch, QuoteData } from './marketData';
import getState from './globalState';
import { randomUUID } from 'crypto';

// -- Trading-day map --
const TD: Record<string, number> = {
  '1D': 1, '2D': 2, '3D': 3, '4D': 4, '5D': 5,
  '1W': 5, '2W': 10, '3W': 15, '4W': 20, '5W': 25,
  '1M': 22, '2M': 44, '3M': 66, '4M': 88, '5M': 110,
  '6M': 132, '7M': 154, '8M': 176, '9M': 198,
  '10M': 220, '11M': 242,
  '1Y': 252, '2Y': 504, '3Y': 756, '4Y': 1008, '5Y': 1260, '10Y': 2520,
};

function pct(cur: number, prev: number): number {
  if (!prev) return 0;
  return Math.round(((cur - prev) / prev) * 10000) / 100;
}

function ckey(id: number, seg: string): string {
  return `${seg}:${id}`;
}

/**
 * Load historical data from PostgreSQL into globalThis memory -- ONCE per segment.
 * Awaitable: concurrent callers share the same promise (no duplicate loads).
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
        console.log(`[Hist] Loaded ${docs.length} ${segment} records from DB`);
      } catch (e) {
        console.error(`[Hist] DB load error for ${segment}:`, e);
        g.historicalLoadPromise[segment] = null; // allow retry on failure
      }
    })();
  }

  await g.historicalLoadPromise[segment];
}

/**
 * Background-populate stocks that have no historical data yet.
 * Runs once, stores in PostgreSQL + globalThis memory.
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
  console.log(`[Hist] Background population: ${missing.length} stocks`);

  const now = new Date();
  const ago = new Date();
  ago.setFullYear(ago.getFullYear() - 10);

  fetchHistoricalBatch(
    missing.map((m) => ({ securityId: m.securityId, exchangeSegment: m.exchangeSegment as 'NSE_EQ' | 'BSE_EQ' })),
    ago.toISOString().split('T')[0],
    now.toISOString().split('T')[0],
    (id, seg, data) => {
      g.historicalMem.set(ckey(id, seg), { closes: data.close, timestamps: data.timestamp });
      // fire-and-forget DB persist using raw SQL upsert
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
      if (done % 200 === 0 || done === total) console.log(`[Hist] Population: ${done}/${total}`);
    }
  )
    .then(() => { g.isPopulating = false; console.log(`[Hist] Population complete (${g.historicalMem.size} total)`); })
    .catch(() => { g.isPopulating = false; });
}

/**
 * Daily sync: use live quotes to append today's close.
 * Zero Dhan historical API calls -- just uses data we already have.
 */
export async function syncDailyFromQuotes(
  quotes: Map<number, QuoteData>,
  segment: string
): Promise<void> {
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
      // Batch updates in a transaction
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
      console.log(`[Hist] Daily sync: ${updates.length} stocks updated for ${segment}`);
    } catch { /* ignore */ }
  }
}

/**
 * Load price snapshots from PostgreSQL into memory on cold start (Vercel serverless).
 * Returns immediately if snapshots already exist in memory.
 */
export async function ensureSnapshotsLoaded(): Promise<void> {
  const g = getState();
  if (g.priceSnapshots.length > 0) return;

  try {
    const cutoff = new Date(Date.now() - 150 * 60 * 1000);
    const docs = await prisma.priceSnapshot.findMany({
      where: { timestamp: { gte: cutoff } },
      orderBy: { timestamp: 'asc' },
    });

    for (const doc of docs) {
      const prices = new Map<number, number>();
      const raw = doc.prices as Record<string, number>;
      if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) {
          prices.set(parseInt(k), v);
        }
      }
      g.priceSnapshots.push({
        timestamp: new Date(doc.timestamp).getTime(),
        prices,
      });
    }

    if (docs.length > 0) {
      console.log(`[Snap] Loaded ${docs.length} price snapshots from DB (cold start recovery)`);
    }
  } catch (e) {
    console.error('[Snap] Failed to load snapshots:', e);
  }
}

/**
 * Store a price snapshot from live quotes. Called on every quote fetch.
 * Saves to memory (fast access) AND PostgreSQL (survives Vercel cold starts).
 * Keeps a rolling 2.5-hour window for intraday % change calculations.
 */
export function storeSnapshot(quotes: Map<number, QuoteData>): void {
  const g = getState();
  const now = Date.now();

  // Skip if we stored a snapshot less than 20s ago (avoid duplicates from cache hits)
  if (g.priceSnapshots.length > 0 && now - g.priceSnapshots[g.priceSnapshots.length - 1].timestamp < 20_000) {
    return;
  }

  const prices = new Map<number, number>();
  for (const [id, q] of quotes.entries()) {
    if (q.last_price > 0) prices.set(id, q.last_price);
  }

  // Save to memory
  g.priceSnapshots.push({ timestamp: now, prices });

  // Trim memory: keep only last 2.5 hours
  const cutoff = now - 150 * 60 * 1000;
  while (g.priceSnapshots.length > 0 && g.priceSnapshots[0].timestamp < cutoff) {
    g.priceSnapshots.shift();
  }

  // Persist to PostgreSQL (fire-and-forget -- survives cold starts)
  const pricesObj: Record<string, number> = {};
  for (const [id, p] of prices.entries()) {
    pricesObj[String(id)] = p;
  }
  prisma.priceSnapshot.create({
    data: { timestamp: new Date(now), prices: pricesObj },
  }).then(() => {
    // Cleanup old snapshots (replaces TTL index)
    prisma.priceSnapshot.deleteMany({
      where: { timestamp: { lt: new Date(Date.now() - 10800000) } },
    }).catch(() => {});
  }).catch(() => {});
}

/** Find the price of a stock from the snapshot closest to `minutesAgo`. */
function getSnapshotPrice(securityId: number, minutesAgo: number): number | null {
  const g = getState();
  const targetTs = Date.now() - minutesAgo * 60 * 1000;
  let closest: { timestamp: number; prices: Map<number, number> } | null = null;
  let closestDiff = Infinity;

  for (const snap of g.priceSnapshots) {
    const diff = Math.abs(snap.timestamp - targetTs);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = snap;
    }
  }

  // Accept if within 2 minutes of target time
  if (!closest || closestDiff > 120_000) return null;
  return closest.prices.get(securityId) ?? null;
}

// Intraday intervals: column name -> minutes ago
const INTRADAY: [string, number][] = [
  ['% 5Min Chag', 5],
  ['% 15Min Chag', 15],
  ['% 30Min Chag', 30],
  ['% 1Hour Chag', 60],
  ['% 2Hours Chag', 120],
];

/**
 * Calculate all % changes for a stock from in-memory historical data + price snapshots.
 */
export function calcChanges(
  securityId: number,
  segment: string,
  cmp: number,
  prevClose: number
): Record<string, number | null> {
  const ch: Record<string, number | null> = {};
  const dayPct = pct(cmp, prevClose);

  // Intraday: from real price snapshots (fills up as server runs)
  for (const [col, mins] of INTRADAY) {
    const oldPrice = getSnapshotPrice(securityId, mins);
    ch[col] = oldPrice != null ? pct(cmp, oldPrice) : null;
  }
  ch['% Chag'] = dayPct;

  const g = getState();
  const hist = g.historicalMem.get(ckey(securityId, segment));

  if (!hist || hist.closes.length === 0) {
    for (const p of Object.keys(TD)) if (p !== '1D') ch[`% ${p} Chag`] = null;
    ch['% Max Chag'] = null;
    ch['% Cust Date Chag'] = dayPct;
    ch['% YTD Chag'] = ch['% 2YTD Chag'] = ch['% 3YTD Chag'] = null;
    ch['% 4YTD Chag'] = ch['% 5YTD Chag'] = ch['% 10 YTD Chag'] = null;
    ch['% 52W Chag'] = ch['% ATH&L Chag'] = null;
    return ch;
  }

  const len = hist.closes.length;
  const at = (d: number) => (len - 1 - d >= 0 ? hist.closes[len - 1 - d] : null);

  for (const [col, period] of [
    ['% 2D Chag','2D'],['% 3D Chag','3D'],['% 4D Chag','4D'],['% 5D Chag','5D'],
    ['% 1W Chag','1W'],['% 2W Chag','2W'],['% 3W Chag','3W'],['% 4W Chag','4W'],['% 5W Chag','5W'],
    ['% 1M Chag','1M'],['% 2M Chag','2M'],['% 3M Chag','3M'],['% 4M Chag','4M'],['% 5M Chag','5M'],
    ['% 6M Chag','6M'],['% 7M Chag','7M'],['% 8M Chag','8M'],['% 9M Chag','9M'],
    ['% 10M Chag','10M'],['% 11M Chag','11M'],
    ['% 1Y Chag','1Y'],['% 2Y Chag','2Y'],['% 3Y Chag','3Y'],
    ['% 4Y Chag','4Y'],['% 5Y Chag','5Y'],['% 10Y Chag','10Y'],
  ] as [string, string][]) {
    const old = at(TD[period]);
    ch[col] = old != null ? pct(cmp, old) : null;
  }

  ch['% Max Chag'] = pct(cmp, hist.closes[0]);
  ch['% Cust Date Chag'] = dayPct;

  const now = new Date();
  for (const { col, yb } of [
    { col: '% YTD Chag', yb: 0 }, { col: '% 2YTD Chag', yb: 1 },
    { col: '% 3YTD Chag', yb: 2 }, { col: '% 4YTD Chag', yb: 3 },
    { col: '% 5YTD Chag', yb: 4 }, { col: '% 10 YTD Chag', yb: 9 },
  ]) {
    const start = new Date(now.getFullYear() - yb, 0, 1);
    const days = Math.round(((now.getTime() - start.getTime()) / 86400000) * (252 / 365));
    const old = at(days);
    ch[col] = old != null ? pct(cmp, old) : null;
  }

  const w52 = at(252);
  ch['% 52W Chag'] = w52 != null ? pct(cmp, w52) : null;

  let ath = -Infinity;
  for (let i = 0; i < hist.closes.length; i++) if (hist.closes[i] > ath) ath = hist.closes[i];
  ch['% ATH&L Chag'] = pct(cmp, ath);

  return ch;
}

export function getPopulationStatus() {
  const g = getState();
  return {
    isPopulating: g.isPopulating,
    progress: g.populationProgress,
    cachedCount: g.historicalMem.size,
  };
}
