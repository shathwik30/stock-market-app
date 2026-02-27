'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import {
  BarChart3,
  LogOut,
  Menu,
  X,
  TrendingUp,
  TrendingDown,
  Eye,
  Briefcase,
  LayoutDashboard,
  LineChart,
  ChevronDown,
  Activity,
  PieChart,
  Globe,
  StickyNote,
  Search,
  Bell,
  CalendarDays,
  FileText
} from 'lucide-react';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [marketDataOpen, setMarketDataOpen] = useState(false);
  const [screenersOpen, setScreenersOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [mobileMarketDataOpen, setMobileMarketDataOpen] = useState(false);
  const [mobileScreenersOpen, setMobileScreenersOpen] = useState(false);
  const [mobilePortfolioOpen, setMobilePortfolioOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  // Order: Dashboard, Market Data (handled separately), Screeners, Analysis, Alerts, Calendar, Watchlist, Portfolio
  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    // Market Data dropdown is placed after Dashboard in the JSX
  ];

  const afterMarketDataLinks = [
    { href: '/analysis', label: 'Analysis', icon: BarChart3 },
    { href: '/alerts', label: 'Alerts', icon: Bell },
    { href: '/calendar', label: 'Calendar', icon: CalendarDays },
    { href: '/watchlist', label: 'Watchlist', icon: Eye },
  ];

  const portfolioLinks = [
    { href: '/portfolio/live-trading', label: 'Live Trading', icon: TrendingUp },
    { href: '/portfolio/paper-trading', label: 'Paper Trading', icon: FileText },
    { href: '/portfolio/management', label: 'Portfolio Management', icon: PieChart },
  ];

  const screenersLinks = {
    technical: {
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
      indicators: [],
      strategies: [],
    },
    fundamental: [],
  };

  const marketDataLinks = {
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
        { href: '/market', label: 'Total Market Performance' }
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

  const isMarketDataActive = pathname.startsWith('/market-data');
  const isScreenersActive = pathname.startsWith('/screeners');
  const isPortfolioActive = pathname.startsWith('/portfolio');

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full px-6 lg:px-10">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <BarChart3 className="h-7 w-7 text-foreground transition-transform group-hover:scale-110" />
              <div className="absolute inset-0 blur-xl bg-primary/20 group-hover:bg-primary/30 transition-all" />
            </div>
            <span className="text-xl font-display font-semibold text-foreground tracking-tight">
              StockMarket Pro
            </span>
          </Link>

          {/* Desktop Navigation */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`
                      relative flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${isActive
                        ? 'text-foreground bg-secondary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="navbar-indicator"
                        className="absolute inset-0 bg-secondary rounded-lg -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </Link>
                );
              })}

              {/* Market Data Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setMarketDataOpen(true)}
                onMouseLeave={() => setMarketDataOpen(false)}
              >
                <button
                  className={`
                    relative flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${isMarketDataActive
                      ? 'text-foreground bg-secondary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }
                  `}
                >
                  <LineChart className="h-4 w-4" />
                  <span>Market Data</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${marketDataOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {marketDataOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 border border-gray-300 shadow-xl overflow-hidden z-50"
                      style={{ backgroundColor: 'white' }}
                    >
                      <div className="flex">
                        {/* Market Overview Column */}
                        <div className="min-w-[200px] border-r border-gray-300">
                          <div className="px-4 py-2 text-sm font-bold text-black border-b border-gray-300 bg-gray-50">
                            Market Overview
                          </div>

                          {/* Indices */}
                          <div className="border-b border-gray-300">
                            <div className="px-4 py-1.5 text-sm font-bold text-black border-b border-gray-200">
                              Indices
                            </div>
                            {marketDataLinks.marketOverview.indices.map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                              >
                                {link.label}
                              </Link>
                            ))}
                          </div>

                          {/* Sectors */}
                          <div className="border-b border-gray-300">
                            <div className="px-4 py-1.5 text-sm font-bold text-black border-b border-gray-200">
                              Sectors
                            </div>
                            {marketDataLinks.marketOverview.sectors.map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                              >
                                {link.label}
                              </Link>
                            ))}
                          </div>

                          {/* Total Market */}
                          <div className="border-b border-gray-300">
                            <div className="px-4 py-1.5 text-sm font-bold text-black border-b border-gray-200">
                              Total Market
                            </div>
                            <Link
                              href="/market-data/advances-decline-unchanged"
                              className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                            >
                              Advances, Decline & Unchanged
                            </Link>
                            <Link
                              href="/market"
                              className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                            >
                              Total Market Performance
                            </Link>
                          </div>

                          {/* Market Mood */}
                          <div className="border-b border-gray-300">
                            <Link
                              href="/market-mood"
                              className="block px-4 py-1.5 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300"
                            >
                              Market Mood
                            </Link>
                          </div>

                          {/* Futures Support & Resistance */}
                          <div className="border-b border-gray-300">
                            <Link
                              href="#"
                              className="block px-4 py-1.5 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300"
                            >
                              Futures Support & Resistance
                            </Link>
                          </div>

                          {/* Global Markets */}
                          <div className="border-b border-gray-300">
                            <Link
                              href="/market-data/global-markets"
                              className="block px-4 py-1.5 text-sm font-bold text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300"
                            >
                              Global Markets
                            </Link>
                          </div>

                          {/* Filterings */}
                          <div>
                            <div className="px-4 py-1.5 text-sm font-bold text-black">
                              Filterings
                            </div>
                          </div>
                        </div>

                        {/* Equity Column */}
                        <div className="min-w-[150px] border-r border-gray-300">
                          <div className="px-4 py-2 text-sm font-bold text-black border-b border-gray-300 bg-gray-50">
                            Equity
                          </div>
                          {marketDataLinks.equity.map((link) => (
                            <Link
                              key={link.label}
                              href={link.href}
                              className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                            >
                              {link.label}
                            </Link>
                          ))}
                          <div className="border-b border-gray-300">
                            <div className="px-4 py-1.5 text-sm font-bold text-black">
                              Filterings
                            </div>
                          </div>
                        </div>

                        {/* Others Column */}
                        <div className="min-w-[180px]">
                          <div className="px-4 py-2 text-sm font-bold text-black border-b border-gray-300 bg-gray-50">
                            Others
                          </div>

                          {/* Results Calendar */}
                          <Link
                            href="/market-data/results-calendar"
                            className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                          >
                            Results Calendar
                          </Link>

                          {/* FII & DII Activity */}
                          <Link
                            href="/market-data/fii-dii"
                            className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                          >
                            FII & DII Activity
                          </Link>

                          {/* Promoters Activity */}
                          <Link
                            href="#"
                            className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                          >
                            Promoters Activity
                          </Link>

                          {/* Mutual Funds Activity */}
                          <Link
                            href="#"
                            className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                          >
                            Mutual Funds Activity
                          </Link>

                          {/* Super Investors */}
                          <Link
                            href="#"
                            className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                          >
                            Super Investors
                          </Link>

                          {/* Corporate Action */}
                          <Link
                            href="/market-data/corporate-action"
                            className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                          >
                            Corporate Action
                          </Link>

                          {/* Deals */}
                          <div className="border-b border-gray-200">
                            <div className="px-4 py-1.5 text-sm font-bold text-black border-b border-gray-200">
                              Deals
                            </div>
                            <Link
                              href="/market-data/bulk-deals"
                              className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                            >
                              Bulk Deals
                            </Link>
                            <Link
                              href="/market-data/block-deals"
                              className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                            >
                              Block Deals
                            </Link>
                            <Link
                              href="/market-data/intraday-deals"
                              className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                            >
                              Intraday Large Deals
                            </Link>
                            <Link
                              href="/market-data/circuit-changes"
                              className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                            >
                              Circuit Changes
                            </Link>
                            <div className="px-4 py-1.5 text-sm font-bold text-black">
                              Monthly Wise
                            </div>
                          </div>

                          {/* Nifty */}
                          <div className="border-b border-gray-200">
                            <Link
                              href="#"
                              className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                            >
                              Nifty
                            </Link>
                            <Link
                              href="/market-data/pe"
                              className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                            >
                              PE
                            </Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Screeners Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setScreenersOpen(true)}
                onMouseLeave={() => setScreenersOpen(false)}
              >
                <button
                  className={`
                    relative flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${isScreenersActive
                      ? 'text-foreground bg-secondary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }
                  `}
                >
                  <Search className="h-4 w-4" />
                  <span>Screeners</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${screenersOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {screenersOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 border border-border rounded-xl shadow-xl overflow-hidden z-50"
                      style={{ backgroundColor: 'white' }}
                    >
                      <div className="flex">
                        {/* Technical Column */}
                        <div className="min-w-[200px] border-r border-gray-300">
                          <div className="px-4 py-2 text-sm font-bold text-black border-b border-gray-300 bg-gray-50">
                            Technical
                          </div>

                          {/* Candlestick Patterns */}
                          <div className="border-b border-gray-300">
                            <div className="px-4 py-1.5 text-sm font-bold text-black border-b border-gray-200">
                              Candlestick Patterns
                            </div>
                            {screenersLinks.technical.candlestickPatterns.map((link) => (
                              <Link
                                key={link.label}
                                href={link.href}
                                className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                              >
                                {link.label}
                              </Link>
                            ))}
                          </div>

                          {/* Chart Patterns */}
                          <div className="border-b border-gray-300">
                            <div className="px-4 py-1.5 text-sm font-bold text-black border-b border-gray-200">
                              Chart Patterns
                            </div>
                            {screenersLinks.technical.chartPatterns.map((link) => (
                              <Link
                                key={link.label}
                                href={link.href}
                                className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                              >
                                {link.label}
                              </Link>
                            ))}
                          </div>

                          {/* Drawing Tools */}
                          <div className="border-b border-gray-300">
                            <div className="px-4 py-1.5 text-sm font-bold text-black border-b border-gray-200">
                              Drawing Tools
                            </div>
                            {screenersLinks.technical.drawingTools.map((link) => (
                              <Link
                                key={link.label}
                                href={link.href}
                                className="block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                              >
                                {link.label}
                              </Link>
                            ))}
                          </div>

                          {/* Indicators */}
                          <div className="border-b border-gray-300">
                            <div className="px-4 py-1.5 text-sm font-bold text-black">
                              Indicators
                            </div>
                          </div>

                          {/* Strategies */}
                          <div>
                            <div className="px-4 py-1.5 text-sm font-bold text-black">
                              Strategies
                            </div>
                          </div>
                        </div>

                        {/* Fundamental Column */}
                        <div className="min-w-[160px]">
                          <div className="px-4 py-2 text-sm font-bold text-black border-b border-gray-300 bg-gray-50">
                            Fundamental
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Analysis, Alerts, Calendar, Watchlist */}
              {afterMarketDataLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`
                      relative flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${isActive
                        ? 'text-foreground bg-secondary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="navbar-indicator"
                        className="absolute inset-0 bg-secondary rounded-lg -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </Link>
                );
              })}

              {/* Portfolio Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setPortfolioOpen(true)}
                onMouseLeave={() => setPortfolioOpen(false)}
              >
                <button
                  className={`
                    relative flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${isPortfolioActive
                      ? 'text-foreground bg-secondary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }
                  `}
                >
                  <Briefcase className="h-4 w-4" />
                  <span>Portfolio</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${portfolioOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {portfolioOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 border border-gray-300 shadow-xl overflow-hidden z-50"
                      style={{ backgroundColor: 'white' }}
                    >
                      <div className="min-w-[180px]">
                        <div className="px-4 py-2 text-sm font-bold text-black border-b border-gray-300 bg-gray-50">
                          Portfolio
                        </div>
                        {portfolioLinks.map((link) => {
                          const Icon = link.icon;
                          return (
                            <Link
                              key={link.href}
                              href={link.href}
                              className="flex items-center space-x-3 px-4 py-1.5 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200"
                            >
                              <Icon className="h-4 w-4" />
                              <span>{link.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Notes - At the end */}
              <Link
                href="/notes"
                className={`
                  relative flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${pathname === '/notes'
                    ? 'text-foreground bg-secondary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }
                `}
              >
                <StickyNote className="h-4 w-4" />
                <span>Notes</span>
                {pathname === '/notes' && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute inset-0 bg-secondary rounded-lg -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </Link>

              {/* User Menu */}
              <div className="flex items-center space-x-3 ml-6 pl-6 border-l border-border">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {user?.firstName || user?.username}
                  </p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}

          {!isAuthenticated && (
            <div className="hidden md:flex items-center space-x-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-6 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
              >
                Get Started
              </Link>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-border overflow-hidden"
            >
              <div className="py-4 space-y-1">
                {isAuthenticated ? (
                  <>
                    {navLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive = pathname === link.href;

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`
                            flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                            ${isActive
                              ? 'text-foreground bg-secondary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                            }
                          `}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{link.label}</span>
                        </Link>
                      );
                    })}

                    {/* Mobile Market Data Section */}
                    <div className="px-4 py-3">
                      <button
                        onClick={() => setMobileMarketDataOpen(!mobileMarketDataOpen)}
                        className={`
                          w-full flex items-center justify-between text-sm font-medium transition-colors
                          ${isMarketDataActive
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                          }
                        `}
                      >
                        <div className="flex items-center space-x-3">
                          <LineChart className="h-4 w-4" />
                          <span>Market Data</span>
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${mobileMarketDataOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {mobileMarketDataOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-2 ml-7 space-y-3 overflow-hidden"
                          >
                            {/* Market Overview */}
                            <div>
                              <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border">
                                Market Overview
                              </div>

                              {/* Indices */}
                              <div className="mb-2">
                                <div className="flex items-center gap-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  <Activity className="h-3 w-3" />
                                  Indices
                                </div>
                                {marketDataLinks.marketOverview.indices.map((link) => (
                                  <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => {
                                      setMobileMenuOpen(false);
                                      setMobileMarketDataOpen(false);
                                    }}
                                    className={`
                                      block py-2 pl-5 text-sm rounded-lg transition-colors
                                      ${pathname === link.href
                                        ? 'text-foreground bg-secondary'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                      }
                                    `}
                                  >
                                    {link.label}
                                  </Link>
                                ))}
                              </div>

                              {/* Sectors */}
                              <div className="mb-2">
                                <div className="flex items-center gap-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  <PieChart className="h-3 w-3" />
                                  Sectors
                                </div>
                                {marketDataLinks.marketOverview.sectors.map((link) => (
                                  <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => {
                                      setMobileMenuOpen(false);
                                      setMobileMarketDataOpen(false);
                                    }}
                                    className={`
                                      block py-2 pl-5 text-sm rounded-lg transition-colors
                                      ${pathname === link.href
                                        ? 'text-foreground bg-secondary'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                      }
                                    `}
                                  >
                                    {link.label}
                                  </Link>
                                ))}
                              </div>

                              {/* Global Markets */}
                              <div>
                                <div className="flex items-center gap-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  <Globe className="h-3 w-3" />
                                  Global Markets
                                </div>
                                {marketDataLinks.marketOverview.globalMarkets.map((link) => (
                                  <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => {
                                      setMobileMenuOpen(false);
                                      setMobileMarketDataOpen(false);
                                    }}
                                    className={`
                                      block py-2 pl-5 text-sm rounded-lg transition-colors
                                      ${pathname === link.href
                                        ? 'text-foreground bg-secondary'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                      }
                                    `}
                                  >
                                    {link.label}
                                  </Link>
                                ))}
                              </div>
                            </div>

                            {/* Equity */}
                            <div>
                              <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border">
                                Equity
                              </div>
                              {marketDataLinks.equity.map((link) => (
                                <Link
                                  key={link.href}
                                  href={link.href}
                                  onClick={() => {
                                    setMobileMenuOpen(false);
                                    setMobileMarketDataOpen(false);
                                  }}
                                  className={`
                                    block py-2 pl-2 text-sm rounded-lg transition-colors
                                    ${pathname === link.href
                                      ? 'text-foreground bg-secondary'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                    }
                                  `}
                                >
                                  {link.label}
                                </Link>
                              ))}
                            </div>

                            {/* Others */}
                            <div>
                              <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border">
                                Others
                              </div>

                              {/* General */}
                              {marketDataLinks.others.general.map((link) => (
                                <Link
                                  key={link.href}
                                  href={link.href}
                                  onClick={() => {
                                    setMobileMenuOpen(false);
                                    setMobileMarketDataOpen(false);
                                  }}
                                  className={`
                                    block py-2 pl-2 text-sm rounded-lg transition-colors
                                    ${pathname === link.href
                                      ? 'text-foreground bg-secondary'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                    }
                                  `}
                                >
                                  {link.label}
                                </Link>
                              ))}

                              {/* Deals */}
                              <div className="mt-2">
                                <div className="py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  Deals
                                </div>
                                {marketDataLinks.others.deals.map((link) => (
                                  <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => {
                                      setMobileMenuOpen(false);
                                      setMobileMarketDataOpen(false);
                                    }}
                                    className={`
                                      block py-2 pl-5 text-sm rounded-lg transition-colors
                                      ${pathname === link.href
                                        ? 'text-foreground bg-secondary'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                      }
                                    `}
                                  >
                                    {link.label}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Mobile Screeners Section */}
                    <div className="px-4 py-3">
                      <button
                        onClick={() => setMobileScreenersOpen(!mobileScreenersOpen)}
                        className={`
                          w-full flex items-center justify-between text-sm font-medium transition-colors
                          ${isScreenersActive
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                          }
                        `}
                      >
                        <div className="flex items-center space-x-3">
                          <Search className="h-4 w-4" />
                          <span>Screeners</span>
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${mobileScreenersOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {mobileScreenersOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-2 ml-7 space-y-3 overflow-hidden"
                          >
                            {/* Technical */}
                            <div>
                              <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border">
                                Technical
                              </div>

                              {/* Candlestick Patterns */}
                              <div className="mb-2">
                                <div className="py-1 text-xs font-semibold text-muted-foreground">
                                  Candlestick Patterns
                                </div>
                                {screenersLinks.technical.candlestickPatterns.map((link) => (
                                  <Link
                                    key={link.label}
                                    href={link.href}
                                    onClick={() => {
                                      setMobileMenuOpen(false);
                                      setMobileScreenersOpen(false);
                                    }}
                                    className="block py-2 pl-2 text-sm rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                  >
                                    {link.label}
                                  </Link>
                                ))}
                              </div>

                              {/* Chart Patterns */}
                              <div className="mb-2">
                                <div className="py-1 text-xs font-semibold text-muted-foreground">
                                  Chart Patterns
                                </div>
                                {screenersLinks.technical.chartPatterns.map((link) => (
                                  <Link
                                    key={link.label}
                                    href={link.href}
                                    onClick={() => {
                                      setMobileMenuOpen(false);
                                      setMobileScreenersOpen(false);
                                    }}
                                    className="block py-2 pl-2 text-sm rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                  >
                                    {link.label}
                                  </Link>
                                ))}
                              </div>

                              {/* Drawing Tools */}
                              <div className="mb-2">
                                <div className="py-1 text-xs font-semibold text-muted-foreground">
                                  Drawing Tools
                                </div>
                                {screenersLinks.technical.drawingTools.map((link) => (
                                  <Link
                                    key={link.label}
                                    href={link.href}
                                    onClick={() => {
                                      setMobileMenuOpen(false);
                                      setMobileScreenersOpen(false);
                                    }}
                                    className="block py-2 pl-2 text-sm rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                  >
                                    {link.label}
                                  </Link>
                                ))}
                              </div>
                            </div>

                            {/* Fundamental */}
                            <div>
                              <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border">
                                Fundamental
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Mobile: Analysis, Alerts, Calendar, Watchlist */}
                    {afterMarketDataLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive = pathname === link.href;

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`
                            flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                            ${isActive
                              ? 'text-foreground bg-secondary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                            }
                          `}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{link.label}</span>
                        </Link>
                      );
                    })}

                    {/* Mobile Portfolio Section */}
                    <div className="px-4 py-3">
                      <button
                        onClick={() => setMobilePortfolioOpen(!mobilePortfolioOpen)}
                        className={`
                          w-full flex items-center justify-between text-sm font-medium transition-colors
                          ${isPortfolioActive
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                          }
                        `}
                      >
                        <div className="flex items-center space-x-3">
                          <Briefcase className="h-4 w-4" />
                          <span>Portfolio</span>
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${mobilePortfolioOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {mobilePortfolioOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-2 ml-7 space-y-1 overflow-hidden"
                          >
                            {portfolioLinks.map((link) => {
                              const Icon = link.icon;
                              return (
                                <Link
                                  key={link.href}
                                  href={link.href}
                                  onClick={() => {
                                    setMobileMenuOpen(false);
                                    setMobilePortfolioOpen(false);
                                  }}
                                  className={`
                                    flex items-center space-x-3 py-2 pl-2 text-sm rounded-lg transition-colors
                                    ${pathname === link.href
                                      ? 'text-foreground bg-secondary'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                    }
                                  `}
                                >
                                  <Icon className="h-4 w-4" />
                                  <span>{link.label}</span>
                                </Link>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Notes - At the end */}
                    <Link
                      href="/notes"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                        ${pathname === '/notes'
                          ? 'text-foreground bg-secondary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                        }
                      `}
                    >
                      <StickyNote className="h-4 w-4" />
                      <span>Notes</span>
                    </Link>


                    <div className="pt-4 mt-4 border-t border-border">
                      <div className="px-4 py-2">
                        <p className="text-sm font-medium text-foreground">
                          {user?.firstName || user?.username}
                        </p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          handleLogout();
                          setMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors mt-2"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 px-4">
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-6 py-2 text-sm font-medium text-center text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-all"
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
