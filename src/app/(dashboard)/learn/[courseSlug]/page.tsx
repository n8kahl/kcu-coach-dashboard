'use client';

// Force dynamic rendering to prevent navigation caching issues
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { ContinueLearning } from '@/components/learn';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  BookOpen,
  Clock,
  Trophy,
  GraduationCap,
  Play,
  CheckCircle2,
  Lock,
  Sparkles,
  Star,
  ChevronRight,
  RotateCcw,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import type { Course, CourseModule, CourseProgress, ModuleProgress, CourseLesson, LessonProgress } from '@/types/learning';

interface ModuleWithProgress extends CourseModule {
  progress: ModuleProgress;
}

interface CourseDetailData {
  course: Course;
  modules: ModuleWithProgress[];
  progress: CourseProgress;
  resumeLesson: {
    lesson: CourseLesson;
    module: CourseModule;
    progress: LessonProgress;
  } | null;
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseSlug = params.courseSlug as string;

  const [data, setData] = useState<CourseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (courseSlug) {
      fetchCourseData();
    }
  }, [courseSlug]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/learn/courses/${courseSlug}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Course not found');
        }
        throw new Error('Failed to fetch course');
      }

      const courseData = await response.json();
      setData(courseData);
    } catch (err) {
      console.error('Error fetching course:', err);
      setError(err instanceof Error ? err.message : 'Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header
          title="Loading..."
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learn', href: '/learn' },
            { label: 'Course' },
          ]}
        />
        <PageShell>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">
              Loading course...
            </span>
          </div>
        </PageShell>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Header
          title="Error"
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learn', href: '/learn' },
            { label: 'Course' },
          ]}
        />
        <PageShell>
          <Card className="border-[var(--error)] bg-[var(--error)]/10">
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-12 h-12 text-[var(--error)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{error}</p>
                  <div className="flex gap-2 mt-4">
                    <Button variant="secondary" onClick={fetchCourseData}>
                      Try Again
                    </Button>
                    <Link href="/learn">
                      <Button variant="ghost">Back to Courses</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  const { course, modules, progress, resumeLesson } = data;
  const isComplete = progress.completionPercent >= 100;
  const isStarted = progress.completedLessons > 0;

  // Find the first available module for starting
  const firstAvailableModule = modules.find(m => !m.progress.isLocked);

  // Build resume URL
  const resumeUrl = resumeLesson
    ? `/learn/${courseSlug}/${resumeLesson.module.slug}/${resumeLesson.lesson.slug}`
    : firstAvailableModule
    ? `/learn/${courseSlug}/${firstAvailableModule.slug}`
    : null;

  return (
    <>
      <Header
        title={course.title}
        subtitle={course.description || undefined}
        breadcrumbs={[
          { label: 'Dashboard' },
          { label: 'Learn', href: '/learn' },
          { label: course.title },
        ]}
        actions={
          <Link href="/learn/progress">
            <Button variant="secondary" size="sm">
              <Trophy className="w-4 h-4 mr-2" />
              My Progress
            </Button>
          </Link>
        }
      />

      <PageShell maxWidth="full" padding="sm">
        <div className="space-y-8 pb-24">
          {/* Course Hero Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="relative overflow-hidden rounded-2xl">
              {/* Background */}
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
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/50" />
                <div
                  className="absolute inset-0"
                  style={{
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                />
              </div>

              {/* Content */}
              <div className="relative p-6 md:p-10">
                <div className="flex flex-col md:flex-row md:items-start gap-8">
                  {/* Left: Course Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-4">
                      {isComplete ? (
                        <Badge variant="success" className="shadow-lg">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Course Complete
                        </Badge>
                      ) : isStarted ? (
                        <Badge variant="gold" className="shadow-lg">
                          <Play className="w-3 h-3 mr-1" />
                          In Progress
                        </Badge>
                      ) : (
                        <Badge variant="default" className="shadow-lg">New</Badge>
                      )}
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                      {course.title}
                    </h1>

                    {course.description && (
                      <p className="text-white/70 text-sm md:text-base mb-6 max-w-2xl">
                        {course.description}
                      </p>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <StatBadge
                        value={`${progress.completedLessons}/${progress.totalLessons}`}
                        label="Lessons"
                        icon={<BookOpen className="w-4 h-4" />}
                      />
                      <StatBadge
                        value={`${progress.completedModules}/${progress.totalModules}`}
                        label="Modules"
                        icon={<GraduationCap className="w-4 h-4" />}
                      />
                      <StatBadge
                        value={formatWatchTime(progress.totalWatchTimeSeconds)}
                        label="Watch Time"
                        icon={<Clock className="w-4 h-4" />}
                      />
                      <StatBadge
                        value={progress.totalQuizAttempts.toString()}
                        label="Quizzes"
                        icon={<Target className="w-4 h-4" />}
                      />
                    </div>

                    {/* Progress Bar */}
                    <div className="max-w-md">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white/70">Course Progress</span>
                        <span className={`font-bold ${isComplete ? 'text-[var(--profit)]' : 'text-[var(--accent-primary)]'}`}>
                          {Math.round(progress.completionPercent)}%
                        </span>
                      </div>
                      <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress.completionPercent}%` }}
                          transition={{ delay: 0.3, duration: 0.8 }}
                          className={`h-full rounded-full ${
                            isComplete
                              ? 'bg-gradient-to-r from-[var(--profit)] to-emerald-400'
                              : 'bg-gradient-to-r from-[var(--accent-primary)] to-amber-400'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: CTA */}
                  {resumeUrl && (
                    <div className="flex-shrink-0">
                      <Link href={resumeUrl}>
                        <Button
                          size="lg"
                          className="bg-white text-black hover:bg-white/90 font-semibold px-8 shadow-xl"
                        >
                          <Play className="w-5 h-5 mr-2 fill-current" />
                          {resumeLesson ? 'Resume Learning' : isStarted ? 'Continue' : 'Start Course'}
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Resume Learning Card */}
          {resumeLesson && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <ContinueLearning
                lesson={resumeLesson.lesson}
                module={resumeLesson.module}
                progress={resumeLesson.progress}
                courseSlug={courseSlug}
              />
            </motion.div>
          )}

          {/* Journey Map - Timeline Visualization */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Your Learning Journey</h2>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                Complete each module to unlock the next
              </p>
            </div>

            <JourneyMap modules={modules} courseSlug={courseSlug} />
          </motion.div>
        </div>

        {/* Sticky Resume Button */}
        <AnimatePresence>
          {resumeUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 right-6 z-50"
            >
              <Link href={resumeUrl}>
                <Button
                  size="lg"
                  className="shadow-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90 text-black font-semibold px-6"
                  style={{
                    boxShadow: '0 8px 32px rgba(245, 158, 11, 0.4)',
                  }}
                >
                  <Play className="w-5 h-5 mr-2 fill-current" />
                  {resumeLesson ? 'Resume' : 'Start'}
                </Button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </PageShell>
    </>
  );
}

// Stat Badge for hero section
function StatBadge({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="p-3 rounded-xl"
      style={{
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-2 text-white/50 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

// Journey Map Visualization
function JourneyMap({
  modules,
  courseSlug,
}: {
  modules: ModuleWithProgress[];
  courseSlug: string;
}) {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-[var(--border-primary)]" />

      {/* Modules */}
      <div className="space-y-6">
        {modules.map((module, index) => {
          const isLocked = module.progress.isLocked;
          const isComplete = module.progress.completionPercent >= 100;
          const isMastered = isComplete && module.progress.quizPassed;
          const isInProgress = !isComplete && module.progress.completedLessons > 0;

          return (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {/* Timeline Node */}
              <div
                className={`absolute left-5 top-6 w-7 h-7 rounded-full border-4 flex items-center justify-center z-10 ${
                  isLocked
                    ? 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]'
                    : isMastered
                    ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                    : isComplete
                    ? 'bg-[var(--profit)] border-[var(--profit)]'
                    : isInProgress
                    ? 'bg-[var(--warning)] border-[var(--warning)]'
                    : 'bg-[var(--bg-secondary)] border-[var(--border-secondary)]'
                }`}
                style={
                  isMastered
                    ? { boxShadow: '0 0 20px rgba(245, 158, 11, 0.5)' }
                    : isComplete
                    ? { boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)' }
                    : undefined
                }
              >
                {isLocked ? (
                  <Lock className="w-3 h-3 text-[var(--text-muted)]" />
                ) : isMastered ? (
                  <Star className="w-3 h-3 text-black fill-current" />
                ) : isComplete ? (
                  <CheckCircle2 className="w-3 h-3 text-white" />
                ) : isInProgress ? (
                  <Play className="w-3 h-3 text-black fill-current" />
                ) : (
                  <span className="text-xs font-bold text-[var(--text-tertiary)]">{index + 1}</span>
                )}
              </div>

              {/* Module Card */}
              <div className="ml-16">
                <JourneyModuleCard
                  module={module}
                  courseSlug={courseSlug}
                  index={index}
                  isLocked={isLocked}
                  isComplete={isComplete}
                  isMastered={isMastered}
                  isInProgress={isInProgress}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// Journey Module Card with Glassmorphism
function JourneyModuleCard({
  module,
  courseSlug,
  index,
  isLocked,
  isComplete,
  isMastered,
  isInProgress,
}: {
  module: ModuleWithProgress;
  courseSlug: string;
  index: number;
  isLocked: boolean;
  isComplete: boolean;
  isMastered: boolean;
  isInProgress: boolean;
}) {
  const cardContent = (
    <Card
      className={`overflow-hidden transition-all duration-300 ${
        isLocked
          ? 'cursor-not-allowed'
          : 'cursor-pointer hover:scale-[1.01] hover:shadow-lg'
      } ${
        isMastered
          ? 'border-[var(--accent-primary)]/50 hover:border-[var(--accent-primary)]'
          : isComplete
          ? 'border-[var(--profit)]/50 hover:border-[var(--profit)]'
          : ''
      }`}
      style={
        isLocked
          ? {
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              background: 'rgba(var(--bg-secondary-rgb), 0.5)',
            }
          : isMastered
          ? {
              boxShadow: '0 4px 20px rgba(245, 158, 11, 0.15)',
            }
          : undefined
      }
    >
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Module Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant={
                  isLocked
                    ? 'default'
                    : isMastered
                    ? 'gold'
                    : isComplete
                    ? 'success'
                    : isInProgress
                    ? 'primary'
                    : 'default'
                }
              >
                {isLocked ? (
                  <>
                    <Lock className="w-3 h-3 mr-1" />
                    Locked
                  </>
                ) : isMastered ? (
                  <>
                    <Sparkles className="w-3 h-3 mr-1" />
                    Mastered
                  </>
                ) : isComplete ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Complete
                  </>
                ) : isInProgress ? (
                  <>
                    <Play className="w-3 h-3 mr-1" />
                    In Progress
                  </>
                ) : (
                  'Ready'
                )}
              </Badge>

              {module.progress.bestQuizScore != null && module.progress.bestQuizScore > 0 && (
                <Badge variant="default" className="text-xs">
                  <Trophy className="w-3 h-3 mr-1 text-[var(--accent-primary)]" />
                  Quiz: {Math.round(module.progress.bestQuizScore)}%
                </Badge>
              )}
            </div>

            <h3
              className={`text-lg font-semibold mb-1 ${
                isLocked
                  ? 'text-[var(--text-muted)]'
                  : 'text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]'
              }`}
            >
              Module {module.moduleNumber}: {module.title}
            </h3>

            {module.description && (
              <p
                className={`text-sm line-clamp-2 ${
                  isLocked ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                {module.description}
              </p>
            )}

            {/* Unlock reason for locked modules */}
            {isLocked && module.progress.unlockReason && (
              <p className="text-xs text-[var(--text-muted)] mt-2 italic">
                {module.progress.unlockReason}
              </p>
            )}
          </div>

          {/* Progress and CTA */}
          <div className="flex items-center gap-4">
            {/* Progress */}
            <div className="text-center">
              <p
                className={`text-2xl font-bold ${
                  isLocked
                    ? 'text-[var(--text-muted)]'
                    : isMastered
                    ? 'text-[var(--accent-primary)]'
                    : isComplete
                    ? 'text-[var(--profit)]'
                    : 'text-[var(--text-primary)]'
                }`}
              >
                {Math.round(module.progress.completionPercent)}%
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                {module.progress.completedLessons}/{module.progress.totalLessons} lessons
              </p>
            </div>

            {/* CTA Arrow */}
            {!isLocked && (
              <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-1 transition-all" />
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {!isLocked && (
          <div className="mt-4">
            <ProgressBar
              value={module.progress.completionPercent}
              variant={isMastered ? 'gold' : isComplete ? 'success' : 'default'}
              size="sm"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLocked) {
    return <div>{cardContent}</div>;
  }

  return (
    <Link href={`/learn/${courseSlug}/${module.slug}`}>
      {cardContent}
    </Link>
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
