'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TranscriptPanel, LessonList } from '@/components/learn';
import { PreviewPlayer } from '@/components/admin/content/PreviewPlayer';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  BookOpen,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import type { CourseModule, CourseLesson } from '@/types/learning';

interface PreviewData {
  lesson: CourseLesson;
  module: CourseModule;
  course: { id: string; title: string; slug: string; isPublished: boolean };
  allLessons: CourseLesson[];
  prevLesson: { id: string; slug: string; title: string } | null;
  nextLesson: { id: string; slug: string; title: string } | null;
  previewMode: boolean;
  publishStatus: {
    coursePublished: boolean;
    modulePublished: boolean;
    lessonPublished: boolean;
  };
}

export default function AdminPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;

  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showLessonList, setShowLessonList] = useState(false);

  useEffect(() => {
    if (lessonId) {
      fetchPreviewData();
    }
  }, [lessonId]);

  const fetchPreviewData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/content/preview/${lessonId}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - Admin access required');
        }
        if (response.status === 404) {
          throw new Error('Lesson not found');
        }
        throw new Error('Failed to fetch preview');
      }

      const previewData = await response.json();
      setData(previewData);
    } catch (err) {
      console.error('Error fetching preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const navigateToPreview = (lessonId: string) => {
    router.push(`/admin/content-studio/preview/${lessonId}`);
  };

  if (loading) {
    return (
      <>
        <Header
          title="Loading Preview..."
          breadcrumbs={[
            { label: 'Admin' },
            { label: 'Content Studio', href: '/admin/content-studio' },
            { label: 'Preview' },
          ]}
        />
        <PageShell maxWidth="full" padding="none">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">
              Loading preview...
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
          title="Preview Error"
          breadcrumbs={[
            { label: 'Admin' },
            { label: 'Content Studio', href: '/admin/content-studio' },
            { label: 'Preview' },
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
                    <Button variant="secondary" onClick={fetchPreviewData}>
                      Try Again
                    </Button>
                    <Link href="/admin/content-studio">
                      <Button variant="ghost">Back to Content Studio</Button>
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

  const { lesson, module, course, allLessons, prevLesson, nextLesson, publishStatus } = data;
  const isFullyPublished = publishStatus.coursePublished && publishStatus.modulePublished && publishStatus.lessonPublished;

  return (
    <>
      <Header
        title={`Preview: ${lesson.title}`}
        breadcrumbs={[
          { label: 'Admin' },
          { label: 'Content Studio', href: '/admin/content-studio' },
          { label: 'Preview' },
          { label: lesson.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/content-studio">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Editor
              </Button>
            </Link>
          </div>
        }
      />

      <PageShell maxWidth="full" padding="sm">
        {/* Preview Mode Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <Card className="border-[var(--warning)] bg-[var(--warning)]/10">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-[var(--warning)]" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      Admin Preview Mode
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      This is how the lesson appears to learners. No progress is tracked in preview mode.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Publication Status Badges */}
                  <Badge
                    variant={publishStatus.coursePublished ? 'success' : 'warning'}
                    size="sm"
                  >
                    Course: {publishStatus.coursePublished ? 'Published' : 'Draft'}
                  </Badge>
                  <Badge
                    variant={publishStatus.modulePublished ? 'success' : 'warning'}
                    size="sm"
                  >
                    Module: {publishStatus.modulePublished ? 'Published' : 'Draft'}
                  </Badge>
                  <Badge
                    variant={publishStatus.lessonPublished ? 'success' : 'warning'}
                    size="sm"
                  >
                    Lesson: {publishStatus.lessonPublished ? 'Published' : 'Draft'}
                  </Badge>
                </div>
              </div>

              {/* Warning if not fully published */}
              {!isFullyPublished && (
                <div className="mt-3 pt-3 border-t border-[var(--warning)]/30 flex items-center gap-2 text-sm text-[var(--warning)]">
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    This content is not visible to learners. Publish all parent items to make it accessible.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Lesson List Sidebar */}
          {showLessonList && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:w-80 flex-shrink-0"
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Module Lessons</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="space-y-1">
                    {allLessons.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => navigateToPreview(l.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          l.id === lesson.id
                            ? 'bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/50'
                            : 'hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {l.lessonNumber} {l.title}
                          </p>
                          {l.videoDurationSeconds && (
                            <p className="text-xs text-[var(--text-tertiary)]">
                              {Math.floor(l.videoDurationSeconds / 60)}:{String(l.videoDurationSeconds % 60).padStart(2, '0')}
                            </p>
                          )}
                        </div>
                        {!l.isPublished && (
                          <Badge variant="warning" size="sm">
                            <EyeOff className="w-3 h-3" />
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLessonList(!showLessonList)}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                {showLessonList ? 'Hide' : 'Show'} Lessons
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTranscript(!showTranscript)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {showTranscript ? 'Hide' : 'Show'} Transcript
              </Button>
            </div>

            {/* Video Player */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {lesson.videoUrl || lesson.videoUid ? (
                <PreviewPlayer
                  videoUid={lesson.videoUid}
                  videoUrl={lesson.videoUrl}
                  videoStatus={lesson.videoStatus}
                  videoDurationSeconds={lesson.videoDurationSeconds}
                  thumbnailUrl={lesson.thumbnailUrl}
                />
              ) : (
                <Card className="aspect-video flex items-center justify-center bg-[var(--bg-tertiary)]">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-[var(--warning)] mx-auto mb-3" />
                    <p className="text-[var(--text-primary)] font-medium">No Video Content</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      This lesson doesn't have a video yet.
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-2">
                      Video Status: {lesson.videoStatus || 'Not set'}
                    </p>
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
                      {lesson.isPreview && (
                        <Badge variant="primary">Free Preview</Badge>
                      )}
                      {lesson.isRequired && (
                        <Badge variant="default">Required</Badge>
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

            {/* Resources */}
            {lesson.resources && lesson.resources.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Resources</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {lesson.resources.map((resource, index) => (
                        <a
                          key={index}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          <Badge variant="default" size="sm">
                            {resource.type.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-[var(--text-primary)]">
                            {resource.title}
                          </span>
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Navigation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between">
                {prevLesson ? (
                  <Button
                    variant="ghost"
                    onClick={() => navigateToPreview(prevLesson.id)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {prevLesson.title}
                  </Button>
                ) : (
                  <div />
                )}

                {nextLesson ? (
                  <Button
                    variant="primary"
                    onClick={() => navigateToPreview(nextLesson.id)}
                  >
                    {nextLesson.title}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Link href="/admin/content-studio">
                    <Button variant="primary">
                      Back to Editor
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
                currentTime={0}
              />
            </motion.div>
          )}
        </div>
      </PageShell>
    </>
  );
}
