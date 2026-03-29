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
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureDataReady, getSyncStatus } from '@/lib/sync/engine';
import type { Exchange, StockQuoteDTO, MarketStatsDTO } from '@/lib/sync/types';
import { formatMarketCap } from '@/lib/format';

export const maxDuration = 10;

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
    const exchange = (sp.get('exchange') || 'NSE') as Exchange;
    const filter = (sp.get('filter') || 'all') as 'all' | 'gainers' | 'losers' | 'unchanged';
    const page = Math.max(1, parseInt(sp.get('page') || '1'));
    const pageSize = Math.min(500, Math.max(1, parseInt(sp.get('pageSize') || '200')));
    const sort = sp.get('sort') || 'pctChange';
    const order = (sp.get('order') || 'desc') as 'asc' | 'desc';
    const search = sp.get('search')?.trim() || '';

    // ── Check in-memory cache first ──
    const cacheKey = `${exchange}:${filter}:${page}:${pageSize}:${sort}:${order}:${search}`;
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // Ensure data exists (blocking on first-ever load, background refresh if stale)
    await ensureDataReady(exchange);

    // Build WHERE clause
    const conditions: string[] = [];
    if (exchange !== 'Both') {
      conditions.push(`exchange = '${exchange}'`);
    }
    if (filter === 'gainers') conditions.push(`"netChange" > 0`);
    else if (filter === 'losers') conditions.push(`"netChange" < 0`);
    else if (filter === 'unchanged') conditions.push(`"netChange" = 0`);

    if (search) {
      const safeSearch = search.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/[%_]/g, '');
      conditions.push(`("displayName" ILIKE '%${safeSearch}%' OR "tradingSymbol" ILIKE '%${safeSearch}%')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = getSortClause(sort, order);
    const offset = (page - 1) * pageSize;

    // Count + fetch in parallel (fewer round trips to DB)
    const [countResult, rows] = await Promise.all([
      prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*)::bigint as count FROM "LiveQuote" ${whereClause}`
      ),
      // Select only columns the frontend needs (no id, securityId, exchangeSegment, open, high, low, circuits, syncedAt)
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT "displayName", "tradingSymbol", sector, industry, series, "faceValue",
                "priceBand", "marketCapValue", "prevClose", "lastPrice", "netChange",
                "pctChange", "percentChanges", "week52High", "week52Low", volume
         FROM "LiveQuote" ${whereClause} ORDER BY ${orderClause} LIMIT ${pageSize} OFFSET ${offset}`
      ),
    ]);

    const totalStocks = Number(countResult[0]?.count || 0);
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
