'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Circle,
  Play,
  Lock,
  ArrowLeft,
  Loader2,
  Video,
  FileText,
  HelpCircle,
  GraduationCap,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Youtube,
  ExternalLink,
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

// Content type icon mapping
const contentTypeIcons: Record<string, React.ElementType> = {
  video: Video,
  text: FileText,
  quiz: HelpCircle,
  unknown: BookOpen,
};

interface ThinkificContent {
  id: string;
  thinkific_id: number;
  name: string;
  content_type: string;
  position: number;
  video_duration: number | null;
  video_provider: string | null;
  free_preview: boolean;
  description: string | null;
}

interface ThinkificChapter {
  id: string;
  thinkific_id: number;
  name: string;
  description: string | null;
  position: number;
  contents: ThinkificContent[];
}

interface ThinkificCourse {
  id: string;
  thinkific_id: number;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  lesson_count: number;
  chapter_count: number;
  duration: string | null;
}

interface CourseData {
  course: ThinkificCourse;
  chapters: ThinkificChapter[];
  source: 'thinkific' | 'local';
}

interface RelatedVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string;
  category: string | null;
  ltp_relevance: number | null;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '';
  const mins = Math.floor(seconds / 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins} min`;
}

export default function ModulePage() {
  const router = useRouter();
  const params = useParams();
  const moduleSlug = params.module as string;

  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [relatedVideos, setRelatedVideos] = useState<RelatedVideo[]>([]);

  // Fetch course data
  useEffect(() => {
    async function fetchCourse() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/learning/modules/${moduleSlug}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Course not found');
          } else {
            throw new Error('Failed to fetch course');
          }
          return;
        }

        const data = await response.json();
        setCourseData(data);

        // Expand first chapter by default
        if (data.chapters?.length > 0) {
          setExpandedChapters(new Set([data.chapters[0].thinkific_id]));
        }
      } catch (err) {
        console.error('Error fetching course:', err);
        setError('Failed to load course content');
      } finally {
        setLoading(false);
      }
    }

    fetchCourse();
  }, [moduleSlug]);

  // Fetch related YouTube videos based on course title
  useEffect(() => {
    async function fetchRelatedVideos() {
      if (!courseData?.course?.title) return;

      try {
        // Use category search - map course title to likely categories
        const title = courseData.course.title.toLowerCase();
        let category = '';

        if (title.includes('ltp') || title.includes('level') || title.includes('trend') || title.includes('patience')) {
          category = 'LTP Framework';
        } else if (title.includes('price action') || title.includes('candle')) {
          category = 'Price Action';
        } else if (title.includes('psychol') || title.includes('mindset') || title.includes('discipline')) {
          category = 'Psychology';
        } else if (title.includes('risk') || title.includes('stop') || title.includes('position')) {
          category = 'Risk Management';
        } else if (title.includes('indicator') || title.includes('ema') || title.includes('vwap')) {
          category = 'Indicators';
        } else if (title.includes('strategy') || title.includes('setup') || title.includes('orb')) {
          category = 'Strategies';
        }

        const params = new URLSearchParams({
          limit: '5',
          sortBy: 'ltp_relevance',
          sortOrder: 'desc',
        });

        if (category) {
          params.set('category', category);
        }

        const response = await fetch(`/api/youtube/videos?${params}`);
        if (response.ok) {
          const data = await response.json();
          setRelatedVideos(data.videos || []);
        }
      } catch (err) {
        console.error('Error fetching related videos:', err);
      }
    }

    fetchRelatedVideos();
  }, [courseData?.course?.title]);

  const toggleChapter = (chapterId: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Header
          title="Loading..."
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learning', href: '/learning' },
            { label: 'Loading...' },
          ]}
        />
        <PageShell>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">Loading course...</span>
          </div>
        </PageShell>
      </>
    );
  }

  // Error state
  if (error || !courseData) {
    return (
      <>
        <Header
          title="Course Not Found"
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learning', href: '/learning' },
            { label: 'Not Found' },
          ]}
        />
        <PageShell>
          <Card className="border-[var(--error)] bg-[var(--error)]/10">
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-12 h-12 text-[var(--error)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    {error || 'The requested course could not be found.'}
                  </p>
                </div>
                <Link href="/learning">
                  <Button variant="primary">Back to Learning Center</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  const { course, chapters } = courseData;
  const totalLessons = chapters.reduce((sum, ch) => sum + ch.contents.length, 0);

  return (
    <>
      <Header
        title={course.title}
        subtitle={course.description}
        breadcrumbs={[
          { label: 'Dashboard' },
          { label: 'Learning', href: '/learning' },
          { label: course.title },
        ]}
        actions={
          <Link href="/learning">
            <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
              Back to Courses
            </Button>
          </Link>
        }
      />

      <PageShell>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Chapters & Lessons */}
          <div className="lg:col-span-2 space-y-4">
            {/* Course Header */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card variant="glow">
                <CardContent>
                  <div className="flex items-start gap-4">
                    {/* Course Image or Icon */}
                    {course.image_url ? (
                      <div
                        className="w-20 h-20 rounded-lg bg-cover bg-center flex-shrink-0"
                        style={{ backgroundImage: `url(${course.image_url})` }}
                      />
                    ) : (
                      <div className="w-20 h-20 flex items-center justify-center flex-shrink-0 rounded-lg bg-[var(--accent-primary-glow)]">
                        <GraduationCap className="w-10 h-10 text-[var(--accent-primary)]" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">
                          {course.title}
                        </h2>
                        <Badge variant="default" size="sm">
                          LMS
                        </Badge>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] mb-3 line-clamp-2">
                        {course.description || 'No description available'}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-[var(--text-tertiary)]">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          {chapters.length} chapters
                        </span>
                        <span className="flex items-center gap-1">
                          <Video className="w-4 h-4" />
                          {totalLessons} lessons
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Chapters Accordion */}
            <div className="space-y-3">
              {chapters.map((chapter, chapterIndex) => {
                const isExpanded = expandedChapters.has(chapter.thinkific_id);
                const ChevronIcon = isExpanded ? ChevronUp : ChevronDown;

                return (
                  <motion.div
                    key={chapter.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: chapterIndex * 0.05 }}
                  >
                    <Card>
                      {/* Chapter Header */}
                      <div
                        className="px-4 py-3 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                        onClick={() => toggleChapter(chapter.thinkific_id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary-glow)] flex items-center justify-center">
                              <span className="text-sm font-bold text-[var(--accent-primary)]">
                                {chapterIndex + 1}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-medium text-[var(--text-primary)]">
                                {chapter.name}
                              </h3>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                {chapter.contents.length} lessons
                              </p>
                            </div>
                          </div>
                          <ChevronIcon className="w-5 h-5 text-[var(--text-tertiary)]" />
                        </div>
                      </div>

                      {/* Chapter Contents (Lessons) */}
                      {isExpanded && chapter.contents.length > 0 && (
                        <div className="border-t border-[var(--border-primary)]">
                          {chapter.contents.map((content, contentIndex) => {
                            const ContentIcon =
                              contentTypeIcons[content.content_type] || BookOpen;

                            return (
                              <div
                                key={content.id}
                                className="px-4 py-3 flex items-center gap-4 border-b border-[var(--border-primary)] last:border-b-0 hover:bg-[var(--bg-secondary)] transition-colors"
                              >
                                {/* Content Icon */}
                                <div className="w-8 h-8 rounded flex items-center justify-center bg-[var(--bg-tertiary)]">
                                  <ContentIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                                </div>

                                {/* Content Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--text-muted)]">
                                      {chapterIndex + 1}.{contentIndex + 1}
                                    </span>
                                    {content.free_preview && (
                                      <Badge variant="success" size="sm">
                                        Free Preview
                                      </Badge>
                                    )}
                                  </div>
                                  <h4 className="font-medium text-[var(--text-primary)] truncate">
                                    {content.name}
                                  </h4>
                                  {content.description && (
                                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                                      {content.description}
                                    </p>
                                  )}
                                </div>

                                {/* Duration & Type */}
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  {content.video_duration && (
                                    <span className="text-xs text-[var(--text-muted)]">
                                      {formatDuration(content.video_duration)}
                                    </span>
                                  )}
                                  <Badge variant="default" size="sm">
                                    {content.content_type}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Empty chapter */}
                      {isExpanded && chapter.contents.length === 0 && (
                        <div className="px-4 py-6 text-center text-[var(--text-muted)] border-t border-[var(--border-primary)]">
                          No lessons in this chapter yet
                        </div>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Empty state if no chapters */}
            {chapters.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <GraduationCap className="w-16 h-16 mx-auto mb-4 text-[var(--text-tertiary)]" />
                  <p className="text-[var(--text-secondary)]">
                    No chapters available for this course yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Course Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader title="Course Overview" />
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-2xl font-bold text-[var(--accent-primary)]">
                          {chapters.length}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">Chapters</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-2xl font-bold text-[var(--accent-primary)]">
                          {totalLessons}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">Lessons</p>
                      </div>
                    </div>

                    {/* Access Course Button */}
                    <Button
                      variant="primary"
                      fullWidth
                      icon={<Play className="w-4 h-4" />}
                      onClick={() => {
                        // Open in Thinkific via SSO
                        window.open(
                          `https://kaycapitals.thinkific.com/courses/${course.slug}`,
                          '_blank'
                        );
                      }}
                    >
                      Access Course
                    </Button>
                    <p className="text-xs text-[var(--text-muted)] text-center">
                      Opens in Thinkific LMS
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Chapters Quick Nav */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
                <CardHeader title="Chapters" />
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {chapters.map((chapter, index) => (
                      <button
                        key={chapter.id}
                        onClick={() => toggleChapter(chapter.thinkific_id)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-[var(--bg-secondary)] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[var(--accent-primary)]">
                            {index + 1}
                          </span>
                          <span className="text-sm text-[var(--text-primary)] truncate">
                            {chapter.name}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] ml-5">
                          {chapter.contents.length} lessons
                        </p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Related YouTube Videos */}
            {relatedVideos.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardHeader
                    title="Related Videos"
                    action={
                      <Link href="/resources">
                        <Badge variant="default" size="sm" className="cursor-pointer hover:bg-[var(--bg-tertiary)]">
                          <Youtube className="w-3 h-3 mr-1 text-red-500" />
                          View All
                        </Badge>
                      </Link>
                    }
                  />
                  <CardContent>
                    <div className="space-y-3">
                      {relatedVideos.slice(0, 4).map((video) => (
                        <a
                          key={video.id}
                          href={`https://www.youtube.com/watch?v=${video.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group"
                        >
                          {/* Thumbnail */}
                          <div className="relative w-20 h-12 flex-shrink-0 rounded overflow-hidden bg-[var(--bg-tertiary)]">
                            {video.thumbnail_url ? (
                              <img
                                src={video.thumbnail_url}
                                alt={video.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Youtube className="w-5 h-5 text-[var(--text-tertiary)]" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="w-4 h-4 text-white" fill="currentColor" />
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-medium text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--accent-primary)] transition-colors">
                              {video.title}
                            </h4>
                            {video.category && (
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {video.category}
                              </span>
                            )}
                          </div>

                          <ExternalLink className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </PageShell>
    </>
  );
}
