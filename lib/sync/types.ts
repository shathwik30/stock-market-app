export interface DhanQuote {
  last_price: number;
  ohlc: { open: number; close: number; high: number; low: number };
  net_change: number;
  volume: number;
  upper_circuit_limit: number;
  lower_circuit_limit: number;
  '52_week_high'?: number;
  '52_week_low'?: number;
  last_trade_time?: string;
}

export type Segment = 'NSE_EQ' | 'BSE_EQ';
export type Exchange = 'NSE' | 'BSE' | 'Both';

export interface HistoricalData {
  close: number[];
  timestamp: number[];
}

export interface PriceSnapshot {
  timestamp: number;
  prices: Map<number, number>;
}

export interface SyncResult {
  quotesUpdated: number;
  snapshotStored: boolean;
  statsUpdated: boolean;
  elapsed: number;
  cycle: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  sort: string;
  order: 'asc' | 'desc';
  filter: 'all' | 'gainers' | 'losers' | 'unchanged';
  exchange: Exchange;
  search?: string;
}

export interface PaginatedResponse {
  stocks: StockQuoteDTO[];
  pagination: {
    page: number;
    pageSize: number;
    totalStocks: number;
    totalPages: number;
  };
  stats: MarketStatsDTO;
  lastSyncAt: string | null;
  syncStatus: {
    isRunning: boolean;
    historicalPopulating: boolean;
    historicalProgress: { completed: number; total: number };
    cachedCount: number;
  };
}

export interface StockQuoteDTO {
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
  percentChanges: Record<string, number | null>;
  week52High?: number;
  week52Low?: number;
  volume?: number;
}

export interface MarketStatsDTO {
  totalGainers: number;
  totalLosers: number;
  totalUnchanged: number;
  avgGain: number;
  avgLoss: number;
  topGainer: {
    company: string;
    symbol: string;
    sector: string;
    ltp: number;
    percentInChange: number;
  } | null;
  topLoser: {
    company: string;
    symbol: string;
    sector: string;
    ltp: number;
    percentInChange: number;
  } | null;
}
