'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VideoPlayer, TranscriptPanel, LessonList } from '@/components/learn';
import { useVideoProgress } from '@/hooks/useVideoProgress';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  BookOpen,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import type { CourseModule, CourseLesson, LessonProgress } from '@/types/learning';

interface LessonWithProgress extends CourseLesson {
  progress?: LessonProgress;
}

interface TranscriptSegment {
  text: string;
  startTime: number;
  endTime?: number;
  startFormatted?: string;
}

export interface LessonClientProps {
  lesson: CourseLesson;
  module: CourseModule;
  progress: LessonProgress | null;
  allLessons: LessonWithProgress[];
  prevLesson: { slug: string; title: string } | null;
  nextLesson: { slug: string; title: string } | null;
  courseTitle: string;
  courseSlug: string;
  moduleSlug: string;
}

export function LessonClient({
  lesson,
  module,
  progress,
  allLessons,
  prevLesson,
  nextLesson,
  courseTitle,
  courseSlug,
  moduleSlug,
}: LessonClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get timestamp from URL query param (e.g., ?t=120)
  const urlTimestamp = searchParams.get('t');
  const startTimeFromUrl = urlTimestamp ? parseInt(urlTimestamp, 10) : null;

  // Default transcript to hidden - improves TTFF by not loading transcript on initial render
  const [showTranscript, setShowTranscript] = useState(false);
  const [showLessonList, setShowLessonList] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptLoaded, setTranscriptLoaded] = useState(false);

  // Determine initial time: prefer URL timestamp, fall back to saved progress
  const effectiveInitialTime = startTimeFromUrl !== null && startTimeFromUrl > 0
    ? startTimeFromUrl
    : (progress?.progressSeconds || 0);

  // Video progress hook
  const videoProgress = useVideoProgress({
    lessonId: lesson.id || '',
    videoDuration: lesson.videoDurationSeconds || 0,
    initialProgress: effectiveInitialTime,
    minWatchPercent: lesson.minWatchPercent || 90,
    onComplete: () => {
      setJustCompleted(true);
    },
  });

  // Fetch transcript when panel is opened - parallel fetch for better performance
  const fetchTranscript = useCallback(async () => {
    if (transcriptLoaded || transcriptLoading) return;

    setTranscriptLoading(true);
    try {
      // Fetch transcript text and segments in parallel
      const [transcriptResponse, segmentsResponse] = await Promise.all([
        fetch(`/api/learn/courses/${courseSlug}/modules/${moduleSlug}/lessons/${lesson.slug}/transcript`),
        fetch(`/api/learn/courses/${courseSlug}/modules/${moduleSlug}/lessons/${lesson.slug}/transcript-segments`),
      ]);

      // Process transcript text
      if (transcriptResponse.ok) {
        const data = await transcriptResponse.json();
        if (data.transcriptText) {
          setTranscriptText(data.transcriptText);
        }
      }

      // Process transcript segments
      if (segmentsResponse.ok) {
        const data = await segmentsResponse.json();
        if (data.segments && data.segments.length > 0) {
          setTranscriptSegments(data.segments);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch transcript:', err);
    } finally {
      setTranscriptLoading(false);
      setTranscriptLoaded(true);
    }
  }, [courseSlug, moduleSlug, lesson.slug, transcriptLoaded, transcriptLoading]);

  // Load transcript when showTranscript becomes true
  const handleToggleTranscript = useCallback(() => {
    const newState = !showTranscript;
    setShowTranscript(newState);
    if (newState && !transcriptLoaded) {
      fetchTranscript();
    }
  }, [showTranscript, transcriptLoaded, fetchTranscript]);

  const handleVideoTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      if (lesson.id) {
        videoProgress.updateTime(currentTime);
      }
    },
    [lesson.id, videoProgress]
  );

  const navigateToNext = useCallback(() => {
    if (nextLesson) {
      router.push(`/learn/${courseSlug}/${moduleSlug}/${nextLesson.slug}`);
    }
  }, [nextLesson, courseSlug, moduleSlug, router]);

  const isCompleted = progress?.completed || videoProgress.isCompleted || justCompleted;

  // Determine video source - prefer HLS for adaptive streaming
  const videoSrc = lesson.videoPlaybackHls || lesson.videoUrl;

  // Prefetch next lesson manifest at 75% progress for instant navigation
  const prefetchedRef = useRef(false);

  useEffect(() => {
    // Skip if already prefetched, no next lesson, or no video duration
    if (prefetchedRef.current || !nextLesson || !lesson.videoDurationSeconds) {
      return;
    }

    const currentProgress = videoProgress.currentTime;
    const progressPercent = (currentProgress / lesson.videoDurationSeconds) * 100;

    // Prefetch at 75% progress
    if (progressPercent >= 75) {
      // Check if user has data saver mode enabled
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (connection?.saveData) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[LessonClient] Skipping prefetch - saveData mode enabled');
        }
        return;
      }

      // Find the next lesson to get its HLS URL
      const nextLessonData = allLessons.find(l => l.slug === nextLesson.slug);
      const nextHlsUrl = nextLessonData?.videoPlaybackHls;

      if (nextHlsUrl) {
        prefetchedRef.current = true;

        // Prefetch the HLS manifest with a HEAD request
        // This warms up DNS, TCP connection, and caches the manifest
        fetch(nextHlsUrl, { method: 'HEAD', mode: 'no-cors' })
          .then(() => {
            if (process.env.NODE_ENV === 'development') {
              console.log('[LessonClient] Prefetched next lesson manifest:', nextLesson.slug);
            }
          })
          .catch(() => {
            // Silently fail - prefetch is just an optimization
            prefetchedRef.current = false; // Allow retry
          });
      }
    }
  }, [videoProgress.currentTime, lesson.videoDurationSeconds, nextLesson, allLessons]);

  return (
    <>
      <Header
        title={`${lesson.lessonNumber} ${lesson.title}`}
        breadcrumbs={[
          { label: 'Dashboard' },
          { label: 'Learn', href: '/learn' },
          { label: courseTitle, href: `/learn/${courseSlug}` },
          { label: `Module ${module.moduleNumber}`, href: `/learn/${courseSlug}/${moduleSlug}` },
          { label: `Lesson ${lesson.lessonNumber}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLessonList(!showLessonList)}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Lessons
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleTranscript}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Transcript
            </Button>
          </div>
        }
      />

      <PageShell maxWidth="full" padding="sm">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Lesson List Sidebar (mobile: slide-over, desktop: side column) */}
          {showLessonList && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:w-80 flex-shrink-0"
            >
              <LessonList
                lessons={allLessons}
                courseSlug={courseSlug}
                moduleSlug={moduleSlug}
                currentLessonId={lesson.id}
              />
            </motion.div>
          )}

          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Completion Banner */}
            {justCompleted && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-[var(--profit)] bg-[var(--profit)]/10">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--profit)]/20 flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-[var(--profit)]" />
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">
                            Lesson Complete!
                          </p>
                          <p className="text-sm text-[var(--text-secondary)]">
                            Great job! Keep up the momentum.
                          </p>
                        </div>
                      </div>
                      {nextLesson && (
                        <Button onClick={navigateToNext}>
                          Next Lesson
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Video Player */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {videoSrc ? (
                <VideoPlayer
                  src={videoSrc}
                  poster={lesson.thumbnailUrl || undefined}
                  title={lesson.title}
                  initialTime={effectiveInitialTime}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onComplete={videoProgress.handleComplete}
                  onPlay={videoProgress.handlePlay}
                  onPause={videoProgress.handlePause}
                  onSeek={videoProgress.handleSeek}
                  onSpeedChange={videoProgress.handleSpeedChange}
                  minWatchPercent={lesson.minWatchPercent}
                  allowSkip={lesson.allowSkip}
                />
              ) : (
                <Card className="aspect-video flex items-center justify-center bg-[var(--bg-tertiary)]">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                    <p className="text-[var(--text-secondary)]">Video not available</p>
                  </div>
                </Card>
              )}
            </motion.div>

            {/* Lesson Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="default">Lesson {lesson.lessonNumber}</Badge>
                      {isCompleted && (
                        <Badge variant="success">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                      {lesson.isPreview && (
                        <Badge variant="primary">Preview</Badge>
                      )}
                    </div>
                    {lesson.videoDurationSeconds && (
                      <span className="text-sm text-[var(--text-tertiary)]">
                        {Math.floor(lesson.videoDurationSeconds / 60)}m {lesson.videoDurationSeconds % 60}s
                      </span>
                    )}
                  </div>
                  <CardTitle className="mt-2">{lesson.title}</CardTitle>
                </CardHeader>
                {lesson.description && (
                  <CardContent className="pt-0">
                    <p className="text-[var(--text-secondary)]">{lesson.description}</p>
                  </CardContent>
                )}
              </Card>
            </motion.div>

            {/* Navigation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between">
                {prevLesson ? (
                  <Link href={`/learn/${courseSlug}/${moduleSlug}/${prevLesson.slug}`}>
                    <Button variant="ghost">
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      {prevLesson.title}
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/learn/${courseSlug}/${moduleSlug}`}>
                    <Button variant="ghost">
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back to Module
                    </Button>
                  </Link>
                )}

                {nextLesson ? (
                  <Link href={`/learn/${courseSlug}/${moduleSlug}/${nextLesson.slug}`}>
                    <Button variant={isCompleted ? 'primary' : 'ghost'}>
                      {nextLesson.title}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/learn/${courseSlug}/${moduleSlug}`}>
                    <Button variant="primary">
                      Complete Module
                      <CheckCircle2 className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </motion.div>
          </div>

          {/* Transcript Sidebar */}
          {showTranscript && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:w-96 flex-shrink-0"
            >
              {transcriptLoading ? (
                <Card className="h-[400px] flex items-center justify-center">
                  <div className="animate-pulse space-y-3 w-full px-6">
                    <div className="h-4 bg-[var(--bg-tertiary)] rounded w-3/4"></div>
                    <div className="h-4 bg-[var(--bg-tertiary)] rounded w-full"></div>
                    <div className="h-4 bg-[var(--bg-tertiary)] rounded w-5/6"></div>
                    <div className="h-4 bg-[var(--bg-tertiary)] rounded w-2/3"></div>
                  </div>
                </Card>
              ) : transcriptText ? (
                <TranscriptPanel
                  transcript={transcriptText}
                  segments={transcriptSegments.length > 0 ? transcriptSegments : undefined}
                  downloadUrl={lesson.transcriptUrl || undefined}
                  currentTime={videoProgress.currentTime}
                  onSeek={(time) => {
                    videoProgress.handleSeek(videoProgress.currentTime, time);
                  }}
                />
              ) : (
                <Card className="h-[400px] flex items-center justify-center">
                  <p className="text-[var(--text-secondary)]">No transcript available</p>
                </Card>
              )}
            </motion.div>
          )}
        </div>
      </PageShell>
    </>
  );
}
