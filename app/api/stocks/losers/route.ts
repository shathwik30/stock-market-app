/**
 * GET /api/stocks/losers
 *
 * Paginated top losers from LiveQuote table.
 * Query: ?page=1&pageSize=150&exchange=NSE
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromToken } from '@/lib/auth';
import { handleApiError } from '@/lib/api-response';
import { ensureDataReady } from '@/lib/sync/engine';

export async function GET(request: NextRequest) {
  try {
    await getUserIdFromToken();

    const sp = request.nextUrl.searchParams;
    const exchange = sp.get('exchange') || 'NSE';
    const page = Math.max(1, parseInt(sp.get('page') || '1'));
    const pageSize = Math.min(500, Math.max(1, parseInt(sp.get('pageSize') || '150')));

    await ensureDataReady(exchange as 'NSE' | 'BSE' | 'Both');

    const where = {
      ...(exchange !== 'Both' ? { exchange } : {}),
      netChange: { lt: 0 },
    };

    const [count, rows] = await Promise.all([
      prisma.liveQuote.count({ where }),
      prisma.liveQuote.findMany({
        where,
        orderBy: { pctChange: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const offset = (page - 1) * pageSize;
    const data = rows.map((row, idx) => ({
      id: String(offset + idx + 1),
      companyName: row.displayName,
      tradingSymbol: row.tradingSymbol,
      sector: row.sector || '-',
      industry: row.industry || '-',
      group: row.series || '',
      faceValue: row.faceValue,
      priceBand: row.priceBand || 'No Band',
      marketCap: row.marketCapLabel || '-',
      preClose: Math.round(row.prevClose * 100) / 100,
      cmp: Math.round(row.lastPrice * 100) / 100,
      netChange: Math.round(row.netChange * 100) / 100,
      percentChange: Math.round(row.pctChange * 100) / 100,
      percentChanges: (row.percentChanges as Record<string, number | null>) || {},
      week52High: row.week52High ?? undefined,
      week52Low: row.week52Low ?? undefined,
      volume: row.volume || 0,
    }));

    return NextResponse.json({
      success: true,
      message: 'Top losers fetched successfully',
      data,
      count: count,
      pagination: {
        page,
        pageSize,
        totalStocks: count,
        totalPages: Math.ceil(count / pageSize),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
