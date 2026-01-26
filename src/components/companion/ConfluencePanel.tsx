'use client';

/**
 * ConfluencePanel
 *
 * A vertical panel that visualizes the LTP confluence score components.
 * Designed to sit beside the chart for quick visual reference.
 *
 * Shows:
 * - Overall LTP grade with color coding
 * - Level alignment bar (proximity to key levels)
 * - Trend alignment bar (MTF trend confluence)
 * - Patience bar (candle formation signals)
 * - Direction indicator (bullish/bearish/neutral)
 */

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Target, Activity, Clock } from 'lucide-react';
import type { LTP2Score } from '@/lib/ltp-gamma-engine';
import type { LTPAnalysis } from '@/lib/market-data';
import { isValidNumber } from '@/lib/format-trade-data';

// ============================================================================
// TYPES
// ============================================================================

export interface ConfluencePanelProps {
  ltp2Score: LTP2Score | null;
  ltpAnalysis: LTPAnalysis | null;
  currentPrice: number;
  vwap: number;
  className?: string;
}

// ============================================================================
// GRADE STYLES
// ============================================================================

const GRADE_STYLES: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  Sniper: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500',
    text: 'text-emerald-400',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.5)]',
  },
  Decent: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500',
    text: 'text-amber-400',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',
  },
  'Dumb Shit': {
    bg: 'bg-red-500/20',
    border: 'border-red-500',
    text: 'text-red-400',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ConfluencePanel({
  ltp2Score,
  ltpAnalysis,
  currentPrice,
  vwap,
  className,
}: ConfluencePanelProps) {
  // Calculate scores from either LTP2 or legacy LTPAnalysis
  const levelScore = ltp2Score?.breakdown?.cloudScore
    ? Math.round((ltp2Score.breakdown.cloudScore / 25) * 100)
    : ltpAnalysis?.levels?.levelScore || 0;

  const trendScore = ltp2Score?.breakdown?.vwapScore
    ? Math.round(((ltp2Score.breakdown.vwapScore + ltp2Score.breakdown.gammaWallScore) / 40) * 100)
    : ltpAnalysis?.trend?.trendScore || 0;

  const patienceScore = ltp2Score?.breakdown?.patienceScore
    ? Math.round((ltp2Score.breakdown.patienceScore / 10) * 100)
    : ltpAnalysis?.patience?.patienceScore || 0;

  const overallScore = ltp2Score?.score || ltpAnalysis?.confluenceScore || 0;
  const grade = ltp2Score?.grade || ltpAnalysis?.grade || 'C';
  const direction = ltp2Score?.direction || (ltpAnalysis?.trend?.intradayTrend === 'bullish' ? 'bullish' : ltpAnalysis?.trend?.intradayTrend === 'bearish' ? 'bearish' : 'neutral');

  // Get grade style
  const gradeStyle = GRADE_STYLES[grade] || GRADE_STYLES['Dumb Shit'];

  // Price vs VWAP
  const aboveVwap = isValidNumber(currentPrice) && isValidNumber(vwap) ? currentPrice > vwap : null;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-3 bg-[#0d0d0d] border-l border-[#2a2e39]',
        'w-[80px] shrink-0',
        className
      )}
    >
      {/* Grade Badge */}
      <div
        className={cn(
          'flex flex-col items-center justify-center p-2 rounded border-2',
          gradeStyle.bg,
          gradeStyle.border,
          gradeStyle.glow
        )}
      >
        <span className={cn('text-lg font-black', gradeStyle.text)}>
          {grade === 'Sniper' ? '🎯' : grade === 'Decent' ? '📊' : '⚠️'}
        </span>
        <span className={cn('text-[9px] font-bold uppercase tracking-wider', gradeStyle.text)}>
          {grade === 'Dumb Shit' ? 'WAIT' : grade === 'Sniper' ? 'GO' : 'MAYBE'}
        </span>
      </div>

      {/* Direction Indicator */}
      <div className="flex items-center justify-center p-1.5 rounded bg-[#1e222d]">
        {direction === 'bullish' ? (
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        ) : direction === 'bearish' ? (
          <TrendingDown className="w-4 h-4 text-red-400" />
        ) : (
          <Minus className="w-4 h-4 text-gray-400" />
        )}
      </div>

      {/* Confluence Bars - Vertical Stack */}
      <div className="flex-1 flex flex-col gap-1.5">
        {/* Level Score */}
        <ConfluenceBar
          icon={<Target className="w-3 h-3" />}
          label="L"
          value={levelScore}
          color="emerald"
        />

        {/* Trend Score */}
        <ConfluenceBar
          icon={<Activity className="w-3 h-3" />}
          label="T"
          value={trendScore}
          color="blue"
        />

        {/* Patience Score */}
        <ConfluenceBar
          icon={<Clock className="w-3 h-3" />}
          label="P"
          value={patienceScore}
          color="amber"
        />
      </div>

      {/* Overall Score */}
      <div className="text-center pt-1 border-t border-[#2a2e39]">
        <span
          className={cn(
            'text-sm font-black tabular-nums',
            overallScore >= 75 ? 'text-emerald-400' : overallScore >= 50 ? 'text-amber-400' : 'text-red-400'
          )}
        >
          {Math.round(overallScore)}
        </span>
        <span className="text-[8px] text-gray-500 block">SCORE</span>
      </div>

      {/* VWAP Position */}
      {aboveVwap !== null && (
        <div
          className={cn(
            'text-center text-[8px] font-bold uppercase py-1 rounded',
            aboveVwap ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          )}
        >
          {aboveVwap ? '▲ VWAP' : '▼ VWAP'}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONFLUENCE BAR
// ============================================================================

interface ConfluenceBarProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'emerald' | 'blue' | 'amber' | 'red';
}

function ConfluenceBar({ icon, label, value, color }: ConfluenceBarProps) {
  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-500',
      text: 'text-emerald-400',
      track: 'bg-emerald-500/20',
    },
    blue: {
      bg: 'bg-blue-500',
      text: 'text-blue-400',
      track: 'bg-blue-500/20',
    },
    amber: {
      bg: 'bg-amber-500',
      text: 'text-amber-400',
      track: 'bg-amber-500/20',
    },
    red: {
      bg: 'bg-red-500',
      text: 'text-red-400',
      track: 'bg-red-500/20',
    },
  };

  const colors = colorClasses[color];
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Label */}
      <span className={cn('text-[10px] font-bold', colors.text)}>{label}</span>

      {/* Vertical Bar */}
      <div className={cn('w-5 h-20 rounded-sm overflow-hidden relative', colors.track)}>
        <div
          className={cn('absolute bottom-0 left-0 right-0 transition-all duration-500', colors.bg)}
          style={{ height: `${clampedValue}%` }}
        />
      </div>

      {/* Value */}
      <span className="text-[9px] text-gray-400 font-mono tabular-nums">{Math.round(clampedValue)}</span>
    </div>
  );
}

export default ConfluencePanel;
