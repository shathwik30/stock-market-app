/**
 * Pure computation: calculates all % changes for a stock.
 * Reads from in-memory historical data + price snapshots.
 * No I/O, no side effects — just math.
 */

import { getState } from './state';
import { getSnapshotPrice } from './snapshots';

// Trading-day mapping for calendar periods → trading days
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

// Intraday intervals: display key → minutes ago
const INTRADAY: [string, number][] = [
  ['% 5Min Chag', 5],
  ['% 15Min Chag', 15],
  ['% 30Min Chag', 30],
  ['% 1Hour Chag', 60],
  ['% 2Hours Chag', 120],
];

// Historical period columns
const PERIOD_COLS: [string, string][] = [
  ['% 2D Chag', '2D'], ['% 3D Chag', '3D'], ['% 4D Chag', '4D'], ['% 5D Chag', '5D'],
  ['% 1W Chag', '1W'], ['% 2W Chag', '2W'], ['% 3W Chag', '3W'], ['% 4W Chag', '4W'], ['% 5W Chag', '5W'],
  ['% 1M Chag', '1M'], ['% 2M Chag', '2M'], ['% 3M Chag', '3M'], ['% 4M Chag', '4M'], ['% 5M Chag', '5M'],
  ['% 6M Chag', '6M'], ['% 7M Chag', '7M'], ['% 8M Chag', '8M'], ['% 9M Chag', '9M'],
  ['% 10M Chag', '10M'], ['% 11M Chag', '11M'],
  ['% 1Y Chag', '1Y'], ['% 2Y Chag', '2Y'], ['% 3Y Chag', '3Y'],
  ['% 4Y Chag', '4Y'], ['% 5Y Chag', '5Y'], ['% 10Y Chag', '10Y'],
];

// YTD columns
const YTD_COLS = [
  { col: '% YTD Chag', yb: 0 },
  { col: '% 2YTD Chag', yb: 1 },
  { col: '% 3YTD Chag', yb: 2 },
  { col: '% 4YTD Chag', yb: 3 },
  { col: '% 5YTD Chag', yb: 4 },
  { col: '% 10 YTD Chag', yb: 9 },
];

/**
 * Calculate ALL % changes for a stock.
 * Returns a flat record matching the frontend's expected key format.
 */
export function calcChanges(
  securityId: number,
  segment: string,
  cmp: number,
  prevClose: number
): Record<string, number | null> {
  const ch: Record<string, number | null> = {};
  const dayPct = pct(cmp, prevClose);

  // Intraday: from price snapshots
  for (const [col, mins] of INTRADAY) {
    const oldPrice = getSnapshotPrice(securityId, mins);
    ch[col] = oldPrice != null ? pct(cmp, oldPrice) : null;
  }
  ch['% Chag'] = dayPct;

  const g = getState();
  const hist = g.historicalMem.get(ckey(securityId, segment));

  if (!hist || hist.closes.length === 0) {
    // No historical data — null out all period columns
    for (const [col] of PERIOD_COLS) ch[col] = null;
    ch['% Max Chag'] = null;
    ch['% Cust Date Chag'] = dayPct;
    ch['% YTD Chag'] = ch['% 2YTD Chag'] = ch['% 3YTD Chag'] = null;
    ch['% 4YTD Chag'] = ch['% 5YTD Chag'] = ch['% 10 YTD Chag'] = null;
    ch['% 52W Chag'] = ch['% ATH&L Chag'] = null;
    return ch;
  }

  const len = hist.closes.length;
  const at = (d: number) => (len - 1 - d >= 0 ? hist.closes[len - 1 - d] : null);

  // Historical period columns
  for (const [col, period] of PERIOD_COLS) {
    const old = at(TD[period]);
    ch[col] = old != null ? pct(cmp, old) : null;
  }

  // Max (oldest data point)
  ch['% Max Chag'] = pct(cmp, hist.closes[0]);
  ch['% Cust Date Chag'] = dayPct;

  // YTD columns
  const now = new Date();
  for (const { col, yb } of YTD_COLS) {
    const start = new Date(now.getFullYear() - yb, 0, 1);
    const days = Math.round(((now.getTime() - start.getTime()) / 86400000) * (252 / 365));
    const old = at(days);
    ch[col] = old != null ? pct(cmp, old) : null;
  }

  // 52-week
  const w52 = at(252);
  ch['% 52W Chag'] = w52 != null ? pct(cmp, w52) : null;

  // All-time high
  let ath = -Infinity;
  for (let i = 0; i < hist.closes.length; i++) {
    if (hist.closes[i] > ath) ath = hist.closes[i];
  }
  ch['% ATH&L Chag'] = pct(cmp, ath);

  return ch;
}

/**
 * Compute price band classification from circuit limits.
 */
export function computePriceBand(upper: number, lower: number, prev: number): string {
  if (!prev || !upper || !lower) return 'No Band';
  const p = Math.round(((upper - prev) / prev) * 100);
  return p <= 2 ? '2%' : p <= 5 ? '5%' : p <= 10 ? '10%' : p <= 20 ? '20%' : 'No Band';
}
