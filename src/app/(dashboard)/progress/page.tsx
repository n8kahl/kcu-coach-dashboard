'use client';

/**
 * Learning Intelligence Dashboard
 *
 * A high-impact progress tracking page that transforms the learning experience
 * from a static list into an intelligent, AI-aware curriculum dashboard.
 *
 * Features:
 * - Real-time progress tracking via useLearningProgress hook
 * - Premium UI components (ProgressOverview, ActivityHeatmap, ModuleProgressList)
 * - Deep AI context integration for intelligent coaching
 * - Responsive layout with mobile-first design
 * - Skeleton loading states for premium UX
 */

// Force dynamic rendering to prevent prerender errors
export const dynamic = 'force-dynamic';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/feedback';
import { ProgressBar } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import {
  Play,
  BookOpen,
  AlertCircle,
  RefreshCw,
  Trophy,
  Flame,
  Clock,
  Target,
  TrendingUp,
  GraduationCap,
} from 'lucide-react';

// Premium learn components
import {
  ProgressOverview,
  ActivityHeatmap,
  ModuleProgressList,
} from '@/components/learn';

// Data hooks
import { useLearningProgress } from '@/hooks/use-learning-progress';

// AI context integration
import { usePageContext } from '@/components/ai/hooks/usePageContext';

// Stable options object for useLearningProgress - prevents infinite re-renders
const PROGRESS_PAGE_OPTIONS = {
  include: ['stats', 'modules', 'activity'] as ('stats' | 'courses' | 'modules' | 'activity')[],
  autoRefresh: true,
  refreshInterval: 120000, // Refresh every 2 minutes
};

// Types
import type { CourseProgress, LearningStreak, DailyActivity } from '@/types/learning';
import type { ModuleProgress } from '@/lib/learning-progress';

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

function ProgressOverviewSkeleton() {
  return (
    <Card variant="glow" className="animate-pulse">
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex-1 w-full">
            <div className="h-8 w-64 bg-[var(--bg-tertiary)] rounded mb-2" />
            <div className="h-4 w-48 bg-[var(--bg-tertiary)] rounded mb-6" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <div className="h-5 w-5 bg-[var(--bg-secondary)] rounded mx-auto mb-2" />
                  <div className="h-6 w-12 bg-[var(--bg-secondary)] rounded mx-auto mb-1" />
                  <div className="h-3 w-16 bg-[var(--bg-secondary)] rounded mx-auto" />
                </div>
              ))}
            </div>
          </div>
          <div className="w-36 h-36 rounded-full bg-[var(--bg-tertiary)]" />
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityHeatmapSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 bg-[var(--bg-tertiary)] rounded" />
          <div className="flex gap-4">
            <div className="h-4 w-20 bg-[var(--bg-tertiary)] rounded" />
            <div className="h-4 w-16 bg-[var(--bg-tertiary)] rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <div className="w-8 space-y-1">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-3 w-8 bg-[var(--bg-tertiary)] rounded" />
            ))}
          </div>
          <div className="flex-1">
            <div className="flex gap-1">
              {Array.from({ length: 12 }).map((_, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {Array.from({ length: 7 }).map((_, dayIndex) => (
                    <div key={dayIndex} className="w-3 h-3 bg-[var(--bg-tertiary)] rounded-sm" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-[var(--border-primary)]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <div className="h-8 w-12 bg-[var(--bg-tertiary)] rounded mx-auto mb-1" />
              <div className="h-3 w-16 bg-[var(--bg-tertiary)] rounded mx-auto" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleGridSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-6 w-48 bg-[var(--bg-tertiary)] rounded mb-2" />
          <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded" />
        </div>
        <div className="text-right">
          <div className="h-8 w-16 bg-[var(--bg-tertiary)] rounded mb-1" />
          <div className="h-3 w-12 bg-[var(--bg-tertiary)] rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-[var(--bg-tertiary)]" />
              <div className="flex-1">
                <div className="h-5 w-32 bg-[var(--bg-tertiary)] rounded mb-2" />
                <div className="h-3 w-24 bg-[var(--bg-tertiary)] rounded" />
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between mb-1.5">
                <div className="h-3 w-16 bg-[var(--bg-tertiary)] rounded" />
                <div className="h-3 w-8 bg-[var(--bg-tertiary)] rounded" />
              </div>
              <div className="h-2 w-full bg-[var(--bg-tertiary)] rounded" />
            </div>
            <div className="h-8 w-full bg-[var(--bg-tertiary)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build CourseProgress object from stats for ProgressOverview
 */
function buildCourseProgress(
  stats: {
    totalLessonsCompleted: number;
    totalWatchTimeSeconds: number;
    overallProgress: number;
    totalCoursesCompleted: number;
    totalCoursesEnrolled: number;
    totalQuizzesPassed: number;
  } | undefined,
  modules: ModuleProgress[] | undefined
): CourseProgress {
  const totalModules = modules?.length || 0;
  const completedModules = modules?.filter(m => m.progress >= 100).length || 0;
  const totalLessons = modules?.reduce((sum, m) => sum + m.totalLessons, 0) || 0;
  const completedLessons = modules?.reduce((sum, m) => sum + m.lessonsCompleted, 0) || 0;

  return {
    totalLessons,
    completedLessons,
    totalModules,
    completedModules,
    totalWatchTimeSeconds: stats?.totalWatchTimeSeconds || 0,
    totalQuizAttempts: stats?.totalQuizzesPassed || 0,
    bestQuizScores: modules?.filter(m => m.quizScore !== undefined).map(m => ({
      moduleId: m.moduleId,
      bestScore: m.quizScore || 0,
    })) || [],
    completionPercent: stats?.overallProgress || 0,
  };
}

/**
 * Build LearningStreak object from stats
 */
function buildStreak(stats: { currentStreak: number; longestStreak: number; lastActivityAt?: string } | undefined): LearningStreak {
  return {
    currentStreak: stats?.currentStreak || 0,
    longestStreak: stats?.longestStreak || 0,
    lastActivityDate: stats?.lastActivityAt || null,
    streakStartDate: null,
  };
}

/**
 * Convert recent activity to DailyActivity format
 */
function buildDailyActivities(recentActivity: Array<{ timestamp: string; type: string; xpEarned?: number }> | undefined): DailyActivity[] {
  if (!recentActivity || recentActivity.length === 0) return [];

  // Group activities by date
  const byDate = new Map<string, { lessonsCompleted: number; watchTime: number; quizzesPassed: number }>();

  recentActivity.forEach(activity => {
    const date = activity.timestamp.split('T')[0];
    const existing = byDate.get(date) || { lessonsCompleted: 0, watchTime: 0, quizzesPassed: 0 };

    if (activity.type === 'lesson_completed') {
      existing.lessonsCompleted++;
      existing.watchTime += 300; // Estimate 5 min per lesson
    } else if (activity.type === 'quiz_passed') {
      existing.quizzesPassed++;
    }

    byDate.set(date, existing);
  });

  return Array.from(byDate.entries()).map(([date, data]) => ({
    activityDate: date,
    lessonsStarted: data.lessonsCompleted,
    lessonsCompleted: data.lessonsCompleted,
    watchTimeSeconds: data.watchTime,
    quizzesTaken: data.quizzesPassed,
    quizzesPassed: data.quizzesPassed,
    engagementScore: (data.lessonsCompleted * 25) + (data.quizzesPassed * 50),
  }));
}

/**
 * Find the recommended next lesson based on progress
 */
function findRecommendedModule(modules: ModuleProgress[] | undefined): ModuleProgress | null {
  if (!modules || modules.length === 0) return null;

  // First, find modules in progress (not completed, has some progress)
  const inProgress = modules.find(m => m.progress > 0 && m.progress < 100);
  if (inProgress) return inProgress;

  // Next, find the first not-started module
  const notStarted = modules.find(m => m.progress === 0);
  if (notStarted) return notStarted;

  // All complete - return the last one for review
  return modules[modules.length - 1];
}

/**
 * Identify weak areas based on quiz scores
 */
function identifyWeakAreas(modules: ModuleProgress[] | undefined): string[] {
  if (!modules) return [];

  return modules
    .filter(m => m.quizScore !== undefined && m.quizScore < 70)
    .map(m => m.moduleName);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProgressPage() {
  const router = useRouter();

  // Fetch all progress data using the unified hook
  const { data, isLoading, error, refresh } = useLearningProgress(PROGRESS_PAGE_OPTIONS);

  // Build derived data for components
  const courseProgress = useMemo(
    () => buildCourseProgress(data?.stats, data?.modules),
    [data?.stats, data?.modules]
  );

  const streak = useMemo(
    () => buildStreak(data?.stats),
    [data?.stats]
  );

  const dailyActivities = useMemo(
    () => buildDailyActivities(data?.recentActivity),
    [data?.recentActivity]
  );

  const recommendedModule = useMemo(
    () => findRecommendedModule(data?.modules),
    [data?.modules]
  );

  const weakAreas = useMemo(
    () => identifyWeakAreas(data?.modules),
    [data?.modules]
  );

  // ============================================================================
  // STEP 3: AI CONTEXT SYNCHRONIZATION
  // ============================================================================

  // Memoize pageData to prevent infinite re-renders
  // (usePageContext has pageData in its dependency array)
  const pageData = useMemo(() => ({
    completionPercent: data?.stats?.overallProgress,
    currentStreak: data?.stats?.currentStreak,
    weakAreas,
    recommendedModule: recommendedModule?.moduleName,
    totalLessonsCompleted: data?.stats?.totalLessonsCompleted,
    totalWatchTimeHours: data?.stats?.totalWatchTimeSeconds
      ? Math.round(data.stats.totalWatchTimeSeconds / 3600 * 10) / 10
      : 0,
    modulesInProgress: data?.modules?.filter(m => m.progress > 0 && m.progress < 100).length || 0,
    modulesCompleted: data?.modules?.filter(m => m.progress >= 100).length || 0,
  }), [
    data?.stats?.overallProgress,
    data?.stats?.currentStreak,
    data?.stats?.totalLessonsCompleted,
    data?.stats?.totalWatchTimeSeconds,
    data?.modules,
    weakAreas,
    recommendedModule?.moduleName,
  ]);

  // Use page context for automatic route tracking
  const { page } = usePageContext({
    pageData,
    deps: [pageData],
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleContinueLearning = () => {
    if (recommendedModule) {
      router.push(`/learn/kcu-trading-mastery/${recommendedModule.moduleSlug}`);
    } else {
      router.push('/learn');
    }
  };

  const handleStudyMaterials = () => {
    router.push('/learn');
  };

  const handleRefresh = async () => {
    await refresh();
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (isLoading && !data) {
    return (
      <>
        <Header
          title="Learning Intelligence"
          subtitle="Track your mastery of the LTP Framework"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Progress' }]}
        />
        <PageShell>
          <div className="space-y-6">
            {/* Hero Section Skeleton */}
            <ProgressOverviewSkeleton />

            {/* Activity Section Skeleton */}
            <div className="overflow-x-auto">
              <ActivityHeatmapSkeleton />
            </div>

            {/* Module Grid Skeleton */}
            <ModuleGridSkeleton />
          </div>
        </PageShell>
      </>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================

  if (error && !data) {
    return (
      <>
        <Header
          title="Learning Intelligence"
          subtitle="Track your mastery of the LTP Framework"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Progress' }]}
        />
        <PageShell>
          <Card variant="bordered">
            <CardContent className="text-center py-12">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-[var(--error)]" />
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  Unable to Load Progress
                </h3>
                <p className="text-sm text-[var(--text-tertiary)] mb-6 max-w-md mx-auto">
                  {error}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="secondary" onClick={() => router.push('/learn')}>
                    <BookOpen className="w-4 h-4 mr-2" />
                    Browse Lessons
                  </Button>
                  <Button variant="primary" onClick={handleRefresh}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <>
      <Header
        title="Learning Intelligence"
        subtitle="Track your mastery of the LTP Framework"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Progress' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="hidden sm:flex"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<BookOpen className="w-4 h-4" />}
              onClick={handleStudyMaterials}
            >
              <span className="hidden sm:inline">Study Materials</span>
              <span className="sm:hidden">Materials</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Play className="w-4 h-4" />}
              onClick={handleContinueLearning}
            >
              <span className="hidden sm:inline">Continue Learning</span>
              <span className="sm:hidden">Continue</span>
            </Button>
          </div>
        }
      />

      <PageShell>
        <div className="space-y-8">
          {/* ============================================================
           * HERO SECTION: Progress Overview
           * Shows completion %, watch time, lessons, streak
           * ============================================================ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <ProgressOverview
              progress={courseProgress}
              streak={streak}
            />
          </motion.div>

          {/* ============================================================
           * CONSISTENCY SECTION: Activity Heatmap
           * Shows learning activity over the past 12 weeks
           * ============================================================ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="overflow-x-auto"
          >
            <ActivityHeatmap
              activities={dailyActivities}
              weeks={12}
            />
          </motion.div>

          {/* ============================================================
           * QUICK INSIGHTS SECTION
           * Shows key metrics and recommendations
           * ============================================================ */}
          {(weakAreas.length > 0 || recommendedModule) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <Card variant="bordered">
                <CardContent className="py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Recommended Next */}
                    {recommendedModule && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                        <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center">
                          <Target className="w-5 h-5 text-[var(--accent-primary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                            Recommended Next
                          </p>
                          <p className="font-semibold text-[var(--text-primary)] truncate">
                            {recommendedModule.moduleName}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {recommendedModule.progress > 0
                              ? `${Math.round(recommendedModule.progress)}% complete`
                              : 'Ready to start'}
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleContinueLearning}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    {/* Weak Areas */}
                    {weakAreas.length > 0 && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20">
                        <div className="w-10 h-10 rounded-lg bg-[var(--warning)]/20 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-[var(--warning)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                            Areas to Improve
                          </p>
                          <p className="font-semibold text-[var(--text-primary)] truncate">
                            {weakAreas.slice(0, 2).join(', ')}
                            {weakAreas.length > 2 && ` +${weakAreas.length - 2} more`}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            Quiz scores below 70%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ============================================================
           * CURRICULUM SECTION: Module Progress Grid
           * Shows all modules with progress, status, and action buttons
           * ============================================================ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {data?.modules && data.modules.length > 0 ? (
              <ModuleProgressList
                modules={data.modules}
                courseSlug="kcu-trading-mastery"
                title="Curriculum Progress"
              />
            ) : (
              <Card variant="bordered">
                <CardContent className="text-center py-12">
                  <GraduationCap className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    No Modules Found
                  </h3>
                  <p className="text-sm text-[var(--text-tertiary)] mb-6 max-w-sm mx-auto">
                    Your curriculum progress data may still be syncing. Try refreshing or explore the course catalog.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="secondary"
                      onClick={handleRefresh}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                      Sync Status
                    </Button>
                    <Button variant="primary" onClick={handleStudyMaterials}>
                      <BookOpen className="w-4 h-4 mr-2" />
                      Browse Curriculum
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </PageShell>
    </>
  );
}
