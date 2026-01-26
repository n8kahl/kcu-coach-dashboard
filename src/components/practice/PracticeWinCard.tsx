'use client';

/**
 * Practice Win Card - LTP 2.0 Score Card
 *
 * Pops up immediately after a practice trade closes
 * showing the KCU Grade with LTP 2.0 breakdown.
 *
 * Enhanced with XP display, streak bonuses, and celebratory animations.
 */

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useShareableCard } from '@/hooks/useShareableCard';
import type { LTP2Score } from '@/lib/ltp-gamma-engine';
import {
  X,
  Share2,
  Download,
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
  Flame,
  Star,
  Sparkles,
} from 'lucide-react';

// XP Rewards by difficulty tier
const XP_REWARDS = {
  beginner: { base: 10, bonus: 5 },
  intermediate: { base: 20, bonus: 10 },
  advanced: { base: 35, bonus: 15 },
};

// Streak multipliers
const STREAK_MULTIPLIERS: Record<number, number> = {
  3: 1.1,   // 3-streak: 10% bonus
  5: 1.25,  // 5-streak: 25% bonus
  10: 1.5,  // 10-streak: 50% bonus
  20: 2.0,  // 20-streak: 100% bonus
};

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

  // Gaming features (NEW)
  xpEarned?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  currentStreak?: number;
  isNewBestStreak?: boolean;
  accuracy?: number;
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
  xpEarned,
  difficulty = 'intermediate',
  currentStreak = 0,
  isNewBestStreak = false,
  accuracy,
}: PracticeWinCardProps) {
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [animatedXP, setAnimatedXP] = useState(0);
  const confettiRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Use LTP 2.0 data if available, otherwise fall back to props
  const displayGrade = ltp2Score?.grade || grade || (isCorrect ? 'B' : 'D');

  // Generate share text for the card
  const shareText = `Just scored a ${displayGrade} on $${symbol} in the KCU Simulator! 🎯${
    currentStreak >= 3 ? ` 🔥 ${currentStreak} streak` : ''
  } #KCU #LTPFramework`;

  // Use shareable card hook for image export
  const { shareNative, downloadImage, isSharing, canShareFiles } = useShareableCard({
    ref: cardRef,
    fileName: `kcu-practice-${symbol}-${displayGrade}`,
    title: `${displayGrade} on $${symbol}!`,
    text: shareText,
    backgroundColor: '#0a0a0a',
  });

  // Calculate XP if not provided
  const calculatedXP = xpEarned ?? (() => {
    if (!isCorrect) return XP_REWARDS[difficulty].base * 0.3; // 30% XP for incorrect
    let baseXP = XP_REWARDS[difficulty].base;

    // Accuracy bonus
    if (accuracy && accuracy >= 80) {
      baseXP += XP_REWARDS[difficulty].bonus;
    }

    // Grade bonus for Sniper
    if (ltp2Score?.grade === 'Sniper' || grade === 'Sniper') {
      baseXP *= 1.5;
    }

    // Apply streak multiplier
    const streakMultiplier = Object.entries(STREAK_MULTIPLIERS)
      .filter(([threshold]) => currentStreak >= parseInt(threshold))
      .reduce((max, [, mult]) => Math.max(max, mult), 1);

    return Math.round(baseXP * streakMultiplier);
  })();

  // Animate XP counter
  useEffect(() => {
    if (!isOpen) {
      setAnimatedXP(0);
      return;
    }

    const duration = 1000; // 1 second animation
    const steps = 30;
    const increment = calculatedXP / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), calculatedXP);
      setAnimatedXP(current);

      if (step >= steps) {
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isOpen, calculatedXP]);

  // Confetti effect for Sniper or big streaks
  useEffect(() => {
    if (isOpen && (ltp2Score?.grade === 'Sniper' || currentStreak >= 10 || isNewBestStreak)) {
      // Create confetti particles
      if (confettiRef.current) {
        const colors = ['#22c55e', '#fbbf24', '#3b82f6', '#ec4899', '#8b5cf6'];
        for (let i = 0; i < 50; i++) {
          const particle = document.createElement('div');
          particle.className = 'confetti-particle';
          particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 8 + 4}px;
            height: ${Math.random() * 8 + 4}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}%;
            top: -10px;
            opacity: 1;
            border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
            animation: confetti-fall ${Math.random() * 2 + 1}s ease-out forwards;
          `;
          confettiRef.current.appendChild(particle);

          // Remove after animation
          setTimeout(() => particle.remove(), 3000);
        }
      }
    }
  }, [isOpen, ltp2Score?.grade, currentStreak, isNewBestStreak]);

  if (!isOpen) return null;

  // Score and direction derived from LTP 2.0 or fallback
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
    let text = `${displayGrade} setup on $${symbol}! LTP Score: ${displayScore}/100`;
    if (calculatedXP > 0) {
      text += ` | +${calculatedXP} XP`;
    }
    if (currentStreak >= 3) {
      text += ` | 🔥 ${currentStreak} streak`;
    }
    text += ' #KCU #LTPFramework';
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in duration-300">
      {/* Confetti Container */}
      <div
        ref={confettiRef}
        className="fixed inset-0 pointer-events-none overflow-hidden z-50"
        style={{ perspective: '1000px' }}
      />

      {/* Confetti CSS */}
      <style jsx global>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotateZ(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotateZ(720deg) scale(0);
            opacity: 0;
          }
        }
      `}</style>

      <div
        ref={cardRef}
        className={cn(
          'relative w-full max-w-md mx-4 bg-gradient-to-br rounded-lg overflow-hidden',
          theme.bg,
          'border',
          theme.border,
          theme.glow,
          'animate-in zoom-in-95 duration-300'
        )}
      >
        {/* Close Button - Hidden from screenshot */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 hover:bg-white/10 rounded-full transition-colors z-10"
          data-html2canvas-ignore="true"
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

        {/* XP Earned & Streak Display */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between gap-4">
            {/* XP Earned */}
            <div className={cn(
              'flex-1 p-3 rounded-lg text-center',
              'bg-gradient-to-br from-amber-500/20 to-yellow-500/10',
              'border border-amber-500/30'
            )}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">XP EARNED</span>
              </div>
              <div className="text-2xl font-black text-amber-400">
                +{animatedXP}
                {currentStreak >= 3 && (
                  <span className="text-xs ml-1 text-amber-300/70">
                    ({Math.round((Object.entries(STREAK_MULTIPLIERS)
                      .filter(([threshold]) => currentStreak >= parseInt(threshold))
                      .reduce((max, [, mult]) => Math.max(max, mult), 1) - 1) * 100)}% bonus)
                  </span>
                )}
              </div>
              <div className="text-[10px] text-amber-400/60 uppercase mt-1">
                {difficulty} difficulty
              </div>
            </div>

            {/* Current Streak */}
            {currentStreak > 0 && (
              <div className={cn(
                'p-3 rounded-lg text-center min-w-[100px]',
                currentStreak >= 10
                  ? 'bg-gradient-to-br from-orange-500/30 to-red-500/20 border border-orange-500/50'
                  : currentStreak >= 5
                    ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/30'
                    : 'bg-white/5 border border-white/10'
              )}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Flame className={cn(
                    'w-4 h-4',
                    currentStreak >= 10 ? 'text-orange-400 animate-pulse' :
                    currentStreak >= 5 ? 'text-yellow-400' : 'text-[var(--text-tertiary)]'
                  )} />
                  <span className={cn(
                    'text-xs font-medium',
                    currentStreak >= 10 ? 'text-orange-400' :
                    currentStreak >= 5 ? 'text-yellow-400' : 'text-[var(--text-tertiary)]'
                  )}>STREAK</span>
                </div>
                <div className={cn(
                  'text-2xl font-black',
                  currentStreak >= 10 ? 'text-orange-400' :
                  currentStreak >= 5 ? 'text-yellow-400' : 'text-[var(--text-primary)]'
                )}>
                  {currentStreak}
                </div>
                {isNewBestStreak && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px] text-purple-400 font-bold">NEW BEST!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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

        {/* Actions - Hidden from screenshot capture */}
        <div
          className="p-6 pt-2 border-t border-white/10 space-y-3"
          data-html2canvas-ignore="true"
        >
          {showShareOptions ? (
            <div className="space-y-2">
              {/* Primary: Native Share (mobile) or Download (desktop) */}
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={shareNative}
                loading={isSharing}
                icon={canShareFiles ? <Share2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              >
                {canShareFiles ? 'Share Image' : 'Download Image'}
              </Button>

              {/* Secondary download option when native share is available */}
              {canShareFiles && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={downloadImage}
                  disabled={isSharing}
                  icon={<Download className="w-4 h-4" />}
                >
                  Save to Device
                </Button>
              )}

              {/* Copy text fallback */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={copyToClipboard}
                icon={copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'Copied!' : 'Copy Text'}
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
