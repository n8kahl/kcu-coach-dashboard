'use client';

import { Card, CardContent } from '@/components/ui/card';
import { CircularProgress } from '@/components/ui/progress';
import { BookOpen, Clock, Trophy, Flame, Target, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { CourseProgress, LearningStreak } from '@/types/learning';

interface ProgressOverviewProps {
  progress: CourseProgress;
  streak: LearningStreak;
  className?: string;
}

export function ProgressOverview({ progress, streak, className = '' }: ProgressOverviewProps) {
  const totalHours = Math.floor(progress.totalWatchTimeSeconds / 3600);
  const totalMinutes = Math.floor((progress.totalWatchTimeSeconds % 3600) / 60);

  const stats = [
    {
      label: 'Completed',
      value: `${Math.round(progress.completionPercent)}%`,
      icon: Target,
      color: 'var(--accent-primary)',
      bgColor: 'rgba(245, 158, 11, 0.15)',
    },
    {
      label: 'Watch Time',
      value: totalHours > 0 ? `${totalHours}h ${totalMinutes}m` : `${totalMinutes}m`,
      icon: Clock,
      color: 'var(--info)',
      bgColor: 'rgba(59, 130, 246, 0.15)',
    },
    {
      label: 'Lessons',
      value: `${progress.completedLessons}/${progress.totalLessons}`,
      icon: BookOpen,
      color: 'var(--profit)',
      bgColor: 'rgba(34, 197, 94, 0.15)',
    },
    {
      label: 'Streak',
      value: `${streak.currentStreak} day${streak.currentStreak !== 1 ? 's' : ''}`,
      icon: Flame,
      color: '#EF4444',
      bgColor: 'rgba(239, 68, 68, 0.15)',
    },
  ];

  return (
    <Card variant="glow" className={className}>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Left side - Title and stats */}
          <div className="flex-1 w-full">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Your Learning Progress
            </h2>
            <p className="text-[var(--text-secondary)] mb-6">
              {progress.completionPercent >= 100
                ? 'Congratulations! You\'ve completed the course!'
                : progress.completionPercent >= 50
                  ? 'Great progress! You\'re more than halfway there.'
                  : 'Keep going! Every lesson brings you closer to mastery.'}
            </p>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex flex-col items-center p-3 rounded-lg"
                    style={{ backgroundColor: stat.bgColor }}
                  >
                    <Icon
                      className="w-5 h-5 mb-1"
                      style={{ color: stat.color }}
                    />
                    <span className="text-lg font-bold text-[var(--text-primary)]">
                      {stat.value}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {stat.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right side - Circular progress */}
          <div className="flex flex-col items-center">
            <CircularProgress
              value={progress.completionPercent}
              size={140}
              strokeWidth={12}
              variant={progress.completionPercent >= 100 ? 'success' : 'gold'}
            />
            <div className="mt-3 flex items-center gap-2 text-sm">
              {progress.completedModules > 0 && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[var(--profit)]" />
                  <span className="text-[var(--text-secondary)]">
                    {progress.completedModules}/{progress.totalModules} modules
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Streak highlight */}
        {streak.currentStreak >= 7 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 p-4 rounded-lg bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-500/20">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  {streak.currentStreak} Day Streak!
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {streak.currentStreak >= streak.longestStreak
                    ? "You're on your longest streak ever!"
                    : `Your longest streak was ${streak.longestStreak} days. Keep going!`}
                </p>
              </div>
              {streak.currentStreak >= 30 && (
                <Trophy className="w-8 h-8 text-yellow-500 ml-auto" />
              )}
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
