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
  Instagram,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WinCard as WinCardType, WinCardStat } from '@/types';

// ============================================
// Aspect Ratio Options
// ============================================

export type AspectRatioName = 'story' | 'post' | 'square' | 'responsive';

export interface AspectRatioOption {
  name: AspectRatioName;
  width: number;
  height: number;
  ratio: string;
  label: string;
  cssClass: string;
}

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { name: 'story', width: 1080, height: 1920, ratio: '9:16', label: 'Instagram Story', cssClass: 'aspect-[9/16]' },
  { name: 'post', width: 1080, height: 1350, ratio: '4:5', label: 'Instagram Post', cssClass: 'aspect-[4/5]' },
  { name: 'square', width: 1080, height: 1080, ratio: '1:1', label: 'Square', cssClass: 'aspect-square' },
  { name: 'responsive', width: 400, height: 500, ratio: 'auto', label: 'Responsive', cssClass: '' },
];

// ============================================
// Win Card Themes (Instagram Branding)
// ============================================

export interface WinCardTheme {
  name: string;
  backgroundColor: string;
  headerBg: string;
  accentColor: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
  glowColor: string;
  gradientFrom?: string;
  gradientTo?: string;
}

export const WIN_CARD_THEMES: Record<string, WinCardTheme> = {
  gold: {
    name: 'Gold & Black',
    backgroundColor: '#0A0A0A',
    headerBg: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)',
    accentColor: '#FFD700',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0A0',
    borderColor: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.3)',
    gradientFrom: '#FFD700',
    gradientTo: '#B8860B',
  },
  platinum: {
    name: 'Platinum',
    backgroundColor: '#0F0F0F',
    headerBg: 'linear-gradient(135deg, #E5E4E2 0%, #9E9E9E 100%)',
    accentColor: '#E5E4E2',
    textPrimary: '#FFFFFF',
    textSecondary: '#808080',
    borderColor: '#E5E4E2',
    glowColor: 'rgba(229, 228, 226, 0.3)',
    gradientFrom: '#E5E4E2',
    gradientTo: '#9E9E9E',
  },
  emerald: {
    name: 'Emerald',
    backgroundColor: '#0A1F0A',
    headerBg: 'linear-gradient(135deg, #50C878 0%, #2E8B57 100%)',
    accentColor: '#50C878',
    textPrimary: '#FFFFFF',
    textSecondary: '#7CB68B',
    borderColor: '#50C878',
    glowColor: 'rgba(80, 200, 120, 0.3)',
    gradientFrom: '#50C878',
    gradientTo: '#2E8B57',
  },
  ruby: {
    name: 'Ruby',
    backgroundColor: '#1A0A0A',
    headerBg: 'linear-gradient(135deg, #E0115F 0%, #9B111E 100%)',
    accentColor: '#E0115F',
    textPrimary: '#FFFFFF',
    textSecondary: '#C08080',
    borderColor: '#E0115F',
    glowColor: 'rgba(224, 17, 95, 0.3)',
    gradientFrom: '#E0115F',
    gradientTo: '#9B111E',
  },
};

interface WinCardProps {
  card: WinCardType;
  username: string;
  avatarUrl?: string;
  showActions?: boolean;
  size?: 'sm' | 'md' | 'lg';
  // New props for Instagram export
  aspectRatio?: AspectRatioName;
  theme?: keyof typeof WIN_CARD_THEMES;
  caption?: string;
  showCaption?: boolean;
  exportMode?: boolean; // For high-res export
}

export function WinCard({
  card,
  username,
  avatarUrl,
  showActions = true,
  size = 'md',
  aspectRatio = 'responsive',
  theme = 'gold',
  caption,
  showCaption = false,
  exportMode = false,
}: WinCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Get aspect ratio config
  const aspectConfig = ASPECT_RATIOS.find(ar => ar.name === aspectRatio) || ASPECT_RATIOS[3];

  // Get theme config
  const themeConfig = WIN_CARD_THEMES[theme] || WIN_CARD_THEMES.gold;

  // Responsive sizes for non-export mode
  const sizes = {
    sm: 'w-[300px]',
    md: 'w-[400px]',
    lg: 'w-[500px]',
  };

  // Export dimensions based on aspect ratio
  const exportSizes = {
    story: { width: 360, height: 640 }, // Scaled for preview
    post: { width: 360, height: 450 },
    square: { width: 360, height: 360 },
    responsive: { width: 400, height: 500 },
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

  // Determine card dimensions based on mode
  const cardDimensions = exportMode || aspectRatio !== 'responsive'
    ? exportSizes[aspectRatio]
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* The Card */}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          backgroundColor: themeConfig.backgroundColor,
          borderColor: themeConfig.borderColor,
          boxShadow: `0 0 30px ${themeConfig.glowColor}`,
          ...(cardDimensions ? {
            width: cardDimensions.width,
            height: cardDimensions.height,
          } : {}),
        }}
        className={cn(
          'relative overflow-hidden border-2 flex flex-col',
          !cardDimensions && sizes[size],
          aspectRatio !== 'responsive' && aspectConfig.cssClass
        )}
      >
        {/* Header Banner */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: themeConfig.headerBg }}
        >
          <div className="flex items-center gap-3">
            <TypeIcon className="w-5 h-5 text-black" />
            <span className="text-sm font-bold text-black tracking-wide">KCU TRADING</span>
          </div>
          <div
            className="px-3 py-1 text-xs font-bold uppercase tracking-wide bg-black/20 rounded"
            style={{ color: themeConfig.backgroundColor }}
          >
            {card.type.toUpperCase()}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 flex flex-col">
          {/* User */}
          <div className="flex items-center gap-3 mb-6">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={username}
                className="w-12 h-12 rounded-full border-2"
                style={{ borderColor: themeConfig.accentColor }}
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2"
                style={{
                  backgroundColor: `${themeConfig.accentColor}20`,
                  borderColor: themeConfig.accentColor,
                  color: themeConfig.accentColor,
                }}
              >
                {username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-bold text-lg" style={{ color: themeConfig.textPrimary }}>{username}</p>
              <p className="text-xs" style={{ color: themeConfig.textSecondary }}>
                {new Date(card.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          {/* Title */}
          <div className="mb-6">
            <h3
              className="text-2xl font-black mb-2"
              style={{
                color: themeConfig.accentColor,
                textShadow: `0 0 20px ${themeConfig.glowColor}`,
              }}
            >
              {card.title}
            </h3>
            {card.subtitle && (
              <p className="text-sm" style={{ color: themeConfig.textSecondary }}>{card.subtitle}</p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 flex-1">
            {card.stats.map((stat, index) => (
              <WinCardStatDisplay key={index} stat={stat} theme={themeConfig} />
            ))}
          </div>

          {/* Caption Preview (for Story format) */}
          {showCaption && caption && aspectRatio === 'story' && (
            <div
              className="mt-4 pt-4 border-t"
              style={{ borderColor: `${themeConfig.accentColor}30` }}
            >
              <p
                className="text-sm leading-relaxed line-clamp-4"
                style={{ color: themeConfig.textSecondary }}
              >
                {caption}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 flex items-center justify-between border-t"
          style={{ borderColor: `${themeConfig.accentColor}30` }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: themeConfig.accentColor }} />
            <span className="text-xs font-medium" style={{ color: themeConfig.textSecondary }}>
              Powered by KCU Coach
            </span>
          </div>
          <span className="text-xs font-medium" style={{ color: themeConfig.accentColor }}>
            @kaycapitals
          </span>
        </div>

        {/* Decorative Elements */}
        <div
          className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"
          style={{ backgroundColor: themeConfig.accentColor }}
        />
        <div
          className="absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl opacity-10 translate-y-1/2 -translate-x-1/2"
          style={{ backgroundColor: themeConfig.accentColor }}
        />
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

function WinCardStatDisplay({ stat, theme }: { stat: WinCardStat; theme?: WinCardTheme }) {
  // Use theme colors if provided, otherwise fall back to CSS variables
  const getColor = () => {
    if (theme) {
      switch (stat.color) {
        case 'profit': return '#22C55E';
        case 'loss': return '#EF4444';
        case 'gold': return theme.accentColor;
        default: return theme.textPrimary;
      }
    }
    const colorClasses = {
      profit: 'text-[var(--profit)]',
      loss: 'text-[var(--loss)]',
      gold: 'text-[var(--accent-primary)]',
      default: 'text-[var(--text-primary)]',
    };
    return colorClasses[stat.color || 'default'];
  };

  const color = getColor();

  return (
    <div
      className={cn(
        'rounded-lg p-3',
        stat.highlight && 'border'
      )}
      style={{
        backgroundColor: theme ? `${theme.accentColor}10` : undefined,
        borderColor: stat.highlight && theme ? `${theme.accentColor}30` : undefined,
      }}
    >
      <span
        className="block text-xs uppercase tracking-wide mb-1"
        style={{ color: theme?.textSecondary || 'var(--text-muted)' }}
      >
        {stat.label}
      </span>
      <span
        className={cn(
          'block text-xl font-bold',
          typeof color === 'string' && !color.startsWith('#') && color
        )}
        style={{ color: typeof color === 'string' && color.startsWith('#') ? color : undefined }}
      >
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

// ============================================
// Instagram Hall of Fame Win Card
// ============================================

export interface HallOfFameWinCardProps {
  // Core data
  winType: 'course_completed' | 'module_completed' | 'quiz_passed' | 'streak_milestone' | 'xp_milestone' | 'first_trade' | 'profit_milestone' | 'consistency_award';
  username: string;
  avatarUrl?: string;
  achievedAt: string;
  // Win-specific data
  courseName?: string;
  moduleName?: string;
  quizScore?: number;
  streakDays?: number;
  xpEarned?: number;
  level?: number;
  lessonsCompleted?: number;
  totalLessons?: number;
  totalWatchTimeHours?: number;
  // Trading-specific (for profit_milestone)
  profitAmount?: number;
  profitPercent?: number;
  tradeSymbol?: string;
  // Display options
  aspectRatio?: AspectRatioName;
  theme?: keyof typeof WIN_CARD_THEMES;
  caption?: string;
  showCaption?: boolean;
  showActions?: boolean;
}

/**
 * Instagram-ready Hall of Fame Win Card
 * Designed for social media posting with Somesh's branding
 */
export function HallOfFameWinCard({
  winType,
  username,
  avatarUrl,
  achievedAt,
  courseName,
  moduleName,
  quizScore,
  streakDays,
  xpEarned,
  level,
  lessonsCompleted,
  totalLessons,
  totalWatchTimeHours,
  profitAmount,
  profitPercent,
  tradeSymbol,
  aspectRatio = 'post',
  theme = 'gold',
  caption,
  showCaption = false,
  showActions = true,
}: HallOfFameWinCardProps) {
  // Build title and subtitle based on win type
  const buildTitle = (): string => {
    switch (winType) {
      case 'course_completed':
        return `${courseName} Complete! 🎓`;
      case 'module_completed':
        return `${moduleName} Mastered! 💪`;
      case 'quiz_passed':
        return quizScore && quizScore >= 90
          ? `Quiz Aced! ${quizScore}% 🌟`
          : `Quiz Passed! ${quizScore}% ✅`;
      case 'streak_milestone':
        return `${streakDays} Day Streak! 🔥`;
      case 'xp_milestone':
        return `Level ${level} Achieved! 🚀`;
      case 'first_trade':
        return 'First Trade Logged! 📊';
      case 'profit_milestone':
        return `${profitPercent}% Gain! 💰`;
      case 'consistency_award':
        return 'Consistency Champion! 👑';
      default:
        return 'Major Win! 🎯';
    }
  };

  const buildSubtitle = (): string => {
    switch (winType) {
      case 'course_completed':
        return 'Trust the process. Complete the journey.';
      case 'module_completed':
        return `${lessonsCompleted}/${totalLessons} lessons completed`;
      case 'quiz_passed':
        return `Knowledge retained. Progress made.`;
      case 'streak_milestone':
        return 'Consistency breeds excellence.';
      case 'xp_milestone':
        return `${xpEarned?.toLocaleString()} XP earned`;
      case 'first_trade':
        return 'From learning to doing.';
      case 'profit_milestone':
        return `${tradeSymbol} trade executed.`;
      case 'consistency_award':
        return `${streakDays} days of dedication.`;
      default:
        return 'Another step towards mastery.';
    }
  };

  const buildStats = (): WinCardStat[] => {
    const stats: WinCardStat[] = [];

    switch (winType) {
      case 'course_completed':
        stats.push(
          { label: 'Course', value: courseName || 'LTP', color: 'gold', highlight: true },
          { label: 'Lessons', value: `${lessonsCompleted || 0}`, color: 'default' },
        );
        if (totalWatchTimeHours) {
          stats.push({ label: 'Watch Time', value: `${totalWatchTimeHours.toFixed(1)}h`, color: 'default' });
        }
        stats.push({ label: 'Status', value: 'COMPLETE', color: 'gold' });
        break;

      case 'module_completed':
        stats.push(
          { label: 'Module', value: moduleName || 'Module', color: 'gold', highlight: true },
          { label: 'Progress', value: `${lessonsCompleted}/${totalLessons}`, color: 'profit' },
        );
        break;

      case 'quiz_passed':
        stats.push(
          { label: 'Score', value: `${quizScore}%`, color: quizScore && quizScore >= 90 ? 'gold' : 'profit', highlight: true },
          { label: 'Module', value: moduleName || 'Quiz', color: 'default' },
          { label: 'Status', value: 'PASSED', color: 'profit' },
        );
        break;

      case 'streak_milestone':
        stats.push(
          { label: 'Streak', value: `${streakDays} Days`, color: 'gold', highlight: true },
          { label: 'Status', value: 'ON FIRE', color: 'gold' },
        );
        break;

      case 'xp_milestone':
        stats.push(
          { label: 'Level', value: `${level}`, color: 'gold', highlight: true },
          { label: 'Total XP', value: xpEarned?.toLocaleString() || '0', color: 'profit' },
        );
        break;

      case 'first_trade':
        stats.push(
          { label: 'Milestone', value: 'First Trade', color: 'gold', highlight: true },
          { label: 'Status', value: 'LOGGED', color: 'profit' },
        );
        break;

      case 'profit_milestone':
        stats.push(
          { label: 'Symbol', value: tradeSymbol || 'Trade', color: 'gold', highlight: true },
          { label: 'Return', value: `${profitPercent}%`, color: 'profit' },
        );
        if (profitAmount) {
          stats.push({ label: 'P&L', value: `$${profitAmount.toLocaleString()}`, color: 'profit' });
        }
        break;

      case 'consistency_award':
        stats.push(
          { label: 'Days', value: `${streakDays}`, color: 'gold', highlight: true },
          { label: 'Status', value: 'CHAMPION', color: 'gold' },
        );
        break;
    }

    return stats;
  };

  const card: WinCardType = {
    id: `hall-of-fame-${Date.now()}`,
    user_id: '',
    type: winType.includes('streak') || winType.includes('consistency') ? 'streak' :
          winType.includes('course') || winType.includes('module') || winType.includes('quiz') ? 'milestone' :
          'achievement',
    title: buildTitle(),
    subtitle: buildSubtitle(),
    stats: buildStats(),
    created_at: achievedAt || new Date().toISOString(),
    shared_count: 0,
  };

  return (
    <WinCard
      card={card}
      username={username}
      avatarUrl={avatarUrl}
      showActions={showActions}
      aspectRatio={aspectRatio}
      theme={theme}
      caption={caption}
      showCaption={showCaption}
    />
  );
}

// ============================================
// Aspect Ratio Selector Component
// ============================================

interface AspectRatioSelectorProps {
  value: AspectRatioName;
  onChange: (ratio: AspectRatioName) => void;
}

export function AspectRatioSelector({ value, onChange }: AspectRatioSelectorProps) {
  return (
    <div className="flex gap-2">
      {ASPECT_RATIOS.filter(ar => ar.name !== 'responsive').map((ratio) => (
        <button
          key={ratio.name}
          onClick={() => onChange(ratio.name)}
          className={cn(
            'px-3 py-2 rounded-lg text-sm font-medium transition-all',
            value === ratio.name
              ? 'bg-[var(--accent-primary)] text-black'
              : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
          )}
        >
          {ratio.ratio}
          <span className="ml-1 text-xs opacity-70">
            {ratio.name === 'story' ? 'Story' : ratio.name === 'post' ? 'Post' : 'Square'}
          </span>
        </button>
      ))}
    </div>
  );
}

// ============================================
// Theme Selector Component
// ============================================

interface ThemeSelectorProps {
  value: string;
  onChange: (theme: string) => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <div className="flex gap-2">
      {Object.entries(WIN_CARD_THEMES).map(([key, theme]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'w-10 h-10 rounded-lg border-2 transition-all',
            value === key ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-primary)]' : ''
          )}
          style={{
            backgroundColor: theme.backgroundColor,
            borderColor: theme.accentColor,
            ...(value === key ? { ringColor: theme.accentColor } : {}),
          }}
          title={theme.name}
        >
          <div
            className="w-full h-full rounded-md"
            style={{
              background: `linear-gradient(135deg, ${theme.gradientFrom || theme.accentColor} 0%, ${theme.gradientTo || theme.accentColor} 100%)`,
              opacity: 0.5,
            }}
          />
        </button>
      ))}
    </div>
  );
}
