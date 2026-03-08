import { NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/auth';
import { handleApiError } from '@/lib/api-response';

export async function GET(request: Request) {
  try {
    await getUserIdFromToken();

    // Fetch live stats from our own market API (reuses its 25s cache)
    const baseUrl = new URL(request.url).origin;
    const res = await fetch(`${baseUrl}/api/market/live?exchange=NSE`, {
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: true, stats: { totalGainers: 0, totalLosers: 0, avgGain: 0, avgLoss: 0, topGainer: null, topLoser: null } },
      );
    }

    const data = await res.json();

    return NextResponse.json({
      success: true,
      stats: data.stats || {
        totalGainers: 0,
        totalLosers: 0,
        avgGain: 0,
        avgLoss: 0,
        topGainer: null,
        topLoser: null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
