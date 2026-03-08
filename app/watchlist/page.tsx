'use client';

import { useState, useEffect } from 'react';
import { Eye, Trash2, Plus, Edit2, TrendingUp, Clock, Activity, BarChart2, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import apiClient from '@/lib/api-client';
import { AuthGuard, LoadingSpinner, PageHeader } from '@/components/common';
import type { WatchlistCategory } from '@/types';

interface WatchlistStock {
  id?: string;
  sNo: number;
  date: string;
  sourceFrom: string;
  segments: string;
  tradingSymbol: string;
  sector: string;
  industry: string;
  ltp: number;
  entryPrice: number;
  stopLoss: number;
  target: number;
  redFlags: string;
  note: string;
  category: WatchlistCategory;
}

const tabs = [
  { id: 'intraday' as const, label: 'Intraday Trading', icon: Clock, isSpecial: false },
  { id: 'fno' as const, label: 'F&O Trading', icon: TrendingUp, isSpecial: false },
  { id: 'swing' as const, label: 'Swing Trading', icon: Activity, isSpecial: false },
  { id: 'positional' as const, label: 'Positional Trading', icon: BarChart2, isSpecial: false },
  { id: 'multibagger' as const, label: 'Multi Bagger Stocks', icon: Zap, isSpecial: true },
];

function WatchlistContent() {
  const [activeTab, setActiveTab] = useState<WatchlistCategory>('intraday');
  const [allStocks, setAllStocks] = useState<WatchlistStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWatchlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWatchlist = async () => {
    try {
      const response = await apiClient.get('/api/watchlist');
      const stocks = response.data.watchlist?.stocks || [];
      setAllStocks(
        stocks.map((stock: WatchlistStock & { date: string }) => ({
          ...stock,
          date: new Date(stock.date).toISOString().split('T')[0],
        }))
      );
    } catch {
      toast.error('Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (stockId: string) => {
    try {
      await apiClient.delete('/api/watchlist', {
        data: { stockId },
      });
      setAllStocks((prev) => prev.filter((s) => s.id !== stockId));
      toast.success('Stock removed from watchlist');
    } catch {
      toast.error('Failed to remove stock');
    }
  };

  const handleEdit = (stockId: string) => {
    toast('Edit functionality coming soon', { icon: '🔧' });
  };

  const handleAddStock = () => {
    toast('Add stock functionality coming soon', { icon: '🔧' });
  };

  const stocks = allStocks.filter((stock) => stock.category === activeTab);

  if (loading) {
    return <LoadingSpinner message="Loading watchlist..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <PageHeader
          title="My Watchlist"
          description="Track your favorite stocks"
          icon={Eye}
        >
          <button
            onClick={handleAddStock}
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Stock
          </button>
        </PageHeader>

        {/* Tabs */}
        <div className="flex space-x-2 bg-background p-1 w-full md:w-fit overflow-x-auto mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isSpecial = tab.isSpecial;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                  ${
                    isActive
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

        {/* Watchlist Table */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-background border border-border rounded-2xl shadow-luxury overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-border bg-muted/5 flex items-center justify-between">
            <h2
              className={`text-lg font-semibold capitalize flex items-center gap-2 ${
                activeTab === 'multibagger' ? 'text-red-500' : 'text-foreground'
              }`}
            >
              {activeTab === 'multibagger' && <Zap className="w-5 h-5 fill-current" />}
              {tabs.find((t) => t.id === activeTab)?.label} Watchlist
            </h2>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{stocks.length}</span> stocks
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    S No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Source From
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Segments
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Trading Symbol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Sector
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    LTP
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Entry Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Stop Loss
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Red Flags
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Note
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stocks.map((stock, index) => {
                  return (
                    <motion.tr
                      key={stock.id || stock.sNo}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-muted/5 transition-colors group"
                    >
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{stock.sNo}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {stock.date}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{stock.sourceFrom}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${
                            stock.segments === 'NSE'
                              ? 'bg-blue-500/10 text-blue-600'
                              : stock.segments === 'BSE'
                              ? 'bg-purple-500/10 text-purple-600'
                              : 'bg-orange-500/10 text-orange-600'
                          }`}
                        >
                          {stock.segments}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-foreground">
                        {stock.tradingSymbol}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{stock.sector}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{stock.industry}</td>
                      <td className="px-4 py-3 text-xs font-mono text-right font-semibold text-foreground">
                        ₹{stock.ltp.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-right text-muted-foreground">
                        ₹{stock.entryPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-right text-error">
                        ₹{stock.stopLoss.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-right text-success">
                        ₹{stock.target.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {stock.redFlags && stock.redFlags !== 'None' ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded bg-error/10 text-error">
                            {stock.redFlags}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate"
                        title={stock.note}
                      >
                        {stock.note || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => stock.id && handleEdit(stock.id)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-all"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => stock.id && handleRemove(stock.id)}
                            className="p-1.5 text-muted-foreground hover:text-error hover:bg-error/10 rounded-md transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
                {stocks.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-6 py-12 text-center text-muted-foreground">
                      No stocks found in this watchlist.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function WatchlistPage() {
  return (
    <AuthGuard loadingMessage="Loading watchlist...">
      <WatchlistContent />
    </AuthGuard>
  );
}
