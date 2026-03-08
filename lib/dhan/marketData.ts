import axios, { AxiosInstance } from 'axios';
import getState from './globalState';

const DHAN_BASE_URL = 'https://api.dhan.co/v2';

let _api: AxiosInstance | null = null;
function api(): AxiosInstance {
  if (!_api) {
    _api = axios.create({
      baseURL: DHAN_BASE_URL,
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

export interface QuoteData {
  last_price: number;
  ohlc: { open: number; close: number; high: number; low: number };
  net_change: number;
  volume: number;
  upper_circuit_limit: number;
  lower_circuit_limit: number;
  '52_week_high'?: number;
  '52_week_low'?: number;
  last_trade_time?: string;
}

export interface HistoricalData {
  close: number[];
  timestamp: number[];
}

type Segment = 'NSE_EQ' | 'BSE_EQ';

// -- Global rate limiter: max 1 Dhan quote call per 1.2s --
async function rateLimitedCall<T>(fn: () => Promise<T>): Promise<T> {
  const state = getState();
  const now = Date.now();
  const wait = Math.max(0, state.lastApiCall + 1200 - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  state.lastApiCall = Date.now();
  return fn();
}

const QUOTE_CACHE_TTL = 30_000; // 30s during market hours

/**
 * Fetch full quotes for a SINGLE segment. Results are cached globally.
 * Returns cached data if fresh enough — no API call needed.
 */
export async function getQuotesForSegment(
  segment: Segment,
  securityIds: number[]
): Promise<Map<number, QuoteData>> {
  const state = getState();

  // Return cached if fresh
  const cached = state.quoteCache[segment];
  if (cached && Date.now() - cached.timestamp < QUOTE_CACHE_TTL) {
    return cached.quotes;
  }

  // Fetch from Dhan in batches of 1000
  const result = new Map<number, QuoteData>();
  const batches: number[][] = [];
  for (let i = 0; i < securityIds.length; i += 1000) {
    batches.push(securityIds.slice(i, i + 1000));
  }

  for (let b = 0; b < batches.length; b++) {
    try {
      const data = await rateLimitedCall(async () => {
        const resp = await api().post('/marketfeed/quote', {
          [segment]: batches[b],
        });
        return resp.data;
      });

      if (data?.status === 'success' && data?.data?.[segment]) {
        for (const [id, quote] of Object.entries(data.data[segment])) {
          result.set(parseInt(id), quote as QuoteData);
        }
      }
    } catch (error) {
      console.error(`[Dhan] ${segment} batch ${b + 1}/${batches.length} error:`,
        error instanceof Error ? error.message : error);
    }
  }

  // Cache globally
  state.quoteCache[segment] = { quotes: result, timestamp: Date.now() };
  console.log(`[Dhan] ${segment}: ${result.size} quotes cached`);
  return result;
}

/**
 * Fetch quotes for multiple segments IN PARALLEL. Reuses per-segment cache.
 * Much faster than sequential fetching for "Both" mode.
 */
export async function getQuotesMultiSegment(
  requests: { segment: Segment; securityIds: number[] }[]
): Promise<Map<number, QuoteData>> {
  const combined = new Map<number, QuoteData>();

  // Check which segments actually need fetching vs cached
  const state = getState();
  const needsFetch: typeof requests = [];
  for (const req of requests) {
    const cached = state.quoteCache[req.segment];
    if (cached && Date.now() - cached.timestamp < QUOTE_CACHE_TTL) {
      for (const [id, q] of cached.quotes.entries()) combined.set(id, q);
    } else {
      needsFetch.push(req);
    }
  }

  // Fetch uncached segments in parallel
  if (needsFetch.length > 0) {
    const results = await Promise.all(
      needsFetch.map(({ segment, securityIds }) =>
        getQuotesForSegment(segment, securityIds)
      )
    );
    for (const quotes of results) {
      for (const [id, q] of quotes.entries()) combined.set(id, q);
    }
  }

  return combined;
}

/**
 * Fetch historical daily data for a single security.
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
 * Batch-fetch historical data with 5/sec rate limiting.
 */
export async function fetchHistoricalBatch(
  items: { securityId: number; exchangeSegment: Segment }[],
  fromDate: string,
  toDate: string,
  onData?: (id: number, seg: Segment, data: HistoricalData) => void,
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  const RATE = 5;
  for (let i = 0; i < items.length; i += RATE) {
    const batch = items.slice(i, i + RATE);
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
    onProgress?.(Math.min(i + RATE, items.length), items.length);
    if (i + RATE < items.length) await new Promise((r) => setTimeout(r, 1050));
  }
}
