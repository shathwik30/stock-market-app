import { NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/auth';
import { handleApiError } from '@/lib/api-response';

export async function GET(request: Request) {
  try {
    await getUserIdFromToken();

    const baseUrl = new URL(request.url).origin;
    const res = await fetch(`${baseUrl}/api/market/live?exchange=NSE`);
    const data = await res.json();

    const gainers = data.gainers || [];

    return NextResponse.json({
      success: true,
      message: 'Top gainers fetched successfully',
      data: gainers,
      count: gainers.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
