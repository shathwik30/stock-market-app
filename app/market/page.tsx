'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

// Time period tabs
type TimePeriod = 'intraday' | 'days' | 'weeks' | 'months' | 'years' | 'customize';
type SubTab = 'custom' | 'seasonality' | 'ytd' | '52weeks' | 'all_time';
type Exchange = 'NSE' | 'BSE' | 'Both';
type ViewType = 'all' | 'gainers' | 'losers' | 'unchanged';

const PAGE_SIZE = 150;

// Column definitions for each type
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

const baseColumns = ['S No', 'Company Name', 'Sector', 'Industry', 'Group', 'F V', 'P Band', 'M Cap', 'Pre Close', 'CMP', 'Net Chag'];

interface StockData {
  id: string;
  companyName: string;
  tradingSymbol?: string;
  sector: string;
  industry: string;
  group: string;
  faceValue: number;
  priceBand: string;
  marketCap: string;
  preClose: number;
  cmp: number;
  netChange: number;
  percentChange?: number;
  percentChanges: Record<string, number | null>;
  volume?: number;
  week52High?: number;
  week52Low?: number;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalStocks: number;
  totalPages: number;
}

interface Stats {
  totalGainers: number;
  totalLosers: number;
  totalUnchanged: number;
  avgGain: number;
  avgLoss: number;
}

interface SyncStatus {
  isRunning: boolean;
  historicalPopulating: boolean;
  historicalProgress: { completed: number; total: number };
  cachedCount: number;
}

// ── Pagination Controls ──
const PaginationControls = ({
  pagination,
  onPageChange,
}: {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
}) => {
  const { page, totalPages, totalStocks, pageSize } = pagination;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalStocks);

  // Generate visible page numbers (show max 7 pages around current)
  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    if (page <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...', totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1, '...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1, '...');
      for (let i = page - 1; i <= page + 1; i++) pages.push(i);
      pages.push('...', totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between py-3 px-2 border-t border-gray-300 bg-gray-50">
      <span className="text-xs text-gray-600">
        Showing {start}–{end} of {totalStocks} stocks
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title="First page"
        >
          <ChevronsLeft className="w-4 h-4 text-gray-700" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4 text-gray-700" />
        </button>

        {getPageNumbers().map((p, idx) =>
          p === '...' ? (
            <span key={`dots-${idx}`} className="px-2 text-xs text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[32px] h-8 px-2 text-xs rounded font-medium ${
                p === page
                  ? 'bg-black text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4 text-gray-700" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Last page"
        >
          <ChevronsRight className="w-4 h-4 text-gray-700" />
        </button>
      </div>

      <span className="text-xs text-gray-600">
        Page {page} of {totalPages}
      </span>
    </div>
  );
};

// ── Stock Table with Pagination ──
const StockTable = ({
  data,
  columns,
  title,
  pagination,
  onPageChange,
  sortCol,
  sortOrder,
  onSort,
}: {
  data: StockData[];
  columns: string[];
  title: string;
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  sortCol: string;
  sortOrder: 'asc' | 'desc';
  onSort: (col: string) => void;
}) => {
  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return <span className="ml-1 text-[10px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className="border border-black">
      {/* Section Title */}
      <div className="text-center py-2 font-bold text-black border-b border-black bg-gray-50">
        {title} ({pagination.totalStocks})
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100">
              {baseColumns.map((col) => (
                <th
                  key={col}
                  className="border border-gray-400 px-2 py-1 text-black font-semibold text-center whitespace-nowrap bg-gray-100 cursor-pointer hover:bg-gray-200"
                  onClick={() => {
                    if (col === 'S No') return;
                    const sortMap: Record<string, string> = {
                      'Company Name': 'name',
                      'CMP': 'lastPrice',
                      'Pre Close': 'prevClose',
                      'Net Chag': 'netChange',
                      'M Cap': 'marketCap',
                    };
                    if (sortMap[col]) onSort(sortMap[col]);
                  }}
                >
                  {col}
                  {col === 'Company Name' && <SortIcon col="name" />}
                  {col === 'CMP' && <SortIcon col="lastPrice" />}
                  {col === 'Net Chag' && <SortIcon col="netChange" />}
                  {col === 'M Cap' && <SortIcon col="marketCap" />}
                </th>
              ))}
              {columns.map((col) => (
                <th
                  key={col}
                  className="border border-gray-400 px-2 py-1 text-black font-semibold text-center whitespace-nowrap bg-yellow-100 cursor-pointer hover:bg-yellow-200"
                  onClick={() => onSort(col)}
                >
                  {col}
                  <SortIcon col={col} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={baseColumns.length + columns.length} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                  No data available
                </td>
              </tr>
            ) : (
              data.map((stock) => {
                const isPositive = stock.netChange > 0;
                const isNegative = stock.netChange < 0;
                const colorClass = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600';

                return (
                  <tr key={`${stock.id}-${stock.companyName}`} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-2 py-1 text-center text-black">{stock.id}</td>
                    <td className="border border-gray-300 px-2 py-1 text-black font-medium whitespace-nowrap">{stock.companyName}</td>
                    <td className="border border-gray-300 px-2 py-1 text-black whitespace-nowrap">{stock.sector}</td>
                    <td className="border border-gray-300 px-2 py-1 text-black whitespace-nowrap">{stock.industry}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center text-black">{stock.group}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center text-black">{stock.faceValue}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center text-black">{stock.priceBand}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-black whitespace-nowrap">{stock.marketCap}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-black">{stock.preClose.toFixed(2)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-black font-medium">{stock.cmp.toFixed(2)}</td>
                    <td className={`border border-gray-300 px-2 py-1 text-right font-medium ${colorClass}`}>
                      {isPositive ? '+' : ''}{stock.netChange.toFixed(2)}
                    </td>
                    {columns.map((col) => {
                      const value = stock.percentChanges[col];
                      const isNull = value === null || value === undefined;
                      return (
                        <td
                          key={col}
                          className={`border border-gray-300 px-2 py-1 text-right font-medium ${isNull ? 'text-gray-400' : value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600'}`}
                        >
                          {isNull ? '-' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <PaginationControls pagination={pagination} onPageChange={onPageChange} />
      )}
    </div>
  );
};

// ── Main Page Content ──
function MarketPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State from URL params
  const viewParam = searchParams.get('view') as ViewType | null;
  const currentView: ViewType = viewParam === 'gainers' || viewParam === 'losers' || viewParam === 'unchanged' ? viewParam : 'all';

  const [selectedExchange, setSelectedExchange] = useState<Exchange>('NSE');
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, pageSize: PAGE_SIZE, totalStocks: 0, totalPages: 0 });
  const [stats, setStats] = useState<Stats>({ totalGainers: 0, totalLosers: 0, totalUnchanged: 0, avgGain: 0, avgLoss: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('intraday');
  const [sortCol, setSortCol] = useState('pctChange');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const exchanges: Exchange[] = ['NSE', 'BSE', 'Both'];

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

  const currentColumns = columnsByPeriod[activeTab as TimePeriod | SubTab] || [];
  const periodLabel = allTabs.find(t => t.id === activeTab)?.label;

  // Fetch data from the paginated API
  const fetchMarketData = useCallback(async (page: number, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const filter = currentView === 'all' ? 'all' : currentView;
      const params = new URLSearchParams({
        exchange: selectedExchange,
        filter,
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sort: sortCol,
        order: sortOrder,
        ...(searchQuery ? { search: searchQuery } : {}),
      });

      const response = await fetch(`/api/market/live?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to fetch market data');
      }

      const data = await response.json();
      setStockData(data.stocks || []);
      setPagination(data.pagination || { page: 1, pageSize: PAGE_SIZE, totalStocks: 0, totalPages: 0 });
      setStats(data.stats || { totalGainers: 0, totalLosers: 0, totalUnchanged: 0, avgGain: 0, avgLoss: 0 });
      setLastSyncAt(data.lastSyncAt);
      setSyncStatus(data.syncStatus || null);
      setCurrentPage(data.pagination?.page || 1);
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load live market data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedExchange, currentView, sortCol, sortOrder, searchQuery]);

  // Fetch on mount and when deps change
  useEffect(() => {
    setCurrentPage(1);
    fetchMarketData(1);
  }, [fetchMarketData]);

  // Auto-refresh every 60 seconds (balanced: fresh data + low bandwidth)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMarketData(currentPage, true);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData, currentPage]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchMarketData(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle sort
  const handleSort = (col: string) => {
    if (col === sortCol) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // Handle search with debounce
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Handle view change
  const handleViewChange = (view: ViewType) => {
    setCurrentPage(1);
    router.push(`/market?view=${view}`);
  };

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCurrentPage(1);
    // Reset sort to daily % change when switching tabs
    setSortCol('pctChange');
    setSortOrder('desc');
  };

  // Handle exchange change
  const handleExchangeChange = (exchange: Exchange) => {
    setSelectedExchange(exchange);
    setCurrentPage(1);
  };

  // CSV Download
  const downloadCSV = () => {
    const allColumns = [...baseColumns, ...currentColumns];
    const headers = allColumns.join(',');

    const csvLines: string[] = [];
    csvLines.push(`Market Data - ${periodLabel} - ${selectedExchange} - ${currentView}`);
    csvLines.push(`Generated on: ${new Date().toLocaleString()}`);
    csvLines.push(`Page ${pagination.page} of ${pagination.totalPages} (${pagination.totalStocks} total)`);
    csvLines.push('');
    csvLines.push(headers);

    stockData.forEach((stock) => {
      const base = [
        stock.id,
        `"${stock.companyName}"`,
        `"${stock.sector}"`,
        `"${stock.industry}"`,
        stock.group,
        stock.faceValue,
        `"${stock.priceBand}"`,
        `"${stock.marketCap}"`,
        stock.preClose.toFixed(2),
        stock.cmp.toFixed(2),
        stock.netChange.toFixed(2),
      ];
      const pctData = currentColumns.map(col => {
        const value = stock.percentChanges[col];
        return value === null || value === undefined ? '-' : value.toFixed(2);
      });
      csvLines.push([...base, ...pctData].join(','));
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `market_${activeTab}_${selectedExchange}_${currentView}_p${currentPage}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Total stocks from stats
  const totalStocksCount = stats.totalGainers + stats.totalLosers + stats.totalUnchanged;

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full px-4 py-4">
        {/* Tabs */}
        <div className="flex border-b-2 border-black mb-4 overflow-x-auto">
          {allTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
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

        {/* Custom date picker placeholder */}
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

        {/* Exchange Tabs & Actions Row */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Exchange Selection */}
            <div className="flex items-center gap-4">
              {exchanges.map((exchange) => (
                <label key={exchange} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="exchange"
                    checked={selectedExchange === exchange}
                    onChange={() => handleExchangeChange(exchange)}
                    className="w-4 h-4 text-black border-gray-300 focus:ring-black"
                  />
                  <span className={`ml-2 text-sm font-medium ${selectedExchange === exchange ? 'text-black underline' : 'text-gray-600'}`}>
                    {exchange}
                  </span>
                </label>
              ))}
            </div>

            {/* Live indicator */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-xs text-gray-500">
                Live Data · {totalStocksCount} Stocks
                {lastSyncAt && ` · Synced ${new Date(lastSyncAt).toLocaleTimeString()}`}
              </span>
            </div>

            {/* Sync status */}
            {syncStatus?.historicalPopulating && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                <span className="text-xs text-blue-600">
                  Syncing historical: {syncStatus.historicalProgress.completed}/{syncStatus.historicalProgress.total} ({syncStatus.cachedCount} cached)
                </span>
              </div>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search company..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-sm border border-gray-300 rounded w-48 focus:outline-none focus:border-black text-black"
              />
            </div>
            <button
              onClick={() => fetchMarketData(currentPage, true)}
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

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mb-4"></div>
            <p className="text-gray-600 text-sm">Loading market data...</p>
            <p className="text-gray-400 text-xs mt-1">Fetching from database</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="border border-red-300 bg-red-50 rounded p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
            <button onClick={() => fetchMarketData(1)} className="mt-2 text-sm text-red-600 underline hover:text-red-800">
              Try again
            </button>
          </div>
        )}

        {/* Data Tables */}
        {!loading && !error && (
          <>
            {/* View toggle buttons */}
            <div className="flex border-b border-black mb-0">
              <button
                onClick={() => handleViewChange('all')}
                className={`flex-1 text-center py-2 font-bold border-r border-black ${
                  currentView === 'all' ? 'text-black bg-gray-50' : 'text-gray-400 bg-gray-100'
                }`}
              >
                All ({totalStocksCount})
              </button>
              <button
                onClick={() => handleViewChange('gainers')}
                className={`flex-1 text-center py-2 font-bold border-r border-black ${
                  currentView === 'gainers' ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'
                }`}
              >
                Gainers ({stats.totalGainers})
              </button>
              <button
                onClick={() => handleViewChange('losers')}
                className={`flex-1 text-center py-2 font-bold border-r border-black ${
                  currentView === 'losers' ? 'text-red-600 bg-red-50' : 'text-gray-400 bg-gray-100'
                }`}
              >
                Losers ({stats.totalLosers})
              </button>
              <button
                onClick={() => handleViewChange('unchanged')}
                className={`flex-1 text-center py-2 font-bold ${
                  currentView === 'unchanged' ? 'text-gray-700 bg-gray-50' : 'text-gray-400 bg-gray-100'
                }`}
              >
                Unchanged ({stats.totalUnchanged})
              </button>
            </div>

            <div className="text-center py-2 border border-t-0 border-black bg-gray-50 font-semibold text-black mb-4">
              {periodLabel} · Powered by Dhan API · {PAGE_SIZE} stocks per page
            </div>

            {/* Single paginated table */}
            <div className="mb-6">
              <StockTable
                data={stockData}
                columns={currentColumns}
                title={
                  currentView === 'gainers' ? 'Gainers' :
                  currentView === 'losers' ? 'Losers' :
                  currentView === 'unchanged' ? 'Unchanged' :
                  'All Stocks'
                }
                pagination={pagination}
                onPageChange={handlePageChange}
                sortCol={sortCol}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MarketPageLoading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense fallback={<MarketPageLoading />}>
      <MarketPageContent />
    </Suspense>
  );
}
