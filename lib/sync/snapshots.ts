/**
 * Intraday price snapshot management.
 * Stores rolling 2.5-hour window of prices for 5min/15min/30min/1hr/2hr % changes.
 * Persists to PostgreSQL to survive Vercel cold starts.
 */

import { prisma } from '@/lib/prisma';
import { getState } from './state';
import type { DhanQuote } from './types';

const WINDOW_MS = 150 * 60 * 1000; // 2.5 hours
const DEDUP_MS = 15_000;            // Skip if snapshot stored < 15s ago
const CLEANUP_MS = 3 * 60 * 60 * 1000; // Clean DB snapshots older than 3hr

/**
 * Load recent snapshots from DB into memory on cold start.
 */
export async function ensureSnapshotsLoaded(): Promise<void> {
  const g = getState();
  if (g.priceSnapshots.length > 0) return;

  try {
    const cutoff = new Date(Date.now() - WINDOW_MS);
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
      g.priceSnapshots.push({ timestamp: new Date(doc.timestamp).getTime(), prices });
    }

    if (docs.length > 0) {
      console.log(`[Sync:Snap] Loaded ${docs.length} snapshots from DB (cold start)`);
    }
  } catch (e) {
    console.error('[Sync:Snap] Failed to load snapshots:', e);
  }
}

/**
 * Store a price snapshot from live quotes.
 * Saves to memory (instant access) AND PostgreSQL (survives cold starts).
 */
export function storeSnapshot(quotes: Map<number, DhanQuote>): boolean {
  const g = getState();
  const now = Date.now();

  // Deduplicate: skip if recent snapshot exists
  if (g.priceSnapshots.length > 0 && now - g.priceSnapshots[g.priceSnapshots.length - 1].timestamp < DEDUP_MS) {
    return false;
  }

  const prices = new Map<number, number>();
  for (const [id, q] of quotes.entries()) {
    if (q.last_price > 0) prices.set(id, q.last_price);
  }

  // Save to memory
  g.priceSnapshots.push({ timestamp: now, prices });

  // Trim memory: keep only last 2.5 hours
  const cutoff = now - WINDOW_MS;
  while (g.priceSnapshots.length > 0 && g.priceSnapshots[0].timestamp < cutoff) {
    g.priceSnapshots.shift();
  }

  // Persist to PostgreSQL (fire-and-forget)
  const pricesObj: Record<string, number> = {};
  for (const [id, p] of prices.entries()) {
    pricesObj[String(id)] = p;
  }
  prisma.priceSnapshot
    .create({ data: { timestamp: new Date(now), prices: pricesObj } })
    .then(() => {
      // Cleanup old snapshots
      prisma.priceSnapshot
        .deleteMany({ where: { timestamp: { lt: new Date(Date.now() - CLEANUP_MS) } } })
        .catch(() => {});
    })
    .catch(() => {});

  return true;
}

/**
 * Find the price of a stock from the snapshot closest to `minutesAgo`.
 * Uses binary search for efficiency (snapshots are sorted by timestamp).
 */
export function getSnapshotPrice(securityId: number, minutesAgo: number): number | null {
  const g = getState();
  if (g.priceSnapshots.length === 0) return null;

  const targetTs = Date.now() - minutesAgo * 60 * 1000;

  // Binary search for closest snapshot
  let lo = 0;
  let hi = g.priceSnapshots.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (g.priceSnapshots[mid].timestamp < targetTs) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  // Check lo and lo-1 for the closest match
  let bestIdx = lo;
  if (lo > 0) {
    const diffLo = Math.abs(g.priceSnapshots[lo].timestamp - targetTs);
    const diffPrev = Math.abs(g.priceSnapshots[lo - 1].timestamp - targetTs);
    if (diffPrev < diffLo) bestIdx = lo - 1;
  }

  const closest = g.priceSnapshots[bestIdx];
  const diff = Math.abs(closest.timestamp - targetTs);

  // Accept if within 2 minutes of target time
  if (diff > 120_000) return null;
  return closest.prices.get(securityId) ?? null;
}
