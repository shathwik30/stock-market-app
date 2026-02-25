'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import toast from 'react-hot-toast';
import apiClient from '@/lib/api-client';
import { TrendingUp, TrendingDown, Eye, Wallet, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AuthGuard, LoadingSpinner } from '@/components/common';

interface Stats {
  totalGainers: number;
  totalLosers: number;
  avgGain: number;
  avgLoss: number;
  topGainer: {
    company: string;
    sector: string;
    ltp: number;
    percentInChange: number;
  } | null;
  topLoser: {
    company: string;
    sector: string;
    ltp: number;
    percentInChange: number;
  } | null;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
    },
  },
};

function DashboardContent() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/api/stocks/stats');
      setStats(response.data.stats);
    } catch {
      toast.error('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const quickActions = [
    { href: '/gainers', label: 'Top Gainers', icon: TrendingUp, color: 'text-success', bgColor: 'bg-success/10' },
    { href: '/losers', label: 'Top Losers', icon: TrendingDown, color: 'text-error', bgColor: 'bg-error/10' },
    { href: '/watchlist', label: 'Watchlist', icon: Eye, color: 'text-primary', bgColor: 'bg-primary/10' },
    { href: '/portfolio', label: 'Portfolio', icon: Wallet, color: 'text-primary', bgColor: 'bg-primary/10' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-2">
            Welcome back, {user?.firstName || user?.username}
          </h1>
          <p className="text-lg text-muted-foreground">
            Here&apos;s your market overview for today
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          {/* Total Gainers */}
          <motion.div variants={itemVariants} className="bg-background border border-border rounded-2xl p-6 hover:shadow-luxury transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Total Gainers</span>
              <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
            </div>
            <p className="text-4xl font-display font-bold text-foreground mb-1">
              {stats?.totalGainers || 0}
            </p>
            <p className="text-sm text-success flex items-center">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              +{stats?.avgGain?.toFixed(2) || '0.00'}% avg
            </p>
          </motion.div>

          {/* Total Losers */}
          <motion.div variants={itemVariants} className="bg-background border border-border rounded-2xl p-6 hover:shadow-luxury transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Total Losers</span>
              <div className="w-10 h-10 bg-error/10 rounded-xl flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-error" />
              </div>
            </div>
            <p className="text-4xl font-display font-bold text-foreground mb-1">
              {stats?.totalLosers || 0}
            </p>
            <p className="text-sm text-error flex items-center">
              <ArrowDownRight className="h-4 w-4 mr-1" />
              {stats?.avgLoss?.toFixed(2) || '0.00'}% avg
            </p>
          </motion.div>

          {/* Market Activity */}
          <motion.div variants={itemVariants} className="bg-background border border-border rounded-2xl p-6 hover:shadow-luxury transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Market Activity</span>
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-4xl font-display font-bold text-foreground mb-1">
              High
            </p>
            <p className="text-sm text-muted-foreground">
              Strong trading volume
            </p>
          </motion.div>
        </motion.div>

        {/* Top Performers */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid md:grid-cols-2 gap-6 mb-12"
        >
          {/* Top Gainer Card */}
          {stats?.topGainer && (
            <motion.div variants={itemVariants} className="bg-background border border-border rounded-2xl p-8 hover:shadow-luxury transition-all group">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Top Gainer</p>
                  <h3 className="text-2xl font-display font-bold text-foreground group-hover:text-success transition-colors">
                    {stats.topGainer.company}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{stats.topGainer.sector}</p>
                </div>
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Current Price</p>
                  <p className="text-xl font-display font-bold text-foreground">
                    ₹{stats.topGainer.ltp.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Change</p>
                  <p className="text-xl font-display font-bold text-success">
                    +{stats.topGainer.percentInChange.toFixed(2)}%
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Top Loser Card */}
          {stats?.topLoser && (
            <motion.div variants={itemVariants} className="bg-background border border-border rounded-2xl p-8 hover:shadow-luxury transition-all group">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Top Loser</p>
                  <h3 className="text-2xl font-display font-bold text-foreground group-hover:text-error transition-colors">
                    {stats.topLoser.company}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{stats.topLoser.sector}</p>
                </div>
                <div className="w-12 h-12 bg-error/10 rounded-xl flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-error" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Current Price</p>
                  <p className="text-xl font-display font-bold text-foreground">
                    ₹{stats.topLoser.ltp.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Change</p>
                  <p className="text-xl font-display font-bold text-error">
                    {stats.topLoser.percentInChange.toFixed(2)}%
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <h2 className="text-2xl font-display font-bold text-foreground mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <motion.div key={action.href} variants={itemVariants}>
                <Link
                  href={action.href}
                  className="group block bg-background border border-border rounded-xl p-6 hover:shadow-luxury hover:border-foreground/20 transition-all"
                >
                  <div className={`w-12 h-12 ${action.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <action.icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{action.label}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard loadingMessage="Loading dashboard...">
      <DashboardContent />
    </AuthGuard>
  );
}
