'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Calendar,
  BarChart2,
  AlertTriangle,
  Sun,
  Activity,
  DollarSign,
} from 'lucide-react';

export interface ScenarioContext {
  symbol: string;
  date: string;
  freezeTime: string;
  currentPrice: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  premarket: {
    high: number;
    low: number;
    change: number;
  };
  orb: {
    high: number;
    low: number;
    range: number;
  };
  news?: string;
  sector?: string;
  sectorPerformance?: string;
  spyTrend?: 'bullish' | 'bearish' | 'neutral';
}

interface MarketContextCardProps {
  context: ScenarioContext;
  className?: string;
}

export function MarketContextCard({ context, className }: MarketContextCardProps) {
  const isPositive = context.changePercent >= 0;
  const volumeRatio = context.avgVolume > 0 ? (context.volume / context.avgVolume) * 100 : 100;

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(0)}K`;
    return vol.toString();
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm} EST`;
  };

  const TrendIcon = context.spyTrend === 'bullish' ? TrendingUp :
    context.spyTrend === 'bearish' ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xl font-bold text-[var(--text-primary)]">
              {context.symbol}
            </div>
            <div className={cn(
              'flex items-center gap-1 text-sm font-mono',
              isPositive ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
            )}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {isPositive ? '+' : ''}{context.changePercent.toFixed(2)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold font-mono text-[var(--text-primary)]">
              ${context.currentPrice.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Date/Time Row */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Calendar className="w-4 h-4 text-[var(--text-tertiary)]" />
            {context.date}
          </div>
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Clock className="w-4 h-4 text-[var(--text-tertiary)]" />
            {formatTime(context.freezeTime)}
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[var(--text-tertiary)]" />
            <span className="text-sm text-[var(--text-secondary)]">Volume</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-[var(--text-primary)]">
              {formatVolume(context.volume)}
            </span>
            <span className={cn(
              'ml-2 text-xs',
              volumeRatio >= 100 ? 'text-[var(--profit)]' : 'text-[var(--text-tertiary)]'
            )}>
              ({volumeRatio.toFixed(0)}% avg)
            </span>
          </div>
        </div>

        {/* Pre-market Data */}
        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Sun className="w-4 h-4 text-[var(--warning)]" />
            <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">
              Pre-Market
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">High</p>
              <p className="font-mono text-sm text-[var(--profit)]">
                ${context.premarket.high.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Low</p>
              <p className="font-mono text-sm text-[var(--loss)]">
                ${context.premarket.low.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Change</p>
              <p className={cn(
                'font-mono text-sm',
                context.premarket.change >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
              )}>
                {context.premarket.change >= 0 ? '+' : ''}{context.premarket.change.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* ORB Data */}
        <div className="p-3 bg-gradient-to-r from-[var(--profit)]/10 to-[var(--loss)]/10 border border-[var(--border-primary)] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">
              Opening Range (ORB)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">High</p>
              <p className="font-mono text-sm font-bold text-[var(--profit)]">
                ${context.orb.high.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Low</p>
              <p className="font-mono text-sm font-bold text-[var(--loss)]">
                ${context.orb.low.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Range</p>
              <p className="font-mono text-sm text-[var(--text-primary)]">
                ${context.orb.range.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* SPY Trend */}
        {context.spyTrend && (
          <div className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--text-tertiary)]" />
              <span className="text-sm text-[var(--text-secondary)]">SPY Trend</span>
            </div>
            <div className={cn(
              'flex items-center gap-1 text-sm font-semibold capitalize',
              context.spyTrend === 'bullish' ? 'text-[var(--profit)]' :
              context.spyTrend === 'bearish' ? 'text-[var(--loss)]' :
              'text-[var(--text-tertiary)]'
            )}>
              <TrendIcon className="w-4 h-4" />
              {context.spyTrend}
            </div>
          </div>
        )}

        {/* Sector Performance */}
        {context.sector && context.sectorPerformance && (
          <div className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg">
            <span className="text-sm text-[var(--text-secondary)]">{context.sector}</span>
            <span className={cn(
              'text-sm font-mono',
              context.sectorPerformance.includes('+') ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
            )}>
              {context.sectorPerformance}
            </span>
          </div>
        )}

        {/* News */}
        {context.news && context.news !== 'None significant' && (
          <div className="p-3 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--warning)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[var(--warning)] uppercase mb-1">
                  News Catalyst
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {context.news}
                </p>
              </div>
            </div>
          </div>
        )}

        {!context.news || context.news === 'None significant' ? (
          <div className="text-xs text-center text-[var(--text-tertiary)]">
            No significant news catalysts
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

export default MarketContextCard;
