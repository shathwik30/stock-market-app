'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useHasHydrated } from '@/store/useAuthStore';
import { Briefcase, TrendingUp, FileText, ArrowRight, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
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

const portfolioOptions = [
  {
    href: '/portfolio/live-trading',
    icon: TrendingUp,
    title: 'Live Trading',
    description: 'View your real trading portfolio with actual market positions',
    gradient: 'from-green-500 to-emerald-600',
    bgColor: 'bg-green-500/10',
    iconColor: 'text-green-500',
  },
  {
    href: '/portfolio/paper-trading',
    icon: FileText,
    title: 'Paper Trading',
    description: 'Practice trading with simulated positions and virtual money',
    gradient: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
  },
  {
    href: '/portfolio/management',
    icon: PieChart,
    title: 'Portfolio Management',
    description: 'Analyze and manage your portfolio allocation and risk',
    gradient: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
  },
];

export default function PortfolioPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const hydrated = useHasHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Briefcase className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground">
                Portfolio
              </h1>
              <p className="text-lg text-muted-foreground mt-1">
                Manage your trading portfolios
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid md:grid-cols-3 gap-6 max-w-6xl"
        >
          {portfolioOptions.map((option) => (
            <motion.div key={option.href} variants={itemVariants}>
              <Link
                href={option.href}
                className="group block bg-background border border-border rounded-2xl p-8 shadow-luxury hover:shadow-2xl transition-all duration-300 hover:border-primary/30"
              >
                <div className={`w-14 h-14 ${option.bgColor} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <option.icon className={`w-7 h-7 ${option.iconColor}`} />
                </div>
                <h3 className="text-2xl font-display font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {option.title}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {option.description}
                </p>
                <div className="flex items-center text-primary font-medium">
                  <span>View Portfolio</span>
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
