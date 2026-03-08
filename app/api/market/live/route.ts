import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';

// Allow up to 60s on Vercel Pro (cold start can be slow: scrip master download + historical load)
export const maxDuration = 60;
import { getScripMaster, deduplicateByIsin, ScripInfo } from '@/lib/dhan/scripMaster';
import { getQuotesMultiSegment, QuoteData } from '@/lib/dhan/marketData';
import {
  ensureHistoricalLoaded,
  ensureSnapshotsLoaded,
  startPopulation,
  syncDailyFromQuotes,
  calcChanges,
  getPopulationStatus,
  storeSnapshot,
} from '@/lib/dhan/historicalService';

interface StockQuote {
  id: string;
  companyName: string;
  tradingSymbol: string;
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
  percentChanges: Record<string, number | null>;
  week52High?: number;
  week52Low?: number;
  volume?: number;
}

// Response cache per exchange mode (NSE / BSE / Both) — 25s TTL
const responseCache: Record<string, { json: unknown; timestamp: number }> = {};
const RESP_CACHE_TTL = 25_000;

function priceBand(upper: number, lower: number, prev: number): string {
  if (!prev || !upper || !lower) return 'No Band';
  const p = Math.round(((upper - prev) / prev) * 100);
  return p <= 2 ? '2%' : p <= 5 ? '5%' : p <= 10 ? '10%' : p <= 20 ? '20%' : 'No Band';
}

function build(s: ScripInfo, q: QuoteData): StockQuote {
  const prev = q.ohlc.close;
  const cmp = q.last_price;
  const net = Math.round((cmp - prev) * 100) / 100;
  const pctChg = prev > 0 ? Math.round(((cmp - prev) / prev) * 10000) / 100 : 0;

  return {
    id: '0',
    companyName: s.displayName,
    tradingSymbol: s.tradingSymbol,
    sector: '-',
    industry: '-',
    group: s.series,
    faceValue: s.faceValue,
    priceBand: priceBand(q.upper_circuit_limit, q.lower_circuit_limit, prev),
    marketCap: '-',
    preClose: Math.round(prev * 100) / 100,
    cmp: Math.round(cmp * 100) / 100,
    netChange: net,
    percentChange: pctChg,
    percentChanges: calcChanges(s.securityId, s.exchangeSegment, cmp, prev),
    week52High: q['52_week_high'],
    week52Low: q['52_week_low'],
    volume: q.volume,
  };
}

export async function GET(request: NextRequest) {
  try {
    const exchange = (request.nextUrl.searchParams.get('exchange') || 'NSE') as 'NSE' | 'BSE' | 'Both';

    // -- Fast path: serve from response cache --
    const rc = responseCache[exchange];
    if (rc && Date.now() - rc.timestamp < RESP_CACHE_TTL) {
      return NextResponse.json(rc.json);
    }

    // -- 1. Scrip master (from DB cache, <10ms) --
    let stocks = await getScripMaster(exchange);
    if (exchange === 'Both') stocks = deduplicateByIsin(stocks);

    // -- 2. Group stocks by segment --
    const bySegment: Record<string, number[]> = {};
    for (const s of stocks) {
      if (!bySegment[s.exchangeSegment]) bySegment[s.exchangeSegment] = [];
      bySegment[s.exchangeSegment].push(s.securityId);
    }
    const segments = Object.keys(bySegment);

    // -- 3. Load historical + snapshots + quotes ALL IN PARALLEL --
    const [, , allQuotes] = await Promise.all([
      // Historical data from DB → memory (instant after first load)
      Promise.all(segments.map((seg) => ensureHistoricalLoaded(seg))),
      // Snapshot recovery from DB (cold start)
      ensureSnapshotsLoaded(),
      // Live quotes — parallel across segments
      getQuotesMultiSegment(
        segments.map((seg) => ({
          segment: seg as 'NSE_EQ' | 'BSE_EQ',
          securityIds: bySegment[seg],
        }))
      ),
    ]);

    // -- 4. Store price snapshot for intraday calculations --
    storeSnapshot(allQuotes);

    // -- 5. Daily sync (fire-and-forget, no blocking) --
    for (const seg of segments) {
      const segQuotes = new Map<number, QuoteData>();
      for (const s of stocks.filter((st) => st.exchangeSegment === seg)) {
        const q = allQuotes.get(s.securityId);
        if (q) segQuotes.set(s.securityId, q);
      }
      syncDailyFromQuotes(segQuotes, seg).catch(() => {});
    }

    // -- 6. Trigger background population for missing historical data --
    startPopulation(stocks.map((s) => ({ securityId: s.securityId, exchangeSegment: s.exchangeSegment })));

    // -- 7. Build response --
    const scripMap = new Map<number, ScripInfo>();
    stocks.forEach((s) => scripMap.set(s.securityId, s));

    const all: StockQuote[] = [];
    for (const [id, q] of allQuotes.entries()) {
      const s = scripMap.get(id);
      if (!s || !q.last_price || q.last_price <= 0) continue;
      try { all.push(build(s, q)); } catch { /* skip */ }
    }

    const gainers = all.filter((s) => s.netChange > 0).sort((a, b) => b.percentChange - a.percentChange);
    const losers = all.filter((s) => s.netChange < 0).sort((a, b) => a.percentChange - b.percentChange);
    const unchanged = all.filter((s) => s.netChange === 0).sort((a, b) => a.companyName.localeCompare(b.companyName));

    gainers.forEach((s, i) => (s.id = `${i + 1}`));
    losers.forEach((s, i) => (s.id = `${i + 1}`));
    unchanged.forEach((s, i) => (s.id = `${i + 1}`));

    // -- 8. Compute stats for dashboard --
    const avgGain = gainers.length > 0
      ? Math.round(gainers.reduce((sum, s) => sum + s.percentChange, 0) / gainers.length * 100) / 100
      : 0;
    const avgLoss = losers.length > 0
      ? Math.round(losers.reduce((sum, s) => sum + s.percentChange, 0) / losers.length * 100) / 100
      : 0;

    const json = {
      gainers,
      losers,
      unchanged,
      stats: {
        totalGainers: gainers.length,
        totalLosers: losers.length,
        totalUnchanged: unchanged.length,
        avgGain,
        avgLoss,
        topGainer: gainers[0] ? {
          company: gainers[0].companyName,
          symbol: gainers[0].tradingSymbol,
          sector: gainers[0].sector,
          ltp: gainers[0].cmp,
          percentInChange: gainers[0].percentChange,
        } : null,
        topLoser: losers[0] ? {
          company: losers[0].companyName,
          symbol: losers[0].tradingSymbol,
          sector: losers[0].sector,
          ltp: losers[0].cmp,
          percentInChange: losers[0].percentChange,
        } : null,
      },
      lastUpdated: new Date().toISOString(),
      totalStocks: all.length,
      historicalStatus: getPopulationStatus(),
    };

    responseCache[exchange] = { json, timestamp: Date.now() };
    return NextResponse.json(json);
  } catch (error) {
    console.error('Market API error:', error);
    return handleApiError(error);
  }
}
