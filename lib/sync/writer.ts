/**
 * Batch writer: writes pre-computed stock data to LiveQuote and MarketStats tables.
 * Uses raw SQL batch upserts for maximum throughput.
 */

import { prisma } from '@/lib/prisma';
import type { ScripInfo } from '@/lib/dhan/scripMaster';
import { classifyMarketCap } from '@/lib/dhan/stockEnrichment';
import type { DhanQuote, Exchange } from './types';
import { calcChanges, computePriceBand } from './compute';

interface ComputedStock {
  stock: ScripInfo;
  quote: DhanQuote;
  changes: Record<string, number | null>;
  netChange: number;
  pctChange: number;
}

/** Escape string for SQL insertion — handles single quotes and backslashes. */
function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return s.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/** Format number for SQL — returns 'NULL' for undefined/NaN/Infinity. */
function fnum(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return 'NULL';
  return String(v);
}

/**
 * Compute all data for every stock and batch-upsert to LiveQuote.
 * Returns computed entries for stats calculation.
 */
export async function writeLiveQuotes(
  stocks: ScripInfo[],
  allQuotes: Map<number, DhanQuote>
): Promise<ComputedStock[]> {
  const computed: ComputedStock[] = [];

  // Compute everything
  for (const s of stocks) {
    const q = allQuotes.get(s.securityId);
    if (!q || !q.last_price || q.last_price <= 0) continue;

    const prev = q.ohlc.close;
    const net = Math.round((q.last_price - prev) * 100) / 100;
    const pct = prev > 0 ? Math.round(((q.last_price - prev) / prev) * 10000) / 100 : 0;
    const changes = calcChanges(s.securityId, s.exchangeSegment, q.last_price, prev);

    computed.push({ stock: s, quote: q, changes, netChange: net, pctChange: pct });
  }

  // Batch upsert to DB
  const BATCH = 300;
  for (let i = 0; i < computed.length; i += BATCH) {
    const batch = computed.slice(i, i + BATCH);

    const values = batch
      .map(({ stock: s, quote: q, changes, netChange, pctChange }) => {
        const band = computePriceBand(q.upper_circuit_limit, q.lower_circuit_limit, q.ohlc.close);
        const mcLabel = classifyMarketCap(s.marketCapValue || 0);
        const changesJson = JSON.stringify(changes).replace(/'/g, "''");

        return `(
          gen_random_uuid(),
          ${s.securityId},
          '${esc(s.exchange)}',
          '${esc(s.exchangeSegment)}',
          '${esc(s.tradingSymbol)}',
          '${esc(s.displayName)}',
          '${esc(s.sector || '-')}',
          '${esc(s.industry || '-')}',
          '${esc(s.series)}',
          ${s.faceValue},
          ${s.marketCapValue || 0},
          '${esc(mcLabel)}',
          '${esc(band)}',
          ${q.last_price},
          ${q.ohlc.close},
          ${q.ohlc.open},
          ${q.ohlc.high},
          ${q.ohlc.low},
          ${netChange},
          ${pctChange},
          ${q.volume || 0},
          ${q.upper_circuit_limit || 0},
          ${q.lower_circuit_limit || 0},
          ${fnum(q['52_week_high'])},
          ${fnum(q['52_week_low'])},
          '${changesJson}'::jsonb,
          NOW()
        )`;
      })
      .join(',');

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "LiveQuote" (
          id, "securityId", exchange, "exchangeSegment", "tradingSymbol", "displayName",
          sector, industry, series, "faceValue", "marketCapValue", "marketCapLabel", "priceBand",
          "lastPrice", "prevClose", open, high, low, "netChange", "pctChange", volume,
          "upperCircuit", "lowerCircuit", "week52High", "week52Low", "percentChanges", "syncedAt"
        ) VALUES ${values}
        ON CONFLICT ("securityId", exchange) DO UPDATE SET
          "tradingSymbol" = EXCLUDED."tradingSymbol",
          "displayName" = EXCLUDED."displayName",
          sector = EXCLUDED.sector,
          industry = EXCLUDED.industry,
          series = EXCLUDED.series,
          "faceValue" = EXCLUDED."faceValue",
          "marketCapValue" = EXCLUDED."marketCapValue",
          "marketCapLabel" = EXCLUDED."marketCapLabel",
          "priceBand" = EXCLUDED."priceBand",
          "lastPrice" = EXCLUDED."lastPrice",
          "prevClose" = EXCLUDED."prevClose",
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          "netChange" = EXCLUDED."netChange",
          "pctChange" = EXCLUDED."pctChange",
          volume = EXCLUDED.volume,
          "upperCircuit" = EXCLUDED."upperCircuit",
          "lowerCircuit" = EXCLUDED."lowerCircuit",
          "week52High" = EXCLUDED."week52High",
          "week52Low" = EXCLUDED."week52Low",
          "percentChanges" = EXCLUDED."percentChanges",
          "syncedAt" = EXCLUDED."syncedAt"
      `);
    } catch (e) {
      console.error(`[Sync:Writer] Batch upsert error (${i}-${i + batch.length}):`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`[Sync:Writer] Upserted ${computed.length} stocks to LiveQuote`);
  return computed;
}

/**
 * Compute and upsert market stats from computed stock data.
 */
export async function writeMarketStats(
  exchange: Exchange,
  computed: ComputedStock[]
): Promise<void> {
  const gainers = computed.filter((c) => c.netChange > 0).sort((a, b) => b.pctChange - a.pctChange);
  const losers = computed.filter((c) => c.netChange < 0).sort((a, b) => a.pctChange - b.pctChange);
  const unchanged = computed.filter((c) => c.netChange === 0);

  const avgGain = gainers.length > 0
    ? Math.round(gainers.reduce((sum, c) => sum + c.pctChange, 0) / gainers.length * 100) / 100
    : 0;
  const avgLoss = losers.length > 0
    ? Math.round(losers.reduce((sum, c) => sum + c.pctChange, 0) / losers.length * 100) / 100
    : 0;

  const top = gainers[0];
  const bottom = losers[0];

  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "MarketStats" (
        id, exchange, "totalStocks", "totalGainers", "totalLosers", "totalUnchanged",
        "avgGain", "avgLoss",
        "topGainerName", "topGainerSymbol", "topGainerSector", "topGainerLtp", "topGainerPct",
        "topLoserName", "topLoserSymbol", "topLoserSector", "topLoserLtp", "topLoserPct",
        "lastSyncAt", "syncCycles", "updatedAt"
      ) VALUES (
        '${esc(exchange)}', '${esc(exchange)}',
        ${computed.length}, ${gainers.length}, ${losers.length}, ${unchanged.length},
        ${avgGain}, ${avgLoss},
        ${top ? `'${esc(top.stock.displayName)}'` : 'NULL'},
        ${top ? `'${esc(top.stock.tradingSymbol)}'` : 'NULL'},
        ${top ? `'${esc(top.stock.sector || '-')}'` : 'NULL'},
        ${top ? top.quote.last_price : 'NULL'},
        ${top ? top.pctChange : 'NULL'},
        ${bottom ? `'${esc(bottom.stock.displayName)}'` : 'NULL'},
        ${bottom ? `'${esc(bottom.stock.tradingSymbol)}'` : 'NULL'},
        ${bottom ? `'${esc(bottom.stock.sector || '-')}'` : 'NULL'},
        ${bottom ? bottom.quote.last_price : 'NULL'},
        ${bottom ? bottom.pctChange : 'NULL'},
        NOW(), COALESCE((SELECT "syncCycles" FROM "MarketStats" WHERE exchange = '${esc(exchange)}'), 0) + 1, NOW()
      )
      ON CONFLICT (exchange) DO UPDATE SET
        "totalStocks" = EXCLUDED."totalStocks",
        "totalGainers" = EXCLUDED."totalGainers",
        "totalLosers" = EXCLUDED."totalLosers",
        "totalUnchanged" = EXCLUDED."totalUnchanged",
        "avgGain" = EXCLUDED."avgGain",
        "avgLoss" = EXCLUDED."avgLoss",
        "topGainerName" = EXCLUDED."topGainerName",
        "topGainerSymbol" = EXCLUDED."topGainerSymbol",
        "topGainerSector" = EXCLUDED."topGainerSector",
        "topGainerLtp" = EXCLUDED."topGainerLtp",
        "topGainerPct" = EXCLUDED."topGainerPct",
        "topLoserName" = EXCLUDED."topLoserName",
        "topLoserSymbol" = EXCLUDED."topLoserSymbol",
        "topLoserSector" = EXCLUDED."topLoserSector",
        "topLoserLtp" = EXCLUDED."topLoserLtp",
        "topLoserPct" = EXCLUDED."topLoserPct",
        "lastSyncAt" = NOW(),
        "syncCycles" = "MarketStats"."syncCycles" + 1,
        "updatedAt" = NOW()
    `);
  } catch (e) {
    console.error('[Sync:Writer] MarketStats upsert error:', e instanceof Error ? e.message : e);
  }
}

/**
 * Compute and write combined 'Both' market stats from NSE + BSE individual stats.
 * Called after each exchange sync so 'Both' stays fresh regardless of which exchange just synced.
 */
export async function writeCombinedMarketStats(): Promise<void> {
  try {
    const [nse, bse] = await Promise.all([
      prisma.marketStats.findUnique({ where: { exchange: 'NSE' } }),
      prisma.marketStats.findUnique({ where: { exchange: 'BSE' } }),
    ]);

    if (!nse && !bse) return;

    const totalStocks = (nse?.totalStocks ?? 0) + (bse?.totalStocks ?? 0);
    const totalGainers = (nse?.totalGainers ?? 0) + (bse?.totalGainers ?? 0);
    const totalLosers = (nse?.totalLosers ?? 0) + (bse?.totalLosers ?? 0);
    const totalUnchanged = (nse?.totalUnchanged ?? 0) + (bse?.totalUnchanged ?? 0);

    // Weighted average gain/loss
    const gNse = nse?.totalGainers ?? 0;
    const gBse = bse?.totalGainers ?? 0;
    const avgGain = (gNse + gBse) > 0
      ? Math.round(((nse?.avgGain ?? 0) * gNse + (bse?.avgGain ?? 0) * gBse) / (gNse + gBse) * 100) / 100
      : 0;

    const lNse = nse?.totalLosers ?? 0;
    const lBse = bse?.totalLosers ?? 0;
    const avgLoss = (lNse + lBse) > 0
      ? Math.round(((nse?.avgLoss ?? 0) * lNse + (bse?.avgLoss ?? 0) * lBse) / (lNse + lBse) * 100) / 100
      : 0;

    // Pick top gainer (highest pct across exchanges)
    const nseGPct = nse?.topGainerPct ?? -Infinity;
    const bseGPct = bse?.topGainerPct ?? -Infinity;
    const gSrc = nseGPct >= bseGPct ? nse : bse;

    // Pick top loser (lowest pct across exchanges)
    const nseLPct = nse?.topLoserPct ?? Infinity;
    const bseLPct = bse?.topLoserPct ?? Infinity;
    const lSrc = nseLPct <= bseLPct ? nse : bse;

    await prisma.$executeRawUnsafe(`
      INSERT INTO "MarketStats" (
        id, exchange, "totalStocks", "totalGainers", "totalLosers", "totalUnchanged",
        "avgGain", "avgLoss",
        "topGainerName", "topGainerSymbol", "topGainerSector", "topGainerLtp", "topGainerPct",
        "topLoserName", "topLoserSymbol", "topLoserSector", "topLoserLtp", "topLoserPct",
        "lastSyncAt", "syncCycles", "updatedAt"
      ) VALUES (
        'Both', 'Both',
        ${totalStocks}, ${totalGainers}, ${totalLosers}, ${totalUnchanged},
        ${avgGain}, ${avgLoss},
        ${gSrc?.topGainerName ? `'${esc(gSrc.topGainerName)}'` : 'NULL'},
        ${gSrc?.topGainerSymbol ? `'${esc(gSrc.topGainerSymbol)}'` : 'NULL'},
        ${gSrc?.topGainerSector ? `'${esc(gSrc.topGainerSector)}'` : 'NULL'},
        ${gSrc?.topGainerLtp != null ? gSrc.topGainerLtp : 'NULL'},
        ${gSrc?.topGainerPct != null ? gSrc.topGainerPct : 'NULL'},
        ${lSrc?.topLoserName ? `'${esc(lSrc.topLoserName)}'` : 'NULL'},
        ${lSrc?.topLoserSymbol ? `'${esc(lSrc.topLoserSymbol)}'` : 'NULL'},
        ${lSrc?.topLoserSector ? `'${esc(lSrc.topLoserSector)}'` : 'NULL'},
        ${lSrc?.topLoserLtp != null ? lSrc.topLoserLtp : 'NULL'},
        ${lSrc?.topLoserPct != null ? lSrc.topLoserPct : 'NULL'},
        NOW(), COALESCE((SELECT "syncCycles" FROM "MarketStats" WHERE exchange = 'Both'), 0) + 1, NOW()
      )
      ON CONFLICT (exchange) DO UPDATE SET
        "totalStocks" = EXCLUDED."totalStocks",
        "totalGainers" = EXCLUDED."totalGainers",
        "totalLosers" = EXCLUDED."totalLosers",
        "totalUnchanged" = EXCLUDED."totalUnchanged",
        "avgGain" = EXCLUDED."avgGain",
        "avgLoss" = EXCLUDED."avgLoss",
        "topGainerName" = EXCLUDED."topGainerName",
        "topGainerSymbol" = EXCLUDED."topGainerSymbol",
        "topGainerSector" = EXCLUDED."topGainerSector",
        "topGainerLtp" = EXCLUDED."topGainerLtp",
        "topGainerPct" = EXCLUDED."topGainerPct",
        "topLoserName" = EXCLUDED."topLoserName",
        "topLoserSymbol" = EXCLUDED."topLoserSymbol",
        "topLoserSector" = EXCLUDED."topLoserSector",
        "topLoserLtp" = EXCLUDED."topLoserLtp",
        "topLoserPct" = EXCLUDED."topLoserPct",
        "lastSyncAt" = NOW(),
        "syncCycles" = "MarketStats"."syncCycles" + 1,
        "updatedAt" = NOW()
    `);
  } catch (e) {
    console.error('[Sync:Writer] Combined MarketStats error:', e instanceof Error ? e.message : e);
  }
}
