import {
  LayoutDashboard,
  BarChart3,
  Bell,
  CalendarDays,
  Eye,
  TrendingUp,
  FileText,
  PieChart,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';

export interface NavLinkItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  highlight?: boolean;
}

export const navLinks: NavLinkItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export const afterMarketDataLinks: NavLinkItem[] = [
  { href: '/analysis', label: 'Analysis', icon: BarChart3 },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/watchlist', label: 'Watchlist', icon: Eye },
];

export const portfolioLinks: NavLinkItem[] = [
  { href: '/portfolio/live-trading', label: 'Live Trading', icon: TrendingUp },
  { href: '/portfolio/paper-trading', label: 'Paper Trading', icon: FileText },
  { href: '/portfolio/management', label: 'Portfolio Management', icon: PieChart },
];

export const notesLink: NavLinkItem = { href: '/notes', label: 'Notes', icon: StickyNote };

export const screenersLinks = {
  technical: {
    screeningTable: [
      { href: '/screeners/screening-table', label: 'Screening Table' },
    ],
    candlestickPatterns: [
      { href: '#', label: '1. Single Candlestick Patterns' },
      { href: '#', label: '2. Dual Candlestick Patterns' },
      { href: '#', label: '3. Three Candlestick Patterns' },
      { href: '#', label: '4. Invented by vgsreddy' },
    ],
    chartPatterns: [
      { href: '#', label: 'Bullish Chart Patterns' },
      { href: '#', label: 'Bearish Chart Patterns' },
    ],
    drawingTools: [
      { href: '#', label: 'Support & Resistance' },
      { href: '#', label: 'Trendline' },
      { href: '#', label: 'Price Action' },
      { href: '#', label: 'Swing High & Lows' },
      { href: '#', label: 'Demand & Supply Zones' },
    ],
    indicators: [] as NavLinkItem[],
    strategies: [] as NavLinkItem[],
  },
  fundamental: [] as NavLinkItem[],
};

export const marketDataLinks = {
  marketOverview: {
    indices: [
      { href: '/market-data/indices/nse', label: 'NSE Indices' },
      { href: '/market-data/indices/bse', label: 'BSE Indices' },
    ],
    sectors: [
      { href: '/market-data/sectors/nse', label: 'NSE Sectors' },
      { href: '/market-data/sectors/bse', label: 'BSE Sectors' },
    ],
    totalMarket: [
      { href: '#', label: 'Total Market' },
      { href: '#', label: 'Advances, Decline & Unchange' },
      { href: '/market', label: 'Total Market Performance' },
    ],
    marketMood: [
      { href: '/market-mood', label: 'Market Mood' },
    ],
    futuresSupport: [
      { href: '#', label: 'Futures Support & Resistance' },
    ],
    globalMarkets: [
      { href: '/market-data/global-markets', label: 'Global Markets' },
    ],
    filterings: [
      { href: '#', label: 'Filterings' },
    ],
  },
  equity: [
    { href: '/market-data/indices-fno', label: 'Indices in F&O' },
    { href: '/market-data/broad-market-indices', label: 'Broad Market Indices' },
    { href: '/market-data/sectoral-indices', label: 'Sectoral Indices' },
    { href: '/market-data/pre-open', label: 'Pre Open' },
    { href: '/market-data/stocks', label: 'Stocks' },
    { href: '/market-data/sectors-data', label: 'Sectors' },
    { href: '/market-data/industry', label: 'Industry' },
    { href: '/market-data/fno-stocks', label: 'F&O Stocks' },
    { href: '/market-data/price-band-hitters', label: 'Price Band Hitters' },
    { href: '/market-data/fno', label: 'F&O Data' },
    { href: '/market-data/ipo', label: "IPO's" },
    { href: '#', label: 'All Statistics' },
    { href: '/gainers', label: 'Top Gainers' },
    { href: '/losers', label: 'Top Losers' },
    { href: '/only-buyers', label: 'Only Buyers' },
    { href: '/only-sellers', label: 'Only Sellers' },
    { href: '/52-week-high', label: '52 Week High' },
    { href: '/52-week-low', label: '52 Week Low' },
    { href: '/all-time-high', label: 'All Time High (ATH)' },
    { href: '/all-time-low', label: 'All Time Low (ATL)' },
    { href: '/price-shockers', label: 'Price Shockers' },
    { href: '/volume-shockers', label: 'Volume Shockers' },
    { href: '/most-active-by-value', label: 'Most Active Stocks' },
    { href: '/market-data/etfs', label: 'ETFs' },
    { href: '/market-data/unlisted-shares', label: 'Unlisted Shares' },
  ],
  others: {
    general: [
      { href: '/market-data/results-calendar', label: 'Results Calendar' },
      { href: '#', label: 'FII & DII Activity' },
      { href: '#', label: 'Promoters Activity' },
      { href: '#', label: 'Mutual Funds Activity' },
      { href: '#', label: 'Super Investors', highlight: true },
      { href: '/market-data/corporate-action', label: 'Corporate Action' },
    ],
    deals: [
      { href: '#', label: 'Deals' },
      { href: '#', label: 'Bulk Deals' },
      { href: '#', label: 'Block Deals' },
      { href: '#', label: 'Intraday Large Deals' },
      { href: '/market-data/circuit-changes', label: 'Circuit Changes' },
      { href: '#', label: 'Monthly' },
    ],
    nifty: [
      { href: '#', label: 'Nifty' },
      { href: '/market-data/pe', label: 'PE' },
    ],
  },
};
