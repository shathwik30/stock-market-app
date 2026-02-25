'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useHasHydrated } from '@/store/useAuthStore';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Activity, BarChart2, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface Trade {
  sNo: number;
  date: string;
  time: string;
  instrument: string;
  tradingSymbol: string;
  sector: string;
  industry: string;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  target: number;
  exit: number;
  pnl: number;
  pnlPercent: number;
}

const intradayTrades: Trade[] = [
  {
    sNo: 1,
    date: '2024-12-16',
    time: '09:30:00',
    instrument: 'EQUITY',
    tradingSymbol: 'RELIANCE',
    sector: 'Energy',
    industry: 'Oil & Gas',
    quantity: 50,
    entryPrice: 2456.50,
    stopLoss: 2400.00,
    target: 2550.00,
    exit: 2520.75,
    pnl: 3212.50,
    pnlPercent: 2.62,
  },
  {
    sNo: 2,
    date: '2024-12-16',
    time: '10:15:00',
    instrument: 'EQUITY',
    tradingSymbol: 'TCS',
    sector: 'Technology',
    industry: 'IT Services',
    quantity: 25,
    entryPrice: 3890.00,
    stopLoss: 3800.00,
    target: 4000.00,
    exit: 3975.50,
    pnl: 2137.50,
    pnlPercent: 2.20,
  },
  {
    sNo: 3,
    date: '2024-12-16',
    time: '11:00:00',
    instrument: 'EQUITY',
    tradingSymbol: 'BAJFINANCE',
    sector: 'Financial',
    industry: 'NBFC',
    quantity: 30,
    entryPrice: 7200.00,
    stopLoss: 7100.00,
    target: 7400.00,
    exit: 7050.00,
    pnl: -4500.00,
    pnlPercent: -2.08,
  },
   {
    sNo: 4,
    date: '2024-12-16',
    time: '12:30:00',
    instrument: 'EQUITY',
    tradingSymbol: 'TITAN',
    sector: 'Consumer',
    industry: 'Luxury Goods',
    quantity: 40,
    entryPrice: 3650.00,
    stopLoss: 3600.00,
    target: 3750.00,
    exit: 3710.00,
    pnl: 2400.00,
    pnlPercent: 1.64,
  },
   {
    sNo: 5,
    date: '2024-12-16',
    time: '02:45:00',
    instrument: 'EQUITY',
    tradingSymbol: 'ADANIENT',
    sector: 'Metals',
    industry: 'Mining',
    quantity: 45,
    entryPrice: 2800.00,
    stopLoss: 2750.00,
    target: 2900.00,
    exit: 2780.00,
    pnl: -900.00,
    pnlPercent: -0.71,
  }
];

const fnoTrades: Trade[] = [
  {
    sNo: 1,
    date: '2024-12-18',
    time: '09:20:00',
    instrument: 'F&O',
    tradingSymbol: 'NIFTY 21500 CE',
    sector: 'Index',
    industry: 'Indices',
    quantity: 50,
    entryPrice: 125.00,
    stopLoss: 100.00,
    target: 180.00,
    exit: 175.50,
    pnl: 2525.00,
    pnlPercent: 40.40,
  },
  {
    sNo: 2,
    date: '2024-12-18',
    time: '12:10:00',
    instrument: 'F&O',
    tradingSymbol: 'BANKNIFTY 48000 PE',
    sector: 'Index',
    industry: 'Indices',
    quantity: 30,
    entryPrice: 320.00,
    stopLoss: 280.00,
    target: 400.00,
    exit: 290.00,
    pnl: -900.00,
    pnlPercent: -9.38,
  },
   {
    sNo: 3,
    date: '2024-12-17',
    time: '14:30:00',
    instrument: 'F&O',
    tradingSymbol: 'RELIANCE JAN FUT',
    sector: 'Energy',
    industry: 'Oil & Gas',
    quantity: 250,
    entryPrice: 2480.00,
    stopLoss: 2460.00,
    target: 2520.00,
    exit: 2515.00,
    pnl: 8750.00,
    pnlPercent: 1.41,
  },
];

const swingTrades: Trade[] = [
  {
    sNo: 1,
    date: '2024-12-10',
    time: '14:30:00',
    instrument: 'EQUITY',
    tradingSymbol: 'HDFCBANK',
    sector: 'Financial',
    industry: 'Banking',
    quantity: 75,
    entryPrice: 1550.00,
    stopLoss: 1480.00,
    target: 1700.00,
    exit: 1680.00,
    pnl: 9750.00,
    pnlPercent: 5.59,
  },
  {
    sNo: 2,
    date: '2024-12-08',
    time: '11:15:00',
    instrument: 'EQUITY',
    tradingSymbol: 'INFY',
    sector: 'Technology',
    industry: 'IT Services',
    quantity: 100,
    entryPrice: 1420.00,
    stopLoss: 1350.00,
    target: 1550.00,
    exit: 1510.00,
    pnl: 9000.00,
    pnlPercent: 6.34,
  },
    {
    sNo: 3,
    date: '2024-12-12',
    time: '10:00:00',
    instrument: 'EQUITY',
    tradingSymbol: 'TATAMOTORS',
    sector: 'Auto',
    industry: 'Automobiles',
    quantity: 200,
    entryPrice: 710.00,
    stopLoss: 680.00,
    target: 780.00,
    exit: 690.00,
    pnl: -4000.00,
    pnlPercent: -2.82,
  },
];

const positionalTrades: Trade[] = [
  {
    sNo: 1,
    date: '2024-11-15',
    time: '13:00:00',
    instrument: 'EQUITY',
    tradingSymbol: 'ITC',
    sector: 'FMCG',
    industry: 'Tobacco',
    quantity: 500,
    entryPrice: 430.00,
    stopLoss: 400.00,
    target: 500.00,
    exit: 480.00,
    pnl: 25000.00,
    pnlPercent: 11.63,
  },
  {
    sNo: 2,
    date: '2024-10-20',
    time: '10:30:00',
    instrument: 'EQUITY',
    tradingSymbol: 'LT',
    sector: 'Construction',
    industry: 'Infrastructure',
    quantity: 50,
    entryPrice: 2900.00,
    stopLoss: 2700.00,
    target: 3400.00,
    exit: 3350.00,
    pnl: 22500.00,
    pnlPercent: 15.52,
  },
   {
    sNo: 3,
    date: '2024-11-01',
    time: '15:15:00',
    instrument: 'EQUITY',
    tradingSymbol: 'SBIN',
    sector: 'Financial',
    industry: 'PSU Bank',
    quantity: 300,
    entryPrice: 580.00,
    stopLoss: 520.00,
    target: 650.00,
    exit: 635.00,
    pnl: 16500.00,
    pnlPercent: 9.48,
  },
];

const multibaggerTrades: Trade[] = [
  {
    sNo: 1,
    date: '2024-10-10',
    time: '09:15:00',
    instrument: 'EQUITY',
    tradingSymbol: 'ZOMATO',
    sector: 'Tech',
    industry: 'Internet',
    quantity: 1000,
    entryPrice: 60.00,
    stopLoss: 40.00,
    target: 200.00,
    exit: 125.00,
    pnl: 65000.00,
    pnlPercent: 108.33,
  },
   {
    sNo: 2,
    date: '2024-09-01',
    time: '10:00:00',
    instrument: 'EQUITY',
    tradingSymbol: 'SUZLON',
    sector: 'Power',
    industry: 'Wind Energy',
    quantity: 5000,
    entryPrice: 8.00,
    stopLoss: 5.00,
    target: 45.00,
    exit: 38.00,
    pnl: 150000.00,
    pnlPercent: 375.00,
  }
];

type TradingType = 'intraday' | 'fno' | 'swing' | 'positional' | 'multibagger';

export default function LiveTradingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const hydrated = useHasHydrated();
  const [activeTab, setActiveTab] = useState<TradingType>('intraday');

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  const getActiveData = () => {
    switch (activeTab) {
      case 'intraday': return intradayTrades;
      case 'fno': return fnoTrades;
      case 'swing': return swingTrades;
      case 'positional': return positionalTrades;
      case 'multibagger': return multibaggerTrades;
      default: return intradayTrades;
    }
  };

  const activeTrades = getActiveData();

  const totalPnL = activeTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const totalInvestment = activeTrades.reduce((sum, trade) => sum + (trade.entryPrice * trade.quantity), 0);
  const totalPnLPercent = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

  const tabs = [
    { id: 'intraday', label: 'Intraday Trading', icon: Clock, isSpecial: false },
    { id: 'fno', label: 'F&O Trading', icon: TrendingUp, isSpecial: false },
    { id: 'swing', label: 'Swing Trading', icon: Activity, isSpecial: false },
    { id: 'positional', label: 'Positional Trading', icon: BarChart2, isSpecial: false },
    { id: 'multibagger', label: 'Multi Bagger Stocks', icon: Zap, isSpecial: true },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full px-4 py-8 md:px-6 md:py-12">
        {/* Header */}
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
        >
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground">
                Live Trading Portfolio
              </h1>
              <p className="text-lg text-muted-foreground mt-1">
                Real-time tracking of your active positions
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 bg-background p-1 w-full md:w-fit overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isSpecial = tab.isSpecial;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TradingType)}
                  className={`
                    flex items-center space-x-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                    ${isActive 
                      ? isSpecial 
                        ? 'bg-red-500 text-white shadow-md scale-105' 
                        : 'bg-primary text-primary-foreground shadow-md scale-105'
                      : isSpecial
                        ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                        : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Table Container */}
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.1 }}
           className="bg-background border border-border rounded-2xl shadow-luxury overflow-hidden"
        >
        {/* Header for the specific table section */}
        <div className="px-6 py-2 border-b border-border bg-muted/5">
            <h2 className={`text-lg font-semibold capitalize flex items-center gap-2 ${activeTab === 'multibagger' ? 'text-red-500' : 'text-foreground'}`}>
                {activeTab === 'multibagger' ? <Zap className="w-5 h-5 fill-current" /> : <span className="w-2 h-2 rounded-full bg-primary mb-0.5"></span>}
                {tabs.find(t => t.id === activeTab)?.label || activeTab} Positions
            </h2>
        </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="border-b border-border bg-muted/5">
                  <th className="px-6 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">S No</th>
                  <th className="px-6 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-6 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                  <th className="px-6 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instrument</th>
                  <th className="px-6 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Symbol</th>
                  <th className="px-6 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sector</th>
                  <th className="px-6 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Industry</th>
                  <th className="px-6 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entry</th>
                  <th className="px-6 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Stop Loss
                  </th>
                  <th className="px-6 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target</th>
                  <th className="px-6 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exit</th>
                  <th className="px-6 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">P&L</th>
                  <th className="px-6 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeTrades.map((trade, index) => (
                  <motion.tr
                    key={trade.sNo}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-muted/5 transition-colors duration-150"
                  >
                    <td className="px-6 py-2 text-xs font-medium text-foreground">{trade.sNo}</td>
                    <td className="px-6 py-2 text-xs text-muted-foreground whitespace-nowrap">{trade.date}</td>
                    <td className="px-6 py-2 text-xs text-muted-foreground">{trade.time}</td>
                    <td className="px-6 py-2 text-xs">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                            {trade.instrument}
                        </span>
                    </td>
                    <td className="px-6 py-2 text-xs font-semibold text-foreground">{trade.tradingSymbol}</td>
                    <td className="px-6 py-2 text-xs text-muted-foreground">{trade.sector}</td>
                    <td className="px-6 py-2 text-xs text-muted-foreground">{trade.industry}</td>
                    <td className="px-6 py-2 text-xs text-right text-foreground font-medium">{trade.quantity}</td>
                    <td className="px-6 py-2 text-xs text-right font-mono text-muted-foreground">₹{trade.entryPrice.toFixed(2)}</td>
                    <td className="px-6 py-2 text-xs text-right font-mono text-error font-medium">₹{trade.stopLoss.toFixed(2)}</td>
                    <td className="px-6 py-2 text-xs text-right font-mono text-success font-medium">₹{trade.target.toFixed(2)}</td>
                    <td className="px-6 py-2 text-xs text-right font-mono text-muted-foreground">₹{trade.exit.toFixed(2)}</td>
                    <td className={`px-6 py-2 text-xs text-right font-bold font-mono ${trade.pnl >= 0 ? 'text-success' : 'text-error'}`}>
                      <span className="inline-flex items-center justify-end gap-1">
                        {trade.pnl >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        ₹{Math.abs(trade.pnl).toFixed(2)}
                      </span>
                    </td>
                    <td className={`px-6 py-2 text-xs text-right font-medium font-mono ${trade.pnlPercent >= 0 ? 'text-success' : 'text-error'}`}>
                      {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                    </td>
                  </motion.tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/5 font-semibold border-t border-border">
                <tr>
                  <td colSpan={12} className="px-6 py-2 text-xs text-muted-foreground text-right uppercase tracking-wide">Total P&L</td>
                  <td className={`px-6 py-2 text-xs text-right font-bold font-mono ${totalPnL >= 0 ? 'text-success' : 'text-error'}`}>
                    <span className="inline-flex items-center justify-end gap-1">
                      {totalPnL >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      ₹{Math.abs(totalPnL).toFixed(2)}
                    </span>
                  </td>
                  <td className={`px-6 py-2 text-xs text-right font-bold font-mono ${totalPnLPercent >= 0 ? 'text-success' : 'text-error'}`}>
                    {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
