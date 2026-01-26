'use client';

// Force dynamic rendering to prevent navigation caching issues
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  BookOpen,
  Play,
  CheckCircle2,
  Clock,
  Trophy,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import Link from 'next/link';
import type { Course, CourseProgress } from '@/types/learning';

interface CourseWithProgress extends Course {
  progress?: CourseProgress;
  modulesCount: number;
  lessonsCount: number;
  totalDurationMinutes: number;
}

export default function LearnPage() {
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/learn/courses');
      if (!response.ok) throw new Error('Failed to fetch courses');

      const data = await response.json();
      setCourses(data.courses);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header
          title="Learning Center"
          subtitle="Master trading with our comprehensive curriculum"
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learn' },
          ]}
        />
        <PageShell>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">
              Loading courses...
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
          title="Learning Center"
          subtitle="Master trading with our comprehensive curriculum"
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learn' },
          ]}
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

  return (
    <>
      <Header
        title="Learning Center"
        subtitle="Master trading with our comprehensive curriculum"
        breadcrumbs={[
          { label: 'Dashboard' },
          { label: 'Learn' },
        ]}
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
          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <QuickStatCard
              icon={<BookOpen className="w-5 h-5" />}
              label="Total Lessons"
              value={courses.reduce((sum, c) => sum + c.lessonsCount, 0)}
            />
            <QuickStatCard
              icon={<Clock className="w-5 h-5" />}
              label="Total Duration"
              value={`${Math.round(courses.reduce((sum, c) => sum + c.totalDurationMinutes, 0) / 60)}h`}
            />
            <QuickStatCard
              icon={<GraduationCap className="w-5 h-5" />}
              label="Modules"
              value={courses.reduce((sum, c) => sum + c.modulesCount, 0)}
            />
            <QuickStatCard
              icon={<Trophy className="w-5 h-5" />}
              label="Certificates"
              value={courses.filter(c => c.progress?.completionPercent === 100).length}
            />
          </motion.div>

          {/* Courses Grid */}
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

            {courses.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-12">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <BookOpen className="w-16 h-16 text-[var(--text-muted)]" />
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">No courses available</p>
                      <p className="text-sm text-[var(--text-tertiary)] mt-1">
                        Check back later for new content
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageShell>
    </>
  );
}

function QuickStatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
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

function CourseCard({ course }: { course: CourseWithProgress }) {
  const progress = course.progress;
  const isStarted = progress && progress.completedLessons > 0;
  const isComplete = progress && progress.completionPercent >= 100;

  return (
    <Link href={`/learn/${course.slug}`}>
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
            <div className="w-full h-full flex items-center justify-center">
              <GraduationCap className="w-16 h-16 text-[var(--text-muted)]" />
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
              <BookOpen className="w-4 h-4" />
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
                <span className={`font-medium ${isComplete ? 'text-[var(--profit)]' : 'text-[var(--text-secondary)]'}`}>
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
