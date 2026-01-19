'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Zap, Target, TrendingUp, Award, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Achievement {
  id: string;
  type: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  title: string;
  description: string;
  xpReward: number;
  unlockedAt: string;
  isNew?: boolean;
}

interface AchievementPopupProps {
  achievement: Achievement | null;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

const TIER_COLORS = {
  bronze: {
    bg: 'from-amber-900/30 to-amber-800/10',
    border: 'border-amber-700/50',
    glow: 'shadow-amber-500/20',
    icon: 'text-amber-400',
    text: 'text-amber-300',
  },
  silver: {
    bg: 'from-slate-400/30 to-slate-500/10',
    border: 'border-slate-400/50',
    glow: 'shadow-slate-300/20',
    icon: 'text-slate-300',
    text: 'text-slate-200',
  },
  gold: {
    bg: 'from-yellow-500/30 to-yellow-600/10',
    border: 'border-yellow-500/50',
    glow: 'shadow-yellow-400/30',
    icon: 'text-yellow-400',
    text: 'text-yellow-300',
  },
  platinum: {
    bg: 'from-purple-500/30 to-purple-600/10',
    border: 'border-purple-400/50',
    glow: 'shadow-purple-400/40',
    icon: 'text-purple-300',
    text: 'text-purple-200',
  },
};

const ACHIEVEMENT_ICONS: Record<string, typeof Trophy> = {
  first_practice: Trophy,
  streak_3: Zap,
  streak_7: Zap,
  streak_30: Zap,
  accuracy_70: Target,
  accuracy_80: Target,
  accuracy_90: Target,
  level_master: TrendingUp,
  trend_master: TrendingUp,
  patience_master: TrendingUp,
  daily_challenge: Star,
  weekly_challenge: Star,
  xp_1000: Award,
  xp_5000: Award,
  xp_10000: Award,
};

export function AchievementPopup({
  achievement,
  onClose,
  autoClose = true,
  autoCloseDelay = 5000,
}: AchievementPopupProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (achievement) {
      setIsVisible(true);
      if (autoClose) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(onClose, 300); // Wait for exit animation
        }, autoCloseDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [achievement, autoClose, autoCloseDelay, onClose]);

  if (!achievement) return null;

  const tierStyle = TIER_COLORS[achievement.tier];
  const IconComponent = ACHIEVEMENT_ICONS[achievement.type] || Trophy;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 25,
          }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div
            className={cn(
              'relative px-6 py-4 rounded-xl border backdrop-blur-md',
              'bg-gradient-to-br',
              tierStyle.bg,
              tierStyle.border,
              'shadow-lg',
              tierStyle.glow
            )}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setIsVisible(false);
                setTimeout(onClose, 300);
              }}
              className="absolute top-2 right-2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Sparkle effects */}
            <motion.div
              className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-white"
              animate={{
                opacity: [0, 1, 0],
                scale: [0.5, 1.5, 0.5],
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
            />
            <motion.div
              className="absolute -top-2 right-8 w-1.5 h-1.5 rounded-full bg-white"
              animate={{
                opacity: [0, 1, 0],
                scale: [0.5, 1.5, 0.5],
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            />
            <motion.div
              className="absolute -bottom-1 left-12 w-1.5 h-1.5 rounded-full bg-white"
              animate={{
                opacity: [0, 1, 0],
                scale: [0.5, 1.5, 0.5],
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
            />

            <div className="flex items-center gap-4">
              {/* Icon */}
              <motion.div
                initial={{ rotate: -20, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, delay: 0.1 }}
                className={cn(
                  'p-3 rounded-full bg-[var(--bg-primary)]/50',
                  tierStyle.icon
                )}
              >
                <IconComponent className="w-6 h-6" />
              </motion.div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-2"
                >
                  <span className={cn('text-xs uppercase tracking-wider font-bold', tierStyle.text)}>
                    {achievement.tier} Achievement
                  </span>
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg font-bold text-white mt-0.5"
                >
                  {achievement.title}
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm text-[var(--text-secondary)] mt-1"
                >
                  {achievement.description}
                </motion.p>
              </div>

              {/* XP Reward */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, delay: 0.5 }}
                className="flex flex-col items-center px-3 py-2 rounded-lg bg-[var(--bg-primary)]/50"
              >
                <span className="text-lg font-bold text-[var(--accent-primary)]">
                  +{achievement.xpReward}
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">XP</span>
              </motion.div>
            </div>

            {/* Progress bar for auto-close */}
            {autoClose && (
              <motion.div
                className="absolute bottom-0 left-0 h-1 bg-white/30 rounded-b-xl"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: autoCloseDelay / 1000, ease: 'linear' }}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Compact achievement badge for lists
export function AchievementBadge({
  achievement,
  size = 'md',
  showTooltip = true,
}: {
  achievement: Achievement;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}) {
  const tierStyle = TIER_COLORS[achievement.tier];
  const IconComponent = ACHIEVEMENT_ICONS[achievement.type] || Trophy;

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="relative group">
      <div
        className={cn(
          'rounded-full flex items-center justify-center border',
          'bg-gradient-to-br',
          tierStyle.bg,
          tierStyle.border,
          tierStyle.icon,
          sizeClasses[size]
        )}
      >
        <IconComponent className={iconSizes[size]} />
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          <div className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-lg whitespace-nowrap">
            <div className={cn('text-xs font-bold', tierStyle.text)}>
              {achievement.title}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {achievement.description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Achievement list component
export function AchievementList({
  achievements,
  onSelect,
}: {
  achievements: Achievement[];
  onSelect?: (achievement: Achievement) => void;
}) {
  const grouped = achievements.reduce((acc, achievement) => {
    if (!acc[achievement.tier]) acc[achievement.tier] = [];
    acc[achievement.tier].push(achievement);
    return acc;
  }, {} as Record<string, Achievement[]>);

  const tierOrder: Array<'platinum' | 'gold' | 'silver' | 'bronze'> = ['platinum', 'gold', 'silver', 'bronze'];

  return (
    <div className="space-y-4">
      {tierOrder.map(tier => {
        const tierAchievements = grouped[tier];
        if (!tierAchievements || tierAchievements.length === 0) return null;

        const tierStyle = TIER_COLORS[tier];

        return (
          <div key={tier}>
            <h4 className={cn('text-xs uppercase tracking-wider font-bold mb-2', tierStyle.text)}>
              {tier} ({tierAchievements.length})
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {tierAchievements.map(achievement => (
                <motion.button
                  key={achievement.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelect?.(achievement)}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg border transition-colors',
                    'bg-gradient-to-br',
                    tierStyle.bg,
                    tierStyle.border,
                    'hover:bg-opacity-80'
                  )}
                >
                  <AchievementBadge achievement={achievement} size="sm" showTooltip={false} />
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {achievement.title}
                    </div>
                    {achievement.isNew && (
                      <span className="text-xs text-[var(--accent-primary)]">NEW!</span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        );
      })}

      {achievements.length === 0 && (
        <div className="text-center py-8 text-[var(--text-tertiary)]">
          <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No achievements yet</p>
          <p className="text-sm">Complete practice sessions to unlock!</p>
        </div>
      )}
    </div>
  );
}

export default AchievementPopup;
