'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressBar, CircularProgress } from '@/components/ui/progress';
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
  Play,
  Loader2,
  GraduationCap,
  AlertCircle,
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
  GraduationCap,
};

// Module type from API
interface LearningModule {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  lessonsCount: number;
  chaptersCount?: number;
  estimatedDuration: number;
  imageUrl?: string | null;
  thinkificId?: number;
  source: 'thinkific' | 'local';
}

interface LearningStats {
  totalModules: number;
  totalLessons: number;
  totalHours: number;
}

// Progress data type
type ModuleProgress = Record<string, { completed: number; total: number }>;

export default function LearningPage() {
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [dataSource, setDataSource] = useState<'thinkific' | 'local'>('local');
  const [userProgress, setUserProgress] = useState<ModuleProgress>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch modules and progress
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch modules from API (will use Thinkific if synced, otherwise local)
        const modulesRes = await fetch('/api/learning/modules');
        if (!modulesRes.ok) {
          throw new Error('Failed to fetch modules');
        }
        const modulesData = await modulesRes.json();
        setModules(modulesData.modules || []);
        setStats(modulesData.stats);
        setDataSource(modulesData.source || 'local');

        // Fetch user progress
        const progressRes = await fetch('/api/learning/progress');
        if (progressRes.ok) {
          const progressData = await progressRes.json();

          // Convert API response to module progress format
          const progress: ModuleProgress = {};
          (modulesData.modules || []).forEach((module: LearningModule) => {
            const moduleProgress = progressData.progress?.[module.id] || {
              completed: 0,
              total: module.lessonsCount,
            };
            progress[module.id] = {
              completed: moduleProgress.completed || 0,
              total: moduleProgress.total || module.lessonsCount,
            };
          });
          setUserProgress(progress);
        }
      } catch (err) {
        console.error('Error fetching learning data:', err);
        setError('Failed to load learning content. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Calculate overall progress
  const moduleValues = Object.values(userProgress);
  const totalCompleted = moduleValues.reduce((sum, p) => sum + p.completed, 0);
  const totalLessons =
    moduleValues.length > 0
      ? moduleValues.reduce((sum, p) => sum + p.total, 0)
      : modules.reduce((sum, m) => sum + m.lessonsCount, 0);
  const overallProgress =
    totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  // Show loading state
  if (loading) {
    return (
      <>
        <Header
          title="Learning Center"
          subtitle="Master the LTP Framework step by step"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Learning' }]}
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

  // Show error state
  if (error) {
    return (
      <>
        <Header
          title="Learning Center"
          subtitle="Master the LTP Framework step by step"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Learning' }]}
        />
        <PageShell>
          <Card className="border-[var(--error)] bg-[var(--error)]/10">
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-12 h-12 text-[var(--error)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    {error}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  // Show empty state if no modules
  if (modules.length === 0) {
    return (
      <>
        <Header
          title="Learning Center"
          subtitle="Master the LTP Framework step by step"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Learning' }]}
        />
        <PageShell>
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4 text-center">
                <GraduationCap className="w-16 h-16 text-[var(--text-tertiary)]" />
                <div>
                  <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                    No Courses Available
                  </h3>
                  <p className="text-[var(--text-secondary)]">
                    Courses are being set up. Please check back soon or contact
                    an administrator.
                  </p>
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
        subtitle="Master the LTP Framework step by step"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Learning' }]}
      />

      <PageShell>
        <div className="space-y-8">
          {/* Data Source Indicator */}
          {dataSource === 'thinkific' && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <GraduationCap className="w-4 h-4" />
              <span>Content synced from Thinkific LMS</span>
            </div>
          )}

          {/* Overall Progress Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card variant="glow">
              <CardContent>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                      Your Learning Journey
                    </h2>
                    <p className="text-[var(--text-secondary)] mb-4">
                      Complete all {stats?.totalModules || modules.length}{' '}
                      courses to master the KCU trading methodology
                    </p>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span className="text-[var(--text-secondary)]">
                          {totalCompleted}/{totalLessons} Lessons
                        </span>
                      </div>
                      {stats?.totalHours && stats.totalHours > 0 && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[var(--accent-primary)]" />
                          <span className="text-[var(--text-secondary)]">
                            ~{stats.totalHours} hours total
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <CircularProgress
                    value={overallProgress}
                    size={120}
                    strokeWidth={10}
                    variant="gold"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Module Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module, index) => {
              const Icon = iconMap[module.icon] || BookOpen;
              const progress = userProgress[module.id] || {
                completed: 0,
                total: module.lessonsCount,
              };
              const progressPercent =
                progress.total > 0
                  ? Math.round((progress.completed / progress.total) * 100)
                  : 0;
              const isComplete = progressPercent === 100;

              // For Thinkific, don't lock modules - all are accessible
              const isLocked =
                module.source === 'local' &&
                index > 0 &&
                userProgress[modules[index - 1]?.id]?.completed === 0;

              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={isLocked ? '#' : `/learning/${module.slug}`}
                    className={isLocked ? 'cursor-not-allowed' : ''}
                  >
                    <Card
                      hoverable={!isLocked}
                      className={`h-full ${isLocked ? 'opacity-50' : ''}`}
                    >
                      <CardContent>
                        <div className="flex items-start gap-4">
                          {/* Module Image or Icon */}
                          {module.imageUrl ? (
                            <div
                              className="w-14 h-14 rounded-lg bg-cover bg-center flex-shrink-0"
                              style={{
                                backgroundImage: `url(${module.imageUrl})`,
                              }}
                            />
                          ) : (
                            <div
                              className="w-14 h-14 flex items-center justify-center flex-shrink-0 rounded-lg"
                              style={{
                                backgroundColor: isComplete
                                  ? 'rgba(34, 197, 94, 0.15)'
                                  : `${module.color}20`,
                              }}
                            >
                              {isComplete ? (
                                <CheckCircle2 className="w-7 h-7 text-[var(--profit)]" />
                              ) : (
                                <Icon
                                  className="w-7 h-7"
                                  style={{ color: module.color }}
                                />
                              )}
                            </div>
                          )}

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-[var(--text-primary)] truncate">
                                {module.title}
                              </h3>
                              {module.source === 'thinkific' && (
                                <Badge variant="default" size="sm">
                                  LMS
                                </Badge>
                              )}
                              {module.source === 'local' && (
                                <Badge
                                  variant={
                                    module.order <= 2
                                      ? 'success'
                                      : module.order <= 6
                                        ? 'warning'
                                        : 'default'
                                  }
                                  size="sm"
                                >
                                  {module.order <= 2
                                    ? 'Beginner'
                                    : module.order <= 6
                                      ? 'Intermediate'
                                      : 'Advanced'}
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm text-[var(--text-tertiary)] mb-3 line-clamp-2">
                              {module.description || 'No description available'}
                            </p>

                            {/* Progress */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[var(--text-muted)]">
                                  {progress.completed}/{progress.total} lessons
                                </span>
                                <span
                                  className={
                                    isComplete
                                      ? 'text-[var(--profit)]'
                                      : 'text-[var(--accent-primary)]'
                                  }
                                >
                                  {progressPercent}%
                                </span>
                              </div>
                              <ProgressBar
                                value={progressPercent}
                                variant={isComplete ? 'success' : 'gold'}
                                size="sm"
                              />
                            </div>
                          </div>

                          {/* Arrow */}
                          {!isLocked && (
                            <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0 mt-2" />
                          )}
                        </div>

                        {/* Continue Button for In-Progress Modules */}
                        {progress.completed > 0 && !isComplete && (
                          <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
                            <div className="flex items-center gap-2 text-sm text-[var(--accent-primary)]">
                              <Play className="w-4 h-4" />
                              <span>Continue Learning</span>
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
      </PageShell>
    </>
  );
}
