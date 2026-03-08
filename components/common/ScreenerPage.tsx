'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import TopGainersLosersTable from '@/components/TopGainersLosersTable';
import { AuthGuard } from './AuthGuard';
import { LoadingSpinner } from './LoadingSpinner';
import { formatMarketDate } from '@/lib/utils';
import { type ScreenerType, screenerConfigs } from '@/lib/screener-config';
import type { TopGainerLoserStock } from '@/lib/mockData';
import apiClient from '@/lib/api-client';

interface MarketStock {
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
  week52High?: number;
  week52Low?: number;
  volume?: number;
}

/** Convert API stock to the shape TopGainersLosersTable expects */
function toTableStock(s: MarketStock): TopGainerLoserStock {
  return {
    id: s.id,
    stockName: s.companyName,
    symbol: s.tradingSymbol,
    price: s.cmp,
    change: s.netChange,
    changePercent: s.percentChange,
    daysHigh: s.week52High ?? s.cmp,
    daysLow: s.week52Low ?? s.cmp,
    open: s.preClose + s.netChange * 0.3, // approximate
    vwap: s.cmp,
    sparklineData: [],
    sector: s.sector,
    industry: s.industry,
    group: s.group,
    faceValue: s.faceValue,
    priceBand: parseFloat(s.priceBand) || undefined,
    mktCap: s.marketCap,
    preClose: s.preClose,
  };
}

/** Apply screener-specific filters */
function applyFilter(
  gainers: MarketStock[],
  losers: MarketStock[],
  filter?: string,
): MarketStock[] {
  const all = [...gainers, ...losers];

  switch (filter) {
    case 'onlyBuyers':
      // Stocks hitting upper circuit (price >= upper circuit limit approximation: band > 0 and at ceiling)
      return gainers.filter((s) => s.priceBand !== 'No Band' && s.percentChange >= parseFloat(s.priceBand));
    case 'onlySellers':
      return losers.filter((s) => s.priceBand !== 'No Band' && Math.abs(s.percentChange) >= parseFloat(s.priceBand));
    case '52wkHigh':
      return gainers.filter((s) => s.week52High && s.cmp >= s.week52High * 0.98);
    case '52wkLow':
      return losers.filter((s) => s.week52Low && s.cmp <= s.week52Low * 1.02);
    case 'allTimeHigh':
      // ATH uses historical data — approximate with 52wk high + strong gains
      return gainers.filter((s) => s.week52High && s.cmp >= s.week52High);
    case 'allTimeLow':
      return losers.filter((s) => s.week52Low && s.cmp <= s.week52Low);
    case 'priceShockers':
      return all
        .filter((s) => Math.abs(s.percentChange) >= 5)
        .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
    case 'volumeShockers':
      return all
        .filter((s) => (s.volume ?? 0) > 0)
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
        .slice(0, 100);
    case 'mostActiveByValue':
      return all
        .filter((s) => (s.volume ?? 0) > 0)
        .sort((a, b) => (b.cmp * (b.volume ?? 0)) - (a.cmp * (a.volume ?? 0)))
        .slice(0, 100);
    default:
      return all;
  }
}

interface ScreenerPageProps {
  screenerType: ScreenerType;
}

function ScreenerContent({ screenerType }: ScreenerPageProps) {
  const config = screenerConfigs[screenerType];
  const [gainers, setGainers] = useState<MarketStock[]>([]);
  const [losers, setLosers] = useState<MarketStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchange, setExchange] = useState<'NSE' | 'BSE'>('NSE');
  const dateStr = useMemo(() => formatMarketDate(), []);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get(`/api/market/live?exchange=${exchange}`);
      setGainers(res.data.gainers || []);
      setLosers(res.data.losers || []);
    } catch {
      // Silently fail — table will show empty
    } finally {
      setLoading(false);
    }
  }, [exchange]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    // Auto-refresh every 30s
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const stocks = useMemo(() => {
    let source: MarketStock[];
    const filterType = 'filter' in config ? config.filter : undefined;
    if (filterType) {
      source = applyFilter(gainers, losers, filterType);
    } else if (config.dataSource === 'gainers') {
      source = gainers;
    } else if (config.dataSource === 'losers') {
      source = losers;
    } else {
      source = [...gainers, ...losers];
    }
    // Re-index
    return source.map((s, i) => ({ ...s, id: `${i + 1}` }));
  }, [gainers, losers, config]);

  const tableData = useMemo(() => stocks.map(toTableStock), [stocks]);

  if (loading) {
    return <LoadingSpinner message={config.loadingMessage} />;
  }

  return (
    <TopGainersLosersTable
      data={tableData}
      type={config.tableType}
      exchange={exchange}
      index="NIFTY 500"
      date={dateStr}
    />
  );
}

export function ScreenerPage({ screenerType }: ScreenerPageProps) {
  const config = screenerConfigs[screenerType];

  return (
    <AuthGuard loadingMessage={config.loadingMessage}>
      <ScreenerContent screenerType={screenerType} />
    </AuthGuard>
  );
}
