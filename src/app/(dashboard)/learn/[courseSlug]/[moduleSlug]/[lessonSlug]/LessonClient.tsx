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
import { useConfetti } from '@/hooks/useConfetti';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  BookOpen,
  Trophy,
  Sparkles,
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
  const confetti = useConfetti();

  // Get timestamp from URL query param (e.g., ?t=120)
  const urlTimestamp = searchParams.get('t');
  const startTimeFromUrl = urlTimestamp ? parseInt(urlTimestamp, 10) : null;

  // Default transcript to hidden - improves TTFF by not loading transcript on initial render
  const [showTranscript, setShowTranscript] = useState(false);
  const [showLessonList, setShowLessonList] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [moduleCompleted, setModuleCompleted] = useState(false);
  const [lightsOutEnabled, setLightsOutEnabled] = useState(false);
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
      // Trigger massive confetti celebration when module is completed (no next lesson)
      if (!nextLesson) {
        setModuleCompleted(true);
        confetti.massiveCelebration();
      }
    },
  });

  // Handle auto-advance to next lesson
  const handleAutoAdvance = useCallback(() => {
    if (nextLesson) {
      router.push(`/learn/${courseSlug}/${moduleSlug}/${nextLesson.slug}`);
    }
  }, [nextLesson, courseSlug, moduleSlug, router]);

  // Handle lights out mode change
  const handleLightsOutChange = useCallback((enabled: boolean) => {
    setLightsOutEnabled(enabled);
  }, []);

  // Fetch transcript when panel is opened
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

  // Lights Out animation variants
  const lightsOutVariants = {
    normal: { opacity: 1, filter: 'brightness(1)' },
    dimmed: { opacity: 0.2, filter: 'brightness(0.3)' },
  };

  return (
    <>
      {/* Lights Out overlay backdrop */}
      <AnimatePresence>
        {lightsOutEnabled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-0 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={lightsOutEnabled ? 'dimmed' : 'normal'}
        variants={lightsOutVariants}
        transition={{ duration: 0.3 }}
      >
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
      </motion.div>

      <PageShell maxWidth="full" padding="sm">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Lesson List Sidebar (mobile: slide-over, desktop: side column) - Dimmed in Lights Out mode */}
          {showLessonList && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={lightsOutEnabled ? { opacity: 0.2, x: 0 } : { opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
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
            {/* Completion Banner - Enhanced for module completion */}
            <AnimatePresence>
              {justCompleted && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <Card className={`border-[var(--profit)] ${moduleCompleted ? 'bg-gradient-to-r from-[var(--accent-primary)]/20 to-[var(--profit)]/10 border-[var(--accent-primary)]' : 'bg-[var(--profit)]/10'}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              moduleCompleted
                                ? 'bg-gradient-to-br from-[var(--accent-primary)] to-[var(--profit)]'
                                : 'bg-[var(--profit)]/20'
                            }`}
                          >
                            {moduleCompleted ? (
                              <Sparkles className="w-6 h-6 text-black" />
                            ) : (
                              <Trophy className="w-5 h-5 text-[var(--profit)]" />
                            )}
                          </motion.div>
                          <div>
                            <motion.p
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 }}
                              className={`font-semibold ${moduleCompleted ? 'text-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--profit)] bg-clip-text text-transparent' : 'text-[var(--text-primary)]'}`}
                            >
                              {moduleCompleted ? 'Module Complete!' : 'Lesson Complete!'}
                            </motion.p>
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.4 }}
                              className="text-sm text-[var(--text-secondary)]"
                            >
                              {moduleCompleted
                                ? 'Outstanding work! You\'ve mastered this module.'
                                : 'Great job! Keep up the momentum.'}
                            </motion.p>
                          </div>
                        </div>
                        {nextLesson ? (
                          <Button onClick={navigateToNext}>
                            Next Lesson
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        ) : (
                          <Link href={`/learn/${courseSlug}/${moduleSlug}`}>
                            <Button variant="primary" className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--profit)] hover:opacity-90">
                              <Trophy className="w-4 h-4 mr-2" />
                              View Module
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Video Player */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10"
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
                  // Netflix-style experience props
                  nextLessonTitle={nextLesson?.title}
                  onAutoAdvance={handleAutoAdvance}
                  autoAdvanceEnabled={true}
                  onLightsOutChange={handleLightsOutChange}
                  lightsOutEnabled={lightsOutEnabled}
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

            {/* Lesson Info - Dimmed in Lights Out mode */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={lightsOutEnabled ? { opacity: 0.2, y: 0 } : { opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
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

            {/* Navigation - Dimmed in Lights Out mode */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={lightsOutEnabled ? { opacity: 0.2, y: 0 } : { opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
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

          {/* Transcript Sidebar - Dimmed in Lights Out mode */}
          {showTranscript && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={lightsOutEnabled ? { opacity: 0.2, x: 0 } : { opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
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
