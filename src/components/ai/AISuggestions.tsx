'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAIContext } from './AIContextProvider';
import {
  Lightbulb,
  X,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Trophy,
  BookOpen,
  Target,
  Clock,
  Flame,
  Zap,
  ChevronRight,
  Brain,
  BarChart3,
} from 'lucide-react';

// ============================================
// Types
// ============================================

export type SuggestionType =
  | 'trade_analysis'
  | 'pattern_detected'
  | 'learning_milestone'
  | 'streak_reminder'
  | 'market_opportunity'
  | 'improvement_tip'
  | 'quiz_prompt'
  | 'risk_warning';

export interface AISuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  action?: {
    label: string;
    prompt?: string;
    url?: string;
  };
  dismissable: boolean;
  timestamp: Date;
  expiresAt?: Date;
}

interface AISuggestionsProps {
  position?: 'panel' | 'toast' | 'inline';
  maxSuggestions?: number;
  className?: string;
}

// ============================================
// Suggestion Icons & Colors
// ============================================

const SUGGESTION_CONFIG: Record<SuggestionType, {
  icon: typeof Lightbulb;
  color: string;
  bgColor: string;
}> = {
  trade_analysis: {
    icon: BarChart3,
    color: 'text-[var(--accent-primary)]',
    bgColor: 'bg-[var(--accent-primary-glow)]',
  },
  pattern_detected: {
    icon: TrendingUp,
    color: 'text-[var(--warning)]',
    bgColor: 'bg-[var(--warning)]/10',
  },
  learning_milestone: {
    icon: Trophy,
    color: 'text-[var(--accent-gold)]',
    bgColor: 'bg-[var(--accent-gold)]/10',
  },
  streak_reminder: {
    icon: Flame,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  market_opportunity: {
    icon: Target,
    color: 'text-[var(--success)]',
    bgColor: 'bg-[var(--success)]/10',
  },
  improvement_tip: {
    icon: Lightbulb,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  quiz_prompt: {
    icon: Brain,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
  risk_warning: {
    icon: AlertTriangle,
    color: 'text-[var(--error)]',
    bgColor: 'bg-[var(--error)]/10',
  },
};

// ============================================
// Suggestions Component
// ============================================

export function AISuggestions({
  position = 'panel',
  maxSuggestions = 3,
  className,
}: AISuggestionsProps) {
  const { context, sendMessage } = useAIContext();
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch suggestions based on context
  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: context.currentPage,
          userId: context.user?.id,
          selectedTrade: context.selectedTrade,
          selectedLesson: context.selectedLesson,
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch suggestions');
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      // Use mock suggestions on error
      setSuggestions(generateMockSuggestions(context));
    } finally {
      setIsLoading(false);
    }
  }, [context]);

  // Fetch on mount and context changes
  useEffect(() => {
    fetchSuggestions();
  }, [context.currentPage, fetchSuggestions]);

  // Filter out dismissed and expired suggestions
  const visibleSuggestions = suggestions
    .filter((s) => !dismissedIds.has(s.id))
    .filter((s) => !s.expiresAt || new Date(s.expiresAt) > new Date())
    .slice(0, maxSuggestions);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  const handleAction = (suggestion: AISuggestion) => {
    if (suggestion.action?.prompt) {
      sendMessage(suggestion.action.prompt);
    } else if (suggestion.action?.url) {
      window.location.href = suggestion.action.url;
    }
    handleDismiss(suggestion.id);
  };

  if (visibleSuggestions.length === 0) {
    return null;
  }

  if (position === 'toast') {
    return <ToastSuggestions suggestions={visibleSuggestions} onDismiss={handleDismiss} onAction={handleAction} />;
  }

  if (position === 'inline') {
    return <InlineSuggestions suggestions={visibleSuggestions} onDismiss={handleDismiss} onAction={handleAction} className={className} />;
  }

  return (
    <div className={cn('border-t border-[var(--border-primary)]', className)}>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3 h-3 text-[var(--accent-primary)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Suggestions
          </span>
        </div>
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {visibleSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onDismiss={() => handleDismiss(suggestion.id)}
                onAction={() => handleAction(suggestion)}
                compact
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Suggestion Card
// ============================================

interface SuggestionCardProps {
  suggestion: AISuggestion;
  onDismiss: () => void;
  onAction: () => void;
  compact?: boolean;
}

function SuggestionCard({ suggestion, onDismiss, onAction, compact = false }: SuggestionCardProps) {
  const config = SUGGESTION_CONFIG[suggestion.type];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'relative group',
        'border border-[var(--border-primary)]',
        config.bgColor,
        compact ? 'p-2' : 'p-3'
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn('shrink-0', config.color)}>
          <Icon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'font-medium text-[var(--text-primary)]',
            compact ? 'text-xs' : 'text-sm'
          )}>
            {suggestion.title}
          </p>
          <p className={cn(
            'text-[var(--text-tertiary)] mt-0.5',
            compact ? 'text-[10px]' : 'text-xs'
          )}>
            {suggestion.message}
          </p>
          {suggestion.action && (
            <button
              onClick={onAction}
              className={cn(
                'flex items-center gap-1 mt-1.5 font-medium',
                config.color,
                'hover:underline',
                compact ? 'text-[10px]' : 'text-xs'
              )}
            >
              {suggestion.action.label}
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
        {suggestion.dismissable && (
          <button
            onClick={onDismiss}
            className="shrink-0 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {suggestion.priority === 'high' && (
        <div className={cn(
          'absolute top-0 right-0 w-2 h-2',
          'bg-[var(--error)] rounded-full animate-pulse'
        )} />
      )}
    </motion.div>
  );
}

// ============================================
// Toast Suggestions
// ============================================

function ToastSuggestions({
  suggestions,
  onDismiss,
  onAction,
}: {
  suggestions: AISuggestion[];
  onDismiss: (id: string) => void;
  onAction: (suggestion: AISuggestion) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence mode="popLayout">
        {suggestions.map((suggestion) => (
          <motion.div
            key={suggestion.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
          >
            <SuggestionCard
              suggestion={suggestion}
              onDismiss={() => onDismiss(suggestion.id)}
              onAction={() => onAction(suggestion)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Inline Suggestions
// ============================================

function InlineSuggestions({
  suggestions,
  onDismiss,
  onAction,
  className,
}: {
  suggestions: AISuggestion[];
  onDismiss: (id: string) => void;
  onAction: (suggestion: AISuggestion) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {suggestions.map((suggestion) => {
        const config = SUGGESTION_CONFIG[suggestion.type];
        const Icon = config.icon;

        return (
          <button
            key={suggestion.id}
            onClick={() => onAction(suggestion)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5',
              'border border-[var(--border-primary)]',
              config.bgColor,
              'hover:border-[var(--accent-primary-muted)]',
              'transition-colors text-xs'
            )}
          >
            <Icon className={cn('w-3 h-3', config.color)} />
            <span className="text-[var(--text-secondary)]">{suggestion.title}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// Mock Suggestions Generator
// ============================================

function generateMockSuggestions(context: ReturnType<typeof useAIContext>['context']): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  // Page-specific suggestions
  switch (context.currentPage) {
    case 'journal':
      if (context.selectedTrade) {
        suggestions.push({
          id: 'analyze-trade',
          type: 'trade_analysis',
          title: 'Analyze this trade',
          message: `Want me to break down your ${context.selectedTrade.symbol} trade?`,
          priority: 'medium',
          action: { label: 'Analyze', prompt: 'Analyze this trade and tell me what I did well and what I could improve.' },
          dismissable: true,
          timestamp: new Date(),
        });
      }
      suggestions.push({
        id: 'pattern-detected',
        type: 'pattern_detected',
        title: 'Pattern detected',
        message: 'You tend to enter trades 1-2 candles early. Want to work on patience?',
        priority: 'high',
        action: { label: 'Review patterns', prompt: 'Show me my entry timing patterns and how to improve.' },
        dismissable: true,
        timestamp: new Date(),
      });
      break;

    case 'learning':
      suggestions.push({
        id: 'quiz-prompt',
        type: 'quiz_prompt',
        title: 'Ready for a quiz?',
        message: 'Test your knowledge on what you just learned.',
        priority: 'medium',
        action: { label: 'Start quiz', prompt: 'Quiz me on the key concepts from this lesson.' },
        dismissable: true,
        timestamp: new Date(),
      });
      break;

    case 'companion':
      suggestions.push({
        id: 'market-opportunity',
        type: 'market_opportunity',
        title: 'Setup forming',
        message: 'SPY approaching key support with bullish divergence.',
        priority: 'high',
        action: { label: 'Analyze setup', prompt: 'Grade the current SPY setup.' },
        dismissable: true,
        timestamp: new Date(),
      });
      break;

    case 'overview':
      suggestions.push({
        id: 'daily-briefing',
        type: 'improvement_tip',
        title: 'Daily briefing ready',
        message: 'Get your personalized trading plan for today.',
        priority: 'medium',
        action: { label: 'Get briefing', prompt: 'Give me my personalized daily briefing.' },
        dismissable: true,
        timestamp: new Date(),
      });
      break;

    case 'practice':
      suggestions.push({
        id: 'practice-tip',
        type: 'improvement_tip',
        title: 'Tip for this scenario',
        message: 'Remember to check all three LTP components before deciding.',
        priority: 'low',
        action: { label: 'Get hint', prompt: 'Give me a hint for this practice scenario.' },
        dismissable: true,
        timestamp: new Date(),
      });
      break;
  }

  // Global suggestions
  if (context.user?.streakDays && context.user.streakDays >= 5) {
    suggestions.push({
      id: 'streak',
      type: 'streak_reminder',
      title: `${context.user.streakDays} day streak!`,
      message: 'Keep it up! Log in tomorrow to maintain your streak.',
      priority: 'low',
      dismissable: true,
      timestamp: new Date(),
    });
  }

  return suggestions.slice(0, 5);
}
