'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Lock, Trophy, Award, Flame, Target, BookOpen, Clock, Zap, Star, GraduationCap } from 'lucide-react';
import type { Achievement } from '@/types/learning';

interface AchievementGridProps {
  achievements: Achievement[];
  className?: string;
  showAll?: boolean;
  maxDisplay?: number;
}

// Achievement icon mapping based on slug patterns
const getAchievementIcon = (slug: string) => {
  if (slug.includes('streak')) return Flame;
  if (slug.includes('lesson')) return BookOpen;
  if (slug.includes('module')) return Target;
  if (slug.includes('quiz')) return Award;
  if (slug.includes('hour') || slug.includes('time')) return Clock;
  if (slug.includes('speed') || slug.includes('marathon')) return Zap;
  if (slug.includes('complete') || slug.includes('graduate')) return GraduationCap;
  if (slug.includes('halfway')) return Star;
  return Trophy;
};

// Achievement color based on type
const getAchievementColor = (slug: string, earned: boolean) => {
  if (!earned) return { bg: 'var(--bg-tertiary)', icon: 'var(--text-muted)' };

  if (slug.includes('streak')) return { bg: 'rgba(239, 68, 68, 0.15)', icon: '#EF4444' };
  if (slug.includes('quiz')) return { bg: 'rgba(168, 85, 247, 0.15)', icon: '#A855F7' };
  if (slug.includes('complete') || slug.includes('graduate')) return { bg: 'rgba(245, 158, 11, 0.15)', icon: '#F59E0B' };
  if (slug.includes('speed') || slug.includes('marathon')) return { bg: 'rgba(59, 130, 246, 0.15)', icon: '#3B82F6' };
  return { bg: 'rgba(34, 197, 94, 0.15)', icon: '#22C55E' };
};

export function AchievementGrid({
  achievements,
  className = '',
  showAll = false,
  maxDisplay = 6,
}: AchievementGridProps) {
  const earnedAchievements = achievements.filter(a => a.earnedAt);
  const unearnedAchievements = achievements.filter(a => !a.earnedAt && !a.isSecret);

  const displayAchievements = showAll
    ? [...earnedAchievements, ...unearnedAchievements]
    : [...earnedAchievements.slice(0, maxDisplay), ...unearnedAchievements.slice(0, Math.max(0, maxDisplay - earnedAchievements.length))];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Achievements</span>
          <span className="text-sm font-normal text-[var(--text-tertiary)]">
            {earnedAchievements.length}/{achievements.filter(a => !a.isSecret).length} earned
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {displayAchievements.map((achievement, index) => {
            const Icon = getAchievementIcon(achievement.slug);
            const colors = getAchievementColor(achievement.slug, !!achievement.earnedAt);
            const isEarned = !!achievement.earnedAt;

            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`
                  relative p-4 rounded-lg border text-center transition-all
                  ${isEarned
                    ? 'border-[var(--border-primary)] bg-[var(--bg-secondary)]'
                    : 'border-dashed border-[var(--border-secondary)] bg-[var(--bg-tertiary)] opacity-60'
                  }
                `}
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: colors.bg }}
                >
                  {isEarned ? (
                    <Icon className="w-6 h-6" style={{ color: colors.icon }} />
                  ) : (
                    <Lock className="w-5 h-5 text-[var(--text-muted)]" />
                  )}
                </div>

                {/* Title */}
                <h4 className={`font-medium mb-1 ${isEarned ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                  {achievement.title}
                </h4>

                {/* Description */}
                <p className="text-xs text-[var(--text-tertiary)] line-clamp-2">
                  {achievement.description}
                </p>

                {/* Earned date */}
                {isEarned && achievement.earnedAt && (
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    Earned {new Date(achievement.earnedAt).toLocaleDateString()}
                  </p>
                )}

                {/* Shine effect for earned */}
                {isEarned && (
                  <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-white via-transparent to-transparent" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* View all link */}
        {!showAll && achievements.length > maxDisplay && (
          <div className="mt-4 text-center">
            <button className="text-sm text-[var(--accent-primary)] hover:underline">
              View all {achievements.length} achievements
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
