'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Share2,
  Trophy,
  Flame,
  Target,
  Award,
  CheckCircle,
  Copy,
  Twitter,
  Instagram,
  Download,
  X,
} from 'lucide-react';

interface WinCardProps {
  type: 'streak' | 'accuracy' | 'milestone' | 'perfect_session';
  title: string;
  description: string;
  stats: {
    streak?: number;
    accuracy?: number;
    totalAttempts?: number;
    correct?: number;
    total?: number;
    milestone?: number;
    username?: string;
    avatarUrl?: string;
    createdAt?: string;
  };
  onClose?: () => void;
  onShare?: (platform: string) => void;
  className?: string;
}

const CARD_THEMES = {
  streak: {
    bg: 'from-orange-500/20 to-red-500/20',
    border: 'border-orange-500/50',
    icon: Flame,
    iconColor: 'text-orange-500',
    accentColor: 'text-orange-400',
  },
  accuracy: {
    bg: 'from-green-500/20 to-emerald-500/20',
    border: 'border-green-500/50',
    icon: Target,
    iconColor: 'text-green-500',
    accentColor: 'text-green-400',
  },
  milestone: {
    bg: 'from-purple-500/20 to-indigo-500/20',
    border: 'border-purple-500/50',
    icon: Award,
    iconColor: 'text-purple-500',
    accentColor: 'text-purple-400',
  },
  perfect_session: {
    bg: 'from-yellow-500/20 to-amber-500/20',
    border: 'border-yellow-500/50',
    icon: Trophy,
    iconColor: 'text-yellow-500',
    accentColor: 'text-yellow-400',
  },
};

export function WinCard({
  type,
  title,
  description,
  stats,
  onClose,
  onShare,
  className,
}: WinCardProps) {
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [copied, setCopied] = useState(false);

  const theme = CARD_THEMES[type] || CARD_THEMES.streak;
  const Icon = theme.icon;

  const copyToClipboard = async () => {
    const text = generateShareText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateShareText = (): string => {
    switch (type) {
      case 'streak':
        return `${stats.streak} correct in a row on my LTP practice! The framework is clicking. #KCU #LTPFramework #DayTrading`;
      case 'accuracy':
        return `Hit ${stats.accuracy}% accuracy on ${stats.totalAttempts} LTP practice scenarios! #KCU #LTPFramework`;
      case 'milestone':
        return `Just completed ${stats.milestone} practice scenarios! Putting in the reps. #KCU #TradingPractice`;
      case 'perfect_session':
        return `Perfect practice session! ${stats.correct}/${stats.total} - Level, Trend, Patience locked in. #KCU #LTPFramework`;
      default:
        return `${title} #KCU #LTPFramework`;
    }
  };

  const shareToTwitter = () => {
    const text = encodeURIComponent(generateShareText());
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    onShare?.('twitter');
  };

  const getMainStat = (): { value: string | number; label: string } => {
    switch (type) {
      case 'streak':
        return { value: stats.streak || 0, label: 'IN A ROW' };
      case 'accuracy':
        return { value: `${stats.accuracy || 0}%`, label: 'ACCURACY' };
      case 'milestone':
        return { value: stats.milestone || 0, label: 'SCENARIOS' };
      case 'perfect_session':
        return { value: `${stats.correct}/${stats.total}`, label: 'PERFECT' };
      default:
        return { value: '0', label: '' };
    }
  };

  const mainStat = getMainStat();

  return (
    <div className={cn(
      'relative overflow-hidden bg-gradient-to-br',
      theme.bg,
      'border',
      theme.border,
      'p-6',
      className
    )}>
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
        >
          <X className="w-4 h-4 text-[var(--text-tertiary)]" />
        </button>
      )}

      {/* Background decoration */}
      <div className="absolute top-0 right-0 opacity-10">
        <Icon className="w-32 h-32 -mr-8 -mt-8" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={cn('p-2 rounded-full bg-[var(--bg-primary)]', theme.iconColor)}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">{title}</h3>
            <p className="text-sm text-[var(--text-secondary)]">{description}</p>
          </div>
        </div>

        {/* Main Stat */}
        <div className="text-center py-6">
          <div className={cn('text-5xl font-bold font-mono', theme.accentColor)}>
            {mainStat.value}
          </div>
          <div className="text-sm text-[var(--text-tertiary)] tracking-widest mt-1">
            {mainStat.label}
          </div>
        </div>

        {/* Additional Stats */}
        {type === 'accuracy' && stats.totalAttempts && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-3 bg-[var(--bg-primary)]/50 rounded">
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {stats.totalAttempts}
              </div>
              <div className="text-xs text-[var(--text-tertiary)]">Total Attempts</div>
            </div>
            <div className="text-center p-3 bg-[var(--bg-primary)]/50 rounded">
              <div className="text-xl font-bold text-[var(--success)]">
                {Math.round((stats.totalAttempts * (stats.accuracy || 0)) / 100)}
              </div>
              <div className="text-xs text-[var(--text-tertiary)]">Correct</div>
            </div>
          </div>
        )}

        {/* User info */}
        {stats.username && (
          <div className="flex items-center gap-2 mb-4 text-sm text-[var(--text-secondary)]">
            {stats.avatarUrl && (
              <img
                src={stats.avatarUrl}
                alt={stats.username}
                className="w-6 h-6 rounded-full"
              />
            )}
            <span>@{stats.username}</span>
            {stats.createdAt && (
              <span className="text-[var(--text-tertiary)]">
                • {new Date(stats.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        {/* KCU Branding */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-primary)]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[var(--accent-primary)] rounded flex items-center justify-center">
              <span className="text-xs font-bold text-[var(--bg-primary)]">K</span>
            </div>
            <span className="text-xs text-[var(--text-tertiary)]">Kings Corner University</span>
          </div>
          <span className="text-xs text-[var(--text-tertiary)]">LTP Framework</span>
        </div>

        {/* Share Options */}
        {showShareOptions ? (
          <div className="mt-4 space-y-2">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={shareToTwitter}
                icon={<Twitter className="w-4 h-4" />}
              >
                Twitter
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={copyToClipboard}
                icon={copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
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
          <Button
            variant="primary"
            size="sm"
            className="w-full mt-4"
            onClick={() => setShowShareOptions(true)}
            icon={<Share2 className="w-4 h-4" />}
          >
            Share Achievement
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Win Card Modal - Full screen modal for celebrating achievements
 */
export function WinCardModal({
  isOpen,
  onClose,
  ...props
}: WinCardProps & { isOpen: boolean }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative w-full max-w-md mx-4 animate-in fade-in zoom-in duration-300">
        <WinCard {...props} onClose={onClose} className="shadow-2xl" />
      </div>
    </div>
  );
}

/**
 * Win Card Trigger - Check if user deserves a win card and show it
 */
export function useWinCardTrigger() {
  const [winCard, setWinCard] = useState<{
    type: WinCardProps['type'];
    title: string;
    description: string;
    stats: WinCardProps['stats'];
  } | null>(null);

  const checkForWinCard = (stats: {
    currentStreak: number;
    sessionCorrect: number;
    sessionTotal: number;
    totalAttempts: number;
    accuracyPercent: number;
  }) => {
    // Streak achievements
    if (stats.currentStreak === 5) {
      setWinCard({
        type: 'streak',
        title: 'Hot Streak!',
        description: '5 correct in a row',
        stats: { streak: 5 },
      });
      return;
    }
    if (stats.currentStreak === 10) {
      setWinCard({
        type: 'streak',
        title: 'On Fire!',
        description: '10 correct in a row',
        stats: { streak: 10 },
      });
      return;
    }
    if (stats.currentStreak === 20) {
      setWinCard({
        type: 'streak',
        title: 'Unstoppable!',
        description: '20 correct in a row',
        stats: { streak: 20 },
      });
      return;
    }

    // Perfect session (at least 5 attempts)
    if (stats.sessionTotal >= 5 && stats.sessionCorrect === stats.sessionTotal) {
      setWinCard({
        type: 'perfect_session',
        title: 'Perfect Session!',
        description: `${stats.sessionTotal} for ${stats.sessionTotal}`,
        stats: { correct: stats.sessionCorrect, total: stats.sessionTotal },
      });
      return;
    }

    // Milestone achievements
    if (stats.totalAttempts === 50) {
      setWinCard({
        type: 'milestone',
        title: '50 Scenarios!',
        description: 'Halfway to 100',
        stats: { milestone: 50 },
      });
      return;
    }
    if (stats.totalAttempts === 100) {
      setWinCard({
        type: 'milestone',
        title: 'Century Club!',
        description: '100 scenarios completed',
        stats: { milestone: 100 },
      });
      return;
    }

    // Accuracy achievements (after at least 20 attempts)
    if (stats.totalAttempts >= 20 && stats.accuracyPercent >= 80) {
      setWinCard({
        type: 'accuracy',
        title: 'Sharp Shooter!',
        description: '80%+ accuracy achieved',
        stats: { accuracy: Math.round(stats.accuracyPercent), totalAttempts: stats.totalAttempts },
      });
      return;
    }
  };

  const clearWinCard = () => setWinCard(null);

  return { winCard, checkForWinCard, clearWinCard };
}

export default WinCard;
