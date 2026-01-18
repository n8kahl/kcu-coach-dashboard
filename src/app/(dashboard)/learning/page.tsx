'use client';

import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressBar, CircularProgress } from '@/components/ui/progress';
import { CURRICULUM_MODULES, getCurriculumStats } from '@/data/curriculum';
import { motion } from 'framer-motion';
import {
  BookOpen,
  TrendingUp,
  Activity,
  Target,
  Crosshair,
  ArrowRightLeft,
  Brain,
  ClipboardList,
  ListChecks,
  Shield,
  ChevronRight,
  Clock,
  CheckCircle2,
  Play,
} from 'lucide-react';
import Link from 'next/link';

// Icon mapping
const iconMap: Record<string, React.ElementType> = {
  BookOpen,
  TrendingUp,
  Activity,
  Target,
  Crosshair,
  ArrowRightLeft,
  Brain,
  ClipboardList,
  ListChecks,
  Shield,
};

// Mock user progress - in real app, fetch from API
const mockUserProgress: Record<string, { completed: number; total: number }> = {
  'mod_fundamentals': { completed: 4, total: 4 },
  'mod_price_action': { completed: 3, total: 4 },
  'mod_indicators': { completed: 2, total: 4 },
  'mod_ltp_framework': { completed: 1, total: 5 },
  'mod_strategies': { completed: 0, total: 4 },
  'mod_entries_exits': { completed: 0, total: 4 },
  'mod_psychology': { completed: 0, total: 5 },
  'mod_trading_rules': { completed: 0, total: 4 },
  'mod_watchlist': { completed: 0, total: 3 },
};

export default function LearningPage() {
  const stats = getCurriculumStats();

  // Calculate overall progress
  const totalCompleted = Object.values(mockUserProgress).reduce((sum, p) => sum + p.completed, 0);
  const totalLessons = Object.values(mockUserProgress).reduce((sum, p) => sum + p.total, 0);
  const overallProgress = Math.round((totalCompleted / totalLessons) * 100);

  return (
    <>
      <Header
        title="Learning Center"
        subtitle="Master the LTP Framework step by step"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Learning' }]}
      />

      <PageShell>
        <div className="space-y-8">
          {/* Overall Progress Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card variant="glow">
              <CardContent>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                      Your Learning Journey
                    </h2>
                    <p className="text-[var(--text-secondary)] mb-4">
                      Complete all {stats.totalModules} modules to master the KCU trading methodology
                    </p>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span className="text-[var(--text-secondary)]">
                          {totalCompleted}/{totalLessons} Lessons
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span className="text-[var(--text-secondary)]">
                          ~{stats.totalHours} hours total
                        </span>
                      </div>
                    </div>
                  </div>
                  <CircularProgress
                    value={overallProgress}
                    size={120}
                    strokeWidth={10}
                    variant="gold"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Module Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CURRICULUM_MODULES.map((module, index) => {
              const Icon = iconMap[module.icon] || BookOpen;
              const progress = mockUserProgress[module.id] || { completed: 0, total: module.lessons.length };
              const progressPercent = Math.round((progress.completed / progress.total) * 100);
              const isComplete = progressPercent === 100;
              const isLocked = index > 0 && mockUserProgress[CURRICULUM_MODULES[index - 1].id]?.completed === 0;

              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={isLocked ? '#' : `/learning/${module.slug}`}
                    className={isLocked ? 'cursor-not-allowed' : ''}
                  >
                    <Card
                      hoverable={!isLocked}
                      className={`h-full ${isLocked ? 'opacity-50' : ''}`}
                    >
                      <CardContent>
                        <div className="flex items-start gap-4">
                          {/* Module Icon */}
                          <div
                            className="w-14 h-14 flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: isComplete
                                ? 'rgba(34, 197, 94, 0.15)'
                                : `${module.color}20`,
                            }}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="w-7 h-7 text-[var(--profit)]" />
                            ) : (
                              <Icon
                                className="w-7 h-7"
                                style={{ color: module.color }}
                              />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-[var(--text-primary)] truncate">
                                {module.title}
                              </h3>
                              <Badge
                                variant={
                                  module.lessons[0]?.duration
                                    ? module.order <= 2
                                      ? 'success'
                                      : module.order <= 6
                                      ? 'warning'
                                      : 'default'
                                    : 'default'
                                }
                                size="sm"
                              >
                                {module.order <= 2
                                  ? 'Beginner'
                                  : module.order <= 6
                                  ? 'Intermediate'
                                  : 'Advanced'}
                              </Badge>
                            </div>

                            <p className="text-sm text-[var(--text-tertiary)] mb-3 line-clamp-2">
                              {module.description}
                            </p>

                            {/* Progress */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[var(--text-muted)]">
                                  {progress.completed}/{progress.total} lessons
                                </span>
                                <span
                                  className={
                                    isComplete
                                      ? 'text-[var(--profit)]'
                                      : 'text-[var(--accent-primary)]'
                                  }
                                >
                                  {progressPercent}%
                                </span>
                              </div>
                              <ProgressBar
                                value={progressPercent}
                                variant={isComplete ? 'success' : 'gold'}
                                size="sm"
                              />
                            </div>
                          </div>

                          {/* Arrow */}
                          {!isLocked && (
                            <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0 mt-2" />
                          )}
                        </div>

                        {/* Continue Button for In-Progress Modules */}
                        {progress.completed > 0 && !isComplete && (
                          <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
                            <div className="flex items-center gap-2 text-sm text-[var(--accent-primary)]">
                              <Play className="w-4 h-4" />
                              <span>Continue Learning</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </PageShell>
    </>
  );
}
