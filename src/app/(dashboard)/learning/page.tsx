'use client';

/**
 * Learning Page - Course Library
 *
 * Displays all available courses from the native course_* schema.
 * Users can see their progress and navigate to individual courses.
 */

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { usePageContext } from '@/components/ai';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Clock,
  CheckCircle2,
  Play,
  Loader2,
  AlertCircle,
  GraduationCap,
  Trophy,
  ArrowRight,
  Layers,
} from 'lucide-react';
import Link from 'next/link';

interface CourseProgress {
  totalLessons: number;
  completedLessons: number;
  totalModules: number;
  completedModules: number;
  completionPercent: number;
  totalWatchTimeSeconds: number;
}

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  sortOrder: number;
  modulesCount: number;
  lessonsCount: number;
  totalDurationMinutes: number;
  progress: CourseProgress | null;
}

interface LearningStats {
  totalCourses: number;
  totalModules: number;
  totalLessons: number;
  totalHours: number;
  completedLessons: number;
  certificates: number;
}

export default function LearningPage() {
  usePageContext();
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/learn/courses');
      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }

      const data = await response.json();
      setCourses(data.courses || []);

      // Calculate stats
      const totalModules = data.courses.reduce((sum: number, c: Course) => sum + c.modulesCount, 0);
      const totalLessons = data.courses.reduce((sum: number, c: Course) => sum + c.lessonsCount, 0);
      const totalMinutes = data.courses.reduce((sum: number, c: Course) => sum + c.totalDurationMinutes, 0);
      const completedLessons = data.courses.reduce(
        (sum: number, c: Course) => sum + (c.progress?.completedLessons || 0),
        0
      );
      const certificates = data.courses.filter(
        (c: Course) => c.progress && c.progress.completionPercent >= 100
      ).length;

      setStats({
        totalCourses: data.courses.length,
        totalModules,
        totalLessons,
        totalHours: Math.round(totalMinutes / 60),
        completedLessons,
        certificates,
      });
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError('Failed to load courses. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header
          title="Learning Center"
          subtitle="Master trading with the KCU curriculum"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Learning' }]}
        />
        <PageShell>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">Loading courses...</span>
          </div>
        </PageShell>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header
          title="Learning Center"
          subtitle="Master trading with the KCU curriculum"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Learning' }]}
        />
        <PageShell>
          <Card className="border-[var(--error)] bg-[var(--error)]/10">
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-12 h-12 text-[var(--error)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{error}</p>
                  <Button variant="secondary" onClick={fetchCourses} className="mt-4">
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

  if (courses.length === 0) {
    return (
      <>
        <Header
          title="Learning Center"
          subtitle="Master trading with the KCU curriculum"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Learning' }]}
        />
        <PageShell>
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4 text-center">
                <GraduationCap className="w-16 h-16 text-[var(--text-muted)]" />
                <div>
                  <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                    No Courses Available
                  </h3>
                  <p className="text-[var(--text-secondary)]">
                    Courses are being set up. Check back soon!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  const overallProgress =
    stats && stats.totalLessons > 0
      ? Math.round((stats.completedLessons / stats.totalLessons) * 100)
      : 0;

  return (
    <>
      <Header
        title="Learning Center"
        subtitle="Master trading with the KCU curriculum"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Learning' }]}
        actions={
          <Link href="/learn/progress">
            <Button variant="secondary" size="sm">
              <Trophy className="w-4 h-4 mr-2" />
              View Progress
            </Button>
          </Link>
        }
      />

      <PageShell>
        <div className="space-y-8">
          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <StatCard
              icon={<BookOpen className="w-5 h-5" />}
              label="Total Lessons"
              value={stats?.totalLessons || 0}
            />
            <StatCard
              icon={<Clock className="w-5 h-5" />}
              label="Total Content"
              value={`${stats?.totalHours || 0}h`}
            />
            <StatCard
              icon={<Layers className="w-5 h-5" />}
              label="Modules"
              value={stats?.totalModules || 0}
            />
            <StatCard
              icon={<Trophy className="w-5 h-5" />}
              label="Completed"
              value={`${overallProgress}%`}
            />
          </motion.div>

          {/* Course Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <CourseCard course={course} />
              </motion.div>
            ))}
          </div>
        </div>
      </PageShell>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
            <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CourseCard({ course }: { course: Course }) {
  const progress = course.progress;
  const isStarted = progress && progress.completedLessons > 0;
  const isComplete = progress && progress.completionPercent >= 100;

  return (
    <Link href={`/learning/${course.slug}`}>
      <Card className="h-full hover:border-[var(--accent-primary)] transition-all cursor-pointer group">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-[var(--bg-tertiary)] overflow-hidden">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-primary)]/5">
              <GraduationCap className="w-16 h-16 text-[var(--accent-primary)]/50" />
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-3 right-3">
            {isComplete ? (
              <Badge variant="success">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            ) : isStarted ? (
              <Badge variant="primary">
                <Play className="w-3 h-3 mr-1" />
                In Progress
              </Badge>
            ) : (
              <Badge variant="default">New</Badge>
            )}
          </div>

          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
              <Play className="w-8 h-8 text-black ml-1" />
            </div>
          </div>
        </div>

        <CardHeader className="pb-3">
          <h3 className="font-semibold text-lg text-[var(--text-primary)] line-clamp-2">
            {course.title}
          </h3>
          {course.description && (
            <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mt-1">
              {course.description}
            </p>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-[var(--text-tertiary)] mb-3">
            <span className="flex items-center gap-1">
              <Layers className="w-4 h-4" />
              {course.modulesCount} modules
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {Math.round(course.totalDurationMinutes / 60)}h
            </span>
          </div>

          {/* Progress */}
          {progress && isStarted && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-tertiary)]">
                  {progress.completedLessons}/{progress.totalLessons} lessons
                </span>
                <span
                  className={`font-medium ${isComplete ? 'text-[var(--profit)]' : 'text-[var(--text-secondary)]'}`}
                >
                  {Math.round(progress.completionPercent)}%
                </span>
              </div>
              <ProgressBar
                value={progress.completionPercent}
                variant={isComplete ? 'success' : 'gold'}
                size="sm"
              />
            </div>
          )}

          {/* CTA */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm font-medium text-[var(--accent-primary)] group-hover:underline">
              {isComplete ? 'Review Course' : isStarted ? 'Continue Learning' : 'Start Course'}
            </span>
            <ArrowRight className="w-4 h-4 text-[var(--accent-primary)] group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
