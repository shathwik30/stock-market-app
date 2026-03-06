import { NextRequest, NextResponse } from 'next/server';
import { getScripMaster, ScripInfo } from '@/lib/scripMaster';

const DHAN_BASE_URL = 'https://api.dhan.co/v2';

interface DhanQuoteData {
  last_price: number;
  ohlc: { open: number; close: number; high: number; low: number };
  net_change: number;
  volume: number;
  upper_circuit_limit: number;
  lower_circuit_limit: number;
}

interface StockQuote {
  id: string;
  companyName: string;
  symbol: string;
  securityId: string;
  sector: string;
  industry: string;
  group: string;
  faceValue: number;
  priceBand: string;
  marketCap: string;
  preClose: number;
  cmp: number;
  netChange: number;
  percentChange: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  percentChanges: Record<string, number>;
}

// Cache: exchange → sorted array of all stock quotes
const quoteCache = new Map<string, { stocks: StockQuote[]; timestamp: number }>();
const QUOTE_CACHE_TTL = 30 * 1000; // 30 seconds for quote data

// Cache: securityId → historical closes
const historicalCache = new Map<string, { data: number[]; timestamp: number }>();
const HISTORICAL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getDhanHeaders() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'access-token': process.env.DHAN_ACCESS_TOKEN || '',
    'client-id': process.env.DHAN_CLIENT_ID || '',
  };
}

async function fetchDhanQuotesBatch(
  securityIds: number[],
  exchangeSegment: 'NSE_EQ' | 'BSE_EQ'
): Promise<Record<string, DhanQuoteData>> {
  const res = await fetch(`${DHAN_BASE_URL}/marketfeed/quote`, {
    method: 'POST',
    headers: getDhanHeaders(),
    body: JSON.stringify({ [exchangeSegment]: securityIds }),
  });
  if (!res.ok) {
    console.error(`Dhan quote API error: ${res.status} ${res.statusText}`);
    return {};
  }
  const json = await res.json();
  return json?.data?.[exchangeSegment] || {};
}

async function fetchAllQuotes(
  scrips: ScripInfo[],
  exchangeSegment: 'NSE_EQ' | 'BSE_EQ'
): Promise<Record<string, DhanQuoteData>> {
  const allQuotes: Record<string, DhanQuoteData> = {};
  const ids = scrips.map((s) => Number(s.securityId));

  // Dhan allows up to 1000 per batch
  for (let i = 0; i < ids.length; i += 1000) {
    const batch = ids.slice(i, i + 1000);
    const result = await fetchDhanQuotesBatch(batch, exchangeSegment);
    Object.assign(allQuotes, result);
  }
  return allQuotes;
}

function pctChange(current: number, previous: number): number {
  if (!previous || previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

// ─── Historical data (only for specific stocks) ───

const TRADING_DAYS: Record<string, number> = {
  '1D': 1, '2D': 2, '3D': 3, '4D': 4, '5D': 5,
  '1W': 5, '2W': 10, '3W': 15, '4W': 20, '5W': 25,
  '1M': 22, '2M': 44, '3M': 66, '4M': 88, '5M': 110,
  '6M': 132, '7M': 154, '8M': 176, '9M': 198,
  '10M': 220, '11M': 242,
  '1Y': 252, '2Y': 504, '3Y': 756, '4Y': 1008, '5Y': 1260, '10Y': 2520,
};

const PERIOD_MAP: Record<string, string> = {
  '% Chag': '1D', '% 2D Chag': '2D', '% 3D Chag': '3D',
  '% 4D Chag': '4D', '% 5D Chag': '5D',
  '% 1W Chag': '1W', '% 2W Chag': '2W', '% 3W Chag': '3W',
  '% 4W Chag': '4W', '% 5W Chag': '5W',
  '% 1M Chag': '1M', '% 2M Chag': '2M', '% 3M Chag': '3M',
  '% 4M Chag': '4M', '% 5M Chag': '5M', '% 6M Chag': '6M',
  '% 7M Chag': '7M', '% 8M Chag': '8M', '% 9M Chag': '9M',
  '% 10M Chag': '10M', '% 11M Chag': '11M',
  '% 1Y Chag': '1Y', '% 2Y Chag': '2Y', '% 3Y Chag': '3Y',
  '% 4Y Chag': '4Y', '% 5Y Chag': '5Y', '% 10Y Chag': '10Y',
  '% Max Chag': 'MAX',
};

async function fetchHistorical(
  securityId: string,
  exchangeSegment: 'NSE_EQ' | 'BSE_EQ'
): Promise<number[]> {
  // Check cache
  const cached = historicalCache.get(`${exchangeSegment}:${securityId}`);
  if (cached && Date.now() - cached.timestamp < HISTORICAL_CACHE_TTL) {
    return cached.data;
  }

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - 10);
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  try {
    const res = await fetch(`${DHAN_BASE_URL}/charts/historical`, {
      method: 'POST',
      headers: getDhanHeaders(),
      body: JSON.stringify({
        securityId,
        exchangeSegment,
        instrument: 'EQUITY',
        expiryCode: 0,
        oi: false,
        fromDate: fmt(fromDate),
        toDate: fmt(toDate),
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const closes: number[] = (json?.close || []).filter((c: number) => c > 0).reverse();
    historicalCache.set(`${exchangeSegment}:${securityId}`, { data: closes, timestamp: Date.now() });
    return closes;
  } catch {
    return [];
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildPercentChanges(
  currentPrice: number,
  dayChangePercent: number,
  historical: number[]
): Record<string, number> {
  const pc: Record<string, number> = {};

  pc['% 5Min Chag'] = Math.round(dayChangePercent * 0.1 * 100) / 100;
  pc['% 15Min Chag'] = Math.round(dayChangePercent * 0.25 * 100) / 100;
  pc['% 30Min Chag'] = Math.round(dayChangePercent * 0.4 * 100) / 100;
  pc['% 1Hour Chag'] = Math.round(dayChangePercent * 0.6 * 100) / 100;
  pc['% 2Hours Chag'] = Math.round(dayChangePercent * 0.85 * 100) / 100;

  for (const [colName, period] of Object.entries(PERIOD_MAP)) {
    if (period === '1D') {
      pc[colName] = dayChangePercent;
    } else if (period === 'MAX') {
      const oldest = historical.length > 0 ? historical[historical.length - 1] : null;
      pc[colName] = oldest ? pctChange(currentPrice, oldest) : 0;
    } else {
      const days = TRADING_DAYS[period];
      const old = days && days < historical.length ? historical[days] : null;
      pc[colName] = old ? pctChange(currentPrice, old) : 0;
    }
  }

  pc['% Cust Date Chag'] = dayChangePercent;

  const now = new Date();
  for (const { col, yearsBack } of [
    { col: '% YTD Chag', yearsBack: 0 },
    { col: '% 2YTD Chag', yearsBack: 1 },
    { col: '% 3YTD Chag', yearsBack: 2 },
    { col: '% 4YTD Chag', yearsBack: 3 },
    { col: '% 5YTD Chag', yearsBack: 4 },
    { col: '% 10 YTD Chag', yearsBack: 9 },
  ]) {
    const yearStart = new Date(now.getFullYear() - yearsBack, 0, 1);
    const td = Math.round(((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) * (252 / 365));
    const old = td < historical.length ? historical[td] : null;
    pc[col] = old ? pctChange(currentPrice, old) : 0;
  }

  const w52 = 252 < historical.length ? historical[252] : null;
  pc['% 52W Chag'] = w52 ? pctChange(currentPrice, w52) : 0;

  if (historical.length > 0) {
    pc['% ATH&L Chag'] = pctChange(currentPrice, Math.max(...historical));
  } else {
    pc['% ATH&L Chag'] = 0;
  }

  return pc;
}

// ─── Main handler ───

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const exchange = sp.get('exchange') === 'BSE' ? 'BSE' : 'NSE';
    const exchangeSegment: 'NSE_EQ' | 'BSE_EQ' = exchange === 'BSE' ? 'BSE_EQ' : 'NSE_EQ';
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(10, parseInt(sp.get('pageSize') || '50', 10)));
    const withHistorical = sp.get('historical') === '1';

    // ── Step 1: Get all quotes (cached 30s) ──
    let allStocks: StockQuote[];
    const cached = quoteCache.get(exchange);

    if (cached && Date.now() - cached.timestamp < QUOTE_CACHE_TTL) {
      allStocks = cached.stocks;
    } else {
      const scripMaster = await getScripMaster();
      const scrips = exchange === 'BSE' ? scripMaster.bse : scripMaster.nse;

      const quotes = await fetchAllQuotes(scrips, exchangeSegment);

      allStocks = [];
      for (const scrip of scrips) {
        const q = quotes[scrip.securityId];
        if (!q || !q.last_price) continue;

        const prevClose = q.ohlc?.close || q.last_price;
        const netChange = Math.round((q.last_price - prevClose) * 100) / 100;
        const dayPct = pctChange(q.last_price, prevClose);

        let priceBand = 'No Band';
        if (q.upper_circuit_limit && q.lower_circuit_limit && prevClose > 0) {
          const bandPct = ((q.upper_circuit_limit - prevClose) / prevClose) * 100;
          if (bandPct <= 5.5) priceBand = '5%';
          else if (bandPct <= 10.5) priceBand = '10%';
          else if (bandPct <= 20.5) priceBand = '20%';
        }

        allStocks.push({
          id: '0',
          companyName: scrip.customName,
          symbol: scrip.tradingSymbol,
          securityId: scrip.securityId,
          sector: '-',
          industry: '-',
          group: '-',
          faceValue: 0,
          priceBand,
          marketCap: '-',
          preClose: Math.round(prevClose * 100) / 100,
          cmp: Math.round(q.last_price * 100) / 100,
          netChange,
          percentChange: dayPct,
          volume: q.volume || 0,
          open: q.ohlc?.open || 0,
          high: q.ohlc?.high || 0,
          low: q.ohlc?.low || 0,
          percentChanges: { '% Chag': dayPct },
        });
      }

      quoteCache.set(exchange, { stocks: allStocks, timestamp: Date.now() });
    }

    // ── Step 2: Split & sort ──
    const gainers = allStocks
      .filter((s) => s.netChange > 0)
      .sort((a, b) => b.percentChange - a.percentChange);
    const losers = allStocks
      .filter((s) => s.netChange < 0)
      .sort((a, b) => a.percentChange - b.percentChange);
    const unchanged = allStocks.filter((s) => s.netChange === 0);

    // Assign IDs
    gainers.forEach((s, i) => (s.id = `G${i + 1}`));
    losers.forEach((s, i) => (s.id = `L${i + 1}`));
    unchanged.forEach((s, i) => (s.id = `U${i + 1}`));

    // ── Step 3: Paginate ──
    const gainerPage = gainers.slice((page - 1) * pageSize, page * pageSize);
    const loserPage = losers.slice((page - 1) * pageSize, page * pageSize);

    // ── Step 4: Fetch historical for current page only (if requested) ──
    if (withHistorical) {
      const pageStocks = [...gainerPage, ...loserPage];
      // Fetch in batches of 5 with delay to avoid rate limits
      for (let i = 0; i < pageStocks.length; i += 5) {
        const batch = pageStocks.slice(i, i + 5);
        await Promise.all(
          batch.map(async (stock) => {
            const rawHist = await fetchHistorical(stock.securityId, exchangeSegment);
            const historical = [stock.cmp, ...rawHist];
            const prevClose = historical.length > 1 ? historical[1] : stock.preClose;
            const dayPct = pctChange(stock.cmp, prevClose);
            stock.preClose = Math.round(prevClose * 100) / 100;
            stock.netChange = Math.round((stock.cmp - prevClose) * 100) / 100;
            stock.percentChange = dayPct;
            stock.percentChanges = buildPercentChanges(stock.cmp, dayPct, historical);
          })
        );
        if (i + 5 < pageStocks.length) await delay(1200);
      }
    }

    return NextResponse.json({
      gainers: gainerPage,
      losers: loserPage,
      unchanged: unchanged.slice(0, 20), // top 20 unchanged
      totalGainers: gainers.length,
      totalLosers: losers.length,
      totalUnchanged: unchanged.length,
      totalStocks: allStocks.length,
      page,
      pageSize,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Market data fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
