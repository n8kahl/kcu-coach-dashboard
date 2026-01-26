'use client';

// Force dynamic rendering to prevent navigation caching issues
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type { Course, CourseProgress, CourseLesson, CourseModule, LessonProgress } from '@/types/learning';

interface CourseWithProgress extends Course {
  progress?: CourseProgress;
  modulesCount: number;
  lessonsCount: number;
  totalDurationMinutes: number;
  resumeLesson?: {
    lesson: CourseLesson;
    module: CourseModule;
    progress: LessonProgress;
  } | null;
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

  // Categorize courses
  const inProgressCourses = courses.filter(c => c.progress && c.progress.completedLessons > 0 && c.progress.completionPercent < 100);
  const newCourses = courses.filter(c => !c.progress || c.progress.completedLessons === 0);
  const completedCourses = courses.filter(c => c.progress && c.progress.completionPercent >= 100);

  // Find the most recently active course with progress
  const continueCourse = inProgressCourses.length > 0 ? inProgressCourses[0] : null;

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

      <PageShell maxWidth="full" padding="sm">
        <div className="space-y-10">
          {/* Hero Section - Continue Watching */}
          {continueCourse && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl"
            >
              <HeroSection course={continueCourse} />
            </motion.section>
          )}

          {/* Quick Stats - Glassmorphism style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
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

          {/* In Progress Swimlane */}
          {inProgressCourses.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Swimlane
                title="Continue Learning"
                subtitle={`${inProgressCourses.length} course${inProgressCourses.length > 1 ? 's' : ''} in progress`}
                courses={inProgressCourses}
                icon={<Play className="w-5 h-5 text-[var(--accent-primary)]" />}
              />
            </motion.section>
          )}

          {/* New Courses Swimlane */}
          {newCourses.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Swimlane
                title="Start New Course"
                subtitle="Ready to learn something new?"
                courses={newCourses}
                icon={<Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />}
              />
            </motion.section>
          )}

          {/* Completed Swimlane */}
          {completedCourses.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Swimlane
                title="Completed Courses"
                subtitle={`${completedCourses.length} course${completedCourses.length > 1 ? 's' : ''} mastered`}
                courses={completedCourses}
                icon={<CheckCircle2 className="w-5 h-5 text-[var(--profit)]" />}
              />
            </motion.section>
          )}

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
      </PageShell>
    </>
  );
}

// Hero Section - Cinematic Continue Watching
function HeroSection({ course }: { course: CourseWithProgress }) {
  const progress = course.progress;

  return (
    <div className="relative h-[320px] md:h-[380px] overflow-hidden">
      {/* Background Image with Blur */}
      <div className="absolute inset-0">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary)]" />
        )}
        {/* Gradient overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
        {/* Glassmorphism accent */}
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            background: 'rgba(0,0,0,0.4)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-6 md:p-10 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Badge variant="gold" className="mb-3">
            <Play className="w-3 h-3 mr-1" />
            Continue Watching
          </Badge>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl md:text-4xl font-bold text-white mb-2"
          style={{
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          {course.title}
        </motion.h2>

        {course.description && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-white/70 text-sm md:text-base mb-4 line-clamp-2 max-w-2xl"
          >
            {course.description}
          </motion.p>
        )}

        {/* Progress Bar */}
        {progress && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-4"
          >
            <div className="flex items-center gap-4 text-sm text-white/70 mb-2">
              <span>{progress.completedLessons} of {progress.totalLessons} lessons</span>
              <span className="text-[var(--accent-primary)] font-semibold">
                {Math.round(progress.completionPercent)}% Complete
              </span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden max-w-md">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress.completionPercent}%` }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--profit)] rounded-full"
              />
            </div>
          </motion.div>
        )}

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-3"
        >
          <Link href={`/learn/${course.slug}`}>
            <Button
              size="lg"
              className="bg-white text-black hover:bg-white/90 font-semibold px-8"
            >
              <Play className="w-5 h-5 mr-2 fill-current" />
              Resume Learning
            </Button>
          </Link>
          <Link href={`/learn/${course.slug}`}>
            <Button
              variant="ghost"
              size="lg"
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <BookOpen className="w-5 h-5 mr-2" />
              View Course
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

// Horizontal Scroll Swimlane
function Swimlane({
  title,
  subtitle,
  courses,
  icon,
}: {
  title: string;
  subtitle?: string;
  courses: CourseWithProgress[];
  icon?: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    el?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [courses]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (el) {
      const cardWidth = 320;
      const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">{title}</h3>
            {subtitle && (
              <p className="text-sm text-[var(--text-tertiary)]">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Scroll Buttons */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`p-2 rounded-full transition-all ${
              canScrollLeft
                ? 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`p-2 rounded-full transition-all ${
              canScrollRight
                ? 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {courses.map((course, index) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex-shrink-0 w-[280px] md:w-[320px] snap-start"
          >
            <SwimlaneCourseCard course={course} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Swimlane Course Card with Glassmorphism
function SwimlaneCourseCard({ course }: { course: CourseWithProgress }) {
  const progress = course.progress;
  const isStarted = progress && progress.completedLessons > 0;
  const isComplete = progress && progress.completionPercent >= 100;

  return (
    <Link href={`/learn/${course.slug}`}>
      <Card
        className="h-full overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-[var(--accent-primary)]/10"
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video bg-[var(--bg-tertiary)] overflow-hidden">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary)]">
              <GraduationCap className="w-12 h-12 text-[var(--text-muted)]" />
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-2 right-2">
            {isComplete ? (
              <Badge variant="success" className="shadow-lg">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            ) : isStarted ? (
              <Badge variant="primary" className="shadow-lg">
                {Math.round(progress!.completionPercent)}%
              </Badge>
            ) : (
              <Badge variant="default" className="shadow-lg">New</Badge>
            )}
          </div>

          {/* Play Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="w-14 h-14 rounded-full bg-[var(--accent-primary)] flex items-center justify-center shadow-xl"
            >
              <Play className="w-7 h-7 text-black ml-1 fill-current" />
            </motion.div>
          </div>

          {/* Progress bar at bottom */}
          {isStarted && !isComplete && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
              <div
                className="h-full bg-[var(--accent-primary)]"
                style={{ width: `${progress!.completionPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4">
          <h4 className="font-semibold text-[var(--text-primary)] line-clamp-1 group-hover:text-[var(--accent-primary)] transition-colors">
            {course.title}
          </h4>

          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {course.modulesCount} modules
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {Math.round(course.totalDurationMinutes / 60)}h
            </span>
          </div>

          {/* CTA */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-primary)]">
            <span className="text-xs font-medium text-[var(--accent-primary)]">
              {isComplete ? 'Review Course' : isStarted ? 'Continue' : 'Start Learning'}
            </span>
            <ArrowRight className="w-4 h-4 text-[var(--accent-primary)] group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickStatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card
      style={{
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
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
