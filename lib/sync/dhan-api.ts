/**
 * Dhan API client — optimized for maximum throughput within rate limits.
 * No caching here; the DB is our cache. Every call hits the real API.
 */

import axios, { AxiosInstance } from 'axios';
import { getState } from './state';
import type { DhanQuote, Segment, HistoricalData } from './types';

const DHAN_BASE = 'https://api.dhan.co/v2';
const MIN_INTERVAL_MS = 1000; // 1s between quote calls (maximized from old 1.2s)
const BATCH_SIZE = 1000;      // Max security IDs per quote request

let _api: AxiosInstance | null = null;
function api(): AxiosInstance {
  if (!_api) {
    _api = axios.create({
      baseURL: DHAN_BASE,
      headers: {
        'access-token': process.env.DHAN_ACCESS_TOKEN || '',
        'client-id': process.env.DHAN_CLIENT_ID || '',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }
  return _api;
}

/** Wait until rate limit window allows the next call. */
async function rateLimit(): Promise<void> {
  const s = getState();
  const wait = Math.max(0, s.lastApiCall + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  s.lastApiCall = Date.now();
}

/**
 * Fetch live quotes for ALL securities in a segment.
 * Batches into groups of 1000, rate-limited at 1 call/sec.
 * Returns raw quotes — no caching, no transformation.
 */
export async function fetchQuotes(
  segment: Segment,
  securityIds: number[]
): Promise<Map<number, DhanQuote>> {
  const result = new Map<number, DhanQuote>();

  for (let i = 0; i < securityIds.length; i += BATCH_SIZE) {
    const batch = securityIds.slice(i, i + BATCH_SIZE);
    try {
      await rateLimit();
      const resp = await api().post('/marketfeed/quote', { [segment]: batch });
      if (resp.data?.status === 'success' && resp.data?.data?.[segment]) {
        for (const [id, quote] of Object.entries(resp.data.data[segment])) {
          result.set(parseInt(id), quote as DhanQuote);
        }
      }
    } catch (e) {
      console.error(
        `[Sync:API] ${segment} batch ${Math.floor(i / BATCH_SIZE) + 1} error:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  return result;
}

/**
 * Fetch historical daily OHLC data for a single security.
 */
export async function fetchHistorical(
  securityId: number,
  exchangeSegment: Segment,
  fromDate: string,
  toDate: string
): Promise<HistoricalData | null> {
  try {
    const resp = await api().post('/charts/historical', {
      securityId: String(securityId),
      exchangeSegment,
      instrument: 'EQUITY',
      expiryCode: 0,
      fromDate,
      toDate,
    });
    if (resp.data?.close && resp.data?.timestamp) {
      return { close: resp.data.close, timestamp: resp.data.timestamp };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Batch-fetch historical data with 5/sec concurrency limit.
 */
export async function fetchHistoricalBatch(
  items: { securityId: number; exchangeSegment: Segment }[],
  fromDate: string,
  toDate: string,
  onData?: (id: number, seg: Segment, data: HistoricalData) => void,
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  const CONCURRENT = 5;
  for (let i = 0; i < items.length; i += CONCURRENT) {
    const batch = items.slice(i, i + CONCURRENT);
    const results = await Promise.all(
      batch.map(async ({ securityId, exchangeSegment }) => ({
        securityId,
        exchangeSegment,
        data: await fetchHistorical(securityId, exchangeSegment, fromDate, toDate),
      }))
    );
    for (const { securityId, exchangeSegment, data } of results) {
      if (data) onData?.(securityId, exchangeSegment, data);
    }
    onProgress?.(Math.min(i + CONCURRENT, items.length), items.length);
    if (i + CONCURRENT < items.length) {
      await new Promise((r) => setTimeout(r, 1050));
    }
  }
}
