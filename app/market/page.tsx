'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import FilterPanel, { type FilterState, type FilterOptions, emptyFilters, emptyFilterOptions } from '@/components/FilterPanel';

// Time period tabs
type TimePeriod = 'intraday' | 'days' | 'weeks' | 'months' | 'years' | 'customize';
type SubTab = 'custom' | 'seasonality' | 'ytd' | '52weeks' | 'all_time';
type Exchange = 'NSE' | 'BSE' | 'Both' | 'Only NSE' | 'Only BSE';
type ViewType = 'all' | 'gainers' | 'losers' | 'unchanged';

const PAGE_SIZE = 200;

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
const TOGGLEABLE_COLUMNS = ['Sector', 'Industry', 'Group', 'F V', 'P Band', 'M Cap', 'Pre Close'];

// Two-month calendar helpers for the Customize Date picker
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const buildMonthGrid = (year: number, month: number): (Date | null)[] => {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();
  // JS getDay: 0=Sun..6=Sat. Shift so Monday=0.
  const offset = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const toIsoDate = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toDisplayDate = (d: Date): string => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const addMonths = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth() + n, 1);

const formatMonthYear = (d: Date): string =>
  d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

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
const SORT_MAP_UI: Record<string, string> = {
  'Company Name': 'name', 'CMP': 'lastPrice', 'Pre Close': 'prevClose',
  'Net Chag': 'netChange', 'M Cap': 'marketCap',
};

const SORT_ICON_MAP: Record<string, string> = {
  'Company Name': 'name', 'CMP': 'lastPrice', 'Net Chag': 'netChange', 'M Cap': 'marketCap',
};

function renderBaseCell(col: string, stock: StockData, colorClass: string) {
  const cls = 'border border-gray-300 px-2 py-1';
  switch (col) {
    case 'S No': return <td key={col} className={`${cls} text-center text-black`}>{stock.id}</td>;
    case 'Company Name': return <td key={col} className={`${cls} text-black font-medium whitespace-nowrap`}>{stock.companyName}</td>;
    case 'Sector': return <td key={col} className={`${cls} text-black whitespace-nowrap`}>{stock.sector}</td>;
    case 'Industry': return <td key={col} className={`${cls} text-black whitespace-nowrap`}>{stock.industry}</td>;
    case 'Group': return <td key={col} className={`${cls} text-center text-black`}>{stock.group}</td>;
    case 'F V': return <td key={col} className={`${cls} text-center text-black`}>{stock.faceValue}</td>;
    case 'P Band': return <td key={col} className={`${cls} text-center text-black`}>{stock.priceBand}</td>;
    case 'M Cap': return <td key={col} className={`${cls} text-right text-black whitespace-nowrap`}>{stock.marketCap}</td>;
    case 'Pre Close': return <td key={col} className={`${cls} text-right text-black`}>{stock.preClose.toFixed(2)}</td>;
    case 'CMP': return <td key={col} className={`${cls} text-right text-black font-medium`}>{stock.cmp.toFixed(2)}</td>;
    case 'Net Chag': return <td key={col} className={`${cls} text-right font-medium ${colorClass}`}>{stock.netChange > 0 ? '+' : ''}{stock.netChange.toFixed(2)}</td>;
    default: return null;
  }
}

const StockTable = ({
  data, columns, title, pagination, onPageChange, sortCol, sortOrder, onSort, hiddenColumns, customDate, customEndDate,
}: {
  data: StockData[];
  columns: string[];
  title: string;
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  sortCol: string;
  sortOrder: 'asc' | 'desc';
  onSort: (col: string) => void;
  hiddenColumns: Set<string>;
  customDate?: string;
  customEndDate?: string;
}) => {
  const visibleBase = baseColumns.filter(c => !hiddenColumns.has(c));

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return <span className="ml-1 text-[10px]">{sortOrder === 'asc' ? '\u25B2' : '\u25BC'}</span>;
  };

  return (
    <div className="border border-black">
      <div className="text-center py-2 font-bold text-black border-b border-black bg-gray-50">
        {title} ({pagination.totalStocks})
      </div>

      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100">
              {visibleBase.map((col) => (
                <th key={col}
                  className="border border-gray-400 px-2 py-1 text-black font-semibold text-center whitespace-nowrap bg-gray-100 cursor-pointer hover:bg-gray-200"
                  onClick={() => { if (SORT_MAP_UI[col]) onSort(SORT_MAP_UI[col]); }}
                >
                  {col}
                  {SORT_ICON_MAP[col] && <SortIcon col={SORT_ICON_MAP[col]} />}
                </th>
              ))}
              {columns.map((col) => {
                let label = col;
                if (col === '% Cust Date Chag' && customDate) {
                  const fmt = (iso: string) =>
                    new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
                  label = customEndDate
                    ? `% ${fmt(customDate)} → ${fmt(customEndDate)} Chag`
                    : `% ${fmt(customDate)} Chag`;
                }
                return (
                  <th key={col}
                    className="border border-gray-400 px-2 py-1 text-black font-semibold text-center whitespace-nowrap bg-yellow-100 cursor-pointer hover:bg-yellow-200"
                    onClick={() => onSort(col)}
                  >
                    {label}<SortIcon col={col} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={visibleBase.length + columns.length} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                  No data available
                </td>
              </tr>
            ) : (
              data.map((stock) => {
                const colorClass = stock.netChange > 0 ? 'text-green-600' : stock.netChange < 0 ? 'text-red-600' : 'text-gray-600';
                return (
                  <tr key={`${stock.id}-${stock.companyName}`} className="hover:bg-gray-50">
                    {visibleBase.map(col => renderBaseCell(col, stock, colorClass))}
                    {columns.map((col) => {
                      const value = stock.percentChanges[col];
                      const isNull = value === null || value === undefined;
                      return (
                        <td key={col}
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

  // Advanced filters
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [debouncedFilters, setDebouncedFilters] = useState<FilterState>(emptyFilters);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(emptyFilterOptions);
  const [filteredCounts, setFilteredCounts] = useState<{ total: number; gainers: number; losers: number; unchanged: number } | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [customDate, setCustomDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [dateError, setDateError] = useState('');
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [isCustomDatePopupOpen, setIsCustomDatePopupOpen] = useState(false);
  const customDateTabRef = useRef<HTMLButtonElement>(null);
  const customDatePopupRef = useRef<HTMLDivElement>(null);

  const exchanges: string[] = ['NSE', 'BSE', 'Both', 'Only NSE', 'Only BSE'];

  // DD/MM/YYYY ↔ YYYY-MM-DD helpers (used by the Customize Date picker)
  const isoToDisplay = (iso: string): string => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return '';
    return `${d}/${m}/${y}`;
  };
  const parseDisplayDate = (input: string): { iso: string; valid: boolean } => {
    const trimmed = input.trim();
    if (!trimmed) return { iso: '', valid: true };
    const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return { iso: '', valid: false };
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (isNaN(d.getTime()) || d.getFullYear() !== Number(yyyy) || d.getMonth() + 1 !== Number(mm) || d.getDate() !== Number(dd)) {
      return { iso: '', valid: false };
    }
    return { iso: `${yyyy}-${mm}-${dd}`, valid: true };
  };

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

  // Debounce filter changes (handles rapid range input typing)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  // When switching to Customize Date tab, prefill inputs with the currently-applied range
  useEffect(() => {
    if (activeTab === 'custom') {
      setStartDateInput(isoToDisplay(customDate));
      setEndDateInput(isoToDisplay(customEndDate));
      setDateError('');
      // Show the month of the currently-applied start date, or today
      const anchor = customDate ? new Date(customDate + 'T00:00:00') : new Date();
      setCalendarMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Fetch filter options when exchange changes
  useEffect(() => {
    fetch(`/api/market/filters?exchange=${selectedExchange}`)
      .then(r => r.json())
      .then(data => setFilterOptions(data))
      .catch(() => {});
  }, [selectedExchange]);

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
        ...(debouncedFilters.sectors.length ? { sectors: debouncedFilters.sectors.join(',') } : {}),
        ...(debouncedFilters.industries.length ? { industries: debouncedFilters.industries.join(',') } : {}),
        ...(debouncedFilters.marketCaps.length ? { marketCaps: debouncedFilters.marketCaps.join(',') } : {}),
        ...(debouncedFilters.priceBands.length ? { priceBands: debouncedFilters.priceBands.join(',') } : {}),
        ...(debouncedFilters.series.length ? { series: debouncedFilters.series.join(',') } : {}),
        ...(debouncedFilters.marketCapMin ? { marketCapMin: debouncedFilters.marketCapMin } : {}),
        ...(debouncedFilters.marketCapMax ? { marketCapMax: debouncedFilters.marketCapMax } : {}),
        ...(debouncedFilters.priceMin ? { priceMin: debouncedFilters.priceMin } : {}),
        ...(debouncedFilters.priceMax ? { priceMax: debouncedFilters.priceMax } : {}),
        ...(debouncedFilters.changeMin ? { changeMin: debouncedFilters.changeMin } : {}),
        ...(debouncedFilters.changeMax ? { changeMax: debouncedFilters.changeMax } : {}),
        ...(debouncedFilters.volumeMin ? { volumeMin: debouncedFilters.volumeMin } : {}),
        ...(customDate ? { customDate } : {}),
        ...(customEndDate ? { customEndDate } : {}),
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
      setFilteredCounts(data.filteredCounts || null);
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
  }, [selectedExchange, currentView, sortCol, sortOrder, searchQuery, debouncedFilters, customDate, customEndDate]);

  // Fetch on mount and when deps change
  useEffect(() => {
    setCurrentPage(1);
    fetchMarketData(1);
  }, [fetchMarketData]);

  // Auto-refresh every 30 seconds for near-real-time data
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMarketData(currentPage, true);
    }, 30000);
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
    // Toggle popup when re-clicking the already-active Customize Date tab
    if (tab === 'custom' && activeTab === 'custom') {
      setIsCustomDatePopupOpen((prev) => !prev);
      return;
    }
    setActiveTab(tab);
    setCurrentPage(1);
    // Reset sort to daily % change when switching tabs
    setSortCol('pctChange');
    setSortOrder('desc');
    setIsCustomDatePopupOpen(tab === 'custom');
  };

  // Close popup on outside click
  useEffect(() => {
    if (!isCustomDatePopupOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        customDatePopupRef.current && !customDatePopupRef.current.contains(target) &&
        customDateTabRef.current && !customDateTabRef.current.contains(target)
      ) {
        setIsCustomDatePopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCustomDatePopupOpen]);

  // Close popup on Escape
  useEffect(() => {
    if (!isCustomDatePopupOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCustomDatePopupOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isCustomDatePopupOpen]);

  // Handle exchange change — reset filters since options differ per exchange
  const handleExchangeChange = (exchange: Exchange) => {
    setSelectedExchange(exchange);
    setFilters(emptyFilters);
    setDebouncedFilters(emptyFilters);
    setCurrentPage(1);
  };

  // CSV Download (respects column visibility)
  const downloadCSV = () => {
    const visibleBase = baseColumns.filter(c => !hiddenColumns.has(c));
    const allColumns = [...visibleBase, ...currentColumns];
    const headers = allColumns.join(',');

    const csvLines: string[] = [];
    csvLines.push(`Market Data - ${periodLabel} - ${selectedExchange} - ${currentView}`);
    csvLines.push(`Generated on: ${new Date().toLocaleString()}`);
    csvLines.push(`Page ${pagination.page} of ${pagination.totalPages} (${pagination.totalStocks} total)`);
    csvLines.push('');
    csvLines.push(headers);

    const getCsvValue = (col: string, stock: StockData): string => {
      switch (col) {
        case 'S No': return stock.id;
        case 'Company Name': return `"${stock.companyName}"`;
        case 'Sector': return `"${stock.sector}"`;
        case 'Industry': return `"${stock.industry}"`;
        case 'Group': return stock.group;
        case 'F V': return String(stock.faceValue);
        case 'P Band': return `"${stock.priceBand}"`;
        case 'M Cap': return `"${stock.marketCap}"`;
        case 'Pre Close': return stock.preClose.toFixed(2);
        case 'CMP': return stock.cmp.toFixed(2);
        case 'Net Chag': return stock.netChange.toFixed(2);
        default: return '';
      }
    };

    stockData.forEach((stock) => {
      const base = visibleBase.map(col => getCsvValue(col, stock));
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

  // Use filtered counts for tab labels (respects advanced filters), fallback to global stats
  const displayCounts = filteredCounts || {
    total: stats.totalGainers + stats.totalLosers + stats.totalUnchanged,
    gainers: stats.totalGainers,
    losers: stats.totalLosers,
    unchanged: stats.totalUnchanged,
  };
  const totalStocksCount = displayCounts.total;

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full px-4 py-4">
        {/* Tabs */}
        <div className="relative mb-4">
          <div className="flex border-b-2 border-black overflow-x-auto">
            {allTabs.map((tab) => (
              <button
                key={tab.id}
                ref={tab.id === 'custom' ? customDateTabRef : undefined}
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

        {/* Custom date picker popup */}
        {isCustomDatePopupOpen && (() => {
          const startIso = parseDisplayDate(startDateInput).iso;
          const endIso = parseDisplayDate(endDateInput).iso;
          const todayIso = toIsoDate(new Date());
          const leftMonth = calendarMonth;
          const rightMonth = addMonths(calendarMonth, 1);
          const leftCells = buildMonthGrid(leftMonth.getFullYear(), leftMonth.getMonth());
          const rightCells = buildMonthGrid(rightMonth.getFullYear(), rightMonth.getMonth());

          const handleDateClick = (d: Date) => {
            const iso = toIsoDate(d);
            const display = toDisplayDate(d);
            // Start a fresh selection if nothing set, or both already set
            if (!startIso || (startIso && endIso)) {
              setStartDateInput(display);
              setEndDateInput('');
              setDateError('');
              return;
            }
            // Start set, end not set
            if (iso < startIso) {
              setStartDateInput(display);
              setEndDateInput('');
              setDateError('');
              return;
            }
            setEndDateInput(display);
            setDateError('');
          };

          const getCellClass = (d: Date | null): string => {
            if (!d) return 'invisible';
            const iso = toIsoDate(d);
            const isStart = iso === startIso;
            const isEnd = iso === endIso;
            const inRange = startIso && endIso && iso > startIso && iso < endIso;
            const isToday = iso === todayIso;

            let cls = 'w-9 h-9 flex items-center justify-center text-sm cursor-pointer transition-colors ';
            if (isStart || isEnd) {
              cls += 'bg-[#1256A0] text-white font-semibold rounded-full ';
            } else if (inRange) {
              cls += 'bg-blue-50 text-[#1256A0] ';
            } else {
              cls += 'text-gray-700 hover:bg-gray-100 rounded-full ';
            }
            if (isToday && !isStart && !isEnd) {
              cls += 'underline ';
            }
            return cls;
          };

          const renderMonth = (cells: (Date | null)[]) => (
            <div className="grid grid-cols-7 gap-y-1">
              {WEEKDAY_LABELS.map((d, i) => (
                <div key={i} className="w-9 h-8 flex items-center justify-center text-xs text-gray-500 font-medium">
                  {d}
                </div>
              ))}
              {cells.map((cell, i) => (
                <div key={i} className="flex items-center justify-center">
                  {cell ? (
                    <button
                      type="button"
                      onClick={() => handleDateClick(cell)}
                      className={getCellClass(cell)}
                    >
                      {cell.getDate()}
                    </button>
                  ) : (
                    <div className="w-9 h-9" />
                  )}
                </div>
              ))}
            </div>
          );

          return (
            <div
              ref={customDatePopupRef}
              className="absolute top-full left-0 z-50 mt-2 border border-gray-300 rounded-lg p-5 bg-white shadow-xl"
              style={{ left: customDateTabRef.current?.offsetLeft ?? 0 }}
            >
              {/* Two-month calendar */}
              <div className="flex items-start gap-8">
                {/* Left month */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
                      className="p-1 text-gray-700 hover:bg-gray-100 rounded"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-semibold text-gray-900">{formatMonthYear(leftMonth)}</span>
                    <div className="w-7" />
                  </div>
                  {renderMonth(leftCells)}
                </div>
                {/* Right month */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-7" />
                    <span className="text-sm font-semibold text-gray-900">{formatMonthYear(rightMonth)}</span>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                      className="p-1 text-gray-700 hover:bg-gray-100 rounded"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                  {renderMonth(rightCells)}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 mt-4 pt-3">
                {/* Today / Clear row */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      const t = new Date();
                      setStartDateInput(toDisplayDate(t));
                      setEndDateInput('');
                      setCalendarMonth(new Date(t.getFullYear(), t.getMonth(), 1));
                      setDateError('');
                    }}
                    className="text-sm font-medium text-[#1256A0] hover:underline"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStartDateInput('');
                      setEndDateInput('');
                      setDateError('');
                      if (customDate || customEndDate) {
                        setCustomDate('');
                        setCustomEndDate('');
                        setCurrentPage(1);
                      }
                    }}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>

                {/* Start/End inputs + Apply */}
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">Start Date</label>
                    <input
                      type="text"
                      value={startDateInput}
                      onChange={(e) => { setStartDateInput(e.target.value); setDateError(''); }}
                      placeholder="DD/MM/YYYY"
                      className="border border-gray-300 rounded px-3 py-2 bg-white text-sm text-black placeholder-gray-400 focus:outline-none focus:border-[#1256A0] focus:ring-1 focus:ring-[#1256A0] w-36"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">End Date</label>
                    <input
                      type="text"
                      value={endDateInput}
                      onChange={(e) => { setEndDateInput(e.target.value); setDateError(''); }}
                      placeholder="DD/MM/YYYY"
                      className="border border-gray-300 rounded px-3 py-2 bg-white text-sm text-black placeholder-gray-400 focus:outline-none focus:border-[#1256A0] focus:ring-1 focus:ring-[#1256A0] w-36"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const start = parseDisplayDate(startDateInput);
                      const end = parseDisplayDate(endDateInput);
                      if (!start.valid) { setDateError('Invalid Start Date. Use DD/MM/YYYY.'); return; }
                      if (!end.valid) { setDateError('Invalid End Date. Use DD/MM/YYYY.'); return; }
                      if (!start.iso && !end.iso) { setDateError('Enter at least a Start Date.'); return; }
                      if (!start.iso) { setDateError('Start Date is required.'); return; }
                      if (end.iso && start.iso > end.iso) { setDateError('Start Date must be before End Date.'); return; }
                      const today = new Date().toISOString().split('T')[0];
                      if (start.iso > today) { setDateError('Start Date cannot be in the future.'); return; }
                      if (end.iso && end.iso > today) { setDateError('End Date cannot be in the future.'); return; }
                      setDateError('');
                      setCustomDate(start.iso);
                      setCustomEndDate(end.iso);
                      setCurrentPage(1);
                      setIsCustomDatePopupOpen(false);
                    }}
                    className="px-6 py-2 border-2 border-[#1256A0] text-[#1256A0] font-semibold text-sm rounded hover:bg-[#1256A0] hover:text-white transition-colors"
                  >
                    Apply
                  </button>
                </div>

                {dateError && (
                  <p className="text-xs text-red-600 mt-3">{dateError}</p>
                )}
                {!dateError && customDate && (
                  <p className="text-xs text-gray-600 mt-3">
                    Showing % change from{' '}
                    <strong className="text-black">{new Date(customDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                    {' '}to{' '}
                    <strong className="text-black">
                      {customEndDate
                        ? new Date(customEndDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'today'}
                    </strong>
                  </p>
                )}
                {!dateError && !customDate && (
                  <p className="text-xs text-gray-400 mt-3">Pick dates on the calendar or type them, then click Apply to compare stock performance between the two dates.</p>
                )}
              </div>
            </div>
          );
        })()}
        </div>

        {/* Active custom date indicator */}
        {customDate && !isCustomDatePopupOpen && (
          <div className="mb-4 flex items-center gap-3 text-xs border border-gray-300 rounded px-3 py-2 bg-yellow-50">
            <span className="text-gray-700">
              Custom date active:{' '}
              <strong className="text-black">{new Date(customDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
              {' → '}
              <strong className="text-black">
                {customEndDate
                  ? new Date(customEndDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'today'}
              </strong>
            </span>
            <button onClick={() => { setActiveTab('custom'); setIsCustomDatePopupOpen(true); }} className="text-blue-600 hover:text-blue-800 underline">Change</button>
            <button onClick={() => { setCustomDate(''); setCustomEndDate(''); setStartDateInput(''); setEndDateInput(''); setCurrentPage(1); }} className="text-red-600 hover:text-red-800 underline">Clear</button>
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
                    onChange={() => handleExchangeChange(exchange as Exchange)}
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

        {/* Filter Panel */}
        <FilterPanel
          filters={filters}
          options={filterOptions}
          onChange={(f) => { setFilters(f); setCurrentPage(1); }}
          onReset={() => { setFilters(emptyFilters); setDebouncedFilters(emptyFilters); setCurrentPage(1); }}
          hiddenColumns={hiddenColumns}
          onHiddenColumnsChange={setHiddenColumns}
          toggleableColumns={TOGGLEABLE_COLUMNS}
        />

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
                Gainers ({displayCounts.gainers})
              </button>
              <button
                onClick={() => handleViewChange('losers')}
                className={`flex-1 text-center py-2 font-bold border-r border-black ${
                  currentView === 'losers' ? 'text-red-600 bg-red-50' : 'text-gray-400 bg-gray-100'
                }`}
              >
                Losers ({displayCounts.losers})
              </button>
              <button
                onClick={() => handleViewChange('unchanged')}
                className={`flex-1 text-center py-2 font-bold ${
                  currentView === 'unchanged' ? 'text-gray-700 bg-gray-50' : 'text-gray-400 bg-gray-100'
                }`}
              >
                Unchanged ({displayCounts.unchanged})
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
                hiddenColumns={hiddenColumns}
                customDate={customDate}
                customEndDate={customEndDate}
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
