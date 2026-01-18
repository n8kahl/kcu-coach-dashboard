'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type {
  RichContent,
  LessonLinkContent,
  ChartWidgetContent,
  SetupVisualizationContent,
  QuizPromptContent,
} from '@/types';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Target,
  Brain,
  ExternalLink,
  ChevronRight,
  LineChart,
  Play,
} from 'lucide-react';

// ============================================
// Main Rich Content Renderer
// ============================================

interface RichContentRendererProps {
  content: RichContent[];
  className?: string;
}

export function RichContentRenderer({ content, className }: RichContentRendererProps) {
  if (!content || content.length === 0) return null;

  return (
    <div className={cn('space-y-3 mt-3', className)}>
      {content.map((item, index) => {
        switch (item.type) {
          case 'lesson_link':
            return <LessonCard key={`lesson-${index}`} lesson={item} />;
          case 'chart':
            return <InlineChart key={`chart-${index}`} chart={item} />;
          case 'setup':
            return <SetupCard key={`setup-${index}`} setup={item} />;
          case 'quiz':
            return <QuizCard key={`quiz-${index}`} quiz={item} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

// ============================================
// Lesson Card Component
// ============================================

interface LessonCardProps {
  lesson: LessonLinkContent;
}

function LessonCardComponent({ lesson }: LessonCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/learning/${lesson.moduleId}/${lesson.lessonId}`}
        className="block group"
      >
        <div
          className={cn(
            'bg-[var(--bg-primary)] border border-[var(--border-primary)]',
            'hover:border-[var(--accent-primary-muted)] hover:bg-[var(--bg-card-hover)]',
            'transition-all duration-200'
          )}
        >
          <div className="p-3 flex items-center gap-3">
            {/* Icon */}
            <div
              className={cn(
                'w-10 h-10 shrink-0 flex items-center justify-center',
                'bg-[var(--accent-primary-glow)]'
              )}
            >
              <BookOpen className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--text-primary)] truncate text-sm">
                {lesson.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {lesson.moduleTitle && (
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {lesson.moduleTitle}
                  </span>
                )}
                <span className="text-xs text-[var(--text-muted)]">
                  {lesson.duration}
                </span>
              </div>
            </div>

            {/* Arrow */}
            <div className="shrink-0 flex items-center gap-1 text-[var(--accent-primary)]">
              <Play className="w-3 h-3" />
              <span className="text-xs font-medium group-hover:underline">
                Watch
              </span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export const LessonCard = memo(LessonCardComponent);

// ============================================
// Inline Chart Component
// ============================================

interface InlineChartProps {
  chart: ChartWidgetContent;
}

function InlineChartComponent({ chart }: InlineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing content
    containerRef.current.innerHTML = '';

    // Create the widget container div
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';
    containerRef.current.appendChild(widgetContainer);

    // Determine exchange prefix
    const symbol = chart.symbol.includes(':')
      ? chart.symbol
      : `NASDAQ:${chart.symbol}`;

    // Create and configure the script
    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      width: '100%',
      height: 160,
      locale: 'en',
      dateRange: '1D',
      colorTheme: 'dark',
      isTransparent: true,
      autosize: false,
      largeChartUrl: '',
    });

    script.onload = () => setIsLoaded(true);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [chart.symbol, chart.interval]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'bg-[var(--bg-primary)] border border-[var(--border-primary)]',
        'overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-secondary)]">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="font-medium text-[var(--text-primary)] text-sm">
            {chart.symbol}
          </span>
          <span className="text-xs text-[var(--text-tertiary)] px-1.5 py-0.5 bg-[var(--bg-secondary)]">
            {chart.interval}m
          </span>
        </div>
        <a
          href={`https://www.tradingview.com/chart/?symbol=${chart.symbol}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline"
        >
          Full Chart
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Chart Container */}
      <div
        ref={containerRef}
        className="h-[160px] w-full"
        style={{ minHeight: '160px' }}
      />

      {/* Indicators */}
      {chart.indicators && chart.indicators.length > 0 && (
        <div className="px-3 py-2 border-t border-[var(--border-secondary)] flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">Indicators:</span>
          {chart.indicators.map((indicator) => (
            <span
              key={indicator}
              className="text-xs px-1.5 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
            >
              {indicator}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export const InlineChart = memo(InlineChartComponent);

// ============================================
// Setup Card Component with LTP Scores
// ============================================

interface SetupCardProps {
  setup: SetupVisualizationContent;
}

function SetupCardComponent({ setup }: SetupCardProps) {
  const { symbol, direction, entry, stop, target, ltpScore } = setup;

  // Calculate R:R
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const riskReward = risk > 0 ? (reward / risk).toFixed(1) : '0';

  // Determine grade color
  const gradeColors: Record<string, string> = {
    A: 'text-green-400',
    B: 'text-green-300',
    C: 'text-yellow-400',
    D: 'text-orange-400',
    F: 'text-red-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'bg-[var(--bg-primary)] border border-[var(--border-primary)]',
        'overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-secondary)]">
        <div className="flex items-center gap-2">
          {direction === 'long' ? (
            <TrendingUp className="w-5 h-5 text-green-400" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-400" />
          )}
          <span className="font-bold text-[var(--text-primary)]">{symbol}</span>
          <span
            className={cn(
              'text-xs px-2 py-0.5 font-medium',
              direction === 'long'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            )}
          >
            {direction.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn('text-2xl font-bold', gradeColors[ltpScore.grade] || 'text-gray-400')}
          >
            {ltpScore.grade}
          </span>
          <span className="text-sm text-[var(--text-tertiary)]">
            {ltpScore.total}/100
          </span>
        </div>
      </div>

      {/* LTP Score Bars */}
      <div className="p-3 space-y-2">
        <ScoreRow label="Level" score={ltpScore.level} />
        <ScoreRow label="Trend" score={ltpScore.trend} />
        <ScoreRow label="Patience" score={ltpScore.patience} />
      </div>

      {/* Trade Levels */}
      <div className="grid grid-cols-3 gap-px bg-[var(--border-secondary)]">
        <div className="bg-[var(--bg-primary)] p-2 text-center">
          <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Entry</p>
          <p className="font-mono text-sm text-[var(--text-primary)]">
            ${entry.toFixed(2)}
          </p>
        </div>
        <div className="bg-[var(--bg-primary)] p-2 text-center">
          <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Stop</p>
          <p className="font-mono text-sm text-red-400">${stop.toFixed(2)}</p>
        </div>
        <div className="bg-[var(--bg-primary)] p-2 text-center">
          <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Target</p>
          <p className="font-mono text-sm text-green-400">${target.toFixed(2)}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-3 border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
        <span className="text-xs text-[var(--text-tertiary)]">
          Risk/Reward: <span className="text-[var(--text-primary)] font-medium">{riskReward}R</span>
        </span>
        <a
          href={`https://www.tradingview.com/chart/?symbol=${symbol}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline"
        >
          Open Chart
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </motion.div>
  );
}

export const SetupCard = memo(SetupCardComponent);

// ============================================
// Score Bar Component
// ============================================

interface ScoreRowProps {
  label: string;
  score: number;
}

function ScoreRow({ label, score }: ScoreRowProps) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 60) return 'bg-yellow-500';
    if (s >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--text-tertiary)] w-14">{label}</span>
      <div className="flex-1 h-2 bg-[var(--bg-secondary)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('h-full', getScoreColor(score))}
        />
      </div>
      <span className="text-xs text-[var(--text-secondary)] w-8 text-right font-mono">
        {score}%
      </span>
    </div>
  );
}

// ============================================
// Quiz Card Component
// ============================================

interface QuizCardProps {
  quiz: QuizPromptContent;
}

function QuizCardComponent({ quiz }: QuizCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/learning/${quiz.moduleId}?quiz=true`} className="block group">
        <div
          className={cn(
            'bg-[var(--bg-primary)] border border-[var(--border-primary)]',
            'hover:border-purple-500/50 hover:bg-[var(--bg-card-hover)]',
            'transition-all duration-200'
          )}
        >
          <div className="p-3 flex items-center gap-3">
            {/* Icon */}
            <div
              className={cn(
                'w-10 h-10 shrink-0 flex items-center justify-center',
                'bg-purple-500/10'
              )}
            >
              <Brain className="w-5 h-5 text-purple-400" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--text-primary)] truncate text-sm">
                {quiz.title}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {quiz.description}
              </p>
            </div>

            {/* Arrow */}
            <div className="shrink-0 flex items-center gap-1 text-purple-400">
              <span className="text-xs font-medium group-hover:underline">
                Take Quiz
              </span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export const QuizCard = memo(QuizCardComponent);
