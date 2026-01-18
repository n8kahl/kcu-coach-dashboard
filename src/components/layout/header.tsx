'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Search,
  Sun,
  Moon,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';

interface HeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, breadcrumbs, actions }: HeaderProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="sticky top-0 z-30 bg-[var(--bg-primary)]/95 backdrop-blur-sm border-b border-[var(--border-primary)]">
      <div className="px-6 py-4">
        {/* Top row */}
        <div className="flex items-center justify-between gap-4">
          <div>
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-1"
              >
                <ol className="flex items-center gap-2" role="list">
                  {breadcrumbs.map((crumb, index) => (
                    <li key={index} className="flex items-center gap-2">
                      {crumb.href ? (
                        <a
                          href={crumb.href}
                          className="hover:text-[var(--text-secondary)] transition-colors focus:outline-none focus-visible:text-[var(--accent-primary)]"
                        >
                          {crumb.label}
                        </a>
                      ) : (
                        <span
                          className="text-[var(--text-secondary)]"
                          aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                        >
                          {crumb.label}
                        </span>
                      )}
                      {index < breadcrumbs.length - 1 && (
                        <span aria-hidden="true">/</span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            {/* Title */}
            <h1 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-wide">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-[var(--text-tertiary)] mt-0.5">{subtitle}</p>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3" role="toolbar" aria-label="Header actions">
            {/* Search toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={cn(
                'p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]',
                showSearch
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              )}
              aria-label={showSearch ? 'Close search' : 'Open search'}
              aria-expanded={showSearch}
              aria-controls="header-search"
            >
              <Search className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
              </button>
              <span
                className="absolute top-1 right-1 w-2 h-2 bg-[var(--accent-primary)]"
                aria-label="New notifications available"
                role="status"
              />
            </div>

            {/* Help */}
            <a
              href="https://discord.gg/kcu"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
              aria-label="Get help on Discord (opens in new tab)"
            >
              <HelpCircle className="w-5 h-5" aria-hidden="true" />
              <ExternalLink className="w-3 h-3 absolute -top-1 -right-1 opacity-0 group-hover:opacity-100" aria-hidden="true" />
            </a>

            {/* Actions slot */}
            {actions}
          </div>
        </div>

        {/* Search bar (expandable) */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              id="header-search"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
              role="search"
            >
              <div className="pt-4">
                <label htmlFor="header-search-input" className="sr-only">
                  Search trades, topics, achievements
                </label>
                <Input
                  id="header-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search trades, topics, achievements..."
                  leftIcon={<Search className="w-4 h-4" aria-hidden="true" />}
                  autoFocus
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

// Market Status Bar - shows live market info
interface MarketStatusProps {
  spyPrice: number;
  spyChange: number;
  qqqPrice: number;
  qqqChange: number;
  vix: number;
  marketStatus: 'pre-market' | 'open' | 'closed';
  lastUpdated: string;
}

export function MarketStatusBar({
  spyPrice,
  spyChange,
  qqqPrice,
  qqqChange,
  vix,
  marketStatus,
  lastUpdated,
}: MarketStatusProps) {
  const statusColors = {
    'pre-market': 'bg-[var(--warning)]',
    open: 'bg-[var(--success)]',
    closed: 'bg-[var(--text-tertiary)]',
  };

  const statusLabels = {
    'pre-market': 'Pre-Market',
    open: 'Market Open',
    closed: 'Market Closed',
  };

  return (
    <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
      <div className="px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Market Status */}
          <div className="flex items-center gap-2">
            <span className={cn('w-2 h-2 pulse-dot', statusColors[marketStatus])} />
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {statusLabels[marketStatus]}
            </span>
          </div>

          {/* SPY */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-primary)]">SPY</span>
            <span className="text-xs font-mono text-[var(--text-primary)]">
              ${spyPrice.toFixed(2)}
            </span>
            <span
              className={cn(
                'text-xs font-mono',
                spyChange >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
              )}
            >
              {spyChange >= 0 ? '+' : ''}{spyChange.toFixed(2)}%
            </span>
          </div>

          {/* QQQ */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-primary)]">QQQ</span>
            <span className="text-xs font-mono text-[var(--text-primary)]">
              ${qqqPrice.toFixed(2)}
            </span>
            <span
              className={cn(
                'text-xs font-mono',
                qqqChange >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
              )}
            >
              {qqqChange >= 0 ? '+' : ''}{qqqChange.toFixed(2)}%
            </span>
          </div>

          {/* VIX */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-primary)]">VIX</span>
            <span
              className={cn(
                'text-xs font-mono',
                vix > 20 ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]'
              )}
            >
              {vix.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Last updated */}
        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <RefreshCw className="w-3 h-3" />
          <span className="text-xs">{lastUpdated}</span>
        </div>
      </div>
    </div>
  );
}
