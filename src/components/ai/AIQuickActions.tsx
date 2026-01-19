'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAIContext } from './AIContextProvider';
import { quickActionsByPage, type QuickAction } from '@/types/ai';
import {
  Search,
  TrendingUp,
  Award,
  BookOpen,
  HelpCircle,
  Brain,
  Eye,
  ArrowRight,
  Layers,
  Target,
  Sunrise,
  Calendar,
  Percent,
  Lightbulb,
  Copy,
  AlertTriangle,
  Edit,
  Users,
  Clock,
  Trophy,
  Share,
  Map,
  BarChart,
  Plus,
  Star,
  Video,
  ThumbsUp,
  FileText,
  Link,
  Zap,
} from 'lucide-react';

// ============================================
// Icon Map
// ============================================

const ICON_MAP: Record<string, React.ElementType> = {
  search: Search,
  'trending-up': TrendingUp,
  award: Award,
  'book-open': BookOpen,
  'help-circle': HelpCircle,
  brain: Brain,
  eye: Eye,
  'arrow-right': ArrowRight,
  layers: Layers,
  target: Target,
  sunrise: Sunrise,
  calendar: Calendar,
  book: BookOpen,
  percent: Percent,
  lightbulb: Lightbulb,
  copy: Copy,
  'alert-triangle': AlertTriangle,
  edit: Edit,
  users: Users,
  clock: Clock,
  chart: BarChart,
  trophy: Trophy,
  share: Share,
  map: Map,
  'bar-chart': BarChart,
  plus: Plus,
  star: Star,
  video: Video,
  'thumbs-up': ThumbsUp,
  'file-text': FileText,
  link: Link,
};

// ============================================
// Quick Actions Component
// ============================================

interface AIQuickActionsProps {
  onAction: (prompt: string) => void;
}

export function AIQuickActions({ onAction }: AIQuickActionsProps) {
  const { context } = useAIContext();
  const currentPage = context.currentPage;

  // Get actions for current page
  const actions = useMemo(() => {
    return quickActionsByPage[currentPage] || quickActionsByPage.overview;
  }, [currentPage]);

  // Build context-aware prompt
  const buildPrompt = (action: QuickAction): string => {
    let prompt = action.prompt;

    // Add context based on selection
    if (action.requiresSelection) {
      switch (action.selectionType) {
        case 'trade':
          if (context.selectedTrade) {
            prompt += ` Trade details: ${context.selectedTrade.symbol} ${context.selectedTrade.direction} trade from ${context.selectedTrade.entry_time}.`;
            if (context.selectedTrade.pnl !== undefined) {
              prompt += ` P&L: $${context.selectedTrade.pnl.toFixed(2)}.`;
            }
          } else {
            prompt = 'Please select a trade first, then I can analyze it for you. You can select a trade from the Journal page.';
          }
          break;
        case 'setup':
          if (context.selectedSetup) {
            prompt += ` Setup: ${context.selectedSetup.symbol} ${context.selectedSetup.direction} with ${context.selectedSetup.confluence_score}% confluence.`;
          } else {
            prompt = 'Please select a setup first from the Companion page.';
          }
          break;
        case 'symbol':
          if (context.selectedSymbol) {
            prompt += ` Symbol: ${context.selectedSymbol}.`;
          } else if (context.selectedSetup?.symbol) {
            prompt += ` Symbol: ${context.selectedSetup.symbol}.`;
          } else {
            prompt = 'Please select a symbol first from the Companion watchlist.';
          }
          break;
        case 'lesson':
          if (context.selectedLesson) {
            prompt += ` Lesson: "${context.selectedLesson.title}".`;
          } else {
            prompt = 'Please select a lesson first from the Learning Hub.';
          }
          break;
      }
    }

    return prompt;
  };

  // Check if action requires selection that's missing
  const isActionDisabled = (action: QuickAction): boolean => {
    if (!action.requiresSelection) return false;

    switch (action.selectionType) {
      case 'trade':
        return !context.selectedTrade;
      case 'setup':
        return !context.selectedSetup;
      case 'symbol':
        return !context.selectedSymbol && !context.selectedSetup?.symbol;
      case 'lesson':
        return !context.selectedLesson;
      default:
        return false;
    }
  };

  const handleClick = (action: QuickAction) => {
    const prompt = buildPrompt(action);
    onAction(prompt);
  };

  return (
    <div className="px-4 py-3 border-b border-[var(--border-primary)]">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3 h-3 text-[var(--accent-primary)]" />
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Quick Actions
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.slice(0, 4).map((action, index) => {
          const Icon = ICON_MAP[action.icon] || HelpCircle;
          const disabled = isActionDisabled(action);

          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleClick(action)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-2 p-2 text-left text-xs font-medium',
                'border border-[var(--border-primary)]',
                'transition-all duration-150',
                disabled
                  ? 'opacity-50 cursor-not-allowed bg-[var(--bg-tertiary)]'
                  : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-card-hover)] hover:border-[var(--accent-primary-muted)]'
              )}
              title={
                disabled
                  ? `Requires ${action.selectionType} selection`
                  : action.prompt
              }
            >
              <Icon className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <span className="text-[var(--text-secondary)] truncate">
                {action.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
