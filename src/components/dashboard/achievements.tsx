'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Lock, Check } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import type { Achievement } from '@/types';

interface AchievementsGridProps {
  achievements: Achievement[];
}

export function AchievementsGrid({ achievements }: AchievementsGridProps) {
  const earned = achievements.filter((a) => a.earned_at);
  const locked = achievements.filter((a) => !a.earned_at);

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
  const hasProgress = achievement.progress !== undefined && achievement.target !== undefined;
  const progressPercent = hasProgress
    ? (achievement.progress! / achievement.target!) * 100
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        variant={locked ? 'default' : 'glow'}
        hoverable
        className={cn(
          'text-center',
          locked && 'opacity-60'
        )}
      >
        <CardContent>
          {/* Emoji/Icon */}
          <div className="relative inline-flex items-center justify-center w-16 h-16 mb-3">
            <span className="text-4xl">{achievement.emoji}</span>
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
            {achievement.name}
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
                {achievement.progress} / {achievement.target}
              </p>
            </div>
          ) : achievement.earned_at ? (
            <p className="text-xs text-[var(--accent-primary)]">
              {new Date(achievement.earned_at).toLocaleDateString()}
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
  return (
    <Card variant="glow" className="overflow-hidden">
      <div className="flex items-center gap-6 p-6">
        <div className="text-6xl">{achievement.emoji}</div>
        <div className="flex-1">
          <p className="text-xs text-[var(--accent-primary)] uppercase tracking-wide mb-1">
            Latest Achievement
          </p>
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1">
            {achievement.name}
          </h3>
          <p className="text-sm text-[var(--text-tertiary)]">{achievement.description}</p>
          {achievement.earned_at && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Earned {new Date(achievement.earned_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// Achievement definitions
export const achievementDefinitions: Record<string, Omit<Achievement, 'id' | 'earned_at' | 'progress' | 'target'>> = {
  first_trade: {
    type: 'first_trade',
    name: 'First Trade',
    description: 'Log your first trade in the journal',
    emoji: '🎯',
  },
  seven_day_streak: {
    type: 'seven_day_streak',
    name: '7-Day Streak',
    description: 'Trade for 7 consecutive days',
    emoji: '🔥',
  },
  quiz_master: {
    type: 'quiz_master',
    name: 'Quiz Master',
    description: 'Score 100% on 5 different quizzes',
    emoji: '🧠',
  },
  ltp_disciple: {
    type: 'ltp_disciple',
    name: 'LTP Disciple',
    description: 'Get an A grade on 10 trades',
    emoji: '📊',
  },
  green_week: {
    type: 'green_week',
    name: 'Green Week',
    description: 'Finish a week with positive P&L',
    emoji: '💚',
  },
  patience_pays: {
    type: 'patience_pays',
    name: 'Patience Pays',
    description: 'Wait for patience candle on 20 trades',
    emoji: '⏳',
  },
  level_master: {
    type: 'level_master',
    name: 'Level Master',
    description: 'Trade at key levels 50 times',
    emoji: '📏',
  },
  trend_rider: {
    type: 'trend_rider',
    name: 'Trend Rider',
    description: 'Trade with the trend 50 times',
    emoji: '🏄',
  },
  practice_pro: {
    type: 'practice_pro',
    name: 'Practice Pro',
    description: 'Complete 25 practice scenarios',
    emoji: '🎮',
  },
  journal_regular: {
    type: 'journal_regular',
    name: 'Journal Regular',
    description: 'Log trades for 30 days',
    emoji: '📓',
  },
  helping_hand: {
    type: 'helping_hand',
    name: 'Helping Hand',
    description: 'Help 10 community members',
    emoji: '🤝',
  },
  podium_finish: {
    type: 'podium_finish',
    name: 'Podium Finish',
    description: 'Reach top 3 on the weekly leaderboard',
    emoji: '🏅',
  },
  weekly_champion: {
    type: 'weekly_champion',
    name: 'Weekly Champion',
    description: 'Win the weekly leaderboard',
    emoji: '🏆',
  },
};
