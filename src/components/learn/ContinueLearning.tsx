'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { Play, Clock, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import type { CourseLesson, CourseModule, LessonProgress } from '@/types/learning';

interface ContinueLearningProps {
  lesson: CourseLesson;
  module: CourseModule;
  progress: LessonProgress;
  courseSlug: string;
  className?: string;
}

export function ContinueLearning({
  lesson,
  module,
  progress,
  courseSlug,
  className = '',
}: ContinueLearningProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = lesson.videoDurationSeconds || 0;
  const currentPosition = progress.progressSeconds;
  const remainingMinutes = Math.ceil((totalDuration - currentPosition) / 60);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Card variant="glow" className="overflow-hidden">
        <CardContent className="p-0">
          <Link href={`/learn/${courseSlug}/${module.slug}/${lesson.slug}`}>
            <div className="flex flex-col md:flex-row">
              {/* Thumbnail */}
              <div className="relative w-full md:w-64 h-40 md:h-auto bg-[var(--bg-tertiary)] flex-shrink-0">
                {lesson.thumbnailUrl ? (
                  <img
                    src={lesson.thumbnailUrl}
                    alt={lesson.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-12 h-12 text-[var(--text-tertiary)]" />
                  </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
                    <Play className="w-8 h-8 text-black ml-1" />
                  </div>
                </div>

                {/* Progress overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0">
                  <div
                    className="h-1 bg-[var(--accent-primary)]"
                    style={{ width: `${progress.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text-tertiary)] mb-1">
                      Continue Watching
                    </p>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                      {lesson.lessonNumber} {lesson.title}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      {module.title}
                    </p>

                    {/* Progress info */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--text-tertiary)]">
                          {formatTime(currentPosition)} / {formatTime(totalDuration)}
                        </span>
                        <span className="text-[var(--accent-primary)]">
                          {Math.round(progress.progressPercent)}% complete
                        </span>
                      </div>
                      <ProgressBar
                        value={progress.progressPercent}
                        variant="gold"
                        size="sm"
                      />
                    </div>

                    {/* Time remaining */}
                    <div className="flex items-center gap-2 mt-3 text-sm text-[var(--text-tertiary)]">
                      <Clock className="w-4 h-4" />
                      <span>{remainingMinutes} min remaining</span>
                    </div>
                  </div>

                  {/* Resume button */}
                  <div className="hidden md:flex items-center gap-2 text-[var(--accent-primary)] font-medium">
                    <span>Resume</span>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}
