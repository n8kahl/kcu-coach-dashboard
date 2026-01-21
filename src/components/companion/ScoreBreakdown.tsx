'use client';

/**
 * ScoreBreakdown
 *
 * Displays detailed LTP2 score breakdown with explanations for each factor.
 * Shows exactly WHY the confluence/penalty scores are what they are.
 */

import { cn } from '@/lib/utils';
import { Check, X, AlertTriangle, TrendingUp, Activity, Target, Shield } from 'lucide-react';
import type { LTP2Score } from '@/lib/ltp-gamma-engine';
import { isValidNumber, isValidPrice, formatPercent, formatScore } from '@/lib/format-trade-data';

// ============================================================================
// TYPES
// ============================================================================

export interface ScoreBreakdownProps {
  score: LTP2Score;
  currentPrice: number;
  vwap: number;
  gammaRegime?: 'positive' | 'negative' | 'neutral' | null;
  callWall?: number;
  putWall?: number;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ScoreBreakdown({
  score,
  currentPrice,
  vwap,
  gammaRegime,
  callWall,
  putWall,
  className,
}: ScoreBreakdownProps) {
  const { breakdown } = score;

  // Determine price position relative to VWAP with safe number checks
  const aboveVwap = isValidPrice(currentPrice) && isValidPrice(vwap) ? currentPrice > vwap : false;
  const vwapDistance = isValidPrice(currentPrice) && isValidPrice(vwap)
    ? ((currentPrice - vwap) / vwap) * 100
    : 0;

  // Determine proximity to gamma walls with safe number checks
  const callWallDistance = isValidPrice(callWall) && isValidPrice(currentPrice)
    ? ((callWall - currentPrice) / currentPrice) * 100
    : null;
  const putWallDistance = isValidPrice(putWall) && isValidPrice(currentPrice)
    ? ((currentPrice - putWall) / currentPrice) * 100
    : null;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-bold border-b border-[var(--border-primary)] pb-1 mb-2">
        Score Breakdown
      </div>

      {/* Cloud Score (EMA Alignment) */}
      <ScoreFactor
        icon={<TrendingUp className="w-3 h-3" />}
        name="Cloud"
        points={breakdown.cloudScore}
        maxPoints={25}
        isPassing={breakdown.cloudScore > 0}
        explanation={
          breakdown.cloudScore >= 25
            ? score.direction === 'bearish'
              ? '8 EMA < 21 EMA (strong bearish)'
              : '8 EMA > 21 EMA (strong bullish)'
            : breakdown.cloudScore >= 21
            ? score.direction === 'bearish'
              ? '8 EMA < 21 EMA (moderate bearish)'
              : '8 EMA > 21 EMA (moderate bullish)'
            : breakdown.cloudScore >= 12
            ? 'EMAs converging - weak trend'
            : breakdown.cloudScore > 0
            ? 'EMAs crossed - neutral zone'
            : 'No EMA cloud alignment'
        }
      />

      {/* VWAP Score */}
      <ScoreFactor
        icon={<Activity className="w-3 h-3" />}
        name="VWAP"
        points={breakdown.vwapScore}
        maxPoints={20}
        isPassing={breakdown.vwapScore > 0}
        explanation={
          isValidPrice(vwap) && isValidNumber(vwapDistance)
            ? score.direction === 'bullish'
              ? aboveVwap
                ? `Price ${Math.abs(vwapDistance).toFixed(1)}% above VWAP (aligned)`
                : `Price ${Math.abs(vwapDistance).toFixed(1)}% below VWAP (not aligned)`
              : aboveVwap
                ? `Price ${Math.abs(vwapDistance).toFixed(1)}% above VWAP (not aligned)`
                : `Price ${Math.abs(vwapDistance).toFixed(1)}% below VWAP (aligned)`
            : breakdown.vwapScore > 0
              ? 'VWAP from most recent trading session'
              : 'VWAP data unavailable'
        }
      />

      {/* Gamma Wall Score */}
      <ScoreFactor
        icon={<Shield className="w-3 h-3" />}
        name="Gamma Wall"
        points={breakdown.gammaWallScore}
        maxPoints={20}
        isPassing={breakdown.gammaWallScore >= 10}
        explanation={
          breakdown.gammaWallScore >= 15
            ? 'Positioned favorably vs gamma walls'
            : breakdown.gammaWallScore >= 10
            ? 'Moderate gamma wall support'
            : 'Near gamma wall resistance'
        }
      />

      {/* Gamma Regime Score */}
      <ScoreFactor
        icon={<Activity className="w-3 h-3" />}
        name="Gamma Flow"
        points={breakdown.gammaRegimeScore}
        maxPoints={15}
        isPassing={breakdown.gammaRegimeScore >= 10}
        explanation={
          gammaRegime === 'positive'
            ? 'Positive gamma (dealer hedging bullish)'
            : gammaRegime === 'negative'
            ? 'Negative gamma (volatility mode)'
            : 'Neutral gamma regime'
        }
      />

      {/* Patience Score */}
      <ScoreFactor
        icon={<Target className="w-3 h-3" />}
        name="Patience"
        points={breakdown.patienceScore}
        maxPoints={10}
        isPassing={breakdown.patienceScore >= 5}
        explanation={
          breakdown.patienceScore >= 8
            ? 'Current candle is inside bar ✓'
            : breakdown.patienceScore >= 5
            ? 'Consolidation forming'
            : 'Current bar not inside (◆ = historical)'
        }
      />

      {/* Resistance Penalty */}
      {breakdown.resistancePenalty < 0 && (
        <div className="flex items-start gap-2 p-2 rounded bg-[var(--error)]/10 border border-[var(--error)]/30">
          <AlertTriangle className="w-3 h-3 text-[var(--error)] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-[var(--error)]">Penalty</span>
              <span className="text-[10px] font-mono text-[var(--error)]">
                {breakdown.resistancePenalty}
              </span>
            </div>
            <p className="text-[9px] text-[var(--error)]/80 mt-0.5 leading-tight">
              {isValidNumber(callWallDistance) && callWallDistance < 1.5
                ? `Only ${callWallDistance.toFixed(1)}% from Call Wall`
                : isValidNumber(putWallDistance) && putWallDistance < 1.5
                ? `Only ${putWallDistance.toFixed(1)}% from Put Wall`
                : 'Approaching significant resistance'}
            </p>
          </div>
        </div>
      )}

      {/* Total Score */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-primary)]">
        <span className="text-[10px] font-bold text-[var(--text-secondary)]">Total</span>
        <span
          className={cn(
            'text-sm font-black tabular-nums',
            isValidNumber(score.score) && score.score >= 75
              ? 'text-[var(--success)]'
              : isValidNumber(score.score) && score.score >= 50
              ? 'text-[var(--warning)]'
              : 'text-[var(--error)]'
          )}
        >
          {formatScore(score.score)}/90
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// SCORE FACTOR ROW
// ============================================================================

interface ScoreFactorProps {
  icon: React.ReactNode;
  name: string;
  points: number;
  maxPoints: number;
  isPassing: boolean;
  explanation: string;
}

function ScoreFactor({
  icon,
  name,
  points,
  maxPoints,
  isPassing,
  explanation,
}: ScoreFactorProps) {
  const percentage = maxPoints > 0 ? (points / maxPoints) * 100 : 0;

  return (
    <div className="flex items-start gap-2">
      {/* Status Icon */}
      <div
        className={cn(
          'w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          isPassing
            ? 'bg-[var(--success)]/20 text-[var(--success)]'
            : 'bg-[var(--text-tertiary)]/20 text-[var(--text-tertiary)]'
        )}
      >
        {isPassing ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className={cn('text-[10px]', isPassing ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]')}>
              {icon}
            </span>
            <span
              className={cn(
                'text-[10px] font-bold',
                isPassing ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
              )}
            >
              {name}
            </span>
          </div>
          <span
            className={cn(
              'text-[10px] font-mono',
              isPassing ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]'
            )}
          >
            +{points}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mt-1">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              isPassing ? 'bg-[var(--success)]' : 'bg-[var(--text-tertiary)]/30'
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>

        {/* Explanation */}
        <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5 leading-tight">
          {explanation}
        </p>
      </div>
    </div>
  );
}

export default ScoreBreakdown;
