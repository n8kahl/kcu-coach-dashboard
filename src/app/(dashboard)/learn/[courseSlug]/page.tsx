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
import { JourneyMap, ContinueLearning } from '@/components/learn';
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

      <PageShell>
        <div className="space-y-8">
          {/* Course Progress Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  {/* Thumbnail */}
                  <div className="w-full md:w-48 aspect-video rounded-lg overflow-hidden bg-[var(--bg-tertiary)] flex-shrink-0">
                    {course.thumbnailUrl ? (
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <GraduationCap className="w-12 h-12 text-[var(--text-muted)]" />
                      </div>
                    )}
                  </div>

                  {/* Progress Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-4">
                      {isComplete ? (
                        <Badge variant="success">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Course Complete
                        </Badge>
                      ) : isStarted ? (
                        <Badge variant="primary">
                          <Play className="w-3 h-3 mr-1" />
                          In Progress
                        </Badge>
                      ) : (
                        <Badge variant="default">Not Started</Badge>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                          {progress.completedLessons}/{progress.totalLessons}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">Lessons</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                          {progress.completedModules}/{progress.totalModules}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">Modules</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                          {formatWatchTime(progress.totalWatchTimeSeconds)}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">Watch Time</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                          {progress.totalQuizAttempts}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">Quizzes Taken</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">Overall Progress</span>
                        <span className={`font-bold ${isComplete ? 'text-[var(--profit)]' : 'text-[var(--text-primary)]'}`}>
                          {Math.round(progress.completionPercent)}%
                        </span>
                      </div>
                      <ProgressBar
                        value={progress.completionPercent}
                        variant={isComplete ? 'success' : 'gold'}
                        size="md"
                      />
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="flex-shrink-0">
                    {resumeLesson ? (
                      <Link href={`/learn/${courseSlug}/${resumeLesson.module.slug}/${resumeLesson.lesson.slug}`}>
                        <Button size="lg">
                          <Play className="w-5 h-5 mr-2" />
                          Continue Learning
                        </Button>
                      </Link>
                    ) : firstAvailableModule ? (
                      <Link href={`/learn/${courseSlug}/${firstAvailableModule.slug}`}>
                        <Button size="lg">
                          <Play className="w-5 h-5 mr-2" />
                          {isStarted ? 'Continue' : 'Start Course'}
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
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

          {/* Journey Map - Premium Timeline Visualization */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <JourneyMap
              modules={modules}
              courseSlug={courseSlug}
            />
          </motion.div>
        </div>

        {/* Sticky Resume Button - Appears when scrolling */}
        <AnimatePresence>
          {resumeLesson && (
            <StickyResumeButton
              courseSlug={courseSlug}
              moduleSlug={resumeLesson.module.slug}
              lessonSlug={resumeLesson.lesson.slug}
              lessonTitle={resumeLesson.lesson.title}
              lessonNumber={resumeLesson.lesson.lessonNumber}
            />
          )}
        </AnimatePresence>
      </PageShell>
    </>
  );
}

/**
 * Sticky Resume Button - Floats at bottom right when user scrolls down
 */
function StickyResumeButton({
  courseSlug,
  moduleSlug,
  lessonSlug,
  lessonTitle,
  lessonNumber,
}: {
  courseSlug: string;
  moduleSlug: string;
  lessonSlug: string;
  lessonTitle: string;
  lessonNumber: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show button after scrolling 300px
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Link href={`/learn/${courseSlug}/${moduleSlug}/${lessonSlug}`}>
            <motion.div
              className="flex items-center gap-3 px-5 py-3 rounded-full bg-[var(--accent-primary)] text-black font-semibold shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              style={{
                boxShadow: '0 8px 32px rgba(212, 175, 55, 0.4)',
              }}
            >
              <Play className="w-5 h-5" />
              <div className="text-left">
                <div className="text-xs opacity-80">Resume Lesson {lessonNumber}</div>
                <div className="text-sm font-bold truncate max-w-[200px]">{lessonTitle}</div>
              </div>
            </motion.div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
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
