'use client';

/**
 * Course Player Page
 *
 * Full-featured course player with:
 * - Sidebar: Modules/Lessons with progress checkmarks
 * - Main: Video player using Cloudflare Stream
 * - Tabs: Overview, Resources, Transcript, AI Assistant
 */

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Clock,
  CheckCircle2,
  Play,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  FileText,
  Download,
  ExternalLink,
  Send,
  Sparkles,
  Info,
  Files,
  Bot,
} from 'lucide-react';
import Link from 'next/link';

// Types
interface Resource {
  name: string;
  url: string;
  type: string;
}

interface Lesson {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  lessonNumber: string;
  videoDurationSeconds: number | null;
  videoUid: string | null;
  videoPlaybackHls: string | null;
  thumbnailUrl: string | null;
  transcriptText: string | null;
  resources: Resource[];
  isPreview: boolean;
  sortOrder: number;
  completed?: boolean;
  progressPercent?: number;
}

interface Module {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  moduleNumber: string;
  sortOrder: number;
  lessons: Lesson[];
  completedLessons: number;
  totalLessons: number;
}

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  modules: Module[];
}

interface CourseProgress {
  totalLessons: number;
  completedLessons: number;
  completionPercent: number;
}

// Tabs
type Tab = 'overview' | 'resources' | 'transcript' | 'ai';

export default function CoursePlayerPage() {
  const params = useParams();
  const router = useRouter();
  const courseSlug = params.module as string; // Using 'module' param as courseSlug

  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Current lesson state
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // AI Chat state
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Fetch course data
  useEffect(() => {
    if (courseSlug) {
      fetchCourse();
    }
  }, [courseSlug]);

  const fetchCourse = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/learn/courses/${courseSlug}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Course not found');
        }
        throw new Error('Failed to fetch course');
      }

      const data = await response.json();
      setCourse(data.course);
      setProgress(data.progress);

      // Set initial module/lesson
      if (data.course.modules && data.course.modules.length > 0) {
        const firstModule = data.course.modules[0];
        setCurrentModule(firstModule);
        setExpandedModules(new Set([firstModule.id]));

        if (firstModule.lessons && firstModule.lessons.length > 0) {
          setCurrentLesson(firstModule.lessons[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching course:', err);
      setError(err instanceof Error ? err.message : 'Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const selectLesson = useCallback((lesson: Lesson, module: Module) => {
    setCurrentLesson(lesson);
    setCurrentModule(module);
    setExpandedModules((prev) => {
      const arr = Array.from(prev);
      arr.push(module.id);
      return new Set(arr);
    });
    // Reset AI chat when changing lessons
    setAiMessages([]);
  }, []);

  const toggleModule = useCallback((moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }, []);

  // Find next/previous lessons
  const getAdjacentLessons = useCallback(() => {
    if (!course || !currentLesson || !currentModule) return { prev: null, next: null };

    const allLessons: { lesson: Lesson; module: Module }[] = [];
    course.modules.forEach((mod) => {
      mod.lessons.forEach((les) => {
        allLessons.push({ lesson: les, module: mod });
      });
    });

    const currentIndex = allLessons.findIndex((l) => l.lesson.id === currentLesson.id);

    return {
      prev: currentIndex > 0 ? allLessons[currentIndex - 1] : null,
      next: currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null,
    };
  }, [course, currentLesson, currentModule]);

  // AI Chat handler
  const sendAiMessage = async () => {
    if (!aiInput.trim() || !currentLesson) return;

    const userMessage = aiInput.trim();
    setAiInput('');
    setAiMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setAiLoading(true);

    try {
      const response = await fetch('/api/ai/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          mode: 'coach',
          context: {
            lessonId: currentLesson.id,
            lessonTitle: currentLesson.title,
            moduleTitle: currentModule?.title,
            courseTitle: course?.title,
            transcriptContext: currentLesson.transcriptText?.slice(0, 2000),
          },
          conversationHistory: aiMessages,
        }),
      });

      if (!response.ok) throw new Error('AI request failed');

      const data = await response.json();
      setAiMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header
          title="Loading..."
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Learning', href: '/learning' }, { label: 'Course' }]}
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

  if (error || !course) {
    return (
      <>
        <Header
          title="Error"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Learning', href: '/learning' }, { label: 'Course' }]}
        />
        <PageShell>
          <Card className="border-[var(--error)] bg-[var(--error)]/10">
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-12 h-12 text-[var(--error)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{error}</p>
                  <div className="flex gap-2 mt-4">
                    <Button variant="secondary" onClick={fetchCourse}>
                      Try Again
                    </Button>
                    <Link href="/learning">
                      <Button variant="ghost">Back to Courses</Button>
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

  const { prev, next } = getAdjacentLessons();

  return (
    <>
      <Header
        title={course.title}
        breadcrumbs={[
          { label: 'Dashboard' },
          { label: 'Learning', href: '/learning' },
          { label: course.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              {sidebarOpen ? 'Hide' : 'Show'} Lessons
            </Button>
            {progress && (
              <Badge variant="default">
                {progress.completedLessons}/{progress.totalLessons} Complete
              </Badge>
            )}
          </div>
        }
      />

      <PageShell maxWidth="full" padding="sm">
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)]">
          {/* Sidebar - Modules & Lessons */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full lg:w-80 flex-shrink-0 overflow-y-auto"
              >
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Course Content</CardTitle>
                      {progress && (
                        <span className="text-sm text-[var(--text-tertiary)]">
                          {Math.round(progress.completionPercent)}%
                        </span>
                      )}
                    </div>
                    {progress && (
                      <ProgressBar value={progress.completionPercent} variant="gold" size="sm" />
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {course.modules.map((module) => (
                      <ModuleAccordion
                        key={module.id}
                        module={module}
                        isExpanded={expandedModules.has(module.id)}
                        onToggle={() => toggleModule(module.id)}
                        currentLessonId={currentLesson?.id}
                        onSelectLesson={(lesson) => selectLesson(lesson, module)}
                      />
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-hidden">
            {currentLesson ? (
              <>
                {/* Video Player */}
                <Card className="flex-shrink-0">
                  <div className="aspect-video bg-black relative">
                    {currentLesson.videoUid ? (
                      <CloudflareStreamPlayer
                        videoUid={currentLesson.videoUid}
                        poster={currentLesson.thumbnailUrl || undefined}
                      />
                    ) : currentLesson.videoPlaybackHls ? (
                      <video
                        src={currentLesson.videoPlaybackHls}
                        poster={currentLesson.thumbnailUrl || undefined}
                        controls
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)]">
                        <div className="text-center">
                          <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                          <p>Video not available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Lesson Info & Tabs */}
                <Card className="flex-1 overflow-hidden flex flex-col">
                  {/* Lesson Header */}
                  <CardHeader className="flex-shrink-0 pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Lesson {currentLesson.lessonNumber}</Badge>
                        {currentLesson.completed && (
                          <Badge variant="success">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                      </div>
                      {currentLesson.videoDurationSeconds && (
                        <span className="text-sm text-[var(--text-tertiary)]">
                          <Clock className="w-4 h-4 inline mr-1" />
                          {Math.floor(currentLesson.videoDurationSeconds / 60)}m
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                      {currentLesson.title}
                    </h2>
                  </CardHeader>

                  {/* Tabs */}
                  <div className="flex border-b border-[var(--border-primary)] px-6">
                    <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
                      <Info className="w-4 h-4 mr-2" />
                      Overview
                    </TabButton>
                    <TabButton active={activeTab === 'resources'} onClick={() => setActiveTab('resources')}>
                      <Files className="w-4 h-4 mr-2" />
                      Resources
                      {currentLesson.resources.length > 0 && (
                        <Badge variant="default" size="sm" className="ml-2">
                          {currentLesson.resources.length}
                        </Badge>
                      )}
                    </TabButton>
                    <TabButton active={activeTab === 'transcript'} onClick={() => setActiveTab('transcript')}>
                      <FileText className="w-4 h-4 mr-2" />
                      Transcript
                    </TabButton>
                    <TabButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')}>
                      <Bot className="w-4 h-4 mr-2" />
                      AI Assistant
                    </TabButton>
                  </div>

                  {/* Tab Content */}
                  <CardContent className="flex-1 overflow-y-auto py-4">
                    {activeTab === 'overview' && (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {currentLesson.description ? (
                          <p>{currentLesson.description}</p>
                        ) : (
                          <p className="text-[var(--text-tertiary)]">No description available for this lesson.</p>
                        )}
                      </div>
                    )}

                    {activeTab === 'resources' && (
                      <div className="space-y-3">
                        {currentLesson.resources.length > 0 ? (
                          currentLesson.resources.map((resource, index) => (
                            <a
                              key={index}
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                              <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
                                {resource.type === 'pdf' ? (
                                  <FileText className="w-5 h-5 text-[var(--accent-primary)]" />
                                ) : (
                                  <Download className="w-5 h-5 text-[var(--accent-primary)]" />
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-[var(--text-primary)]">{resource.name}</p>
                                <p className="text-sm text-[var(--text-tertiary)]">{resource.type.toUpperCase()}</p>
                              </div>
                              <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)]" />
                            </a>
                          ))
                        ) : (
                          <p className="text-[var(--text-tertiary)] text-center py-8">
                            No resources available for this lesson.
                          </p>
                        )}
                      </div>
                    )}

                    {activeTab === 'transcript' && (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {currentLesson.transcriptText ? (
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                            {currentLesson.transcriptText}
                          </pre>
                        ) : (
                          <p className="text-[var(--text-tertiary)] text-center py-8">
                            Transcript not available for this lesson.
                          </p>
                        )}
                      </div>
                    )}

                    {activeTab === 'ai' && (
                      <AIAssistantChat
                        messages={aiMessages}
                        input={aiInput}
                        loading={aiLoading}
                        lessonTitle={currentLesson.title}
                        onInputChange={setAiInput}
                        onSend={sendAiMessage}
                      />
                    )}
                  </CardContent>

                  {/* Navigation */}
                  <div className="flex-shrink-0 border-t border-[var(--border-primary)] p-4">
                    <div className="flex items-center justify-between">
                      {prev ? (
                        <Button
                          variant="ghost"
                          onClick={() => selectLesson(prev.lesson, prev.module)}
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Previous
                        </Button>
                      ) : (
                        <div />
                      )}
                      {next ? (
                        <Button
                          variant="primary"
                          onClick={() => selectLesson(next.lesson, next.module)}
                        >
                          Next Lesson
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      ) : (
                        <Link href="/learning">
                          <Button variant="primary">
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Complete Course
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <BookOpen className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
                  <p className="text-[var(--text-secondary)]">Select a lesson to start learning</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </PageShell>
    </>
  );
}

// Module Accordion Component
function ModuleAccordion({
  module,
  isExpanded,
  onToggle,
  currentLessonId,
  onSelectLesson,
}: {
  module: Module;
  isExpanded: boolean;
  onToggle: () => void;
  currentLessonId?: string;
  onSelectLesson: (lesson: Lesson) => void;
}) {
  const completionPercent = module.totalLessons > 0
    ? Math.round((module.completedLessons / module.totalLessons) * 100)
    : 0;

  return (
    <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <div className="flex-shrink-0">
          {completionPercent === 100 ? (
            <CheckCircle2 className="w-5 h-5 text-[var(--profit)]" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-[var(--border-secondary)] flex items-center justify-center">
              <span className="text-xs text-[var(--text-muted)]">{module.moduleNumber}</span>
            </div>
          )}
        </div>
        <div className="flex-1 text-left">
          <p className="font-medium text-[var(--text-primary)] text-sm">{module.title}</p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {module.completedLessons}/{module.totalLessons} lessons
          </p>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
              {module.lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  onClick={() => onSelectLesson(lesson)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                    lesson.id === currentLessonId
                      ? 'bg-[var(--accent-primary)]/10 border-l-2 border-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {lesson.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--profit)]" />
                    ) : lesson.id === currentLessonId ? (
                      <Play className="w-4 h-4 text-[var(--accent-primary)]" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-[var(--border-secondary)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${
                      lesson.id === currentLessonId
                        ? 'text-[var(--accent-primary)] font-medium'
                        : 'text-[var(--text-primary)]'
                    }`}>
                      {lesson.title}
                    </p>
                  </div>
                  {lesson.videoDurationSeconds && (
                    <span className="text-xs text-[var(--text-muted)]">
                      {Math.floor(lesson.videoDurationSeconds / 60)}m
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
          : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  );
}

// Cloudflare Stream Player Component
function CloudflareStreamPlayer({
  videoUid,
  poster,
}: {
  videoUid: string;
  poster?: string;
}) {
  return (
    <iframe
      src={`https://iframe.cloudflarestream.com/${videoUid}?poster=${poster ? encodeURIComponent(poster) : ''}`}
      className="w-full h-full"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}

// AI Assistant Chat Component
function AIAssistantChat({
  messages,
  input,
  loading,
  lessonTitle,
  onInputChange,
  onSend,
}: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  input: string;
  loading: boolean;
  lessonTitle: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full min-h-[300px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-[var(--accent-primary)] mx-auto mb-3" />
            <h3 className="font-medium text-[var(--text-primary)] mb-2">
              AI Assistant for "{lessonTitle}"
            </h3>
            <p className="text-sm text-[var(--text-tertiary)] max-w-md mx-auto">
              Ask questions about this lesson. The AI has context from the transcript and can explain concepts, clarify points, or help you understand the material better.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <SuggestionButton onClick={() => onInputChange('Summarize the key points of this lesson')}>
                Summarize key points
              </SuggestionButton>
              <SuggestionButton onClick={() => onInputChange('What are the main takeaways?')}>
                Main takeaways
              </SuggestionButton>
              <SuggestionButton onClick={() => onInputChange('Explain this concept in simpler terms')}>
                Explain simply
              </SuggestionButton>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-[var(--accent-primary)] text-black'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-secondary)] rounded-lg px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
          placeholder="Ask about this lesson..."
          className="flex-1 px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
          disabled={loading}
        />
        <Button onClick={onSend} disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function SuggestionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
    >
      {children}
    </button>
  );
}
