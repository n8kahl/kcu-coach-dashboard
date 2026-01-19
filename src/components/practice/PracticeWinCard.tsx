'use client';

/**
 * Practice Win Card - LTP 2.0 Score Card
 *
 * Pops up immediately after a practice trade closes
 * showing the KCU Grade with LTP 2.0 breakdown.
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { LTP2Score } from '@/lib/ltp-gamma-engine';
import {
  X,
  Share2,
  Trophy,
  Target,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  Shield,
  AlertTriangle,
  ChevronRight,
  Copy,
  CheckCircle,
} from 'lucide-react';

interface PracticeWinCardProps {
  isOpen: boolean;
  onClose: () => void;
  onNextScenario?: () => void;
  onViewDetails?: () => void;

  // Trade result
  symbol: string;
  direction: 'long' | 'short' | 'wait';
  isCorrect: boolean;
  pnlPercent?: number;
  tradeStatus?: 'won' | 'lost' | 'breakeven' | 'wait';

  // LTP 2.0 Score
  ltp2Score?: LTP2Score;

  // Legacy scoring
  grade?: string;
  score?: number;
  breakdown?: {
    cloudScore?: number;
    vwapScore?: number;
    gammaScore?: number;
    patienceScore?: number;
    resistancePenalty?: number;
  };
}

export function PracticeWinCard({
  isOpen,
  onClose,
  onNextScenario,
  onViewDetails,
  symbol,
  direction,
  isCorrect,
  pnlPercent,
  tradeStatus,
  ltp2Score,
  grade,
  score,
  breakdown,
}: PracticeWinCardProps) {
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-close confetti effect
  useEffect(() => {
    if (isOpen && isCorrect && ltp2Score?.grade === 'Sniper') {
      // Could trigger confetti here
    }
  }, [isOpen, isCorrect, ltp2Score]);

  if (!isOpen) return null;

  // Use LTP 2.0 data if available, otherwise fall back to props
  const displayGrade = ltp2Score?.grade || grade || (isCorrect ? 'B' : 'D');
  const displayScore = ltp2Score?.score ?? score ?? (isCorrect ? 65 : 35);
  const displayDirection = ltp2Score?.direction || (direction === 'long' ? 'bullish' : direction === 'short' ? 'bearish' : 'neutral');

  // Determine theme based on grade
  const getTheme = () => {
    if (displayGrade === 'Sniper') {
      return {
        bg: 'from-green-500/30 to-emerald-600/30',
        border: 'border-green-500',
        glow: 'shadow-[0_0_40px_rgba(34,197,94,0.4)]',
        textColor: 'text-green-400',
        emoji: '🎯',
      };
    }
    if (displayGrade === 'Decent' || displayGrade === 'B' || displayGrade === 'B+') {
      return {
        bg: 'from-yellow-500/20 to-amber-500/20',
        border: 'border-yellow-500/50',
        glow: 'shadow-[0_0_30px_rgba(251,191,36,0.3)]',
        textColor: 'text-yellow-400',
        emoji: '📊',
      };
    }
    // Dumb Shit / C / D / F
    return {
      bg: 'from-red-500/20 to-rose-500/20',
      border: 'border-red-500/50',
      glow: 'shadow-[0_0_30px_rgba(239,68,68,0.3)]',
      textColor: 'text-red-400',
      emoji: '💩',
    };
  };

  const theme = getTheme();

  const copyToClipboard = async () => {
    const text = `${displayGrade} setup on $${symbol}! LTP Score: ${displayScore}/100 #KCU #LTPFramework`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in duration-300">
      <div className={cn(
        'relative w-full max-w-md mx-4 bg-gradient-to-br rounded-lg overflow-hidden',
        theme.bg,
        'border',
        theme.border,
        theme.glow,
        'animate-in zoom-in-95 duration-300'
      )}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 hover:bg-white/10 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5 text-[var(--text-tertiary)]" />
        </button>

        {/* Header */}
        <div className="p-6 pb-0 text-center">
          <div className="text-4xl mb-2">{theme.emoji}</div>
          <h2 className={cn('text-2xl font-black mb-1', theme.textColor)}>
            {displayGrade === 'Sniper' ? 'SNIPER SETUP!' :
             displayGrade === 'Decent' ? 'DECENT TRADE' :
             'LEARNING MOMENT'}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {symbol} • {direction.toUpperCase()}
          </p>
        </div>

        {/* Score Circle */}
        <div className="flex justify-center py-6">
          <div className={cn(
            'relative w-24 h-24 rounded-full border-4 flex items-center justify-center',
            displayScore >= 75 ? 'border-green-500' :
            displayScore >= 50 ? 'border-yellow-500' :
            'border-red-500'
          )}>
            <div className="text-center">
              <div className="text-3xl font-black text-white">{displayScore}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">LTP 2.0</div>
            </div>
            {/* Direction Badge */}
            <div className={cn(
              'absolute -bottom-2 px-2 py-0.5 text-[10px] font-bold rounded',
              displayDirection === 'bullish' ? 'bg-green-500/30 text-green-400' :
              displayDirection === 'bearish' ? 'bg-red-500/30 text-red-400' :
              'bg-gray-500/30 text-gray-400'
            )}>
              {displayDirection.toUpperCase()}
            </div>
          </div>
        </div>

        {/* LTP 2.0 Breakdown */}
        {(ltp2Score?.breakdown || breakdown) && (
          <div className="px-6 pb-4">
            <div className="bg-black/30 rounded-lg p-4 space-y-2">
              <h4 className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                Score Breakdown
              </h4>

              <ScoreBarSmall
                label="EMA Cloud"
                value={ltp2Score?.breakdown.cloudScore ?? breakdown?.cloudScore ?? 0}
                max={25}
                color="#3b82f6"
              />
              <ScoreBarSmall
                label="VWAP"
                value={ltp2Score?.breakdown.vwapScore ?? breakdown?.vwapScore ?? 0}
                max={20}
                color="#22c55e"
              />
              <ScoreBarSmall
                label="Gamma"
                value={(ltp2Score?.breakdown.gammaWallScore ?? 0) + (ltp2Score?.breakdown.gammaRegimeScore ?? 0)}
                max={35}
                color="#00ffff"
              />
              <ScoreBarSmall
                label="Patience"
                value={ltp2Score?.breakdown.patienceScore ?? breakdown?.patienceScore ?? 0}
                max={10}
                color="#fbbf24"
              />
              {(ltp2Score?.breakdown.resistancePenalty ?? 0) < 0 && (
                <ScoreBarSmall
                  label="Penalty"
                  value={Math.abs(ltp2Score?.breakdown.resistancePenalty ?? 0)}
                  max={20}
                  color="#ef4444"
                />
              )}
            </div>
          </div>
        )}

        {/* Trade Result */}
        {(pnlPercent !== undefined || tradeStatus) && (
          <div className="px-6 pb-4">
            <div className={cn(
              'flex items-center justify-between p-3 rounded-lg',
              isCorrect ? 'bg-green-500/10' : 'bg-red-500/10'
            )}>
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {isCorrect ? 'Correct Decision' : 'Incorrect Decision'}
                </span>
              </div>
              {pnlPercent !== undefined && (
                <span className={cn(
                  'font-mono font-bold',
                  pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {ltp2Score?.recommendation && (
          <div className="px-6 pb-4">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {ltp2Score.recommendation}
            </p>
          </div>
        )}

        {/* Warning */}
        {ltp2Score?.warnings && ltp2Score.warnings.length > 0 && (
          <div className="px-6 pb-4">
            <div className="flex items-start gap-2 text-xs text-yellow-500 bg-yellow-500/10 rounded p-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{ltp2Score.warnings[0]}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-6 pt-2 border-t border-white/10 space-y-3">
          {showShareOptions ? (
            <div className="space-y-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={copyToClipboard}
                icon={copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setShowShareOptions(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={onViewDetails}
                >
                  See Details
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={onNextScenario}
                  icon={<ChevronRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setShowShareOptions(true)}
                icon={<Share2 className="w-4 h-4" />}
              >
                Share Achievement
              </Button>
            </>
          )}
        </div>

        {/* KCU Branding */}
        <div className="px-6 pb-4 flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-[var(--accent-primary)] rounded flex items-center justify-center">
              <span className="text-[8px] font-bold text-black">K</span>
            </div>
            <span>Kings Corner University</span>
          </div>
          <span>LTP 2.0 Framework</span>
        </div>
      </div>
    </div>
  );
}

function ScoreBarSmall({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--text-tertiary)] w-16 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono text-[var(--text-secondary)] w-6 text-right">
        {value}
      </span>
    </div>
  );
}

export default PracticeWinCard;
