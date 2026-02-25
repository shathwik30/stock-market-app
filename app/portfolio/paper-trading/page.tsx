'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useHasHydrated } from '@/store/useAuthStore';
import { FileText, ArrowUpRight, ArrowDownRight, Clock, Activity, BarChart2, TrendingUp, Zap } from 'lucide-react';
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
    time: '09:35:00',
    instrument: 'EQUITY',
    tradingSymbol: 'TATAMOTORS',
    sector: 'Automobile',
    industry: 'Auto Manufacturers',
    quantity: 100,
    entryPrice: 785.50,
    stopLoss: 770.00,
    target: 820.00,
    exit: 812.25,
    pnl: 2675.00,
    pnlPercent: 3.41,
  },
  {
    sNo: 2,
    date: '2024-12-16',
    time: '10:00:00',
    instrument: 'EQUITY',
    tradingSymbol: 'WIPRO',
    sector: 'Technology',
    industry: 'IT Services',
    quantity: 80,
    entryPrice: 465.75,
    stopLoss: 450.00,
    target: 490.00,
    exit: 488.50,
    pnl: 1820.00,
    pnlPercent: 4.88,
  },
  {
    sNo: 3,
    date: '2024-12-16',
    time: '11:30:00',
    instrument: 'EQUITY',
    tradingSymbol: 'SBIN',
    sector: 'Financial',
    industry: 'Banking',
    quantity: 120,
    entryPrice: 628.00,
    stopLoss: 610.00,
    target: 660.00,
    exit: 615.50,
    pnl: -1500.00,
    pnlPercent: -1.99,
  },
   {
    sNo: 4,
    date: '2024-12-16',
    time: '13:15:00',
    instrument: 'EQUITY',
    tradingSymbol: 'BHARTIARTL',
    sector: 'Telecom',
    industry: 'Telecommunications',
    quantity: 45,
    entryPrice: 1540.00,
    stopLoss: 1500.00,
    target: 1600.00,
    exit: 1595.75,
    pnl: 2508.75,
    pnlPercent: 3.62,
  },
   {
    sNo: 5,
    date: '2024-12-16',
    time: '15:00:00',
    instrument: 'EQUITY',
    tradingSymbol: 'MARUTI',
    sector: 'Automobile',
    industry: 'Auto Manufacturers',
    quantity: 10,
    entryPrice: 11250.00,
    stopLoss: 11000.00,
    target: 11600.00,
    exit: 11580.00,
    pnl: 3300.00,
    pnlPercent: 2.93,
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
    date: '2024-12-11',
    time: '09:50:00',
    instrument: 'EQUITY',
    tradingSymbol: 'SUNPHARMA',
    sector: 'Healthcare',
    industry: 'Pharmaceuticals',
    quantity: 55,
    entryPrice: 1180.25,
    stopLoss: 1150.00,
    target: 1230.00,
    exit: 1225.50,
    pnl: 2488.75,
    pnlPercent: 3.84,
  },
  {
    sNo: 2,
    date: '2024-12-09',
    time: '14:20:00',
    instrument: 'EQUITY',
    tradingSymbol: 'CIPLA',
    sector: 'Healthcare',
    industry: 'Pharmaceuticals',
    quantity: 60,
    entryPrice: 1200.00,
    stopLoss: 1160.00,
    target: 1300.00,
    exit: 1280.00,
    pnl: 4800.00,
    pnlPercent: 6.67,
  },
    {
    sNo: 3,
    date: '2024-12-08',
    time: '10:45:00',
    instrument: 'EQUITY',
    tradingSymbol: 'AXISBANK',
    sector: 'Financial',
    industry: 'Banking',
    quantity: 90,
    entryPrice: 1100.00,
    stopLoss: 1050.00,
    target: 1200.00,
    exit: 1080.00,
    pnl: -1800.00,
    pnlPercent: -1.82,
  },
];

const positionalTrades: Trade[] = [
  {
    sNo: 1,
    date: '2024-11-20',
    time: '11:00:00',
    instrument: 'EQUITY',
    tradingSymbol: 'POWERGRID',
    sector: 'Power',
    industry: 'Utilities',
    quantity: 400,
    entryPrice: 210.00,
    stopLoss: 190.00,
    target: 250.00,
    exit: 235.00,
    pnl: 10000.00,
    pnlPercent: 11.90,
  },
  {
    sNo: 2,
    date: '2024-11-05',
    time: '13:30:00',
    instrument: 'EQUITY',
    tradingSymbol: 'NTPC',
    sector: 'Power',
    industry: 'Utilities',
    quantity: 300,
    entryPrice: 280.00,
    stopLoss: 260.00,
    target: 330.00,
    exit: 315.00,
    pnl: 10500.00,
    pnlPercent: 12.50,
  },
   {
    sNo: 3,
    date: '2024-10-15',
    time: '10:15:00',
    instrument: 'EQUITY',
    tradingSymbol: 'COALINDIA',
    sector: 'Mining',
    industry: 'Coal',
    quantity: 250,
    entryPrice: 350.00,
    stopLoss: 320.00,
    target: 400.00,
    exit: 385.00,
    pnl: 8750.00,
    pnlPercent: 10.00,
  },
];

const multibaggerTrades: Trade[] = [
  {
    sNo: 1,
    date: '2024-11-15',
    time: '09:30:00',
    instrument: 'EQUITY',
    tradingSymbol: 'VARUNBEV',
    sector: 'FMCG',
    industry: 'Beverages',
    quantity: 200,
    entryPrice: 800.00,
    stopLoss: 600.00,
    target: 1500.00,
    exit: 1200.00,
    pnl: 80000.00,
    pnlPercent: 50.00,
  },
   {
    sNo: 2,
    date: '2024-10-05',
    time: '11:15:00',
    instrument: 'EQUITY',
    tradingSymbol: 'TRENT',
    sector: 'Retail',
    industry: 'Fashion',
    quantity: 150,
    entryPrice: 2000.00,
    stopLoss: 1800.00,
    target: 4000.00,
    exit: 3500.00,
    pnl: 225000.00,
    pnlPercent: 75.00,
  }
];

type TradingType = 'intraday' | 'fno' | 'swing' | 'positional' | 'multibagger';

export default function PaperTradingPage() {
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
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground">
                Paper Trading Live
              </h1>
              <p className="text-lg text-muted-foreground mt-1">
                Practice trading with simulated positions
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
