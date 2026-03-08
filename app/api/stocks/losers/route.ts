import { NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/auth';
import { handleApiError } from '@/lib/api-response';

export async function GET(request: Request) {
  try {
    await getUserIdFromToken();

    const baseUrl = new URL(request.url).origin;
    const res = await fetch(`${baseUrl}/api/market/live?exchange=NSE`);
    const data = await res.json();

    const losers = data.losers || [];

    return NextResponse.json({
      success: true,
      message: 'Top losers fetched successfully',
      data: losers,
      count: losers.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
