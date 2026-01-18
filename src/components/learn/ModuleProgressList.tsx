'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Lock,
  Play,
  ChevronRight,
  Trophy,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { CourseModule, ModuleProgress } from '@/types/learning';

interface ModuleWithProgress extends CourseModule {
  progress: ModuleProgress;
}

interface ModuleProgressListProps {
  modules: ModuleWithProgress[];
  courseSlug: string;
  className?: string;
}

export function ModuleProgressList({ modules, courseSlug, className = '' }: ModuleProgressListProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Module Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {modules.map((module, index) => {
          const isComplete = module.progress.completionPercent >= 100;
          const isLocked = module.progress.isLocked;
          const isInProgress = module.progress.completionPercent > 0 && !isComplete;
          const hasQuiz = module.requiresQuizPass || module.progress.bestQuizScore !== null;

          return (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={isLocked ? '#' : `/learning/${courseSlug}/${module.slug}`}
                className={isLocked ? 'cursor-not-allowed' : ''}
              >
                <div
                  className={`
                    p-4 rounded-lg border transition-all
                    ${isLocked
                      ? 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] opacity-60'
                      : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]'
                    }
                  `}
                >
                  <div className="flex items-center gap-4">
                    {/* Status icon */}
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                        ${isComplete
                          ? 'bg-[var(--profit)]/20 text-[var(--profit)]'
                          : isLocked
                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                            : isInProgress
                              ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                        }
                      `}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : isLocked ? (
                        <Lock className="w-5 h-5" />
                      ) : isInProgress ? (
                        <Play className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-bold">{module.moduleNumber}</span>
                      )}
                    </div>

                    {/* Module info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-[var(--text-primary)] truncate">
                          {module.title}
                        </h3>
                        {isComplete && (
                          <Badge variant="success" size="sm">Complete</Badge>
                        )}
                        {isLocked && (
                          <Badge variant="default" size="sm">Locked</Badge>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <ProgressBar
                            value={module.progress.completionPercent}
                            variant={isComplete ? 'success' : 'gold'}
                            size="sm"
                          />
                        </div>
                        <span className={`text-sm font-medium min-w-[45px] text-right ${
                          isComplete ? 'text-[var(--profit)]' : 'text-[var(--text-secondary)]'
                        }`}>
                          {Math.round(module.progress.completionPercent)}%
                        </span>
                      </div>

                      {/* Lesson count and quiz score */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-tertiary)]">
                        <span>
                          {module.progress.completedLessons}/{module.progress.totalLessons} lessons
                        </span>
                        {hasQuiz && (
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            Quiz: {module.progress.bestQuizScore !== null
                              ? `${module.progress.bestQuizScore}%`
                              : 'Not taken'}
                            {module.progress.quizPassed && (
                              <CheckCircle2 className="w-3 h-3 text-[var(--profit)]" />
                            )}
                          </span>
                        )}
                      </div>

                      {/* Unlock reason for locked modules */}
                      {isLocked && module.progress.unlockReason && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-[var(--text-muted)]">
                          <AlertCircle className="w-3 h-3" />
                          <span>{module.progress.unlockReason}</span>
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    {!isLocked && (
                      <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0" />
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
