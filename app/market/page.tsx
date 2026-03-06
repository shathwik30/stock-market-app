'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLiveMarketStream } from '@/hooks/useLiveMarketStream';

type TimePeriod = 'intraday' | 'days' | 'weeks' | 'months' | 'years' | 'customize';
type SubTab = 'custom' | 'seasonality' | 'ytd' | '52weeks' | 'all_time';
type Exchange = 'NSE' | 'BSE';
type ViewType = 'all' | 'gainers' | 'losers';

const columnsByPeriod: Record<TimePeriod | SubTab, string[]> = {
  intraday: ['% 5Min Chag', '% 15Min Chag', '% 30Min Chag', '% 1Hour Chag', '% 2Hours Chag', '% Cust Date Chag'],
  days: ['% Chag', '% 2D Chag', '% 3D Chag', '% 4D Chag', '% 5D Chag', '% 1W Chag', '% Cust Date Chag'],
  weeks: ['% 1W Chag', '% 2W Chag', '% 3W Chag', '% 4W Chag', '% 5W Chag', '% 1M Chag', '% Cust Date Chag'],
  months: ['% 1M Chag', '% 2M Chag', '% 3M Chag', '% 4M Chag', '% 5M Chag', '% 6M Chag', '% 7M Chag', '% 8M Chag', '% 9M Chag', '% 10M Chag', '% 11M Chag', '% 1Y Chag'],
  years: ['% 1Y Chag', '% 2Y Chag', '% 3Y Chag', '% 4Y Chag', '% 5Y Chag', '% 10Y Chag', '% Max Chag'],
  customize: [],
  custom: ['% Chag', '% Cust Date Chag'],
  seasonality: ['% Chag', '% Cust Date Chag'],
  ytd: ['% YTD Chag', '% 2YTD Chag', '% 3YTD Chag', '% 4YTD Chag', '% 5YTD Chag', '% 10 YTD Chag', '% Cust Date Chag'],
  '52weeks': ['% 52W Chag', '% Cust Date Chag'],
  all_time: ['% ATH&L Chag', '% Cust Date Chag'],
};

const baseColumns = ['S No', 'Company Name', 'Symbol', 'P Band', 'Pre Close', 'CMP', 'Net Chag', 'Volume'];

interface StockData {
  id: string;
  companyName: string;
  symbol: string;
  securityId: string;
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
  volume: number;
  open: number;
  high: number;
  low: number;
  percentChanges: Record<string, number>;
}

// Needs historical columns that go beyond just % Chag (1D)
function needsHistorical(tabId: string): boolean {
  return tabId !== 'intraday' && tabId !== 'days' && tabId !== 'custom' && tabId !== 'seasonality';
}

const StockTable = ({
  data,
  columns,
  title,
  pageOffset,
  hasHistorical,
}: {
  data: StockData[];
  columns: string[];
  title: string;
  pageOffset: number;
  hasHistorical: boolean;
}) => {
  // Only show % columns that have data
  const showColumns = hasHistorical ? columns : columns.filter(c => c === '% Chag');

  return (
    <div className="border border-black">
      <div className="text-center py-2 font-bold text-black border-b border-black bg-gray-50">
        {title}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {baseColumns.map((col) => (
                <th key={col} className="border border-gray-400 px-2 py-1 text-black font-semibold text-center whitespace-nowrap">
                  {col}
                </th>
              ))}
              {showColumns.map((col) => (
                <th key={col} className="border border-gray-400 px-2 py-1 text-black font-semibold text-center whitespace-nowrap bg-yellow-100">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={baseColumns.length + showColumns.length} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                  No data available
                </td>
              </tr>
            ) : (
              data.map((stock, index) => (
                <tr key={stock.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-2 py-1 text-center text-black">{pageOffset + index + 1}</td>
                  <td className="border border-gray-300 px-2 py-1 text-black font-medium whitespace-nowrap">{stock.companyName}</td>
                  <td className="border border-gray-300 px-2 py-1 text-black whitespace-nowrap">{stock.symbol}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center text-black">{stock.priceBand}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right text-black">{stock.preClose.toFixed(2)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right text-black font-medium">{stock.cmp.toFixed(2)}</td>
                  <td className={`border border-gray-300 px-2 py-1 text-right font-medium ${stock.netChange > 0 ? 'text-green-600' : stock.netChange < 0 ? 'text-red-600' : 'text-black'}`}>
                    {stock.netChange > 0 ? '+' : ''}{stock.netChange.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right text-black">
                    {stock.volume ? stock.volume.toLocaleString() : '-'}
                  </td>
                  {showColumns.map((col) => {
                    const value = stock.percentChanges[col] || 0;
                    return (
                      <td
                        key={col}
                        className={`border border-gray-300 px-2 py-1 text-right font-medium ${value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-black'}`}
                      >
                        {value > 0 ? '+' : ''}{value.toFixed(2)}%
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Pagination component
const Pagination = ({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}) => {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-3">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-1.5 border border-gray-300 rounded disabled:opacity-30 hover:bg-gray-100"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm text-black">
        Page {page} of {totalPages} ({total} stocks)
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="p-1.5 border border-gray-300 rounded disabled:opacity-30 hover:bg-gray-100"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

function TopGainersLosersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const viewParam = searchParams.get('view') as ViewType | null;
  const currentView: ViewType = viewParam === 'gainers' || viewParam === 'losers' ? viewParam : 'all';

  const [selectedExchange, setSelectedExchange] = useState<Exchange>('NSE');
  const [gainers, setGainers] = useState<StockData[]>([]);
  const [losers, setLosers] = useState<StockData[]>([]);
  const [totalGainers, setTotalGainers] = useState(0);
  const [totalLosers, setTotalLosers] = useState(0);
  const [totalStocks, setTotalStocks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const exchanges: Exchange[] = ['NSE', 'BSE'];

  const [activeTab, setActiveTab] = useState<string>('days');
  const currentColumns = columnsByPeriod[activeTab as TimePeriod | SubTab] || [];
  const [hasHistorical, setHasHistorical] = useState(false);

  // Fetch quote data (fast — no historical)
  const fetchQuoteData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await fetch(`/api/market/live?exchange=${selectedExchange}&page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error('Failed to fetch market data');

      const data = await res.json();
      setGainers(data.gainers || []);
      setLosers(data.losers || []);
      setTotalGainers(data.totalGainers || 0);
      setTotalLosers(data.totalLosers || 0);
      setTotalStocks(data.totalStocks || 0);
      setLastUpdated(data.lastUpdated);
      setHasHistorical(false);
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError('Failed to load live market data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedExchange, page]);

  // Fetch historical enrichment for current page (slower)
  const fetchHistorical = useCallback(async () => {
    if (!needsHistorical(activeTab)) return;
    setHistoricalLoading(true);
    try {
      const res = await fetch(`/api/market/live?exchange=${selectedExchange}&page=${page}&pageSize=${pageSize}&historical=1`);
      if (!res.ok) return;
      const data = await res.json();
      setGainers(data.gainers || []);
      setLosers(data.losers || []);
      setHasHistorical(true);
    } catch {
      // Silently fail — quote data still shows
    } finally {
      setHistoricalLoading(false);
    }
  }, [selectedExchange, page, activeTab]);

  // Live stream
  const { liveTicks, connected: streamConnected } = useLiveMarketStream();

  // Merge live ticks into current page data
  const liveGainers = useMemo(() => {
    if (liveTicks.size === 0) return gainers;
    return gainers.map((stock) => {
      const live = liveTicks.get(stock.companyName);
      if (!live || live.ltp === 0) return stock;
      const netChange = Number((live.ltp - stock.preClose).toFixed(2));
      const pctChange = stock.preClose ? Number((((live.ltp - stock.preClose) / stock.preClose) * 100).toFixed(2)) : 0;
      return {
        ...stock,
        cmp: live.ltp,
        netChange,
        percentChange: pctChange,
        percentChanges: { ...stock.percentChanges, '% Chag': pctChange },
      };
    });
  }, [gainers, liveTicks]);

  const liveLosers = useMemo(() => {
    if (liveTicks.size === 0) return losers;
    return losers.map((stock) => {
      const live = liveTicks.get(stock.companyName);
      if (!live || live.ltp === 0) return stock;
      const netChange = Number((live.ltp - stock.preClose).toFixed(2));
      const pctChange = stock.preClose ? Number((((live.ltp - stock.preClose) / stock.preClose) * 100).toFixed(2)) : 0;
      return {
        ...stock,
        cmp: live.ltp,
        netChange,
        percentChange: pctChange,
        percentChanges: { ...stock.percentChanges, '% Chag': pctChange },
      };
    });
  }, [losers, liveTicks]);

  // Fetch on mount and when exchange/page changes
  useEffect(() => {
    fetchQuoteData();
  }, [fetchQuoteData]);

  // Fetch historical when tab changes to one that needs it
  useEffect(() => {
    if (needsHistorical(activeTab) && !hasHistorical && !loading) {
      fetchHistorical();
    }
  }, [activeTab, hasHistorical, loading, fetchHistorical]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchQuoteData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchQuoteData]);

  // Reset page on exchange change
  useEffect(() => {
    setPage(1);
  }, [selectedExchange]);

  const allTabs: { id: string; label: string }[] = [
    { id: 'intraday', label: 'Intraday Wise' },
    { id: 'days', label: 'Days Wise' },
    { id: 'weeks', label: 'Weeks Wise' },
    { id: 'months', label: 'Months Wise' },
    { id: 'years', label: 'Years Wise' },
    { id: 'custom', label: 'Customize Date' },
    { id: 'seasonality', label: 'Seasonality' },
    { id: 'ytd', label: 'Year to Date' },
    { id: '52weeks', label: '52 Weeks Gainers & Losers' },
    { id: 'all_time', label: 'All Time Gainers & Losers' },
  ];

  const periodLabel = allTabs.find(t => t.id === activeTab)?.label;
  const pageOffset = (page - 1) * pageSize;

  // CSV Download
  const downloadCSV = () => {
    const showColumns = hasHistorical ? currentColumns : currentColumns.filter(c => c === '% Chag');
    const allCols = [...baseColumns, ...showColumns];
    const headers = allCols.join(',');

    const createRow = (stock: StockData, index: number): string => {
      const base = [
        pageOffset + index + 1,
        `"${stock.companyName}"`,
        stock.symbol,
        `"${stock.priceBand}"`,
        stock.preClose.toFixed(2),
        stock.cmp.toFixed(2),
        stock.netChange.toFixed(2),
        stock.volume || 0,
      ];
      const pcts = showColumns.map(col => (stock.percentChanges[col] || 0).toFixed(2));
      return [...base, ...pcts].join(',');
    };

    const lines: string[] = [];
    lines.push(`Top Gainers and Losers - ${periodLabel} - ${selectedExchange}`);
    lines.push(`Generated on: ${new Date().toLocaleString()}`);
    lines.push(`Total: ${totalStocks} stocks | Gainers: ${totalGainers} | Losers: ${totalLosers}`);
    lines.push('');

    lines.push('GAINERS');
    lines.push(headers);
    liveGainers.forEach((s, i) => lines.push(createRow(s, i)));
    lines.push('');

    lines.push('LOSERS');
    lines.push(headers);
    liveLosers.forEach((s, i) => lines.push(createRow(s, i)));

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `market_${activeTab}_${selectedExchange}_p${page}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full px-4 py-4">
        {/* Tabs */}
        <div className="flex border-b-2 border-black mb-4 overflow-x-auto">
          {allTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-t border-l last:border-r border-black -mb-[2px] whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white border-b-2 border-b-white text-black'
                  : 'bg-gray-100 text-black hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'custom' && (
          <div className="mb-4 border border-black p-4 bg-gray-50">
            <div className="flex items-center gap-4">
              <span className="font-bold text-sm">Choose Your Choice of Data:</span>
              <div className="border border-gray-400 px-2 py-1 bg-white w-64 text-sm text-gray-500">
                Select date range...
              </div>
            </div>
          </div>
        )}

        {/* Controls Row */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            {/* Exchange */}
            <div className="flex items-center gap-4">
              {exchanges.map((ex) => (
                <label key={ex} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="exchange"
                    checked={selectedExchange === ex}
                    onChange={() => setSelectedExchange(ex)}
                    className="w-4 h-4 text-black border-gray-300 focus:ring-black"
                  />
                  <span className={`ml-2 text-sm font-medium ${selectedExchange === ex ? 'text-black underline' : 'text-gray-600'}`}>
                    {ex}
                  </span>
                </label>
              ))}
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${streamConnected ? 'bg-green-400' : 'bg-yellow-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${streamConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
              </span>
              <span className="text-xs text-gray-500">
                {streamConnected ? 'Live' : 'Connecting...'}
                {totalStocks > 0 && ` · ${totalStocks} stocks`}
                {lastUpdated && ` · ${new Date(lastUpdated).toLocaleTimeString()}`}
              </span>
              {historicalLoading && (
                <span className="text-xs text-blue-500 animate-pulse">Loading historical...</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => fetchQuoteData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-black font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mb-4"></div>
            <p className="text-gray-600 text-sm">Loading market data for all {selectedExchange} stocks...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="border border-red-300 bg-red-50 rounded p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
            <button onClick={() => fetchQuoteData()} className="mt-2 text-sm text-red-600 underline hover:text-red-800">
              Try again
            </button>
          </div>
        )}

        {/* Tables */}
        {!loading && !error && (
          <>
            {/* Gainers */}
            {(currentView === 'all' || currentView === 'gainers') && (
              <div className="mb-6">
                <div className="flex border-b border-black mb-0">
                  <button
                    onClick={() => router.push('/market?view=gainers')}
                    className="flex-1 text-center py-2 font-bold border-r border-black text-black bg-gray-50"
                  >
                    Gainers ({totalGainers})
                  </button>
                  <button
                    onClick={() => router.push('/market?view=losers')}
                    className="flex-1 text-center py-2 font-bold text-gray-400 bg-gray-100"
                  >
                    Losers ({totalLosers})
                  </button>
                </div>

                <div className="text-center py-2 border border-t-0 border-black bg-gray-50 font-semibold text-black">
                  {periodLabel}
                </div>

                <StockTable
                  data={liveGainers}
                  columns={currentColumns}
                  title={`Top Gainers — Page ${page}`}
                  pageOffset={pageOffset}
                  hasHistorical={hasHistorical}
                />

                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={totalGainers}
                  onPageChange={setPage}
                />
              </div>
            )}

            {/* Losers */}
            {(currentView === 'all' || currentView === 'losers') && (
              <div className="mb-6">
                <div className="flex border-b border-black mb-0">
                  <button
                    onClick={() => router.push('/market?view=gainers')}
                    className="flex-1 text-center py-2 font-bold border-r border-black text-gray-400 bg-gray-100"
                  >
                    Gainers ({totalGainers})
                  </button>
                  <button
                    onClick={() => router.push('/market?view=losers')}
                    className="flex-1 text-center py-2 font-bold text-black bg-gray-50"
                  >
                    Losers ({totalLosers})
                  </button>
                </div>

                <div className="text-center py-2 border border-t-0 border-black bg-gray-50 font-semibold text-black">
                  {periodLabel}
                </div>

                <StockTable
                  data={liveLosers}
                  columns={currentColumns}
                  title={`Top Losers — Page ${page}`}
                  pageOffset={pageOffset}
                  hasHistorical={hasHistorical}
                />

                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={totalLosers}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TopGainersLosersLoading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
    </div>
  );
}

export default function TopGainersLosersPage() {
  return (
    <Suspense fallback={<TopGainersLosersLoading />}>
      <TopGainersLosersContent />
    </Suspense>
  );
}
