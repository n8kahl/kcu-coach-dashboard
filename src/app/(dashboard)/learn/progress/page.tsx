'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ProgressOverview,
  ActivityHeatmap,
  ModuleProgressList,
  ContinueLearning,
  AchievementGrid,
} from '@/components/learn';
import { useLearnProgress } from '@/hooks/useLearnProgress';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  Download,
  RefreshCw,
  BookOpen,
  Trophy,
} from 'lucide-react';
import type {
  CourseProgress,
  LearningStreak,
  DailyActivity,
  CourseModule,
  ModuleProgress,
  Achievement,
  CourseLesson,
  LessonProgress,
} from '@/types/learning';

// Default course ID - in production this would come from context or URL
const DEFAULT_COURSE_ID = process.env.NEXT_PUBLIC_DEFAULT_COURSE_ID;

export default function LearnProgressPage() {
  const { overview, modules, achievements, loading, error, refresh } = useLearnProgress(DEFAULT_COURSE_ID);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  const handleDownloadReport = () => {
    const params = new URLSearchParams();
    if (DEFAULT_COURSE_ID) params.append('courseId', DEFAULT_COURSE_ID);
    params.append('format', 'csv');
    window.open(`/api/learn/compliance/report?${params}`, '_blank');
  };

  if (loading) {
    return (
      <>
        <Header
          title="Learning Progress"
          subtitle="Track your learning journey"
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learn' },
            { label: 'Progress' },
          ]}
        />
        <PageShell>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">
              Loading your progress...
            </span>
          </div>
        </PageShell>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header
          title="Learning Progress"
          subtitle="Track your learning journey"
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learn' },
            { label: 'Progress' },
          ]}
        />
        <PageShell>
          <Card className="border-[var(--error)] bg-[var(--error)]/10">
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-12 h-12 text-[var(--error)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{error}</p>
                  <Button variant="outline" onClick={handleRefresh} className="mt-4">
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  // Default values if data is missing
  const courseProgress: CourseProgress = overview?.courseProgress || {
    totalLessons: 0,
    completedLessons: 0,
    totalModules: 0,
    completedModules: 0,
    totalWatchTimeSeconds: 0,
    totalQuizAttempts: 0,
    bestQuizScores: [],
    completionPercent: 0,
  };

  const streak: LearningStreak = overview?.streak || {
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
    streakStartDate: null,
  };

  const recentActivity: DailyActivity[] = overview?.recentActivity || [];

  const modulesWithProgress = (modules || []).map(m => ({
    ...m,
    progress: m.progress || {
      moduleId: m.id,
      totalLessons: 0,
      completedLessons: 0,
      completionPercent: 0,
      isLocked: false,
      bestQuizScore: null,
      quizPassed: false,
    },
  })) as (CourseModule & { progress: ModuleProgress })[];

  return (
    <>
      <Header
        title="Learning Progress"
        subtitle="Track your learning journey"
        breadcrumbs={[
          { label: 'Dashboard' },
          { label: 'Learn' },
          { label: 'Progress' },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadReport}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        }
      />

      <PageShell>
        <div className="space-y-8">
          {/* Progress Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ProgressOverview progress={courseProgress} streak={streak} />
          </motion.div>

          {/* Continue Learning */}
          {overview?.resumeLesson && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <ContinueLearning
                lesson={overview.resumeLesson.lesson as unknown as CourseLesson}
                module={overview.resumeLesson.module as unknown as CourseModule}
                progress={overview.resumeLesson.progress as unknown as LessonProgress}
                courseSlug="kcu-trading-mastery"
              />
            </motion.div>
          )}

          {/* Two-column layout for activity and modules */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Activity Heatmap */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <ActivityHeatmap activities={recentActivity} weeks={12} />
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                      <BookOpen className="w-6 h-6 text-[var(--accent-primary)] mb-2" />
                      <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {courseProgress.completedLessons}
                      </p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        Lessons Completed
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                      <Trophy className="w-6 h-6 text-[var(--accent-primary)] mb-2" />
                      <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {courseProgress.completedModules}
                      </p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        Modules Completed
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                      <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {formatWatchTime(courseProgress.totalWatchTimeSeconds)}
                      </p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        Total Watch Time
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                      <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {courseProgress.totalQuizAttempts}
                      </p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        Quizzes Taken
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Module Progress */}
          {modulesWithProgress.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <ModuleProgressList
                modules={modulesWithProgress}
                courseSlug="kcu-trading-mastery"
              />
            </motion.div>
          )}

          {/* Achievements */}
          {achievements.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <AchievementGrid
                achievements={achievements as Achievement[]}
                showAll={false}
                maxDisplay={9}
              />
            </motion.div>
          )}
        </div>
      </PageShell>
    </>
  );
}

function formatWatchTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
