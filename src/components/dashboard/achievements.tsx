'use client';

/**
 * Hall of Fame Achievements
 *
 * Premium achievements display with:
 * - Holographic effects for legendary achievements
 * - "Almost There" section with progress bars
 * - Unlock modal with confetti celebration
 * - Rarity tiers (Common, Rare, Epic, Legendary)
 * - Category filtering and sorting
 */

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Lock,
  Check,
  Sparkles,
  Star,
  Crown,
  Trophy,
  X,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Achievement } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

type RarityTier = 'common' | 'rare' | 'epic' | 'legendary';

interface EnhancedAchievement extends Achievement {
  rarity?: {
    tier: RarityTier;
    percentage: number;
    label: string;
    description: string;
  };
  visual?: {
    glowColor?: string;
    bgGradient?: string;
    borderGlow?: string;
    holographic?: boolean;
    color?: string;
  };
  progress?: {
    current: number;
    target: number;
    percent: number;
  } | null;
}

interface RarityConfig {
  label: string;
  color: string;
  bgGradient: string;
  borderGlow: string;
  icon: typeof Star;
  holographic: boolean;
}

const RARITY_CONFIGS: Record<RarityTier, RarityConfig> = {
  legendary: {
    label: 'Legendary',
    color: '#FFD700',
    bgGradient: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(255,215,0,0.1) 100%)',
    borderGlow: '0 0 20px rgba(212,175,55,0.5)',
    icon: Crown,
    holographic: true,
  },
  epic: {
    label: 'Epic',
    color: '#A855F7',
    bgGradient: 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(139,92,246,0.1) 100%)',
    borderGlow: '0 0 15px rgba(168,85,247,0.4)',
    icon: Sparkles,
    holographic: false,
  },
  rare: {
    label: 'Rare',
    color: '#3B82F6',
    bgGradient: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(96,165,250,0.1) 100%)',
    borderGlow: '0 0 10px rgba(59,130,246,0.3)',
    icon: Star,
    holographic: false,
  },
  common: {
    label: 'Common',
    color: '#6B7280',
    bgGradient: 'linear-gradient(135deg, rgba(107,114,128,0.1) 0%, rgba(156,163,175,0.05) 100%)',
    borderGlow: 'none',
    icon: Trophy,
    holographic: false,
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function getAchievementDisplay(achievement: EnhancedAchievement) {
  return {
    name: achievement.name || achievement.title,
    emoji: achievement.emoji || achievement.icon,
    earnedAt: achievement.earned_at || achievement.unlocked_at,
    progress: achievement.progress?.current ?? achievement.requirement?.current,
    target: achievement.progress?.target ?? achievement.requirement?.target,
  };
}

function getRarityConfig(achievement: EnhancedAchievement): RarityConfig {
  const tier = achievement.rarity?.tier || 'common';
  return RARITY_CONFIGS[tier] || RARITY_CONFIGS.common;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface AchievementsGridProps {
  achievements: EnhancedAchievement[];
  almostThere?: EnhancedAchievement[];
  categoryStats?: Array<{ category: string; total: number; earned: number }>;
}

export function AchievementsGrid({
  achievements,
  almostThere = [],
  categoryStats = [],
}: AchievementsGridProps) {
  const [selectedAchievement, setSelectedAchievement] = useState<EnhancedAchievement | null>(null);
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.1 });

  const earned = achievements.filter((a) => getAchievementDisplay(a).earnedAt);
  const locked = achievements.filter((a) => !getAchievementDisplay(a).earnedAt);

  const filteredAchievements =
    filter === 'all' ? achievements : filter === 'earned' ? earned : locked;

  // Group by rarity for display
  const groupedByRarity = {
    legendary: filteredAchievements.filter((a) => a.rarity?.tier === 'legendary'),
    epic: filteredAchievements.filter((a) => a.rarity?.tier === 'epic'),
    rare: filteredAchievements.filter((a) => a.rarity?.tier === 'rare'),
    common: filteredAchievements.filter(
      (a) => !a.rarity?.tier || a.rarity?.tier === 'common'
    ),
  };

  return (
    <div ref={containerRef} className="space-y-8">
      {/* Header Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-3xl font-black text-[var(--text-primary)]">
            <span className="text-[var(--accent-primary)]">{earned.length}</span>
            <span className="text-[var(--text-muted)]"> / {achievements.length}</span>
          </h2>
          <p className="text-sm text-[var(--text-tertiary)]">Achievements Unlocked</p>
        </div>

        {/* Circular Progress */}
        <div className="relative w-20 h-20">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              stroke="var(--border-primary)"
              strokeWidth="6"
            />
            <motion.circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 35}
              initial={{ strokeDashoffset: 2 * Math.PI * 35 }}
              animate={
                isInView
                  ? {
                      strokeDashoffset:
                        (1 - earned.length / achievements.length) * 2 * Math.PI * 35,
                    }
                  : {}
              }
              transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-[var(--accent-primary)]">
              {Math.round((earned.length / achievements.length) * 100)}%
            </span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(['all', 'earned', 'locked'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
              {f === 'earned' && ` (${earned.length})`}
              {f === 'locked' && ` (${locked.length})`}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Almost There Section */}
      {almostThere.length > 0 && filter !== 'earned' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
        >
          <Card
            className="overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(245,158,11,0.1) 100%)',
              borderColor: 'rgba(245,158,11,0.3)',
            }}
          >
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span>Almost There!</span>
                </div>
              }
              subtitle="You're so close to unlocking these achievements"
            />
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {almostThere.slice(0, 3).map((achievement, index) => (
                  <AlmostThereCard
                    key={achievement.id || index}
                    achievement={achievement}
                    index={index}
                    onClick={() => setSelectedAchievement(achievement)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Legendary Achievements */}
      {groupedByRarity.legendary.length > 0 && (
        <AchievementSection
          title="Legendary"
          achievements={groupedByRarity.legendary}
          config={RARITY_CONFIGS.legendary}
          onSelect={setSelectedAchievement}
          delay={0.3}
          isInView={isInView}
        />
      )}

      {/* Epic Achievements */}
      {groupedByRarity.epic.length > 0 && (
        <AchievementSection
          title="Epic"
          achievements={groupedByRarity.epic}
          config={RARITY_CONFIGS.epic}
          onSelect={setSelectedAchievement}
          delay={0.4}
          isInView={isInView}
        />
      )}

      {/* Rare Achievements */}
      {groupedByRarity.rare.length > 0 && (
        <AchievementSection
          title="Rare"
          achievements={groupedByRarity.rare}
          config={RARITY_CONFIGS.rare}
          onSelect={setSelectedAchievement}
          delay={0.5}
          isInView={isInView}
        />
      )}

      {/* Common Achievements */}
      {groupedByRarity.common.length > 0 && (
        <AchievementSection
          title="Common"
          achievements={groupedByRarity.common}
          config={RARITY_CONFIGS.common}
          onSelect={setSelectedAchievement}
          delay={0.6}
          isInView={isInView}
        />
      )}

      {/* Achievement Detail Modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <AchievementModal
            achievement={selectedAchievement}
            onClose={() => setSelectedAchievement(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// ACHIEVEMENT SECTION
// ============================================================================

interface AchievementSectionProps {
  title: string;
  achievements: EnhancedAchievement[];
  config: RarityConfig;
  onSelect: (achievement: EnhancedAchievement) => void;
  delay: number;
  isInView: boolean;
}

function AchievementSection({
  title,
  achievements,
  config,
  onSelect,
  delay,
  isInView,
}: AchievementSectionProps) {
  const RarityIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay }}
    >
      <div className="flex items-center gap-2 mb-4">
        <RarityIcon className="w-5 h-5" style={{ color: config.color }} />
        <h3
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: config.color }}
        >
          {title}
        </h3>
        <span className="text-xs text-[var(--text-muted)]">
          ({achievements.length})
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {achievements.map((achievement, index) => (
          <AchievementCard
            key={achievement.id || index}
            achievement={achievement}
            index={index}
            onClick={() => onSelect(achievement)}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================================
// ACHIEVEMENT CARD
// ============================================================================

interface AchievementCardProps {
  achievement: EnhancedAchievement;
  index: number;
  onClick: () => void;
}

function AchievementCard({ achievement, index, onClick }: AchievementCardProps) {
  const display = getAchievementDisplay(achievement);
  const config = getRarityConfig(achievement);
  const isLocked = !display.earnedAt;
  const isHolographic = config.holographic && !isLocked;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <Card
        className={cn(
          'text-center relative overflow-hidden transition-all duration-300',
          isLocked && 'opacity-60'
        )}
        style={{
          background: isLocked ? undefined : config.bgGradient,
          borderColor: isLocked ? undefined : config.color,
          boxShadow: isLocked ? undefined : config.borderGlow,
        }}
      >
        {/* Holographic shimmer effect */}
        {isHolographic && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 55%, transparent 60%)',
              backgroundSize: '200% 200%',
            }}
            animate={{
              backgroundPosition: ['200% 50%', '-50% 50%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatDelay: 2,
            }}
          />
        )}

        <CardContent className="p-4">
          {/* Rarity Badge */}
          {!isLocked && (
            <div className="absolute top-2 right-2">
              <Badge
                size="sm"
                style={{
                  background: config.bgGradient,
                  color: config.color,
                  borderColor: config.color,
                }}
              >
                {config.label}
              </Badge>
            </div>
          )}

          {/* Emoji/Icon */}
          <div className="relative inline-flex items-center justify-center w-16 h-16 mb-3">
            <motion.span
              className="text-4xl"
              animate={isHolographic ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {display.emoji}
            </motion.span>
            {isLocked ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-card)]/80 rounded-full">
                <Lock className="w-6 h-6 text-[var(--text-muted)]" />
              </div>
            ) : (
              <motion.div
                className="absolute -top-1 -right-1"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: index * 0.05 + 0.3 }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: config.color }}
                >
                  <Check className="w-4 h-4 text-black" />
                </div>
              </motion.div>
            )}
          </div>

          {/* Name */}
          <h4
            className={cn(
              'font-bold mb-1 text-sm',
              isLocked ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'
            )}
          >
            {display.name}
          </h4>

          {/* Rarity Description */}
          {!isLocked && achievement.rarity && (
            <p className="text-xs" style={{ color: config.color }}>
              {achievement.rarity.description}
            </p>
          )}

          {/* Progress or Date */}
          {isLocked && achievement.progress ? (
            <div className="mt-3">
              <ProgressBar value={achievement.progress.percent} size="sm" />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {achievement.progress.current} / {achievement.progress.target}
              </p>
            </div>
          ) : display.earnedAt ? (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {new Date(display.earnedAt).toLocaleDateString()}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================================
// ALMOST THERE CARD
// ============================================================================

interface AlmostThereCardProps {
  achievement: EnhancedAchievement;
  index: number;
  onClick: () => void;
}

function AlmostThereCard({ achievement, index, onClick }: AlmostThereCardProps) {
  const display = getAchievementDisplay(achievement);
  const config = getRarityConfig(achievement);
  const progress = achievement.progress;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <Card className="hover:border-orange-500/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="text-3xl">{display.emoji}</div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-[var(--text-primary)] truncate">
                {display.name}
              </h4>
              <p className="text-xs text-[var(--text-tertiary)] truncate">
                {achievement.description}
              </p>
              {progress && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-orange-500 font-semibold">
                      {progress.percent}%
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {progress.current} / {progress.target}
                    </span>
                  </div>
                  <ProgressBar value={progress.percent} variant="warning" size="sm" />
                </div>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================================
// ACHIEVEMENT MODAL
// ============================================================================

interface AchievementModalProps {
  achievement: EnhancedAchievement;
  onClose: () => void;
}

function AchievementModal({ achievement, onClose }: AchievementModalProps) {
  const display = getAchievementDisplay(achievement);
  const config = getRarityConfig(achievement);
  const isEarned = !!display.earnedAt;
  const isHolographic = config.holographic && isEarned;

  // Trigger confetti for earned achievements
  useEffect(() => {
    if (isEarned && typeof window !== 'undefined') {
      import('canvas-confetti').then((confetti) => {
        confetti.default({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: [config.color, '#FFD700', '#FFFFFF'],
        });
      });
    }
  }, [isEarned, config.color]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.9, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 50 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <Card
          className="overflow-hidden"
          style={{
            background: config.bgGradient,
            borderColor: config.color,
            boxShadow: `${config.borderGlow}, 0 25px 50px -12px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
          >
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>

          {/* Holographic shimmer */}
          {isHolographic && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 55%, transparent 60%)',
                backgroundSize: '200% 200%',
              }}
              animate={{
                backgroundPosition: ['200% 50%', '-50% 50%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            />
          )}

          <CardContent className="p-8 text-center relative">
            {/* Rarity Badge */}
            <div className="flex justify-center mb-4">
              <Badge
                style={{
                  background: config.bgGradient,
                  color: config.color,
                  borderColor: config.color,
                }}
              >
                <config.icon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>
            </div>

            {/* Large Emoji */}
            <motion.div
              className="text-8xl mb-6"
              animate={
                isHolographic
                  ? {
                      scale: [1, 1.05, 1],
                      rotate: [-2, 2, -2],
                    }
                  : {}
              }
              transition={{ duration: 3, repeat: Infinity }}
            >
              {display.emoji}
            </motion.div>

            {/* Status */}
            {isEarned ? (
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
                style={{
                  background: config.bgGradient,
                  border: `1px solid ${config.color}`,
                }}
              >
                <Check className="w-5 h-5" style={{ color: config.color }} />
                <span className="font-semibold" style={{ color: config.color }}>
                  Unlocked!
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-tertiary)] mb-4">
                <Lock className="w-5 h-5 text-[var(--text-muted)]" />
                <span className="font-semibold text-[var(--text-secondary)]">Locked</span>
              </div>
            )}

            {/* Name */}
            <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">
              {display.name}
            </h2>

            {/* Description */}
            <p className="text-[var(--text-secondary)] mb-4">{achievement.description}</p>

            {/* Rarity Info */}
            {achievement.rarity && (
              <p className="text-sm mb-4" style={{ color: config.color }}>
                {achievement.rarity.description}
              </p>
            )}

            {/* Progress or Date */}
            {!isEarned && achievement.progress ? (
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-[var(--text-secondary)]">Progress</span>
                  <span className="font-bold" style={{ color: config.color }}>
                    {achievement.progress.percent}%
                  </span>
                </div>
                <ProgressBar value={achievement.progress.percent} variant="gold" />
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  {achievement.progress.current} / {achievement.progress.target} completed
                </p>
              </div>
            ) : display.earnedAt ? (
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 mb-4">
                <p className="text-sm text-[var(--text-secondary)]">Earned on</p>
                <p className="text-lg font-bold" style={{ color: config.color }}>
                  {new Date(display.earnedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            ) : null}

            {/* XP Reward */}
            {achievement.xp_reward && (
              <div className="flex items-center justify-center gap-2">
                <Star className="w-5 h-5 text-[var(--accent-primary)]" />
                <span className="font-bold text-[var(--accent-primary)]">
                  +{achievement.xp_reward} XP
                </span>
              </div>
            )}

            {/* Close Button */}
            <Button onClick={onClose} className="mt-6 w-full" variant="secondary">
              Close
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// FEATURED ACHIEVEMENT
// ============================================================================

interface FeaturedAchievementProps {
  achievement: EnhancedAchievement;
}

export function FeaturedAchievement({ achievement }: FeaturedAchievementProps) {
  const display = getAchievementDisplay(achievement);
  const config = getRarityConfig(achievement);
  const isHolographic = config.holographic;

  return (
    <Card
      className="overflow-hidden relative"
      style={{
        background: config.bgGradient,
        borderColor: config.color,
        boxShadow: config.borderGlow,
      }}
    >
      {/* Holographic shimmer */}
      {isHolographic && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 55%, transparent 60%)',
            backgroundSize: '200% 200%',
          }}
          animate={{
            backgroundPosition: ['200% 50%', '-50% 50%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatDelay: 1,
          }}
        />
      )}

      <div className="flex items-center gap-6 p-6 relative">
        <motion.div
          className="text-6xl"
          animate={isHolographic ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {display.emoji}
        </motion.div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              size="sm"
              style={{
                background: config.bgGradient,
                color: config.color,
                borderColor: config.color,
              }}
            >
              <config.icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            <p className="text-xs text-[var(--accent-primary)] uppercase tracking-wide">
              Latest Achievement
            </p>
          </div>
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1">
            {display.name}
          </h3>
          <p className="text-sm text-[var(--text-tertiary)]">{achievement.description}</p>
          {display.earnedAt && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Earned {new Date(display.earnedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// ACHIEVEMENT DEFINITIONS (for reference)
// ============================================================================

export const achievementDefinitions: Record<string, Partial<Achievement>> = {
  first_trade: {
    slug: 'first_trade',
    title: 'First Trade',
    name: 'First Trade',
    description: 'Log your first trade in the journal',
    icon: '🎯',
    emoji: '🎯',
    category: 'milestone',
    xp_reward: 50,
  },
  seven_day_streak: {
    slug: 'seven_day_streak',
    title: '7-Day Streak',
    name: '7-Day Streak',
    description: 'Trade for 7 consecutive days',
    icon: '🔥',
    emoji: '🔥',
    category: 'streak',
    xp_reward: 100,
  },
  quiz_master: {
    slug: 'quiz_master',
    title: 'Quiz Master',
    name: 'Quiz Master',
    description: 'Score 100% on 5 different quizzes',
    icon: '🧠',
    emoji: '🧠',
    category: 'learning',
    xp_reward: 150,
  },
  ltp_disciple: {
    slug: 'ltp_disciple',
    title: 'LTP Disciple',
    name: 'LTP Disciple',
    description: 'Get an A grade on 10 trades',
    icon: '📊',
    emoji: '📊',
    category: 'trading',
    xp_reward: 200,
  },
  green_week: {
    slug: 'green_week',
    title: 'Green Week',
    name: 'Green Week',
    description: 'Finish a week with positive P&L',
    icon: '💚',
    emoji: '💚',
    category: 'milestone',
    xp_reward: 100,
  },
  patience_pays: {
    slug: 'patience_pays',
    title: 'Patience Pays',
    name: 'Patience Pays',
    description: 'Wait for patience candle on 20 trades',
    icon: '⏳',
    emoji: '⏳',
    category: 'trading',
    xp_reward: 150,
  },
  level_master: {
    slug: 'level_master',
    title: 'Level Master',
    name: 'Level Master',
    description: 'Trade at key levels 50 times',
    icon: '📏',
    emoji: '📏',
    category: 'trading',
    xp_reward: 200,
  },
  trend_rider: {
    slug: 'trend_rider',
    title: 'Trend Rider',
    name: 'Trend Rider',
    description: 'Trade with the trend 50 times',
    icon: '🏄',
    emoji: '🏄',
    category: 'trading',
    xp_reward: 200,
  },
  practice_pro: {
    slug: 'practice_pro',
    title: 'Practice Pro',
    name: 'Practice Pro',
    description: 'Complete 25 practice scenarios',
    icon: '🎮',
    emoji: '🎮',
    category: 'learning',
    xp_reward: 150,
  },
  journal_regular: {
    slug: 'journal_regular',
    title: 'Journal Regular',
    name: 'Journal Regular',
    description: 'Log trades for 30 days',
    icon: '📓',
    emoji: '📓',
    category: 'consistency',
    xp_reward: 250,
  },
  helping_hand: {
    slug: 'helping_hand',
    title: 'Helping Hand',
    name: 'Helping Hand',
    description: 'Help 10 community members',
    icon: '🤝',
    emoji: '🤝',
    category: 'community',
    xp_reward: 100,
  },
  podium_finish: {
    slug: 'podium_finish',
    title: 'Podium Finish',
    name: 'Podium Finish',
    description: 'Reach top 3 on the weekly leaderboard',
    icon: '🏅',
    emoji: '🏅',
    category: 'competition',
    xp_reward: 200,
  },
  weekly_champion: {
    slug: 'weekly_champion',
    title: 'Weekly Champion',
    name: 'Weekly Champion',
    description: 'Win the weekly leaderboard',
    icon: '🏆',
    emoji: '🏆',
    category: 'competition',
    xp_reward: 300,
  },
};
