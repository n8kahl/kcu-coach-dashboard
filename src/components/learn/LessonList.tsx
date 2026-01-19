'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Play,
  Lock,
  Clock,
  Eye,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import type { CourseLesson, LessonProgress } from '@/types/learning';

interface LessonWithProgress extends CourseLesson {
  progress?: LessonProgress;
}

interface LessonListProps {
  lessons: LessonWithProgress[];
  courseSlug: string;
  moduleSlug: string;
  currentLessonId?: string;
  isModuleLocked?: boolean;
  className?: string;
}

export function LessonList({
  lessons,
  courseSlug,
  moduleSlug,
  currentLessonId,
  isModuleLocked = false,
  className = '',
}: LessonListProps) {
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Lessons</span>
          <span className="text-sm font-normal text-[var(--text-tertiary)]">
            {lessons.filter(l => l.progress?.completed).length}/{lessons.length} completed
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {lessons.map((lesson, index) => {
          const isCompleted = lesson.progress?.completed;
          const isInProgress = lesson.progress && !isCompleted && lesson.progress.progressPercent > 0;
          const isCurrent = lesson.id === currentLessonId;
          const isLocked = isModuleLocked && !lesson.isPreview;
          const isPreview = lesson.isPreview;

          return (
            <motion.div
              key={lesson.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Link
                href={
                  isLocked
                    ? '#'
                    : `/learn/${courseSlug}/${moduleSlug}/${lesson.slug}`
                }
                className={isLocked ? 'cursor-not-allowed' : ''}
              >
                <div
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border transition-all
                    ${isCurrent
                      ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]'
                      : isLocked
                        ? 'bg-[var(--bg-tertiary)] border-[var(--border-secondary)] opacity-50'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]'
                    }
                  `}
                >
                  {/* Status icon */}
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${isCompleted
                        ? 'bg-[var(--profit)]/20 text-[var(--profit)]'
                        : isLocked
                          ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                          : isCurrent
                            ? 'bg-[var(--accent-primary)] text-black'
                            : isInProgress
                              ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                      }
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : isLocked ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </div>

                  {/* Lesson info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-muted)] font-mono">
                        {lesson.lessonNumber}
                      </span>
                      <h4 className="font-medium text-[var(--text-primary)] truncate">
                        {lesson.title}
                      </h4>
                      {isPreview && (
                        <Badge variant="default" size="sm">
                          <Eye className="w-3 h-3 mr-1" />
                          Preview
                        </Badge>
                      )}
                    </div>

                    {/* Progress bar for in-progress lessons */}
                    {isInProgress && lesson.progress && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--accent-primary)] rounded-full"
                            style={{ width: `${lesson.progress.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {Math.round(lesson.progress.progressPercent)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-1 text-sm text-[var(--text-tertiary)]">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(lesson.videoDurationSeconds)}</span>
                  </div>

                  {/* Arrow */}
                  {!isLocked && (
                    <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0" />
                  )}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
