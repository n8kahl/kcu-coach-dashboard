'use client';

/**
 * Elite Trader Leaderboard
 *
 * Premium leaderboard with:
 * - Animated podium with staggered reveals
 * - Tier system (Diamond, Platinum, Gold, Silver, Bronze)
 * - Sticky user rank card
 * - Trader profile cards with rank movement indicators
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Trophy,
  Flame,
  TrendingUp,
  TrendingDown,
  Medal,
  Crown,
  Star,
  ChevronUp,
  ChevronDown,
  Minus,
  Sparkles,
  Target,
  Award,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { LeaderboardEntry } from '@/types';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type TierType = 'diamond' | 'platinum' | 'gold' | 'silver' | 'bronze';

interface TierConfig {
  name: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  glowColor: string;
  icon: typeof Trophy;
  minRank: number;
  maxRank: number;
}

const TIERS: Record<TierType, TierConfig> = {
  diamond: {
    name: 'Diamond',
    color: '#B9F2FF',
    bgGradient: 'linear-gradient(135deg, rgba(185,242,255,0.15) 0%, rgba(224,247,250,0.05) 100%)',
    borderColor: 'rgba(185,242,255,0.5)',
    glowColor: '0 0 30px rgba(185,242,255,0.4)',
    icon: Crown,
    minRank: 1,
    maxRank: 3,
  },
  platinum: {
    name: 'Platinum',
    color: '#E5E4E2',
    bgGradient: 'linear-gradient(135deg, rgba(229,228,226,0.15) 0%, rgba(192,192,192,0.05) 100%)',
    borderColor: 'rgba(229,228,226,0.5)',
    glowColor: '0 0 20px rgba(229,228,226,0.3)',
    icon: Star,
    minRank: 4,
    maxRank: 10,
  },
  gold: {
    name: 'Gold',
    color: '#FFD700',
    bgGradient: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(255,215,0,0.05) 100%)',
    borderColor: 'rgba(212,175,55,0.5)',
    glowColor: '0 0 20px rgba(212,175,55,0.3)',
    icon: Medal,
    minRank: 11,
    maxRank: 25,
  },
  silver: {
    name: 'Silver',
    color: '#C0C0C0',
    bgGradient: 'linear-gradient(135deg, rgba(192,192,192,0.1) 0%, rgba(169,169,169,0.05) 100%)',
    borderColor: 'rgba(192,192,192,0.3)',
    glowColor: 'none',
    icon: Award,
    minRank: 26,
    maxRank: 50,
  },
  bronze: {
    name: 'Bronze',
    color: '#CD7F32',
    bgGradient: 'linear-gradient(135deg, rgba(205,127,50,0.1) 0%, rgba(184,115,51,0.05) 100%)',
    borderColor: 'rgba(205,127,50,0.3)',
    glowColor: 'none',
    icon: Target,
    minRank: 51,
    maxRank: Infinity,
  },
};

function getTier(rank: number): TierConfig {
  if (rank <= 3) return TIERS.diamond;
  if (rank <= 10) return TIERS.platinum;
  if (rank <= 25) return TIERS.gold;
  if (rank <= 50) return TIERS.silver;
  return TIERS.bronze;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  period?: 'weekly' | 'monthly' | 'all-time';
  onPeriodChange?: (period: 'weekly' | 'monthly' | 'all-time') => void;
}

export function Leaderboard({
  entries,
  currentUserId,
  period = 'weekly',
  onPeriodChange,
}: LeaderboardProps) {
  const [activePeriod, setActivePeriod] = useState(period);
  const [showStickyRank, setShowStickyRank] = useState(false);
  const userRowRef = useRef<HTMLDivElement>(null);

  const currentUserEntry = entries.find((e) => e.user_id === currentUserId);
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  // Handle scroll to show/hide sticky rank
  useEffect(() => {
    if (!currentUserEntry || !userRowRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky when user row is not visible
        setShowStickyRank(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '-100px 0px 0px 0px' }
    );

    observer.observe(userRowRef.current);
    return () => observer.disconnect();
  }, [currentUserEntry]);

  const handlePeriodChange = (value: string) => {
    const newPeriod = value as 'weekly' | 'monthly' | 'all-time';
    setActivePeriod(newPeriod);
    onPeriodChange?.(newPeriod);
  };

  return (
    <div className="space-y-6">
      {/* Period Tabs */}
      <Tabs defaultValue={activePeriod} onValueChange={handlePeriodChange}>
        <TabsList variant="pills">
          <TabsTrigger value="weekly" variant="pills">
            This Week
          </TabsTrigger>
          <TabsTrigger value="monthly" variant="pills">
            This Month
          </TabsTrigger>
          <TabsTrigger value="all-time" variant="pills">
            All Time
          </TabsTrigger>
        </TabsList>

        {['weekly', 'monthly', 'all-time'].map((p) => (
          <TabsContent key={p} value={p}>
            <div className="space-y-8">
              {/* Animated Podium */}
              <AnimatedPodium top3={top3} currentUserId={currentUserId} />

              {/* Leaderboard List */}
              <Card>
                <CardContent className="p-0">
                  {rest.map((entry, index) => (
                    <TraderRow
                      key={entry.user_id}
                      ref={entry.user_id === currentUserId ? userRowRef : null}
                      entry={entry}
                      index={index}
                      isCurrentUser={entry.user_id === currentUserId}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Sticky User Rank */}
      <AnimatePresence>
        {showStickyRank && currentUserEntry && (
          <StickyUserRank entry={currentUserEntry} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// ANIMATED PODIUM
// ============================================================================

interface AnimatedPodiumProps {
  top3: LeaderboardEntry[];
  currentUserId?: string;
}

function AnimatedPodium({ top3, currentUserId }: AnimatedPodiumProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });

  // Staggered animation order: 2nd, 1st, 3rd (dramatic reveal)
  const animationOrder = [1, 0, 2];

  return (
    <div ref={containerRef} className="relative">
      {/* Background glow for #1 */}
      {top3[0] && (
        <motion.div
          className="absolute inset-0 -z-10"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-3xl opacity-30"
            style={{
              background: 'radial-gradient(circle, rgba(212,175,55,0.4) 0%, transparent 70%)',
            }}
          />
        </motion.div>
      )}

      <div className="grid grid-cols-3 gap-4 items-end pt-8">
        {animationOrder.map((orderIndex, i) => {
          const entry = top3[orderIndex];
          if (!entry) return <div key={i} />;

          return (
            <motion.div
              key={entry.user_id}
              initial={{ opacity: 0, y: 80, scale: 0.8 }}
              animate={
                isInView
                  ? {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    }
                  : {}
              }
              transition={{
                delay: i * 0.2 + 0.3,
                duration: 0.6,
                type: 'spring',
                stiffness: 100,
              }}
              className={cn(
                orderIndex === 0 && 'order-2',
                orderIndex === 1 && 'order-1',
                orderIndex === 2 && 'order-3'
              )}
            >
              <PodiumCard
                entry={entry}
                position={(orderIndex + 1) as 1 | 2 | 3}
                isCurrentUser={entry.user_id === currentUserId}
                animationDelay={i * 0.2 + 0.3}
                isInView={isInView}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// PODIUM CARD
// ============================================================================

interface PodiumCardProps {
  entry: LeaderboardEntry;
  position: 1 | 2 | 3;
  isCurrentUser: boolean;
  animationDelay: number;
  isInView: boolean;
}

function PodiumCard({
  entry,
  position,
  isCurrentUser,
  animationDelay,
  isInView,
}: PodiumCardProps) {
  const heights = {
    1: 'min-h-[220px]',
    2: 'min-h-[180px]',
    3: 'min-h-[160px]',
  };

  const pedestalHeights = {
    1: 'h-16',
    2: 'h-10',
    3: 'h-6',
  };

  const icons = {
    1: '🥇',
    2: '🥈',
    3: '🥉',
  };

  const tier = getTier(position);

  return (
    <div className="relative">
      {/* Card */}
      <Card
        variant={isCurrentUser ? 'glow' : 'default'}
        className={cn(
          'flex flex-col items-center p-5 relative overflow-hidden transition-all duration-300 hover:scale-[1.02]',
          heights[position]
        )}
        style={{
          background: tier.bgGradient,
          borderColor: tier.borderColor,
          boxShadow: tier.glowColor,
        }}
      >
        {/* Sparkle effect for #1 */}
        {position === 1 && isInView && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: animationDelay + 0.5 }}
          >
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${10 + (i % 3) * 20}%`,
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.3,
                  repeat: Infinity,
                }}
              >
                <Sparkles className="w-3 h-3 text-[var(--accent-primary)]" />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Crown for #1 */}
        {position === 1 && (
          <motion.div
            className="absolute -top-1 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, y: -20, rotate: -15 }}
            animate={isInView ? { opacity: 1, y: 0, rotate: 0 } : {}}
            transition={{ delay: animationDelay + 0.4, type: 'spring' }}
          >
            <span className="text-3xl">👑</span>
          </motion.div>
        )}

        {/* Avatar */}
        <motion.div
          className="relative mt-4 mb-3"
          initial={{ scale: 0 }}
          animate={isInView ? { scale: 1 } : {}}
          transition={{
            delay: animationDelay + 0.2,
            type: 'spring',
            stiffness: 200,
          }}
        >
          <Avatar
            src={entry.avatar}
            alt={entry.username}
            fallback={entry.username}
            size={position === 1 ? 'xl' : 'lg'}
            bordered={isCurrentUser}
          />
          {/* Rank Movement Indicator */}
          {entry.delta !== undefined && entry.delta !== 0 && (
            <div
              className={cn(
                'absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                entry.delta > 0
                  ? 'bg-[var(--profit)] text-black'
                  : 'bg-[var(--loss)] text-white'
              )}
            >
              {entry.delta > 0 ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          )}
        </motion.div>

        {/* Position Badge */}
        <motion.span
          className="text-3xl mb-2"
          initial={{ scale: 0, rotate: -180 }}
          animate={isInView ? { scale: 1, rotate: 0 } : {}}
          transition={{ delay: animationDelay + 0.3, type: 'spring' }}
        >
          {icons[position]}
        </motion.span>

        {/* Username */}
        <p
          className={cn(
            'font-bold text-center truncate w-full text-lg',
            isCurrentUser
              ? 'text-[var(--accent-primary)]'
              : 'text-[var(--text-primary)]'
          )}
        >
          {entry.username}
        </p>

        {/* Score with count-up animation */}
        <motion.p
          className="text-2xl font-black mt-2"
          style={{ color: tier.color }}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: animationDelay + 0.5 }}
        >
          <AnimatedScore value={entry.score} delay={animationDelay + 0.5} />
        </motion.p>

        {/* Stats Row */}
        <div className="flex items-center gap-3 mt-3 text-xs text-[var(--text-tertiary)]">
          <span
            className={
              entry.win_rate >= 50 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
            }
          >
            {formatPercent(entry.win_rate)}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            {entry.streak}
          </span>
        </div>
      </Card>

      {/* Pedestal */}
      <motion.div
        className={cn(
          'mx-auto rounded-b-lg',
          pedestalHeights[position],
          position === 1 ? 'w-[90%]' : 'w-[85%]'
        )}
        style={{
          background:
            position === 1
              ? 'linear-gradient(180deg, rgba(212,175,55,0.3) 0%, rgba(212,175,55,0.1) 100%)'
              : position === 2
              ? 'linear-gradient(180deg, rgba(192,192,192,0.2) 0%, rgba(192,192,192,0.05) 100%)'
              : 'linear-gradient(180deg, rgba(205,127,50,0.2) 0%, rgba(205,127,50,0.05) 100%)',
        }}
        initial={{ scaleY: 0 }}
        animate={isInView ? { scaleY: 1 } : {}}
        transition={{ delay: animationDelay, duration: 0.3 }}
      />
    </div>
  );
}

// ============================================================================
// ANIMATED SCORE
// ============================================================================

function AnimatedScore({ value, delay }: { value: number; delay: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const duration = 1500;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(eased * value));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  return <>{formatNumber(displayValue)} pts</>;
}

// ============================================================================
// TRADER ROW
// ============================================================================

import React from 'react';

interface TraderRowProps {
  entry: LeaderboardEntry;
  index: number;
  isCurrentUser: boolean;
}

const TraderRow = React.forwardRef<HTMLDivElement, TraderRowProps>(
  ({ entry, index, isCurrentUser }, ref) => {
    const tier = getTier(entry.rank);
    const TierIcon = tier.icon;

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03, duration: 0.3 }}
        className={cn(
          'flex items-center gap-4 p-4 border-b border-[var(--border-primary)] group',
          'hover:bg-[var(--bg-card-hover)] transition-all duration-200',
          isCurrentUser && 'bg-[var(--accent-primary)]/10 border-l-2 border-l-[var(--accent-primary)]'
        )}
      >
        {/* Rank with tier indicator */}
        <div className="relative">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg"
            style={{
              background: tier.bgGradient,
              color: tier.color,
              border: `1px solid ${tier.borderColor}`,
            }}
          >
            {entry.rank}
          </div>
          {/* Movement indicator */}
          {entry.delta !== undefined && entry.delta !== 0 && (
            <div
              className={cn(
                'absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center',
                entry.delta > 0 ? 'bg-[var(--profit)]' : 'bg-[var(--loss)]'
              )}
            >
              {entry.delta > 0 ? (
                <ChevronUp className="w-3 h-3 text-black" />
              ) : (
                <ChevronDown className="w-3 h-3 text-white" />
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <Avatar
          src={entry.avatar}
          alt={entry.username}
          fallback={entry.username}
          size="md"
        />

        {/* Name & Stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                'font-semibold truncate',
                isCurrentUser
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-primary)]'
              )}
            >
              {entry.username}
            </p>
            {isCurrentUser && (
              <Badge variant="gold" size="sm">
                You
              </Badge>
            )}
            {/* Tier badge */}
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                background: tier.bgGradient,
                color: tier.color,
                border: `1px solid ${tier.borderColor}`,
              }}
            >
              <TierIcon className="w-3 h-3" />
              {tier.name}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)] mt-1">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {entry.total_trades} trades
            </span>
            <span className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-500" />
              {entry.streak} streak
            </span>
            {entry.ltp_compliance !== undefined && (
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3 text-[var(--profit)]" />
                {formatPercent(entry.ltp_compliance)} LTP
              </span>
            )}
          </div>
        </div>

        {/* Win Rate */}
        <div className="text-right">
          <p
            className={cn(
              'font-bold text-lg',
              entry.win_rate >= 50 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
            )}
          >
            {formatPercent(entry.win_rate)}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">win rate</p>
        </div>

        {/* Score */}
        <div className="w-28 text-right">
          <p className="font-bold text-xl" style={{ color: tier.color }}>
            {formatNumber(entry.score)}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">points</p>
        </div>
      </motion.div>
    );
  }
);

TraderRow.displayName = 'TraderRow';

// ============================================================================
// STICKY USER RANK
// ============================================================================

interface StickyUserRankProps {
  entry: LeaderboardEntry;
}

function StickyUserRank({ entry }: StickyUserRankProps) {
  const tier = getTier(entry.rank);
  const TierIcon = tier.icon;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-xl"
    >
      <Card
        className="border-[var(--accent-primary)] overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(212,175,55,0.1) 100%)',
          boxShadow: '0 -4px 30px rgba(212,175,55,0.2), 0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Rank */}
            <div
              className="w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold"
              style={{
                background: tier.bgGradient,
                border: `2px solid ${tier.borderColor}`,
                boxShadow: tier.glowColor,
              }}
            >
              <span className="text-2xl" style={{ color: tier.color }}>
                #{entry.rank}
              </span>
            </div>

            {/* Avatar */}
            <Avatar
              src={entry.avatar}
              alt={entry.username}
              fallback={entry.username}
              size="lg"
              bordered
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-[var(--accent-primary)] truncate">
                  {entry.username}
                </span>
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: tier.bgGradient,
                    color: tier.color,
                    border: `1px solid ${tier.borderColor}`,
                  }}
                >
                  <TierIcon className="w-3 h-3" />
                  {tier.name}
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-[var(--text-tertiary)] mt-1">
                <span
                  className={
                    entry.win_rate >= 50
                      ? 'text-[var(--profit)]'
                      : 'text-[var(--loss)]'
                  }
                >
                  {formatPercent(entry.win_rate)} WR
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Flame className="w-3 h-3 text-orange-500" />
                  {entry.streak}
                </span>
              </div>
            </div>

            {/* Score */}
            <div className="text-right">
              <p className="text-2xl font-black" style={{ color: tier.color }}>
                {formatNumber(entry.score)}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">points</p>
            </div>

            {/* Movement */}
            {entry.delta !== undefined && entry.delta !== 0 && (
              <div
                className={cn(
                  'flex items-center gap-1 px-3 py-1 rounded-full font-bold',
                  entry.delta > 0
                    ? 'bg-[var(--profit)]/20 text-[var(--profit)]'
                    : 'bg-[var(--loss)]/20 text-[var(--loss)]'
                )}
              >
                {entry.delta > 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {Math.abs(entry.delta)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================================
// MINI LEADERBOARD (for Dashboard)
// ============================================================================

interface MiniLeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}

export function MiniLeaderboard({ entries, currentUserId }: MiniLeaderboardProps) {
  const top5 = entries.slice(0, 5);

  return (
    <Card>
      <CardHeader
        title="Leaderboard"
        subtitle="This week"
        action={
          <a
            href="/leaderboard"
            className="text-xs text-[var(--accent-primary)] hover:underline"
          >
            View All
          </a>
        }
      />
      <CardContent>
        <div className="space-y-2">
          {top5.map((entry, index) => {
            const icons = ['🥇', '🥈', '🥉', '', ''];
            const isCurrentUser = entry.user_id === currentUserId;
            const tier = getTier(index + 1);

            return (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-lg transition-colors',
                  isCurrentUser
                    ? 'bg-[var(--accent-primary)]/10'
                    : 'hover:bg-[var(--bg-tertiary)]'
                )}
              >
                {/* Rank */}
                <div className="w-8 flex justify-center">
                  {icons[index] ? (
                    <span className="text-lg">{icons[index]}</span>
                  ) : (
                    <span
                      className="text-sm font-bold"
                      style={{ color: tier.color }}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>

                <Avatar
                  src={entry.avatar}
                  alt={entry.username}
                  fallback={entry.username}
                  size="sm"
                />

                <span
                  className={cn(
                    'flex-1 text-sm truncate',
                    isCurrentUser
                      ? 'text-[var(--accent-primary)] font-semibold'
                      : 'text-[var(--text-primary)]'
                  )}
                >
                  {entry.username}
                </span>

                {/* Movement indicator */}
                {entry.delta !== undefined && entry.delta !== 0 && (
                  <span
                    className={cn(
                      'text-xs flex items-center',
                      entry.delta > 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
                    )}
                  >
                    {entry.delta > 0 ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    {Math.abs(entry.delta)}
                  </span>
                )}

                <span
                  className="text-sm font-bold"
                  style={{ color: tier.color }}
                >
                  {formatNumber(entry.score)}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Your Rank (if not in top 5) */}
        {currentUserId && !top5.some((e) => e.user_id === currentUserId) && (
          <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
            <p className="text-xs text-[var(--text-tertiary)] mb-2">Your Rank</p>
            {entries.find((e) => e.user_id === currentUserId) && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-[var(--accent-primary)]/10">
                <span className="w-8 text-center font-bold text-[var(--accent-primary)]">
                  #{entries.find((e) => e.user_id === currentUserId)?.rank}
                </span>
                <span className="flex-1 text-sm text-[var(--accent-primary)] font-semibold">
                  You
                </span>
                <span className="text-sm font-bold text-[var(--accent-primary)]">
                  {formatNumber(
                    entries.find((e) => e.user_id === currentUserId)?.score || 0
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
