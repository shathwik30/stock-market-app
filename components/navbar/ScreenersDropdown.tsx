'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { NavDropdown } from './NavDropdown';
import { screenersLinks } from '@/lib/nav-config';

const linkClass = "block px-4 py-1 text-sm text-black hover:bg-gray-100 hover:outline hover:outline-1 hover:outline-gray-300 border-b border-gray-200";
const sectionHeader = "px-4 py-1.5 text-sm font-bold text-black border-b border-gray-200";

interface ScreenersDropdownProps {
  isActive: boolean;
}

export function ScreenersDropdown({ isActive }: ScreenersDropdownProps) {
  return (
    <NavDropdown label="Screeners" icon={Search} isActive={isActive} className="rounded-xl">
      <div className="flex">
        {/* Technical Column */}
        <div className="min-w-[200px] border-r border-gray-300">
          <div className="px-4 py-2 text-sm font-bold text-black border-b border-gray-300 bg-gray-50">Technical</div>

          <div className="border-b border-gray-300">
            {screenersLinks.technical.screeningTable.map((link) => (
              <Link key={link.label} href={link.href} className={linkClass}>{link.label}</Link>
            ))}
          </div>

          {/* Candlestick Patterns */}
          <div className="border-b border-gray-300">
            <div className={sectionHeader}>Candlestick Patterns</div>
            {screenersLinks.technical.candlestickPatterns.map((link) => (
              <Link key={link.label} href={link.href} className={linkClass}>{link.label}</Link>
            ))}
          </div>

          {/* Chart Patterns */}
          <div className="border-b border-gray-300">
            <div className={sectionHeader}>Chart Patterns</div>
            {screenersLinks.technical.chartPatterns.map((link) => (
              <Link key={link.label} href={link.href} className={linkClass}>{link.label}</Link>
            ))}
          </div>

          {/* Drawing Tools */}
          <div className="border-b border-gray-300">
            <div className={sectionHeader}>Drawing Tools</div>
            {screenersLinks.technical.drawingTools.map((link) => (
              <Link key={link.label} href={link.href} className={linkClass}>{link.label}</Link>
            ))}
          </div>

          {/* Indicators */}
          <div className="border-b border-gray-300">
            <div className="px-4 py-1.5 text-sm font-bold text-black">Indicators</div>
          </div>

          {/* Strategies */}
          <div>
            <div className="px-4 py-1.5 text-sm font-bold text-black">Strategies</div>
          </div>
        </div>

        {/* Fundamental Column */}
        <div className="min-w-[160px]">
          <div className="px-4 py-2 text-sm font-bold text-black border-b border-gray-300 bg-gray-50">Fundamental</div>
        </div>
      </div>
    </NavDropdown>
  );
}
