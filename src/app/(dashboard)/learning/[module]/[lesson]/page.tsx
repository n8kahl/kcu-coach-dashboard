'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { getModuleBySlug } from '@/data/curriculum';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  BookOpen,
  Play,
  Pause,
  SkipForward,
  MessageSquare,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const moduleSlug = params.module as string;
  const lessonSlug = params.lesson as string;

  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const module = getModuleBySlug(moduleSlug);

  if (!module) {
    return (
      <>
        <Header
          title="Lesson Not Found"
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learning' },
            { label: 'Not Found' },
          ]}
        />
        <PageShell>
          <Card>
            <CardContent>
              <p className="text-[var(--text-secondary)]">
                The requested lesson could not be found.
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

  const lessonIndex = module.lessons.findIndex((l) => l.slug === lessonSlug);
  const lesson = module.lessons[lessonIndex];

  if (!lesson) {
    return (
      <>
        <Header
          title="Lesson Not Found"
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learning' },
            { label: module.title },
            { label: 'Not Found' },
          ]}
        />
        <PageShell>
          <Card>
            <CardContent>
              <p className="text-[var(--text-secondary)]">
                The requested lesson could not be found.
              </p>
              <Link href={`/learning/${moduleSlug}`}>
                <Button variant="primary" className="mt-4">
                  Back to {module.title}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  const prevLesson = lessonIndex > 0 ? module.lessons[lessonIndex - 1] : null;
  const nextLesson =
    lessonIndex < module.lessons.length - 1 ? module.lessons[lessonIndex + 1] : null;

  const handleComplete = () => {
    setIsCompleted(true);
    // In real app, save to API
  };

  const handleNext = () => {
    if (nextLesson) {
      router.push(`/learning/${moduleSlug}/${nextLesson.slug}`);
    } else {
      router.push(`/learning/${moduleSlug}`);
    }
  };

  return (
    <>
      <Header
        title={lesson.title}
        subtitle={`${module.title} • Lesson ${lessonIndex + 1} of ${module.lessons.length}`}
        breadcrumbs={[
          { label: 'Dashboard' },
          { label: 'Learning', href: '/learning' },
          { label: module.title, href: `/learning/${moduleSlug}` },
          { label: lesson.title },
        ]}
        actions={
          <Link href={`/learning/${moduleSlug}`}>
            <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
              Back to Module
            </Button>
          </Link>
        }
      />

      <PageShell>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player Placeholder */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="overflow-hidden">
                <div className="aspect-video bg-[var(--bg-elevated)] relative">
                  {/* Video placeholder - in real app, embed actual video */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div
                      className="w-20 h-20 flex items-center justify-center bg-[var(--accent-primary)] cursor-pointer hover:bg-[var(--accent-primary-hover)] transition-colors"
                      onClick={() => setIsPlaying(!isPlaying)}
                    >
                      {isPlaying ? (
                        <Pause className="w-10 h-10 text-black" />
                      ) : (
                        <Play className="w-10 h-10 text-black ml-1" />
                      )}
                    </div>
                    <p className="mt-4 text-[var(--text-secondary)]">
                      {isPlaying ? 'Playing...' : 'Click to play video'}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      Video ID: {lesson.video_id}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--bg-tertiary)]">
                    <div
                      className="h-full bg-[var(--accent-primary)]"
                      style={{ width: isPlaying ? '35%' : '0%' }}
                    />
                  </div>
                </div>

                {/* Video Controls */}
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-[var(--text-secondary)]">
                        {formatDuration(lesson.duration)}
                      </span>
                      <Badge variant="default" size="sm">
                        <Clock className="w-3 h-3 mr-1" />
                        {Math.floor(lesson.duration / 60)} min
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTranscript(!showTranscript)}
                      >
                        {showTranscript ? (
                          <ChevronUp className="w-4 h-4 mr-1" />
                        ) : (
                          <ChevronDown className="w-4 h-4 mr-1" />
                        )}
                        Transcript
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Transcript Section */}
            {showTranscript && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <Card>
                  <CardHeader title="Video Transcript" />
                  <CardContent>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <p className="text-[var(--text-secondary)] leading-relaxed">
                        {lesson.transcript ||
                          'Transcript will be available soon. The video covers ' +
                            lesson.description.toLowerCase() +
                            '. Watch the full video for detailed explanations and examples.'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Key Takeaways */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader
                  title="Key Takeaways"
                  subtitle="Important concepts from this lesson"
                  icon={<Lightbulb className="w-5 h-5 text-[var(--accent-primary)]" />}
                />
                <CardContent>
                  <ul className="space-y-3">
                    {lesson.key_takeaways.map((takeaway, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                        className="flex items-start gap-3"
                      >
                        <CheckCircle2 className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                        <span className="text-[var(--text-secondary)]">{takeaway}</span>
                      </motion.li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            {/* Navigation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardContent>
                  <div className="flex items-center justify-between">
                    {/* Previous */}
                    <div>
                      {prevLesson ? (
                        <Link href={`/learning/${moduleSlug}/${prevLesson.slug}`}>
                          <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />}>
                            Previous
                          </Button>
                        </Link>
                      ) : (
                        <div />
                      )}
                    </div>

                    {/* Complete / Next */}
                    <div className="flex items-center gap-2">
                      {!isCompleted ? (
                        <Button
                          variant="primary"
                          onClick={handleComplete}
                          icon={<CheckCircle2 className="w-4 h-4" />}
                        >
                          Mark as Complete
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={handleNext}
                          icon={
                            nextLesson ? (
                              <ArrowRight className="w-4 h-4" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )
                          }
                        >
                          {nextLesson ? 'Next Lesson' : 'Finish Module'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Lesson Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader title="Lesson Info" />
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-[var(--border-primary)]">
                      <span className="text-sm text-[var(--text-muted)]">Module</span>
                      <span className="text-sm text-[var(--text-primary)]">{module.title}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[var(--border-primary)]">
                      <span className="text-sm text-[var(--text-muted)]">Lesson</span>
                      <span className="text-sm text-[var(--text-primary)]">
                        {lessonIndex + 1} of {module.lessons.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[var(--border-primary)]">
                      <span className="text-sm text-[var(--text-muted)]">Duration</span>
                      <span className="text-sm text-[var(--text-primary)]">
                        {Math.floor(lesson.duration / 60)} minutes
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-[var(--text-muted)]">Status</span>
                      <Badge variant={isCompleted ? 'success' : 'warning'} size="sm">
                        {isCompleted ? 'Completed' : 'In Progress'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Module Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
                <CardHeader title="Module Progress" />
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[var(--text-secondary)]">Progress</span>
                      <span className="text-sm font-medium text-[var(--accent-primary)]">
                        {Math.round(((lessonIndex + (isCompleted ? 1 : 0)) / module.lessons.length) * 100)}%
                      </span>
                    </div>
                    <ProgressBar
                      value={((lessonIndex + (isCompleted ? 1 : 0)) / module.lessons.length) * 100}
                      variant="gold"
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      {lessonIndex + (isCompleted ? 1 : 0)} of {module.lessons.length} lessons
                      completed
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Ask AI Coach */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader
                  title="Need Help?"
                  icon={<MessageSquare className="w-5 h-5 text-[var(--accent-primary)]" />}
                />
                <CardContent>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Ask the AI Coach about concepts from this lesson.
                  </p>
                  <Button variant="secondary" fullWidth>
                    Ask AI Coach
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Up Next */}
            {nextLesson && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card>
                  <CardHeader title="Up Next" />
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 flex items-center justify-center bg-[var(--bg-tertiary)] flex-shrink-0">
                        <SkipForward className="w-5 h-5 text-[var(--text-secondary)]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {nextLesson.title}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {Math.floor(nextLesson.duration / 60)} min
                        </p>
                      </div>
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
