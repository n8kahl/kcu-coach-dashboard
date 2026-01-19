'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BarChart2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { useState } from 'react';

export interface MarketContext {
  spyTrend: 'bullish' | 'bearish' | 'neutral';
  spyChange?: number;
  vixLevel: number;
  vixChange?: number;
  sectorPerformance?: {
    sector: string;
    change: number;
  }[];
  premarketAction?: string;
  timeOfDay?: string;
  newsEvents?: string[];
  volumeProfile?: 'high' | 'normal' | 'low';
}

export interface LTPAnalysis {
  level: {
    score: number;
    reason: string;
  };
  trend: {
    score: number;
    reason: string;
  };
  patience: {
    score: number;
    reason: string;
  };
  overall?: number;
}

interface ContextPanelProps {
  marketContext: MarketContext;
  ltpAnalysis?: LTPAnalysis;
  decisionContext?: string;
  className?: string;
  collapsed?: boolean;
}

const TREND_ICONS = {
  bullish: TrendingUp,
  bearish: TrendingDown,
  neutral: Minus,
};

const TREND_COLORS = {
  bullish: 'text-[var(--profit)]',
  bearish: 'text-[var(--loss)]',
  neutral: 'text-[var(--text-tertiary)]',
};

function getVixSeverity(vixLevel: number): { label: string; color: string } {
  if (vixLevel < 15) return { label: 'Low', color: 'text-[var(--profit)]' };
  if (vixLevel < 20) return { label: 'Moderate', color: 'text-[var(--warning)]' };
  if (vixLevel < 30) return { label: 'Elevated', color: 'text-orange-400' };
  return { label: 'High', color: 'text-[var(--loss)]' };
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-[var(--profit)]';
  if (score >= 60) return 'text-[var(--warning)]';
  return 'text-[var(--loss)]';
}

function ScoreBar({ score, label, reason }: { score: number; label: string; reason: string }) {
  const color = getScoreColor(score);
  const barColor = score >= 80 ? 'bg-[var(--profit)]' : score >= 60 ? 'bg-[var(--warning)]' : 'bg-[var(--loss)]';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)]">{label}</span>
        <span className={cn('text-sm font-bold', color)}>{score}%</span>
      </div>
      <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('h-full rounded-full', barColor)}
        />
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)] leading-tight">{reason}</p>
    </div>
  );
}

export function ContextPanel({
  marketContext,
  ltpAnalysis,
  decisionContext,
  className,
  collapsed: initialCollapsed = false,
}: ContextPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const TrendIcon = TREND_ICONS[marketContext.spyTrend];
  const trendColor = TREND_COLORS[marketContext.spyTrend];
  const vixSeverity = getVixSeverity(marketContext.vixLevel);

  const overallScore = ltpAnalysis
    ? Math.round((ltpAnalysis.level.score * 0.35 + ltpAnalysis.trend.score * 0.35 + ltpAnalysis.patience.score * 0.30))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="font-medium text-[var(--text-primary)]">Market Context</span>
        </div>
        {isCollapsed ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
        ) : (
          <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" />
        )}
      </button>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Market Overview */}
              <div className="grid grid-cols-2 gap-3">
                {/* SPY Trend */}
                <div className="p-3 bg-[var(--bg-primary)] rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendIcon className={cn('w-4 h-4', trendColor)} />
                    <span className="text-xs text-[var(--text-tertiary)]">SPY Trend</span>
                  </div>
                  <div className={cn('text-sm font-bold capitalize', trendColor)}>
                    {marketContext.spyTrend}
                  </div>
                  {marketContext.spyChange !== undefined && (
                    <div className={cn('text-xs', marketContext.spyChange >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]')}>
                      {marketContext.spyChange >= 0 ? '+' : ''}{marketContext.spyChange.toFixed(2)}%
                    </div>
                  )}
                </div>

                {/* VIX Level */}
                <div className="p-3 bg-[var(--bg-primary)] rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-[var(--text-tertiary)]" />
                    <span className="text-xs text-[var(--text-tertiary)]">VIX</span>
                  </div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">
                    {marketContext.vixLevel.toFixed(1)}
                  </div>
                  <div className={cn('text-xs', vixSeverity.color)}>
                    {vixSeverity.label} Volatility
                  </div>
                </div>
              </div>

              {/* Volume Profile */}
              {marketContext.volumeProfile && (
                <div className="flex items-center justify-between p-2 bg-[var(--bg-primary)] rounded-lg">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-[var(--text-tertiary)]" />
                    <span className="text-xs text-[var(--text-secondary)]">Volume</span>
                  </div>
                  <span className={cn(
                    'text-xs font-medium capitalize',
                    marketContext.volumeProfile === 'high' ? 'text-[var(--accent-primary)]' :
                    marketContext.volumeProfile === 'low' ? 'text-[var(--text-tertiary)]' :
                    'text-[var(--text-secondary)]'
                  )}>
                    {marketContext.volumeProfile}
                  </span>
                </div>
              )}

              {/* Time of Day */}
              {marketContext.timeOfDay && (
                <div className="flex items-center justify-between p-2 bg-[var(--bg-primary)] rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--text-tertiary)]" />
                    <span className="text-xs text-[var(--text-secondary)]">Session</span>
                  </div>
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    {marketContext.timeOfDay}
                  </span>
                </div>
              )}

              {/* Sector Performance */}
              {marketContext.sectorPerformance && marketContext.sectorPerformance.length > 0 && (
                <div>
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'sectors' ? null : 'sectors')}
                    className="w-full flex items-center justify-between text-xs text-[var(--text-tertiary)] mb-2"
                  >
                    <span>Sector Performance</span>
                    {expandedSection === 'sectors' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <AnimatePresence>
                    {expandedSection === 'sectors' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-1 overflow-hidden"
                      >
                        {marketContext.sectorPerformance.map((sector, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 bg-[var(--bg-primary)] rounded text-xs"
                          >
                            <span className="text-[var(--text-secondary)]">{sector.sector}</span>
                            <span className={cn(
                              'font-mono',
                              sector.change >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
                            )}>
                              {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%
                            </span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Premarket Action */}
              {marketContext.premarketAction && (
                <div className="p-2 bg-[var(--bg-primary)] rounded-lg">
                  <div className="text-xs text-[var(--text-tertiary)] mb-1">Premarket</div>
                  <div className="text-sm text-[var(--text-primary)]">
                    {marketContext.premarketAction}
                  </div>
                </div>
              )}

              {/* News Events */}
              {marketContext.newsEvents && marketContext.newsEvents.length > 0 && (
                <div className="p-2 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg">
                  <div className="flex items-center gap-2 text-[var(--warning)] mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium">Events</span>
                  </div>
                  <div className="space-y-1">
                    {marketContext.newsEvents.map((event, idx) => (
                      <div key={idx} className="text-xs text-[var(--text-secondary)]">
                        {event}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LTP Analysis */}
              {ltpAnalysis && (
                <div className="border-t border-[var(--border-primary)] pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      LTP Analysis
                    </span>
                    {overallScore !== null && (
                      <div className={cn('text-lg font-bold', getScoreColor(overallScore))}>
                        {overallScore}%
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <ScoreBar
                      score={ltpAnalysis.level.score}
                      label="Level (35%)"
                      reason={ltpAnalysis.level.reason}
                    />
                    <ScoreBar
                      score={ltpAnalysis.trend.score}
                      label="Trend (35%)"
                      reason={ltpAnalysis.trend.reason}
                    />
                    <ScoreBar
                      score={ltpAnalysis.patience.score}
                      label="Patience (30%)"
                      reason={ltpAnalysis.patience.reason}
                    />
                  </div>
                </div>
              )}

              {/* Decision Context */}
              {decisionContext && (
                <div className="p-3 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded-lg">
                  <div className="text-xs text-[var(--accent-primary)] font-medium mb-1">
                    Decision Context
                  </div>
                  <div className="text-sm text-[var(--text-primary)]">
                    {decisionContext}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Compact inline context display
export function ContextBadges({ marketContext }: { marketContext: MarketContext }) {
  const TrendIcon = TREND_ICONS[marketContext.spyTrend];
  const trendColor = TREND_COLORS[marketContext.spyTrend];
  const vixSeverity = getVixSeverity(marketContext.vixLevel);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)]'
      )}>
        <TrendIcon className={cn('w-3 h-3', trendColor)} />
        <span className={cn('capitalize', trendColor)}>{marketContext.spyTrend}</span>
      </div>

      <div className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)]'
      )}>
        <Activity className={cn('w-3 h-3', vixSeverity.color)} />
        <span className={vixSeverity.color}>VIX {marketContext.vixLevel.toFixed(1)}</span>
      </div>

      {marketContext.volumeProfile && (
        <div className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
          'bg-[var(--bg-secondary)] border border-[var(--border-primary)]'
        )}>
          <BarChart2 className="w-3 h-3 text-[var(--text-tertiary)]" />
          <span className="text-[var(--text-secondary)] capitalize">{marketContext.volumeProfile} Vol</span>
        </div>
      )}
    </div>
  );
}

export default ContextPanel;
