'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VideoPlayer, TranscriptPanel, LessonList } from '@/components/learn';
import { useVideoProgress } from '@/hooks/useVideoProgress';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  BookOpen,
  Play,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import type { CourseModule, CourseLesson, LessonProgress } from '@/types/learning';

interface LessonWithProgress extends CourseLesson {
  progress?: LessonProgress;
}

interface LessonPageData {
  lesson: CourseLesson;
  module: CourseModule;
  progress: LessonProgress | null;
  allLessons: LessonWithProgress[];
  prevLesson: { slug: string; title: string } | null;
  nextLesson: { slug: string; title: string } | null;
  courseTitle: string;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const courseSlug = params.courseSlug as string;
  const moduleSlug = params.moduleSlug as string;
  const lessonSlug = params.lessonSlug as string;

  const [data, setData] = useState<LessonPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showLessonList, setShowLessonList] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  // Video progress hook
  const videoProgress = useVideoProgress({
    lessonId: data?.lesson.id || '',
    videoDuration: data?.lesson.videoDurationSeconds || 0,
    initialProgress: data?.progress?.progressSeconds || 0,
    minWatchPercent: data?.lesson.minWatchPercent || 90,
    onComplete: () => {
      setJustCompleted(true);
      // Show completion toast or animation
    },
  });

  useEffect(() => {
    if (courseSlug && moduleSlug && lessonSlug) {
      fetchLessonData();
    }
  }, [courseSlug, moduleSlug, lessonSlug]);

  const fetchLessonData = async () => {
    try {
      setLoading(true);
      setJustCompleted(false);
      const response = await fetch(
        `/api/learn/courses/${courseSlug}/modules/${moduleSlug}/lessons/${lessonSlug}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Lesson not found');
        }
        if (response.status === 403) {
          throw new Error('This lesson is locked');
        }
        throw new Error('Failed to fetch lesson');
      }

      const lessonData = await response.json();
      setData(lessonData);
    } catch (err) {
      console.error('Error fetching lesson:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      if (data?.lesson.id) {
        videoProgress.updateTime(currentTime);
      }
    },
    [data?.lesson.id, videoProgress]
  );

  const navigateToNext = useCallback(() => {
    if (data?.nextLesson) {
      router.push(`/learn/${courseSlug}/${moduleSlug}/${data.nextLesson.slug}`);
    }
  }, [data?.nextLesson, courseSlug, moduleSlug, router]);

  if (loading) {
    return (
      <>
        <Header
          title="Loading..."
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learn', href: '/learn' },
            { label: 'Course', href: `/learn/${courseSlug}` },
            { label: 'Module', href: `/learn/${courseSlug}/${moduleSlug}` },
            { label: 'Lesson' },
          ]}
        />
        <PageShell maxWidth="full" padding="none">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">
              Loading lesson...
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
            { label: 'Module', href: `/learn/${courseSlug}/${moduleSlug}` },
            { label: 'Lesson' },
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
                    <Button variant="secondary" onClick={fetchLessonData}>
                      Try Again
                    </Button>
                    <Link href={`/learn/${courseSlug}/${moduleSlug}`}>
                      <Button variant="ghost">Back to Module</Button>
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

  const { lesson, module, progress, allLessons, prevLesson, nextLesson, courseTitle } = data;
  const isCompleted = progress?.completed || videoProgress.isCompleted || justCompleted;

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
              onClick={() => setShowTranscript(!showTranscript)}
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
              {lesson.videoUrl ? (
                <VideoPlayer
                  src={lesson.videoUrl}
                  poster={lesson.thumbnailUrl || undefined}
                  title={lesson.title}
                  initialTime={progress?.progressSeconds || 0}
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
          {showTranscript && lesson.transcriptText && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:w-96 flex-shrink-0"
            >
              <TranscriptPanel
                transcript={lesson.transcriptText}
                downloadUrl={lesson.transcriptUrl || undefined}
                currentTime={videoProgress.currentTime}
                onSeek={(time) => {
                  // This would require a ref to the video player
                  // For now, we'll just update progress state
                  videoProgress.handleSeek(videoProgress.currentTime, time);
                }}
              />
            </motion.div>
          )}
        </div>
      </PageShell>
    </>
  );
}
