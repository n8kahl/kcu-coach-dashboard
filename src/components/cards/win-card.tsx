'use client';

import { useRef, useState } from 'react';
import { cn, formatPercent, formatCurrency } from '@/lib/utils';
import { motion } from 'framer-motion';
// import { toPng } from 'html-to-image'; // TODO: Install html-to-image
import {
  Share2,
  Download,
  Twitter,
  Copy,
  Check,
  TrendingUp,
  Trophy,
  Flame,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WinCard as WinCardType, WinCardStat } from '@/types';

interface WinCardProps {
  card: WinCardType;
  username: string;
  avatarUrl?: string;
  showActions?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function WinCard({
  card,
  username,
  avatarUrl,
  showActions = true,
  size = 'md',
}: WinCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const sizes = {
    sm: 'w-[300px]',
    md: 'w-[400px]',
    lg: 'w-[500px]',
  };

  const typeIcons = {
    trade: TrendingUp,
    milestone: Trophy,
    streak: Flame,
    achievement: Target,
  };

  const TypeIcon = typeIcons[card.type];

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);

    try {
      // TODO: Implement with html-to-image when installed
      console.log('Download functionality requires html-to-image package');
      alert('Download functionality coming soon!');
    } catch (err) {
      console.error('Failed to download:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/share/${card.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTwitter = () => {
    const text = `Just hit ${card.title} on @KCUTrading! 🔥\n\n${card.stats.map(s => `${s.label}: ${s.value}`).join('\n')}\n\n#TradingWins #LTP #DayTrading`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* The Card */}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'win-card p-6',
          sizes[size]
        )}
      >
        {/* Header */}
        <div className="win-card-header -mx-6 -mt-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TypeIcon className="w-5 h-5" />
            <span className="text-sm">KCU TRADING</span>
          </div>
          <Badge variant="gold" size="sm">
            {card.type.toUpperCase()}
          </Badge>
        </div>

        {/* User */}
        <div className="flex items-center gap-3 mb-6">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-10 h-10" />
          ) : (
            <div className="w-10 h-10 bg-[var(--bg-elevated)] flex items-center justify-center text-sm font-bold text-[var(--text-secondary)]">
              {username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-[var(--text-primary)]">{username}</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              {new Date(card.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-[var(--accent-primary)] mb-2 glow-text-gold">
          {card.title}
        </h3>
        {card.subtitle && (
          <p className="text-sm text-[var(--text-secondary)] mb-6">{card.subtitle}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          {card.stats.map((stat, index) => (
            <WinCardStatDisplay key={index} stat={stat} />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[var(--border-primary)] flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">
            Powered by KCU Coach
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            kaycapitals.com
          </span>
        </div>
      </motion.div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            loading={downloading}
            onClick={handleDownload}
          >
            Download
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Twitter className="w-4 h-4" />}
            onClick={handleShareTwitter}
          >
            Tweet
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            onClick={handleCopyLink}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>
      )}
    </div>
  );
}

function WinCardStatDisplay({ stat }: { stat: WinCardStat }) {
  const colorClasses = {
    profit: 'text-[var(--profit)]',
    loss: 'text-[var(--loss)]',
    gold: 'text-[var(--accent-primary)]',
    default: 'text-[var(--text-primary)]',
  };

  return (
    <div className={cn('stat', stat.highlight && 'bg-[var(--bg-elevated)] -m-2 p-2')}>
      <span className="stat-label">{stat.label}</span>
      <span className={cn('stat-value text-xl', colorClasses[stat.color || 'default'])}>
        {stat.value}
      </span>
    </div>
  );
}

// Trade Win Card Generator
interface TradeWinCardProps {
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  ltpGrade: string;
  username: string;
  avatarUrl?: string;
}

export function TradeWinCard({
  symbol,
  direction,
  entryPrice,
  exitPrice,
  pnl,
  pnlPercent,
  ltpGrade,
  username,
  avatarUrl,
}: TradeWinCardProps) {
  const card: WinCardType = {
    id: `trade-${Date.now()}`,
    user_id: '',
    type: 'trade',
    title: `${symbol} ${direction.toUpperCase()}`,
    subtitle: pnl >= 0 ? '💰 Winner!' : 'Learning experience',
    stats: [
      {
        label: 'P&L',
        value: formatCurrency(pnl),
        color: pnl >= 0 ? 'profit' : 'loss',
        highlight: true,
      },
      {
        label: 'Return',
        value: formatPercent(pnlPercent),
        color: pnlPercent >= 0 ? 'profit' : 'loss',
      },
      {
        label: 'Entry',
        value: formatCurrency(entryPrice),
      },
      {
        label: 'Exit',
        value: formatCurrency(exitPrice),
      },
      {
        label: 'LTP Grade',
        value: ltpGrade,
        color: ltpGrade === 'A' || ltpGrade === 'B' ? 'gold' : 'default',
      },
      {
        label: 'Direction',
        value: direction.toUpperCase(),
      },
    ],
    created_at: new Date().toISOString(),
    shared_count: 0,
  };

  return <WinCard card={card} username={username} avatarUrl={avatarUrl} />;
}

// Streak Win Card
interface StreakWinCardProps {
  streakDays: number;
  tradesCount: number;
  winRate: number;
  username: string;
  avatarUrl?: string;
}

export function StreakWinCard({
  streakDays,
  tradesCount,
  winRate,
  username,
  avatarUrl,
}: StreakWinCardProps) {
  const card: WinCardType = {
    id: `streak-${Date.now()}`,
    user_id: '',
    type: 'streak',
    title: `${streakDays} Day Streak! 🔥`,
    subtitle: 'Consistency is key',
    stats: [
      {
        label: 'Streak',
        value: `${streakDays} Days`,
        color: 'gold',
        highlight: true,
      },
      {
        label: 'Win Rate',
        value: formatPercent(winRate, 1),
        color: winRate >= 50 ? 'profit' : 'loss',
      },
      {
        label: 'Trades',
        value: tradesCount.toString(),
      },
      {
        label: 'Status',
        value: 'ON FIRE',
        color: 'gold',
      },
    ],
    created_at: new Date().toISOString(),
    shared_count: 0,
  };

  return <WinCard card={card} username={username} avatarUrl={avatarUrl} />;
}

// Milestone Win Card
interface MilestoneWinCardProps {
  milestone: string;
  description: string;
  stats: WinCardStat[];
  username: string;
  avatarUrl?: string;
}

export function MilestoneWinCard({
  milestone,
  description,
  stats,
  username,
  avatarUrl,
}: MilestoneWinCardProps) {
  const card: WinCardType = {
    id: `milestone-${Date.now()}`,
    user_id: '',
    type: 'milestone',
    title: milestone,
    subtitle: description,
    stats,
    created_at: new Date().toISOString(),
    shared_count: 0,
  };

  return <WinCard card={card} username={username} avatarUrl={avatarUrl} />;
}

// Achievement Win Card
interface AchievementWinCardProps {
  achievement: string;
  emoji: string;
  description: string;
  username: string;
  avatarUrl?: string;
}

export function AchievementWinCard({
  achievement,
  emoji,
  description,
  username,
  avatarUrl,
}: AchievementWinCardProps) {
  const card: WinCardType = {
    id: `achievement-${Date.now()}`,
    user_id: '',
    type: 'achievement',
    title: `${emoji} ${achievement}`,
    subtitle: description,
    stats: [
      {
        label: 'Achievement',
        value: 'Unlocked',
        color: 'gold',
        highlight: true,
      },
      {
        label: 'Date',
        value: new Date().toLocaleDateString(),
      },
    ],
    created_at: new Date().toISOString(),
    shared_count: 0,
  };

  return <WinCard card={card} username={username} avatarUrl={avatarUrl} />;
}
