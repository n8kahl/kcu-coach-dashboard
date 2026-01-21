'use client';

/**
 * CompanionHUD
 *
 * Displays the LTP 2.0 Score HUD with grade, breakdown bars, and recommendations.
 * Supports sidebar mode with always-visible score breakdown.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Volume2, AlertTriangle } from 'lucide-react';
import type { LTP2Score } from '@/lib/ltp-gamma-engine';
import type { LTPAnalysis } from '@/lib/market-data';
import { ScoreBreakdown } from './ScoreBreakdown';

// ============================================================================
// PROPS
// ============================================================================

export interface CompanionHUDProps {
  ltp2Score: LTP2Score | null;
  ltpAnalysis: LTPAnalysis | null;
  gammaRegime: 'positive' | 'negative' | 'neutral' | null;
  currentPrice: number;
  vwap: number;
  isSpeaking?: boolean;
  className?: string;
  /** When true, always show the score breakdown (for sidebar mode) */
  showScoreBreakdown?: boolean;
  /** Call wall price for penalty explanation */
  callWall?: number;
  /** Put wall price for penalty explanation */
  putWall?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CompanionHUD({
  ltp2Score,
  ltpAnalysis,
  gammaRegime,
  currentPrice,
  vwap,
  isSpeaking = false,
  className,
  showScoreBreakdown = false,
  callWall,
  putWall,
}: CompanionHUDProps) {
  const [expanded, setExpanded] = useState(false);

  // In sidebar mode, always show breakdown
  const shouldShowBreakdown = showScoreBreakdown || expanded;

  // LTP 2.0 grade colors and badges
  const ltp2GradeStyles: Record<
    string,
    { bg: string; text: string; border: string; emoji: string; label: string }
  > = {
    Sniper: {
      bg: 'bg-[var(--success)]/20',
      text: 'text-[var(--success)]',
      border: 'border-[var(--success)]/50',
      emoji: '🎯',
      label: 'SNIPER',
    },
    Decent: {
      bg: 'bg-[var(--warning)]/15',
      text: 'text-[var(--warning)]',
      border: 'border-[var(--warning)]/30',
      emoji: '📊',
      label: 'DECENT',
    },
    'Dumb Shit': {
      bg: 'bg-[var(--error)]/20',
      text: 'text-[var(--error)]',
      border: 'border-[var(--error)]/50',
      emoji: '💩',
      label: 'DUMB',
    },
  };

  const gammaColors: Record<string, string> = {
    positive: 'text-[var(--success)]',
    negative: 'text-[var(--error)]',
    neutral: 'text-[var(--text-secondary)]',
  };

  const aboveVwap = currentPrice > vwap;
  const gradeStyle = ltp2Score ? ltp2GradeStyles[ltp2Score.grade] : null;

  return (
    <div
      className={cn(
        'bg-[#0d0d0d]/95 backdrop-blur border rounded-lg overflow-hidden transition-all duration-300',
        gradeStyle ? gradeStyle.border : 'border-[var(--border-primary)]',
        shouldShowBreakdown ? 'w-full' : 'w-auto',
        className
      )}
    >
      {/* Compact Header - Always Visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-tertiary)]/50 transition-colors',
          gradeStyle ? gradeStyle.bg : ''
        )}
      >
        {/* Grade Badge */}
        {ltp2Score && gradeStyle ? (
          <span
            className={cn(
              'text-xs font-black px-1.5 py-0.5 rounded border',
              gradeStyle.bg,
              gradeStyle.text,
              gradeStyle.border
            )}
          >
            {gradeStyle.emoji} {gradeStyle.label}
          </span>
        ) : ltpAnalysis ? (
          <span className="text-sm font-black text-[var(--accent-primary)]">
            {ltpAnalysis.grade}
          </span>
        ) : null}

        {/* Score */}
        {ltp2Score && (
          <span
            className={cn(
              'text-lg font-black tabular-nums',
              ltp2Score.score >= 75
                ? 'text-[var(--success)]'
                : ltp2Score.score >= 50
                ? 'text-[var(--warning)]'
                : 'text-[var(--error)]'
            )}
          >
            {ltp2Score.score}
          </span>
        )}

        {/* Quick Indicators */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span
            className={cn(
              'text-[10px] font-bold',
              aboveVwap ? 'text-[var(--success)]' : 'text-[var(--error)]'
            )}
          >
            {aboveVwap ? '▲' : '▼'}
          </span>
          {gammaRegime && (
            <span className={cn('text-[10px] font-bold', gammaColors[gammaRegime])}>
              {gammaRegime === 'positive'
                ? '+γ'
                : gammaRegime === 'negative'
                ? '-γ'
                : '~γ'}
            </span>
          )}
          {isSpeaking && (
            <Volume2 className="w-3 h-3 text-[var(--accent-primary)] animate-pulse" />
          )}
          <ChevronDown
            className={cn(
              'w-3 h-3 text-[var(--text-tertiary)] transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Expanded Details - Uses ScoreBreakdown component */}
      {shouldShowBreakdown && ltp2Score && (
        <div className="px-3 pb-3 border-t border-[var(--border-primary)] pt-2">
          {/* Detailed Score Breakdown with Explanations */}
          <ScoreBreakdown
            score={ltp2Score}
            currentPrice={currentPrice}
            vwap={vwap}
            gammaRegime={gammaRegime}
            callWall={callWall}
            putWall={putWall}
          />

          {/* Recommendation */}
          <div className="mt-3 pt-2 border-t border-[var(--border-primary)]">
            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
              {ltp2Score.recommendation}
            </p>
          </div>

          {/* Warning */}
          {ltp2Score.warnings.length > 0 && (
            <div className="flex items-start gap-1 text-[9px] text-[var(--warning)] bg-[var(--warning)]/10 rounded px-2 py-1 mt-2">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{ltp2Score.warnings[0]}</span>
            </div>
          )}
        </div>
      )}

      {/* Expanded Legacy LTP (fallback) */}
      {shouldShowBreakdown && !ltp2Score && ltpAnalysis && (
        <div className="px-3 pb-3 space-y-1">
          <ScoreBar
            label="Level"
            value={ltpAnalysis.levels.levelScore}
            color="var(--accent-primary)"
          />
          <ScoreBar
            label="Trend"
            value={ltpAnalysis.trend.trendScore}
            color="var(--success)"
          />
          <ScoreBar
            label="Patience"
            value={ltpAnalysis.patience.patienceScore}
            color="var(--warning)"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCORE BAR COMPONENT
// ============================================================================

interface ScoreBarProps {
  label: string;
  value: number;
  max?: number;
  color: string;
}

function ScoreBar({ label, value, max = 100, color }: ScoreBarProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-[10px] font-bold text-[var(--text-tertiary)] truncate">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="w-8 text-[10px] font-mono text-right text-[var(--text-secondary)]">
        {value}
      </span>
    </div>
  );
}

export default CompanionHUD;
