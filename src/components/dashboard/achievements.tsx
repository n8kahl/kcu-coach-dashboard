'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Lock, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import type { Achievement } from '@/types';

// Helper to get display values from Achievement (handles both old and new field names)
function getAchievementDisplay(achievement: Achievement) {
  return {
    name: achievement.name || achievement.title,
    emoji: achievement.emoji || achievement.icon,
    earnedAt: achievement.earned_at || achievement.unlocked_at,
    progress: achievement.progress ?? achievement.requirement?.current,
    target: achievement.target ?? achievement.requirement?.target,
  };
}

interface AchievementsGridProps {
  achievements: Achievement[];
}

export function AchievementsGrid({ achievements }: AchievementsGridProps) {
  const earned = achievements.filter((a) => getAchievementDisplay(a).earnedAt);
  const locked = achievements.filter((a) => !getAchievementDisplay(a).earnedAt);

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
            {earned.length} / {achievements.length}
          </h2>
          <p className="text-sm text-[var(--text-tertiary)]">Achievements Unlocked</p>
        </div>
        <ProgressBar
          value={(earned.length / achievements.length) * 100}
          variant="gold"
          className="w-48"
        />
      </div>

      {/* Earned */}
      {earned.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-4">
            Unlocked
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {earned.map((achievement, index) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                index={index}
              />
            ))}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-4">
            Locked
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {locked.map((achievement, index) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                index={index}
                locked
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface AchievementCardProps {
  achievement: Achievement;
  index: number;
  locked?: boolean;
}

function AchievementCard({ achievement, index, locked }: AchievementCardProps) {
  const display = getAchievementDisplay(achievement);
  const hasProgress = display.progress !== undefined && display.target !== undefined;
  const progressPercent = hasProgress ? (display.progress! / display.target!) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        variant={locked ? 'default' : 'glow'}
        hoverable
        className={cn('text-center', locked && 'opacity-60')}
      >
        <CardContent>
          {/* Emoji/Icon */}
          <div className="relative inline-flex items-center justify-center w-16 h-16 mb-3">
            <span className="text-4xl">{display.emoji}</span>
            {locked ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-card)]/80">
                <Lock className="w-6 h-6 text-[var(--text-muted)]" />
              </div>
            ) : (
              <div className="absolute -top-1 -right-1">
                <div className="w-5 h-5 bg-[var(--accent-primary)] flex items-center justify-center">
                  <Check className="w-3 h-3 text-[var(--bg-primary)]" />
                </div>
              </div>
            )}
          </div>

          {/* Name */}
          <h4
            className={cn(
              'font-semibold mb-1',
              locked ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'
            )}
          >
            {display.name}
          </h4>

          {/* Description */}
          <p className="text-xs text-[var(--text-tertiary)] mb-2">
            {achievement.description}
          </p>

          {/* Progress or Date */}
          {locked && hasProgress ? (
            <div className="mt-3">
              <ProgressBar value={progressPercent} size="sm" />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {display.progress} / {display.target}
              </p>
            </div>
          ) : display.earnedAt ? (
            <p className="text-xs text-[var(--accent-primary)]">
              {new Date(display.earnedAt).toLocaleDateString()}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Featured Achievement (for display on dashboard)
interface FeaturedAchievementProps {
  achievement: Achievement;
}

export function FeaturedAchievement({ achievement }: FeaturedAchievementProps) {
  const display = getAchievementDisplay(achievement);

  return (
    <Card variant="glow" className="overflow-hidden">
      <div className="flex items-center gap-6 p-6">
        <div className="text-6xl">{display.emoji}</div>
        <div className="flex-1">
          <p className="text-xs text-[var(--accent-primary)] uppercase tracking-wide mb-1">
            Latest Achievement
          </p>
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

// Achievement definitions for reference
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
