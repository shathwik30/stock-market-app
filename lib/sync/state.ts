/**
 * In-memory state that survives Next.js HMR / module reloads.
 * Only holds data that MUST be in memory (too large or too hot for per-request DB reads).
 */

import type { PriceSnapshot } from './types';

interface SyncState {
  // Historical closes/timestamps (loaded from DB once, kept in memory for fast % change computation)
  historicalMem: Map<string, { closes: number[]; timestamps: number[] }>;
  historicalLoaded: Record<string, boolean>;
  historicalLoadPromise: Record<string, Promise<void> | null>;

  // Rolling price snapshots for intraday % changes (2.5hr window)
  priceSnapshots: PriceSnapshot[];

  // Sync coordination
  syncLock: boolean;
  lastSyncAt: number;

  // Historical population tracking
  isPopulating: boolean;
  populationProgress: { completed: number; total: number };

  // Dhan API rate limiter
  lastApiCall: number;
}

const KEY = '__sync_state_v2__';

export function getState(): SyncState {
  if (!(globalThis as Record<string, unknown>)[KEY]) {
    (globalThis as Record<string, unknown>)[KEY] = {
      historicalMem: new Map(),
      historicalLoaded: {},
      historicalLoadPromise: {},
      priceSnapshots: [],
      syncLock: false,
      lastSyncAt: 0,
      isPopulating: false,
      populationProgress: { completed: 0, total: 0 },
      lastApiCall: 0,
    } satisfies SyncState;
  }
  return (globalThis as Record<string, unknown>)[KEY] as SyncState;
}
