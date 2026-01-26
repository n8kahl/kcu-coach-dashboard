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
import type { Course, CourseProgress } from '@/types/learning';

interface CourseWithProgress extends Course {
  progress?: CourseProgress;
  modulesCount: number;
  lessonsCount: number;
  totalDurationMinutes: number;
  resumeLesson?: {
    slug: string;
    title: string;
    moduleSlug: string;
    lessonNumber: number;
  };
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
  const completedCourses = courses.filter(c => c.progress?.completionPercent === 100);
  const notStartedCourses = courses.filter(c => !c.progress || c.progress.completedLessons === 0);

  // Get most recently active course for hero
  const heroCourseCandidates = inProgressCourses.length > 0 ? inProgressCourses : notStartedCourses;
  const heroCourse = heroCourseCandidates[0];

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
          {/* Continue Watching Hero Section */}
          {heroCourse && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ContinueWatchingHero course={heroCourse} />
            </motion.div>
          )}

          {/* Quick Stats */}
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
              value={completedCourses.length}
            />
          </motion.div>

          {/* In Progress Swimlane */}
          {inProgressCourses.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <CourseSwimLane
                title="Continue Learning"
                subtitle="Pick up where you left off"
                courses={inProgressCourses}
                icon={<Play className="w-5 h-5" />}
              />
            </motion.div>
          )}

          {/* New Arrivals / Not Started Swimlane */}
          {notStartedCourses.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <CourseSwimLane
                title="Start Learning"
                subtitle="Begin your trading journey"
                courses={notStartedCourses}
                icon={<Sparkles className="w-5 h-5" />}
              />
            </motion.div>
          )}

          {/* Completed Swimlane */}
          {completedCourses.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <CourseSwimLane
                title="Completed"
                subtitle="Review your achievements"
                courses={completedCourses}
                icon={<CheckCircle2 className="w-5 h-5" />}
              />
            </motion.div>
          )}

          {/* Empty State */}
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

/**
 * Continue Watching Hero - Cinematic hero section for the most active course
 */
function ContinueWatchingHero({ course }: { course: CourseWithProgress }) {
  const isStarted = course.progress && course.progress.completedLessons > 0;
  const progressPercent = course.progress?.completionPercent || 0;

  // Build resume link
  let resumeLink = `/learn/${course.slug}`;
  let resumeText = 'Start Course';

  if (course.resumeLesson) {
    resumeLink = `/learn/${course.slug}/${course.resumeLesson.moduleSlug}/${course.resumeLesson.slug}`;
    resumeText = `Resume Lesson ${course.resumeLesson.lessonNumber}`;
  } else if (isStarted) {
    resumeText = 'Continue Learning';
  }

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Background with blur effect */}
      <div className="absolute inset-0">
        {course.thumbnailUrl ? (
          <>
            <img
              src={course.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover scale-110"
            />
            <div className="absolute inset-0 backdrop-blur-xl" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary)]" />
        )}
        {/* Dark overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center gap-8">
        {/* Left: Text Content */}
        <div className="flex-1 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Badge variant="gold" className="mb-3">
              {isStarted ? 'Continue Watching' : 'Featured Course'}
            </Badge>
          </motion.div>

          <motion.h1
            className="text-3xl md:text-4xl font-bold text-white"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {course.title}
          </motion.h1>

          {course.description && (
            <motion.p
              className="text-lg text-white/70 max-w-xl line-clamp-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {course.description}
            </motion.p>
          )}

          {/* Stats */}
          <motion.div
            className="flex items-center gap-6 text-sm text-white/60"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {course.modulesCount} modules
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {Math.round(course.totalDurationMinutes / 60)}h
            </span>
            <span className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              {course.lessonsCount} lessons
            </span>
          </motion.div>

          {/* Progress Bar */}
          {isStarted && (
            <motion.div
              className="space-y-2 max-w-md"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Progress</span>
                <span className="text-white font-medium">{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[var(--accent-primary)] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )}

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Link href={resumeLink}>
              <Button size="lg" className="mt-4 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-black font-semibold">
                <Play className="w-5 h-5 mr-2" />
                {resumeText}
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Right: Course Thumbnail */}
        <motion.div
          className="hidden lg:block w-80 flex-shrink-0"
          initial={{ opacity: 0, scale: 0.95, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="relative rounded-xl overflow-hidden shadow-2xl group">
            {course.thumbnailUrl ? (
              <img
                src={course.thumbnailUrl}
                alt={course.title}
                className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full aspect-video bg-[var(--bg-tertiary)] flex items-center justify-center">
                <GraduationCap className="w-16 h-16 text-[var(--text-muted)]" />
              </div>
            )}
            {/* Play overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
                <Play className="w-8 h-8 text-black ml-1" />
              </div>
            </div>
            {/* Glass border effect */}
            <div className="absolute inset-0 border-2 border-white/10 rounded-xl pointer-events-none" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * Course Swimlane - Horizontal scrolling row of course cards
 */
function CourseSwimLane({
  title,
  subtitle,
  courses,
  icon,
}: {
  title: string;
  subtitle: string;
  courses: CourseWithProgress[];
  icon: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    updateScrollButtons();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', updateScrollButtons);
      return () => ref.removeEventListener('scroll', updateScrollButtons);
    }
  }, [courses]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320; // Card width + gap
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
            {icon}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
            <p className="text-sm text-[var(--text-tertiary)]">{subtitle}</p>
          </div>
        </div>
        {/* Scroll Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`p-2 rounded-full transition-all ${
              canScrollLeft
                ? 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                : 'opacity-30 cursor-not-allowed text-[var(--text-muted)]'
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
                : 'opacity-30 cursor-not-allowed text-[var(--text-muted)]'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrolling Container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {courses.map((course, index) => (
          <motion.div
            key={course.id}
            className="flex-shrink-0 w-72 snap-start"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <SwimLaneCourseCard course={course} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/**
 * SwimLane Course Card - Compact card for horizontal scrolling
 */
function SwimLaneCourseCard({ course }: { course: CourseWithProgress }) {
  const progress = course.progress;
  const isStarted = progress && progress.completedLessons > 0;
  const isComplete = progress && progress.completionPercent >= 100;

  return (
    <Link href={`/learn/${course.slug}`}>
      <Card className="h-full hover:border-[var(--accent-primary)] transition-all cursor-pointer group overflow-hidden backdrop-blur-sm bg-[var(--bg-card)]/80">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-[var(--bg-tertiary)] overflow-hidden">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <GraduationCap className="w-12 h-12 text-[var(--text-muted)]" />
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-2 right-2">
            {isComplete ? (
              <Badge variant="success" size="sm">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            ) : isStarted ? (
              <Badge variant="primary" size="sm">
                {Math.round(progress.completionPercent)}%
              </Badge>
            ) : null}
          </div>

          {/* Glassmorphism Play overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)] flex items-center justify-center transform group-hover:scale-110 transition-transform">
              <Play className="w-6 h-6 text-black ml-0.5" />
            </div>
          </div>

          {/* Progress bar at bottom of thumbnail */}
          {isStarted && !isComplete && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
              <div
                className="h-full bg-[var(--accent-primary)]"
                style={{ width: `${progress.completionPercent}%` }}
              />
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <h3 className="font-semibold text-[var(--text-primary)] line-clamp-1 group-hover:text-[var(--accent-primary)] transition-colors">
            {course.title}
          </h3>
          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-tertiary)]">
            <span>{course.modulesCount} modules</span>
            <span>•</span>
            <span>{Math.round(course.totalDurationMinutes / 60)}h</span>
          </div>
        </CardContent>
      </Card>
    </Link>
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
