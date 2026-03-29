/**
 * GET /api/stocks/stats
 *
 * Returns pre-computed market statistics from MarketStats table.
 * Zero computation at request time — just a DB read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromToken } from '@/lib/auth';
import { handleApiError } from '@/lib/api-response';
import { ensureDataReady } from '@/lib/sync/engine';
import type { Exchange } from '@/lib/sync/types';

export async function GET(request: NextRequest) {
  try {
    await getUserIdFromToken();

    const exchange = (request.nextUrl.searchParams.get('exchange') || 'NSE') as Exchange;
    const statsExchange = exchange === 'Both' ? 'Both' : exchange;

    // Ensure sync has run at least once
    await ensureDataReady(exchange);

    const statsRow = await prisma.marketStats.findUnique({ where: { exchange: statsExchange } });

    const stats = statsRow
      ? {
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
        }
      : {
          totalGainers: 0, totalLosers: 0, totalUnchanged: 0,
          avgGain: 0, avgLoss: 0, topGainer: null, topLoser: null,
        };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    return handleApiError(error);
  }
}
