'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { LessonList } from '@/components/learn';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  BookOpen,
  Clock,
  Trophy,
  Play,
  CheckCircle2,
  Lock,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
} from 'lucide-react';
import Link from 'next/link';
import type { CourseModule, CourseLesson, LessonProgress, ModuleProgress, QuizAttempt } from '@/types/learning';

interface LessonWithProgress extends CourseLesson {
  progress?: LessonProgress;
}

interface ModuleDetailData {
  module: CourseModule;
  lessons: LessonWithProgress[];
  progress: ModuleProgress;
  quiz: {
    questionsCount: number;
    passingScore: number;
    bestAttempt: QuizAttempt | null;
    attemptsCount: number;
  } | null;
  prevModule: { slug: string; title: string } | null;
  nextModule: { slug: string; title: string; isLocked: boolean } | null;
  courseTitle: string;
}

export default function ModuleDetailPage() {
  const params = useParams();
  const courseSlug = params.courseSlug as string;
  const moduleSlug = params.moduleSlug as string;

  const [data, setData] = useState<ModuleDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (courseSlug && moduleSlug) {
      fetchModuleData();
    }
  }, [courseSlug, moduleSlug]);

  const fetchModuleData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/learn/courses/${courseSlug}/modules/${moduleSlug}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Module not found');
        }
        if (response.status === 403) {
          throw new Error('This module is locked');
        }
        throw new Error('Failed to fetch module');
      }

      const moduleData = await response.json();
      setData(moduleData);
    } catch (err) {
      console.error('Error fetching module:', err);
      setError(err instanceof Error ? err.message : 'Failed to load module');
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
            { label: 'Course', href: `/learn/${courseSlug}` },
            { label: 'Module' },
          ]}
        />
        <PageShell>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">
              Loading module...
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
            { label: 'Course', href: `/learn/${courseSlug}` },
            { label: 'Module' },
          ]}
        />
        <PageShell>
          <Card className="border-[var(--error)] bg-[var(--error)]/10">
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-4 text-center">
                {error?.includes('locked') ? (
                  <Lock className="w-12 h-12 text-[var(--text-muted)]" />
                ) : (
                  <AlertCircle className="w-12 h-12 text-[var(--error)]" />
                )}
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{error}</p>
                  <div className="flex gap-2 mt-4">
                    <Button variant="secondary" onClick={fetchModuleData}>
                      Try Again
                    </Button>
                    <Link href={`/learn/${courseSlug}`}>
                      <Button variant="ghost">Back to Course</Button>
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

  const { module, lessons, progress, quiz, prevModule, nextModule, courseTitle } = data;
  const isComplete = progress.completionPercent >= 100;
  const isStarted = progress.completedLessons > 0;
  const canTakeQuiz = isComplete || !module.requiresQuizPass;

  // Find first incomplete lesson or first lesson
  const nextLesson = lessons.find(l => !l.progress?.completed) || lessons[0];

  // Calculate total duration
  const totalDurationSeconds = lessons.reduce((sum, l) => sum + (l.videoDurationSeconds || 0), 0);

  return (
    <>
      <Header
        title={module.title}
        subtitle={module.description || undefined}
        breadcrumbs={[
          { label: 'Dashboard' },
          { label: 'Learn', href: '/learn' },
          { label: courseTitle, href: `/learn/${courseSlug}` },
          { label: `Module ${module.moduleNumber}` },
        ]}
      />

      <PageShell>
        <div className="space-y-6">
          {/* Module Progress Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  {/* Progress Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="default">Module {module.moduleNumber}</Badge>
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
                      ) : null}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                          {progress.completedLessons}/{progress.totalLessons}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">Lessons</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                          {Math.floor(totalDurationSeconds / 60)}m
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">Duration</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                          {quiz?.bestAttempt?.scorePercent
                            ? `${Math.round(quiz.bestAttempt.scorePercent)}%`
                            : '--'}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">Quiz Score</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">Module Progress</span>
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
                  <div className="flex flex-col gap-3 flex-shrink-0">
                    {nextLesson && (
                      <Link href={`/learn/${courseSlug}/${moduleSlug}/${nextLesson.slug}`}>
                        <Button size="lg" className="w-full">
                          <Play className="w-5 h-5 mr-2" />
                          {isStarted ? 'Continue' : 'Start Module'}
                        </Button>
                      </Link>
                    )}
                    {quiz && (
                      <Link href={`/learn/quiz/${module.id}`}>
                        <Button
                          variant={canTakeQuiz ? 'secondary' : 'ghost'}
                          size="lg"
                          className="w-full"
                          disabled={!canTakeQuiz}
                        >
                          <FileQuestion className="w-5 h-5 mr-2" />
                          {quiz.bestAttempt ? 'Retake Quiz' : 'Take Quiz'}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quiz Card (if exists) */}
          {quiz && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className={!canTakeQuiz ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileQuestion className="w-5 h-5" />
                      Module Quiz
                    </CardTitle>
                    {quiz.bestAttempt?.passed && (
                      <Badge variant="success">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Passed
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-[var(--text-secondary)]">
                        {quiz.questionsCount} questions | Pass: {quiz.passingScore}%
                      </p>
                      {quiz.bestAttempt && (
                        <p className="text-sm text-[var(--text-tertiary)]">
                          Best score: {Math.round(quiz.bestAttempt.scorePercent)}% |
                          Attempts: {quiz.attemptsCount}
                        </p>
                      )}
                      {!canTakeQuiz && (
                        <p className="text-sm text-[var(--text-muted)] flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Complete all lessons to unlock
                        </p>
                      )}
                    </div>
                    <Link href={`/learn/quiz/${module.id}`}>
                      <Button
                        variant={quiz.bestAttempt?.passed ? 'ghost' : 'primary'}
                        disabled={!canTakeQuiz}
                      >
                        {quiz.bestAttempt ? 'Retake' : 'Start Quiz'}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Lessons List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <LessonList
              lessons={lessons}
              courseSlug={courseSlug}
              moduleSlug={moduleSlug}
              isModuleLocked={progress.isLocked}
            />
          </motion.div>

          {/* Module Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between">
              {prevModule ? (
                <Link href={`/learn/${courseSlug}/${prevModule.slug}`}>
                  <Button variant="ghost" size="sm">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {prevModule.title}
                  </Button>
                </Link>
              ) : (
                <div />
              )}

              {nextModule && !nextModule.isLocked && (
                <Link href={`/learn/${courseSlug}/${nextModule.slug}`}>
                  <Button variant="ghost" size="sm">
                    {nextModule.title}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </PageShell>
    </>
  );
}
