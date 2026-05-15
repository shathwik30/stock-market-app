'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LineChart,
  Search,
  Briefcase,
  ChevronDown,
  Activity,
  PieChart,
  Globe,
  LogOut,
  StickyNote,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  navLinks,
  afterMarketDataLinks,
  portfolioLinks,
  marketDataLinks,
  screenersLinks,
} from '@/lib/nav-config';

interface NavMobileProps {
  user: { firstName?: string; username?: string; email?: string } | null;
  onLogout: () => void;
  onClose: () => void;
}

const activeLinkClass = (pathname: string, href: string) => `
  block py-2 pl-5 text-sm rounded-lg transition-colors
  ${pathname === href
    ? 'text-foreground bg-secondary'
    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
  }
`;

const simpleLinkClass = (pathname: string, href: string) => `
  block py-2 pl-2 text-sm rounded-lg transition-colors
  ${pathname === href
    ? 'text-foreground bg-secondary'
    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
  }
`;

export function NavMobile({ user, onLogout, onClose }: NavMobileProps) {
  const pathname = usePathname();
  const [marketDataOpen, setMarketDataOpen] = useState(false);
  const [screenersOpen, setScreenersOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);

  const isMarketDataActive = pathname.startsWith('/market-data');
  const isScreenersActive = pathname.startsWith('/screeners');
  const isPortfolioActive = pathname.startsWith('/portfolio');

  const closeAll = () => {
    onClose();
    setMarketDataOpen(false);
    setScreenersOpen(false);
    setPortfolioOpen(false);
  };

  return (
    <div className="py-4 space-y-1">
      {navLinks.map((link) => {
        const Icon = link.icon!;
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={closeAll}
            className={`
              flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
              ${isActive ? 'text-foreground bg-secondary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}
            `}
          >
            <Icon className="h-4 w-4" />
            <span>{link.label}</span>
          </Link>
        );
      })}

      {/* Market Data Section */}
      <div className="px-4 py-3">
        <button
          onClick={() => setMarketDataOpen(!marketDataOpen)}
          className={`w-full flex items-center justify-between text-sm font-medium transition-colors ${isMarketDataActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <div className="flex items-center space-x-3">
            <LineChart className="h-4 w-4" />
            <span>Market Data</span>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${marketDataOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {marketDataOpen && (
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

                <div className="mb-2">
                  <div className="flex items-center gap-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Activity className="h-3 w-3" /> Indices
                  </div>
                  {marketDataLinks.marketOverview.indices.map((link) => (
                    <Link key={link.href} href={link.href} onClick={closeAll} className={activeLinkClass(pathname, link.href)}>{link.label}</Link>
                  ))}
                </div>

                <div className="mb-2">
                  <div className="flex items-center gap-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <PieChart className="h-3 w-3" /> Sectors
                  </div>
                  {marketDataLinks.marketOverview.sectors.map((link) => (
                    <Link key={link.href} href={link.href} onClick={closeAll} className={activeLinkClass(pathname, link.href)}>{link.label}</Link>
                  ))}
                </div>

                <div>
                  <div className="flex items-center gap-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Globe className="h-3 w-3" /> Global Markets
                  </div>
                  {marketDataLinks.marketOverview.globalMarkets.map((link) => (
                    <Link key={link.href} href={link.href} onClick={closeAll} className={activeLinkClass(pathname, link.href)}>{link.label}</Link>
                  ))}
                </div>
              </div>

              {/* Equity */}
              <div>
                <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border">
                  Equity
                </div>
                {marketDataLinks.equity.map((link) => (
                  <Link key={link.href} href={link.href} onClick={closeAll} className={simpleLinkClass(pathname, link.href)}>{link.label}</Link>
                ))}
              </div>

              {/* Others */}
              <div>
                <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border">
                  Others
                </div>
                {marketDataLinks.others.general.map((link) => (
                  <Link key={link.href} href={link.href} onClick={closeAll} className={simpleLinkClass(pathname, link.href)}>{link.label}</Link>
                ))}
                <div className="mt-2">
                  <div className="py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deals</div>
                  {marketDataLinks.others.deals.map((link) => (
                    <Link key={link.href} href={link.href} onClick={closeAll} className={activeLinkClass(pathname, link.href)}>{link.label}</Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Screeners Section */}
      <div className="px-4 py-3">
        <button
          onClick={() => setScreenersOpen(!screenersOpen)}
          className={`w-full flex items-center justify-between text-sm font-medium transition-colors ${isScreenersActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <div className="flex items-center space-x-3">
            <Search className="h-4 w-4" />
            <span>Screeners</span>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${screenersOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {screenersOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2 ml-7 space-y-3 overflow-hidden"
            >
              <div>
                <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border">
                  Technical
                </div>
                <div className="mb-2">
                  {screenersLinks.technical.screeningTable.map((link) => (
                    <Link key={link.label} href={link.href} onClick={closeAll} className="block py-2 pl-2 text-sm rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/50">{link.label}</Link>
                  ))}
                </div>
                <div className="mb-2">
                  <div className="py-1 text-xs font-semibold text-muted-foreground">Candlestick Patterns</div>
                  {screenersLinks.technical.candlestickPatterns.map((link) => (
                    <Link key={link.label} href={link.href} onClick={closeAll} className="block py-2 pl-2 text-sm rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/50">{link.label}</Link>
                  ))}
                </div>
                <div className="mb-2">
                  <div className="py-1 text-xs font-semibold text-muted-foreground">Chart Patterns</div>
                  {screenersLinks.technical.chartPatterns.map((link) => (
                    <Link key={link.label} href={link.href} onClick={closeAll} className="block py-2 pl-2 text-sm rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/50">{link.label}</Link>
                  ))}
                </div>
                <div className="mb-2">
                  <div className="py-1 text-xs font-semibold text-muted-foreground">Drawing Tools</div>
                  {screenersLinks.technical.drawingTools.map((link) => (
                    <Link key={link.label} href={link.href} onClick={closeAll} className="block py-2 pl-2 text-sm rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/50">{link.label}</Link>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border">
                  Fundamental
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* After Market Data Links */}
      {afterMarketDataLinks.map((link) => {
        const Icon = link.icon!;
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={closeAll}
            className={`
              flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
              ${isActive ? 'text-foreground bg-secondary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}
            `}
          >
            <Icon className="h-4 w-4" />
            <span>{link.label}</span>
          </Link>
        );
      })}

      {/* Portfolio Section */}
      <div className="px-4 py-3">
        <button
          onClick={() => setPortfolioOpen(!portfolioOpen)}
          className={`w-full flex items-center justify-between text-sm font-medium transition-colors ${isPortfolioActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <div className="flex items-center space-x-3">
            <Briefcase className="h-4 w-4" />
            <span>Portfolio</span>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${portfolioOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {portfolioOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2 ml-7 space-y-1 overflow-hidden"
            >
              {portfolioLinks.map((link) => {
                const Icon = link.icon!;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeAll}
                    className={`
                      flex items-center space-x-3 py-2 pl-2 text-sm rounded-lg transition-colors
                      ${pathname === link.href ? 'text-foreground bg-secondary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}
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

      {/* Notes */}
      <Link
        href="/notes"
        onClick={closeAll}
        className={`
          flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
          ${pathname === '/notes' ? 'text-foreground bg-secondary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}
        `}
      >
        <StickyNote className="h-4 w-4" />
        <span>Notes</span>
      </Link>

      {/* User Section */}
      <div className="pt-4 mt-4 border-t border-border">
        <div className="px-4 py-2">
          <p className="text-sm font-medium text-foreground">
            {user?.firstName || user?.username}
          </p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <button
          onClick={() => { onLogout(); closeAll(); }}
          className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors mt-2"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
