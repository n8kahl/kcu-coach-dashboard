'use client';

import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { LearningProgress, QuizHistory } from '@/components/dashboard/learning-progress';
import { Button } from '@/components/ui/button';
import { Play, BookOpen } from 'lucide-react';
import type { ModuleProgress } from '@/types';

// Mock learning progress data
const mockModules: ModuleProgress[] = [
  {
    module: 'fundamentals',
    overallProgress: 100,
    topics: [
      { topic: 'account_types', status: 'mastered', score: 95 },
      { topic: 'broker_setup', status: 'mastered', score: 90 },
      { topic: 'chart_basics', status: 'completed', score: 85 },
    ],
  },
  {
    module: 'ltp_framework',
    overallProgress: 85,
    topics: [
      { topic: 'levels', status: 'mastered', score: 100 },
      { topic: 'trends', status: 'completed', score: 88 },
      { topic: 'patience_candles', status: 'in_progress', score: 70 },
    ],
  },
  {
    module: 'entry_exit',
    overallProgress: 60,
    topics: [
      { topic: 'entry_rules', status: 'completed', score: 82 },
      { topic: 'stop_losses', status: 'in_progress', score: 65 },
      { topic: 'targets', status: 'not_started' },
    ],
  },
  {
    module: 'psychology',
    overallProgress: 45,
    topics: [
      { topic: 'mindset', status: 'completed', score: 78 },
      { topic: 'discipline', status: 'in_progress', score: 55 },
      { topic: 'handling_losses', status: 'not_started' },
    ],
  },
  {
    module: 'advanced',
    overallProgress: 0,
    topics: [
      { topic: 'options_greeks', status: 'not_started' },
      { topic: 'spreads', status: 'not_started' },
      { topic: 'scalping', status: 'not_started' },
    ],
  },
];

// Mock quiz history
const mockQuizHistory = [
  { topic: 'levels', score: 5, total: 5, date: 'Today' },
  { topic: 'trends', score: 4, total: 5, date: 'Yesterday' },
  { topic: 'patience_candles', score: 3, total: 5, date: '2 days ago' },
  { topic: 'entry_rules', score: 4, total: 5, date: '3 days ago' },
  { topic: 'stop_losses', score: 3, total: 5, date: '4 days ago' },
];

// Calculate overall progress
const overallProgress = Math.round(
  mockModules.reduce((sum, m) => sum + m.overallProgress, 0) / mockModules.length
);

export default function ProgressPage() {
  return (
    <>
      <Header
        title="Learning Progress"
        subtitle="Master the LTP Framework step by step"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Progress' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<BookOpen className="w-4 h-4" />}>
              Study Materials
            </Button>
            <Button variant="primary" size="sm" icon={<Play className="w-4 h-4" />}>
              Continue Learning
            </Button>
          </div>
        }
      />

      <PageShell>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Progress */}
          <div className="lg:col-span-2">
            <LearningProgress modules={mockModules} overallProgress={overallProgress} />
          </div>

          {/* Quiz History */}
          <div>
            <QuizHistory quizzes={mockQuizHistory} />
          </div>
        </div>
      </PageShell>
    </>
  );
}
