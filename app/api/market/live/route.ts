/**
 * GET /api/market/live
 *
 * Serves pre-computed stock data from LiveQuote table with server-side pagination.
 * The sync engine writes to LiveQuote in the background; this route just reads.
 *
 * Query params:
 *   exchange  = NSE | BSE | Both (default: NSE)
 *   filter    = all | gainers | losers | unchanged (default: all)
 *   page      = 1-based page number (default: 1)
 *   pageSize  = items per page (default: 200, max: 500)
 *   sort      = column to sort by (default: pctChange)
 *   order     = asc | desc (default: desc)
 *   search    = search company name or symbol
 *   sectors   = comma-separated sector names
 *   industries = comma-separated industry names
 *   marketCaps = comma-separated cap labels
 *   priceBands = comma-separated bands
 *   series    = comma-separated series
 *   priceMin/priceMax = price range
 *   changeMin/changeMax = % change range
 *   volumeMin = minimum volume
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureDataReady, getSyncStatus } from '@/lib/sync/engine';
import type { Exchange, StockQuoteDTO, MarketStatsDTO } from '@/lib/sync/types';
import { formatMarketCap } from '@/lib/format';

export const maxDuration = 60;

// ── In-memory response cache (avoids repeated DB reads for identical requests) ──
const responseCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 10_000; // 10 seconds — data is at most 10s old

// Map sort parameter to SQL ORDER BY clause
const SORT_MAP: Record<string, string> = {
  pctChange: '"pctChange"',
  netChange: '"netChange"',
  volume: 'volume',
  name: '"displayName"',
  lastPrice: '"lastPrice"',
  prevClose: '"prevClose"',
  marketCap: '"marketCapValue"',
};

// Map for % change column sorts (JSONB field)
function getSortClause(sort: string, order: string): string {
  const dir = order === 'asc' ? 'ASC' : 'DESC';
  const nulls = order === 'asc' ? 'NULLS LAST' : 'NULLS LAST';

  // Direct column sort
  if (SORT_MAP[sort]) {
    return `${SORT_MAP[sort]} ${dir} ${nulls}`;
  }

  // % change column sort (JSONB key)
  // Accept keys like "% 1W Chag", "% 5Min Chag", etc.
  const safeKey = sort.replace(/[^a-zA-Z0-9% ]/g, '');
  return `COALESCE(("percentChanges"->>'${safeKey}')::float, ${order === 'asc' ? '999999' : '-999999'}) ${dir}`;
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    // Normalize "Only NSE" → "NSE", "Only BSE" → "BSE" for all DB operations
    const exchange = (sp.get('exchange') || 'NSE').replace('Only ', '') as Exchange;
    const filter = (sp.get('filter') || 'all') as 'all' | 'gainers' | 'losers' | 'unchanged';
    const page = Math.max(1, parseInt(sp.get('page') || '1'));
    const pageSize = Math.min(500, Math.max(1, parseInt(sp.get('pageSize') || '200')));
    const sort = sp.get('sort') || 'pctChange';
    const order = (sp.get('order') || 'desc') as 'asc' | 'desc';
    const search = sp.get('search')?.trim() || '';

    // ── Parse advanced filter params ──
    const rawSectors = sp.get('sectors')?.split(',').filter(Boolean) || [];
    const rawIndustries = sp.get('industries')?.split(',').filter(Boolean) || [];
    const rawMarketCaps = sp.get('marketCaps')?.split(',').filter(Boolean) || [];
    const rawPriceBands = sp.get('priceBands')?.split(',').filter(Boolean) || [];
    const rawSeries = sp.get('series')?.split(',').filter(Boolean) || [];
    const marketCapMin = parseFloat(sp.get('marketCapMin') || '');
    const marketCapMax = parseFloat(sp.get('marketCapMax') || '');
    const priceMin = parseFloat(sp.get('priceMin') || '');
    const priceMax = parseFloat(sp.get('priceMax') || '');
    const changeMin = parseFloat(sp.get('changeMin') || '');
    const changeMax = parseFloat(sp.get('changeMax') || '');
    const volumeMin = parseFloat(sp.get('volumeMin') || '');

    // ── Check in-memory cache (include all params) ──
    const filterKey = [
      rawSectors.join(';'), rawIndustries.join(';'), rawMarketCaps.join(';'),
      rawPriceBands.join(';'), rawSeries.join(';'),
      sp.get('marketCapMin') || '', sp.get('marketCapMax') || '',
      sp.get('priceMin') || '', sp.get('priceMax') || '',
      sp.get('changeMin') || '', sp.get('changeMax') || '',
      sp.get('volumeMin') || '',
    ].join('|');
    const customDate = sp.get('customDate')?.trim() || '';
    const customEndDate = sp.get('customEndDate')?.trim() || '';
    const cacheKey = `${exchange}:${filter}:${page}:${pageSize}:${sort}:${order}:${search}:${filterKey}:${customDate}:${customEndDate}`;
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // Ensure data exists (blocking on first-ever load, background refresh if stale)
    await ensureDataReady(exchange);

    // ── Build WHERE conditions in two parts: base (without view filter) + full (with view filter) ──
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "''");
    const baseConditions: string[] = [];

    // Exchange filter (already normalized above: "Only NSE" → "NSE")
    if (exchange !== 'Both') {
      baseConditions.push(`exchange = '${esc(exchange)}'`);
    }

    // Search
    if (search) {
      const safeSearch = search.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/[%_]/g, '');
      baseConditions.push(`("displayName" ILIKE '%${safeSearch}%' OR "tradingSymbol" ILIKE '%${safeSearch}%')`);
    }

    // Categorical filters
    if (rawSectors.length) baseConditions.push(`sector IN (${rawSectors.map(s => `'${esc(s)}'`).join(',')})`);
    if (rawIndustries.length) baseConditions.push(`industry IN (${rawIndustries.map(s => `'${esc(s)}'`).join(',')})`);
    if (rawMarketCaps.length) baseConditions.push(`"marketCapLabel" IN (${rawMarketCaps.map(s => `'${esc(s)}'`).join(',')})`);
    if (rawPriceBands.length) baseConditions.push(`"priceBand" IN (${rawPriceBands.map(s => `'${esc(s)}'`).join(',')})`);
    if (rawSeries.length) baseConditions.push(`series IN (${rawSeries.map(s => `'${esc(s)}'`).join(',')})`);

    // Market cap range filters (user enters in Crores, DB stores in INR)
    if (isFinite(marketCapMin)) baseConditions.push(`"marketCapValue" >= ${marketCapMin * 1e7}`);
    if (isFinite(marketCapMax)) baseConditions.push(`"marketCapValue" <= ${marketCapMax * 1e7}`);

    // Range filters
    if (isFinite(priceMin)) baseConditions.push(`"lastPrice" >= ${priceMin}`);
    if (isFinite(priceMax)) baseConditions.push(`"lastPrice" <= ${priceMax}`);
    if (isFinite(changeMin)) baseConditions.push(`"pctChange" >= ${changeMin}`);
    if (isFinite(changeMax)) baseConditions.push(`"pctChange" <= ${changeMax}`);
    if (isFinite(volumeMin)) baseConditions.push(`volume >= ${volumeMin}`);

    // View filter (gainers/losers/unchanged) — only in full conditions
    const fullConditions = [...baseConditions];
    if (filter === 'gainers') fullConditions.push(`"netChange" > 0`);
    else if (filter === 'losers') fullConditions.push(`"netChange" < 0`);
    else if (filter === 'unchanged') fullConditions.push(`"netChange" = 0`);

    const baseWhere = baseConditions.length > 0 ? `WHERE ${baseConditions.join(' AND ')}` : '';
    const fullWhere = fullConditions.length > 0 ? `WHERE ${fullConditions.join(' AND ')}` : '';
    const orderClause = getSortClause(sort, order);
    const offset = (page - 1) * pageSize;

    // ── Count breakdown (for tab labels) + fetch rows — in parallel ──
    const [countsResult, rows] = await Promise.all([
      // Single query gives total + per-category counts (without view filter)
      prisma.$queryRawUnsafe<[{ total: bigint; gainers: bigint; losers: bigint; unchanged: bigint }]>(
        `SELECT COUNT(*)::bigint AS total,
                COUNT(*) FILTER (WHERE "netChange" > 0)::bigint AS gainers,
                COUNT(*) FILTER (WHERE "netChange" < 0)::bigint AS losers,
                COUNT(*) FILTER (WHERE "netChange" = 0)::bigint AS unchanged
         FROM "LiveQuote" ${baseWhere}`
      ),
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT "securityId", "exchangeSegment",
                "displayName", "tradingSymbol", sector, industry, series, "faceValue",
                "priceBand", "marketCapValue", "prevClose", "lastPrice", "netChange",
                "pctChange", "percentChanges", "week52High", "week52Low", volume
         FROM "LiveQuote" ${fullWhere} ORDER BY ${orderClause} LIMIT ${pageSize} OFFSET ${offset}`
      ),
    ]);

    const counts = countsResult[0];
    const viewTotal = Number(
      filter === 'gainers' ? counts.gainers :
      filter === 'losers' ? counts.losers :
      filter === 'unchanged' ? counts.unchanged :
      counts.total
    );
    const totalStocks = viewTotal;
    const totalPages = Math.ceil(totalStocks / pageSize);

    // Transform DB rows to frontend DTO
    const stocks: StockQuoteDTO[] = rows.map((row, idx) => ({
      id: String(offset + idx + 1),
      companyName: row.displayName as string,
      tradingSymbol: row.tradingSymbol as string,
      sector: (row.sector as string) || '-',
      industry: (row.industry as string) || '-',
      group: (row.series as string) || '',
      faceValue: Number(row.faceValue) || 1,
      priceBand: (row.priceBand as string) || 'No Band',
      marketCap: formatMarketCap(Number(row.marketCapValue) || 0),
      preClose: Math.round(Number(row.prevClose) * 100) / 100,
      cmp: Math.round(Number(row.lastPrice) * 100) / 100,
      netChange: Math.round(Number(row.netChange) * 100) / 100,
      percentChange: Math.round(Number(row.pctChange) * 100) / 100,
      percentChanges: (row.percentChanges as Record<string, number | null>) || {},
      week52High: row.week52High != null ? Number(row.week52High) : undefined,
      week52Low: row.week52Low != null ? Number(row.week52Low) : undefined,
      volume: Number(row.volume) || 0,
    }));

    // ── Custom date % change (override % Cust Date Chag for the current page) ──
    if (customDate && stocks.length > 0) {
      const startTs = Math.floor(new Date(customDate + 'T00:00:00Z').getTime() / 1000);
      const endTs = customEndDate
        ? Math.floor(new Date(customEndDate + 'T00:00:00Z').getTime() / 1000)
        : null;
      if (isFinite(startTs) && startTs > 0 && (endTs === null || (isFinite(endTs) && endTs >= startTs))) {
        const secIds = rows.map(r => parseInt(String(r.securityId))).filter(n => isFinite(n) && n > 0);
        if (secIds.length > 0) {
          try {
            const endSelect = endTs !== null
              ? `(SELECT hp.closes[i]
                   FROM generate_subscripts(hp.timestamps, 1) i
                   WHERE hp.timestamps[i] <= ${endTs}
                   ORDER BY i DESC
                   LIMIT 1
                  ) as "endClose"`
              : `NULL::double precision as "endClose"`;
            const histRows = await prisma.$queryRawUnsafe<Array<{
              securityId: number;
              exchangeSegment: string;
              startClose: number | null;
              endClose: number | null;
            }>>(`
              SELECT hp."securityId", hp."exchangeSegment",
                (SELECT hp.closes[i]
                 FROM generate_subscripts(hp.timestamps, 1) i
                 WHERE hp.timestamps[i] <= ${startTs}
                 ORDER BY i DESC
                 LIMIT 1
                ) as "startClose",
                ${endSelect}
              FROM "HistoricalPrice" hp
              WHERE hp."securityId" IN (${secIds.join(',')})
            `);

            const closeMap = new Map<string, { start: number; end: number | null }>();
            for (const h of histRows) {
              if (h.startClose != null && h.startClose > 0) {
                closeMap.set(`${h.securityId}:${h.exchangeSegment}`, {
                  start: h.startClose,
                  end: h.endClose != null && h.endClose > 0 ? h.endClose : null,
                });
              }
            }

            for (let i = 0; i < stocks.length; i++) {
              const key = `${rows[i].securityId}:${rows[i].exchangeSegment}`;
              const entry = closeMap.get(key);
              if (entry && entry.start > 0) {
                // When end date provided, compare start → end close. Otherwise compare start → CMP.
                const compareTo = endTs !== null ? entry.end : stocks[i].cmp;
                if (compareTo && compareTo > 0) {
                  stocks[i].percentChanges['% Cust Date Chag'] =
                    Math.round(((compareTo - entry.start) / entry.start) * 10000) / 100;
                } else {
                  stocks[i].percentChanges['% Cust Date Chag'] = null;
                }
              } else {
                stocks[i].percentChanges['% Cust Date Chag'] = null;
              }
            }
          } catch (e) {
            console.error('[API:market/live] Custom date query error:', e instanceof Error ? e.message : e);
          }
        }
      }
    }

    // Get pre-computed stats from MarketStats table
    const statsExchange = exchange === 'Both' ? 'Both' : exchange;
    const statsRow = await prisma.marketStats.findUnique({ where: { exchange: statsExchange } });

    // Fallback: if no MarketStats for 'Both', compute from NSE + BSE
    let stats: MarketStatsDTO;
    if (statsRow) {
      stats = {
        totalGainers: statsRow.totalGainers,
        totalLosers: statsRow.totalLosers,
        totalUnchanged: statsRow.totalUnchanged,
        avgGain: statsRow.avgGain,
        avgLoss: statsRow.avgLoss,
        topGainer: statsRow.topGainerName
          ? {
              company: statsRow.topGainerName,
              symbol: statsRow.topGainerSymbol || '',
              sector: statsRow.topGainerSector || '-',
              ltp: statsRow.topGainerLtp || 0,
              percentInChange: statsRow.topGainerPct || 0,
            }
          : null,
        topLoser: statsRow.topLoserName
          ? {
              company: statsRow.topLoserName,
              symbol: statsRow.topLoserSymbol || '',
              sector: statsRow.topLoserSector || '-',
              ltp: statsRow.topLoserLtp || 0,
              percentInChange: statsRow.topLoserPct || 0,
            }
          : null,
      };
    } else {
      // No stats yet — return zeros
      stats = {
        totalGainers: 0, totalLosers: 0, totalUnchanged: 0,
        avgGain: 0, avgLoss: 0, topGainer: null, topLoser: null,
      };
    }

    const syncStatus = getSyncStatus();

    const responseData = {
      stocks,
      pagination: { page, pageSize, totalStocks, totalPages },
      stats,
      filteredCounts: {
        total: Number(counts.total),
        gainers: Number(counts.gainers),
        losers: Number(counts.losers),
        unchanged: Number(counts.unchanged),
      },
      lastSyncAt: syncStatus.lastSyncAt,
      syncStatus: {
        isRunning: syncStatus.isRunning,
        historicalPopulating: syncStatus.historicalPopulating,
        historicalProgress: syncStatus.historicalProgress,
        cachedCount: syncStatus.cachedCount,
      },
    };

    // ── Store in cache ──
    responseCache.set(cacheKey, { data: responseData, ts: Date.now() });
    // Evict old entries to prevent memory bloat
    if (responseCache.size > 100) {
      const now = Date.now();
      for (const [key, val] of responseCache) {
        if (now - val.ts > CACHE_TTL_MS) responseCache.delete(key);
      }
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[API:market/live] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
