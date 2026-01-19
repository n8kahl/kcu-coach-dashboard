'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { LearningProgress, QuizHistory } from '@/components/dashboard/learning-progress';
import { Button } from '@/components/ui/button';
import { SkeletonStats, SkeletonCard } from '@/components/ui/feedback';
import { Play, BookOpen, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ModuleProgress } from '@/types';

// Define the module structure for the LTP Framework curriculum
const CURRICULUM_MODULES = [
  {
    module: 'fundamentals',
    topics: ['account_types', 'broker_setup', 'chart_basics'],
  },
  {
    module: 'ltp_framework',
    topics: ['levels', 'trends', 'patience_candles'],
  },
  {
    module: 'entry_exit',
    topics: ['entry_rules', 'stop_losses', 'targets'],
  },
  {
    module: 'psychology',
    topics: ['mindset', 'discipline', 'handling_losses'],
  },
  {
    module: 'advanced',
    topics: ['options_greeks', 'spreads', 'scalping'],
  },
];

interface ProgressData {
  lessonProgress: Array<{
    lesson_id: string;
    completed: boolean;
    progress_percent: number;
    watch_time: number;
  }>;
  moduleProgress: Array<{
    module_id: string;
    progress_percent: number;
    completed: boolean;
  }>;
  recentQuizzes: Array<{
    topic_id: string;
    score: number;
    total_questions: number;
    completed_at: string;
  }>;
}

// Transform API data to component format
function transformProgressData(data: ProgressData | null): {
  modules: ModuleProgress[];
  quizHistory: Array<{ topic: string; score: number; total: number; date: string }>;
} {
  if (!data) {
    // Return default empty progress for new users
    return {
      modules: CURRICULUM_MODULES.map((curriculum) => ({
        module: curriculum.module,
        overallProgress: 0,
        topics: curriculum.topics.map((topic) => ({
          topic,
          status: 'not_started' as const,
        })),
      })),
      quizHistory: [],
    };
  }

  // Build a map of lesson progress by topic
  const lessonProgressMap = new Map(
    data.lessonProgress.map((lp) => [lp.lesson_id, lp])
  );

  // Build a map of module progress
  const moduleProgressMap = new Map(
    data.moduleProgress.map((mp) => [mp.module_id, mp])
  );

  // Transform modules
  const modules: ModuleProgress[] = CURRICULUM_MODULES.map((curriculum) => {
    const moduleData = moduleProgressMap.get(curriculum.module);

    // Calculate topic progress
    const topics = curriculum.topics.map((topicId) => {
      const topicProgress = lessonProgressMap.get(topicId);

      let status: 'not_started' | 'in_progress' | 'completed' | 'mastered' = 'not_started';
      let score: number | undefined;

      if (topicProgress) {
        const progressPercent = topicProgress.progress_percent;
        score = progressPercent;

        if (progressPercent >= 95) {
          status = 'mastered';
        } else if (progressPercent >= 70) {
          status = 'completed';
        } else if (progressPercent > 0) {
          status = 'in_progress';
        }
      }

      return { topic: topicId, status, score };
    });

    // Calculate overall module progress
    const overallProgress = moduleData?.progress_percent ??
      Math.round(
        topics.reduce((sum, t) => sum + (t.score || 0), 0) / topics.length
      );

    return {
      module: curriculum.module,
      overallProgress,
      topics,
    };
  });

  // Transform quiz history
  const quizHistory = data.recentQuizzes.map((quiz) => {
    const completedDate = new Date(quiz.completed_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));

    let dateLabel: string;
    if (diffDays === 0) {
      dateLabel = 'Today';
    } else if (diffDays === 1) {
      dateLabel = 'Yesterday';
    } else if (diffDays < 7) {
      dateLabel = `${diffDays} days ago`;
    } else {
      dateLabel = completedDate.toLocaleDateString();
    }

    return {
      topic: quiz.topic_id,
      score: quiz.score,
      total: quiz.total_questions,
      date: dateLabel,
    };
  });

  return { modules, quizHistory };
}

// Find the next lesson to continue
function findNextLesson(modules: ModuleProgress[]): { module: string; topic: string } | null {
  for (const module of modules) {
    for (const topic of module.topics) {
      if (topic.status === 'not_started' || topic.status === 'in_progress') {
        return { module: module.module, topic: topic.topic };
      }
    }
  }
  return null;
}

export default function ProgressPage() {
  const router = useRouter();
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProgress() {
      try {
        setLoading(true);
        const response = await fetch('/api/learning/progress');

        if (!response.ok) {
          if (response.status === 401) {
            // User not logged in - redirect to login
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch progress');
        }

        const data = await response.json();
        setProgressData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching progress:', err);
        setError('Unable to load your learning progress. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchProgress();
  }, [router]);

  const { modules, quizHistory } = transformProgressData(progressData);
  const overallProgress = Math.round(
    modules.reduce((sum, m) => sum + m.overallProgress, 0) / modules.length
  );

  const handleStudyMaterials = () => {
    // Navigate to the learning materials/curriculum page
    router.push('/learn');
  };

  const handleContinueLearning = () => {
    const nextLesson = findNextLesson(modules);
    if (nextLesson) {
      // Navigate to the specific lesson
      router.push(`/learn/${nextLesson.module}/${nextLesson.topic}`);
    } else {
      // All complete - go to advanced topics or review
      router.push('/learn/advanced');
    }
  };

  if (loading) {
    return (
      <>
        <Header
          title="Learning Progress"
          subtitle="Master the LTP Framework step by step"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Progress' }]}
        />
        <PageShell>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SkeletonCard className="h-[400px]" />
            </div>
            <div>
              <SkeletonCard className="h-[300px]" />
            </div>
          </div>
        </PageShell>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header
          title="Learning Progress"
          subtitle="Master the LTP Framework step by step"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Progress' }]}
        />
        <PageShell>
          <Card variant="bordered">
            <CardContent className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[var(--error)]" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Unable to Load Progress
              </h3>
              <p className="text-sm text-[var(--text-tertiary)] mb-4">
                {error}
              </p>
              <Button
                variant="primary"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  return (
    <>
      <Header
        title="Learning Progress"
        subtitle="Master the LTP Framework step by step"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Progress' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<BookOpen className="w-4 h-4" />}
              onClick={handleStudyMaterials}
            >
              Study Materials
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Play className="w-4 h-4" />}
              onClick={handleContinueLearning}
            >
              Continue Learning
            </Button>
          </div>
        }
      />

      <PageShell>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Progress */}
          <div className="lg:col-span-2">
            <LearningProgress modules={modules} overallProgress={overallProgress} />
          </div>

          {/* Quiz History */}
          <div>
            <QuizHistory quizzes={quizHistory} />
          </div>
        </div>
      </PageShell>
    </>
  );
}
