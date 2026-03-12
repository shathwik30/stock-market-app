/**
 * GET /api/sync
 *
 * Manual sync trigger + status endpoint.
 * Use ?action=trigger to force a single sync cycle.
 * Use without params (or ?action=status) to check sync status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runSingleSync, getSyncStatus } from '@/lib/sync/engine';
import type { Exchange } from '@/lib/sync/types';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action') || 'status';
  const exchange = (request.nextUrl.searchParams.get('exchange') || 'NSE') as Exchange;

  if (action === 'trigger') {
    try {
      const result = await runSingleSync(exchange);
      return NextResponse.json({
        ok: true,
        ...result,
        syncStatus: getSyncStatus(),
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Sync failed' },
        { status: 500 }
      );
    }
  }

  // Default: return status
  return NextResponse.json({
    ok: true,
    syncStatus: getSyncStatus(),
  });
}
