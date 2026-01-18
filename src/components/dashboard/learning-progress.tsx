'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Star,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ProgressBar, CircularProgress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { ModuleProgress, TopicProgress } from '@/types';

interface LearningProgressProps {
  modules: ModuleProgress[];
  overallProgress: number;
}

export function LearningProgress({ modules, overallProgress }: LearningProgressProps) {
  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card variant="glow">
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
                Learning Journey
              </h3>
              <p className="text-sm text-[var(--text-tertiary)]">
                Master the LTP Framework
              </p>
            </div>
            <CircularProgress
              value={overallProgress}
              size={80}
              strokeWidth={8}
              variant="gold"
            />
          </div>
        </CardContent>
      </Card>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map((module, index) => (
          <ModuleCard key={module.module} module={module} index={index} />
        ))}
      </div>
    </div>
  );
}

interface ModuleCardProps {
  module: ModuleProgress;
  index: number;
}

function ModuleCard({ module, index }: ModuleCardProps) {
  const moduleLabels: Record<string, { name: string; description: string; icon: React.ElementType }> = {
    fundamentals: {
      name: 'Fundamentals',
      description: 'Account setup and chart basics',
      icon: BookOpen,
    },
    ltp_framework: {
      name: 'LTP Framework',
      description: 'Levels, Trends, Patience Candles',
      icon: Star,
    },
    entry_exit: {
      name: 'Entry & Exit',
      description: 'Rules for entries, stops, targets',
      icon: CheckCircle2,
    },
    psychology: {
      name: 'Psychology',
      description: 'Mindset and discipline',
      icon: Clock,
    },
    advanced: {
      name: 'Advanced',
      description: 'Options Greeks and spreads',
      icon: Star,
    },
  };

  const info = moduleLabels[module.module] || {
    name: module.module,
    description: '',
    icon: BookOpen,
  };
  const Icon = info.icon;

  const isLocked = index > 0 && module.overallProgress === 0;
  const isComplete = module.overallProgress === 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card
        hoverable={!isLocked}
        className={cn(isLocked && 'opacity-50 cursor-not-allowed')}
      >
        <CardContent>
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className={cn(
                'w-12 h-12 flex items-center justify-center flex-shrink-0',
                isComplete
                  ? 'bg-[rgba(34,197,94,0.15)] text-[var(--profit)]'
                  : isLocked
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                  : 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)]'
              )}
            >
              {isLocked ? (
                <Lock className="w-5 h-5" />
              ) : isComplete ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-[var(--text-primary)]">{info.name}</h4>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isComplete
                      ? 'text-[var(--profit)]'
                      : isLocked
                      ? 'text-[var(--text-muted)]'
                      : 'text-[var(--accent-primary)]'
                  )}
                >
                  {module.overallProgress}%
                </span>
              </div>
              <p className="text-xs text-[var(--text-tertiary)] mb-3">{info.description}</p>

              {/* Progress bar */}
              <ProgressBar
                value={module.overallProgress}
                variant={isComplete ? 'success' : 'gold'}
                size="sm"
              />

              {/* Topics */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {module.topics.map((topic) => (
                  <TopicBadge key={topic.topic} topic={topic} />
                ))}
              </div>
            </div>

            {/* Arrow */}
            {!isLocked && (
              <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0" />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TopicBadge({ topic }: { topic: TopicProgress }) {
  const statusIcons = {
    not_started: Circle,
    in_progress: Clock,
    completed: CheckCircle2,
    mastered: Star,
  };

  const statusColors = {
    not_started: 'default' as const,
    in_progress: 'warning' as const,
    completed: 'success' as const,
    mastered: 'gold' as const,
  };

  const Icon = statusIcons[topic.status];

  // Format topic name
  const formatTopicName = (name: string) => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Badge
      variant={statusColors[topic.status]}
      size="sm"
      className="gap-1"
    >
      <Icon className="w-3 h-3" />
      {formatTopicName(topic.topic)}
      {topic.score !== undefined && (
        <span className="ml-1 opacity-70">{topic.score}%</span>
      )}
    </Badge>
  );
}

// Quiz History Component
interface QuizHistoryProps {
  quizzes: {
    topic: string;
    score: number;
    total: number;
    date: string;
  }[];
}

export function QuizHistory({ quizzes }: QuizHistoryProps) {
  return (
    <Card>
      <CardHeader title="Quiz History" subtitle="Recent quiz attempts" />
      <CardContent>
        <div className="space-y-3">
          {quizzes.map((quiz, index) => {
            const percentage = (quiz.score / quiz.total) * 100;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 p-3 bg-[var(--bg-tertiary)]"
              >
                <div
                  className={cn(
                    'w-10 h-10 flex items-center justify-center font-bold',
                    percentage >= 90
                      ? 'bg-[rgba(245,158,11,0.15)] text-[var(--accent-primary)]'
                      : percentage >= 70
                      ? 'bg-[rgba(34,197,94,0.15)] text-[var(--profit)]'
                      : 'bg-[rgba(239,68,68,0.15)] text-[var(--loss)]'
                  )}
                >
                  {percentage.toFixed(0)}%
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {quiz.topic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {quiz.score}/{quiz.total} correct
                  </p>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{quiz.date}</span>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
