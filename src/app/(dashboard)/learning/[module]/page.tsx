'use client';

import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgressBar, CircularProgress } from '@/components/ui/progress';
import { getModuleBySlug } from '@/data/curriculum';
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
  Circle,
  Play,
  Lock,
  ArrowLeft,
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

// Mock lesson progress - in real app, fetch from API
const mockLessonProgress: Record<string, { completed: boolean; watchTime: number }> = {
  'lesson_cjv5384jjjkp5adbsol0': { completed: true, watchTime: 480 },
  'lesson_cjv5461bb72p7oi2cspg': { completed: true, watchTime: 600 },
  'lesson_cjv5465gsuq2i82srh9g': { completed: true, watchTime: 540 },
  'lesson_cjv5545gsuq2i82srhag': { completed: true, watchTime: 720 },
  'lesson_ckbv2o9kbr2l62hvrkpg': { completed: true, watchTime: 420 },
  'lesson_ckbv2rhkbr2l62hvrkq0': { completed: true, watchTime: 540 },
  'lesson_ckhm4gcmp0i6449b67pg': { completed: true, watchTime: 780 },
  'lesson_momentum_characteristics': { completed: false, watchTime: 300 },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins} min`;
}

export default function ModulePage() {
  const params = useParams();
  const moduleSlug = params.module as string;
  const module = getModuleBySlug(moduleSlug);

  if (!module) {
    return (
      <>
        <Header
          title="Module Not Found"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Learning' }, { label: 'Not Found' }]}
        />
        <PageShell>
          <Card>
            <CardContent>
              <p className="text-[var(--text-secondary)]">
                The requested module could not be found.
              </p>
              <Link href="/learning">
                <Button variant="primary" className="mt-4">
                  Back to Learning Center
                </Button>
              </Link>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  const Icon = iconMap[module.icon] || BookOpen;

  // Calculate module progress
  const completedLessons = module.lessons.filter(
    (l) => mockLessonProgress[l.id]?.completed
  ).length;
  const progressPercent = Math.round((completedLessons / module.lessons.length) * 100);
  const totalDuration = module.lessons.reduce((sum, l) => sum + l.duration, 0);

  // Find next uncompleted lesson
  const nextLesson = module.lessons.find((l) => !mockLessonProgress[l.id]?.completed);

  return (
    <>
      <Header
        title={module.title}
        subtitle={module.description}
        breadcrumbs={[
          { label: 'Dashboard' },
          { label: 'Learning', href: '/learning' },
          { label: module.title },
        ]}
        actions={
          <Link href="/learning">
            <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
              Back to Modules
            </Button>
          </Link>
        }
      />

      <PageShell>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Lessons List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Module Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card variant="glow">
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 flex items-center justify-center"
                      style={{ backgroundColor: `${module.color}20` }}
                    >
                      <Icon className="w-8 h-8" style={{ color: module.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">
                          {module.title}
                        </h2>
                        <Badge variant="gold" size="sm">
                          Module {module.order}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          {module.lessons.length} lessons
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDuration(totalDuration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          {completedLessons} completed
                        </span>
                      </div>
                    </div>
                    <CircularProgress
                      value={progressPercent}
                      size={80}
                      strokeWidth={8}
                      variant="gold"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Lessons List */}
            <div className="space-y-3">
              {module.lessons.map((lesson, index) => {
                const progress = mockLessonProgress[lesson.id];
                const isCompleted = progress?.completed;
                const isLocked = index > 0 && !mockLessonProgress[module.lessons[index - 1].id]?.completed;
                const isCurrent = lesson.id === nextLesson?.id;

                return (
                  <motion.div
                    key={lesson.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      href={isLocked ? '#' : `/learning/${module.slug}/${lesson.slug}`}
                      className={isLocked ? 'cursor-not-allowed' : ''}
                    >
                      <Card
                        hoverable={!isLocked}
                        className={`${isLocked ? 'opacity-50' : ''} ${
                          isCurrent ? 'ring-2 ring-[var(--accent-primary)]' : ''
                        }`}
                      >
                        <CardContent>
                          <div className="flex items-center gap-4">
                            {/* Status Icon */}
                            <div
                              className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${
                                isCompleted
                                  ? 'bg-[rgba(34,197,94,0.15)] text-[var(--profit)]'
                                  : isLocked
                                  ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                                  : isCurrent
                                  ? 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)]'
                                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : isLocked ? (
                                <Lock className="w-5 h-5" />
                              ) : isCurrent ? (
                                <Play className="w-5 h-5" />
                              ) : (
                                <Circle className="w-5 h-5" />
                              )}
                            </div>

                            {/* Lesson Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--text-muted)]">
                                  Lesson {index + 1}
                                </span>
                                {isCurrent && (
                                  <Badge variant="gold" size="sm">
                                    Next Up
                                  </Badge>
                                )}
                              </div>
                              <h4 className="font-medium text-[var(--text-primary)] truncate">
                                {lesson.title}
                              </h4>
                              <p className="text-sm text-[var(--text-tertiary)] truncate">
                                {lesson.description}
                              </p>
                            </div>

                            {/* Duration & Arrow */}
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <span className="text-sm text-[var(--text-muted)]">
                                {formatDuration(lesson.duration)}
                              </span>
                              {!isLocked && (
                                <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
                              )}
                            </div>
                          </div>

                          {/* Key Takeaways Preview */}
                          {lesson.key_takeaways.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
                              <div className="flex flex-wrap gap-2">
                                {lesson.key_takeaways.slice(0, 2).map((takeaway, i) => (
                                  <span
                                    key={i}
                                    className="text-xs px-2 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                                  >
                                    {takeaway.length > 40
                                      ? takeaway.substring(0, 40) + '...'
                                      : takeaway}
                                  </span>
                                ))}
                                {lesson.key_takeaways.length > 2 && (
                                  <span className="text-xs text-[var(--text-muted)]">
                                    +{lesson.key_takeaways.length - 2} more
                                  </span>
                                )}
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

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Continue Button */}
            {nextLesson && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card>
                  <CardContent>
                    <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                      Continue Learning
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      {nextLesson.title}
                    </p>
                    <Link href={`/learning/${module.slug}/${nextLesson.slug}`}>
                      <Button variant="primary" fullWidth icon={<Play className="w-4 h-4" />}>
                        Start Lesson
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Module Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
                <CardHeader title="Your Progress" />
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[var(--text-secondary)]">
                          Lessons Completed
                        </span>
                        <span className="text-sm font-medium text-[var(--accent-primary)]">
                          {completedLessons}/{module.lessons.length}
                        </span>
                      </div>
                      <ProgressBar value={progressPercent} variant="gold" />
                    </div>

                    <div className="pt-4 border-t border-[var(--border-primary)]">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-[var(--text-primary)]">
                            {progressPercent}%
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">Complete</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[var(--text-primary)]">
                            {formatDuration(
                              module.lessons
                                .filter((l) => !mockLessonProgress[l.id]?.completed)
                                .reduce((sum, l) => sum + l.duration, 0)
                            )}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">Remaining</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Module Quiz */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader title="Module Quiz" />
                <CardContent>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Test your knowledge after completing all lessons.
                  </p>
                  <Button
                    variant={progressPercent === 100 ? 'primary' : 'secondary'}
                    fullWidth
                    disabled={progressPercent < 100}
                  >
                    {progressPercent === 100 ? 'Take Quiz' : 'Complete All Lessons First'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </PageShell>
    </>
  );
}
