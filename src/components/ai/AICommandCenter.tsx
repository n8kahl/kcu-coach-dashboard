'use client';

/**
 * AI Command Center
 *
 * The unified AI panel that provides context-aware coaching across all pages.
 * Replaces the fragmented floating button and dedicated /coach page.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAIContext } from './AIContextProvider';
import { getQuickActionsForPage } from '@/lib/ai-context';
import { RichContentRenderer } from '@/components/chat/rich-content';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import type { QuickAction, AIMessage } from '@/types/ai';
import {
  Bot,
  Send,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  MessageSquare,
  Search,
  Command,
  Trash2,
  Minimize2,
  Maximize2,
} from 'lucide-react';

// Icon mapping for quick actions
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sun: () => <span className="text-lg">☀️</span>,
  Calendar: () => <span className="text-lg">📅</span>,
  GraduationCap: () => <span className="text-lg">🎓</span>,
  TrendingUp: () => <span className="text-lg">📈</span>,
  Search: () => <Search className="w-4 h-4" />,
  Award: () => <span className="text-lg">🏆</span>,
  Copy: () => <span className="text-lg">📋</span>,
  BookOpen: () => <span className="text-lg">📖</span>,
  ThumbsUp: () => <span className="text-lg">👍</span>,
  AlertTriangle: () => <span className="text-lg">⚠️</span>,
  ArrowUp: () => <span className="text-lg">⬆️</span>,
  Play: () => <span className="text-lg">▶️</span>,
  CheckSquare: () => <span className="text-lg">✅</span>,
  HelpCircle: () => <span className="text-lg">❓</span>,
  Image: () => <span className="text-lg">🖼️</span>,
  Dumbbell: () => <span className="text-lg">🏋️</span>,
  Target: () => <span className="text-lg">🎯</span>,
  Layers: () => <span className="text-lg">📊</span>,
  Clock: () => <span className="text-lg">⏰</span>,
  Lightbulb: () => <span className="text-lg">💡</span>,
  Info: () => <span className="text-lg">ℹ️</span>,
  RefreshCw: () => <span className="text-lg">🔄</span>,
  AlertCircle: () => <span className="text-lg">⚡</span>,
  MessageSquare: () => <MessageSquare className="w-4 h-4" />,
  Users: () => <span className="text-lg">👥</span>,
};

// =============================================================================
// Quick Actions Component
// =============================================================================

interface QuickActionsProps {
  actions: QuickAction[];
  onAction: (actionId: string) => void;
  isLoading: boolean;
}

function QuickActions({ actions, onAction, isLoading }: QuickActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="px-4 py-3 border-b border-[var(--border-primary)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
        Quick Actions
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.slice(0, 4).map((action) => {
          const Icon = iconMap[action.icon] || MessageSquare;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium',
                'bg-[var(--bg-primary)] border border-[var(--border-primary)]',
                'hover:border-[var(--accent-primary-muted)] hover:bg-[var(--bg-tertiary)]',
                'transition-all duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title={action.description}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Message List Component
// =============================================================================

interface MessageListProps {
  messages: AIMessage[];
  isLoading: boolean;
}

function MessageList({ messages, isLoading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-[var(--accent-primary-glow)] flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-[var(--accent-primary)]" />
        </div>
        <h4 className="font-semibold text-[var(--text-primary)] mb-2">
          How can I help?
        </h4>
        <p className="text-sm text-[var(--text-tertiary)] max-w-[280px]">
          Ask me anything about trading, the LTP framework, or your performance. I can see what page you&apos;re on.
        </p>
        <div className="mt-4 text-xs text-[var(--text-muted)] flex items-center gap-1">
          <Command className="w-3 h-3" />
          <span>+ J to toggle this panel</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'flex gap-3',
            message.role === 'user' ? 'flex-row-reverse' : ''
          )}
        >
          {message.role === 'assistant' ? (
            <div className="w-8 h-8 bg-[var(--accent-primary-glow)] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
          ) : (
            <Avatar size="sm" />
          )}
          <div className={cn('max-w-[85%]', message.role === 'user' ? '' : '')}>
            <div
              className={cn(
                'p-3 text-sm',
                message.role === 'user'
                  ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-primary)]'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
            {message.role === 'assistant' &&
              message.richContent &&
              message.richContent.length > 0 && (
                <RichContentRenderer content={message.richContent} className="mt-2" />
              )}
            {message.sources && message.sources.length > 0 && (
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                <span className="font-medium">Sources: </span>
                {message.sources.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && ', '}
                    {s.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ))}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-3"
        >
          <div className="w-8 h-8 bg-[var(--accent-primary-glow)] flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-[var(--accent-primary)]" />
          </div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-3">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
          </div>
        </motion.div>
      )}
      <div ref={endRef} />
    </div>
  );
}

// =============================================================================
// Chat Input Component
// =============================================================================

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]"
    >
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your coach..."
          rows={1}
          className={cn(
            'flex-1 resize-none bg-[var(--bg-primary)] border border-[var(--border-primary)]',
            'p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
            'focus:outline-none focus:border-[var(--accent-primary)]',
            'transition-colors'
          )}
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!input.trim() || isLoading}
          icon={<Send className="w-4 h-4" />}
        />
      </div>
    </form>
  );
}

// =============================================================================
// Context Header Component
// =============================================================================

interface ContextHeaderProps {
  currentPage: string;
  selectedItem?: string;
}

function ContextHeader({ currentPage, selectedItem }: ContextHeaderProps) {
  const pageLabels: Record<string, string> = {
    overview: 'Overview',
    journal: 'Trade Journal',
    learning: 'Learning Hub',
    coach: 'AI Coach',
    companion: 'Companion',
    practice: 'Practice Mode',
    achievements: 'Achievements',
    leaderboard: 'Leaderboard',
    'win-cards': 'Win Cards',
    progress: 'Progress',
    resources: 'Resources',
    'admin/users': 'Admin: Users',
    'admin/social-builder': 'Admin: Social',
    'admin/knowledge': 'Admin: Knowledge',
    'admin/analytics': 'Admin: Analytics',
    'admin/settings': 'Admin: Settings',
    'admin/card-builder': 'Admin: Cards',
  };

  return (
    <div className="px-4 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)] text-xs">
      <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
        <span>📍</span>
        <span>You&apos;re in: <strong className="text-[var(--text-secondary)]">{pageLabels[currentPage] || currentPage}</strong></span>
      </div>
      {selectedItem && (
        <div className="flex items-center gap-2 mt-1 text-[var(--text-muted)]">
          <span>👆</span>
          <span>Viewing: {selectedItem}</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Collapsed Panel Component
// =============================================================================

interface CollapsedPanelProps {
  onExpand: () => void;
  hasMessages: boolean;
}

function CollapsedPanel({ onExpand, hasMessages }: CollapsedPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed top-1/2 right-0 -translate-y-1/2 z-40"
    >
      <button
        onClick={onExpand}
        className={cn(
          'flex flex-col items-center gap-2 px-2 py-4',
          'bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-primary)]',
          'hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary-muted)]',
          'transition-all duration-200',
          'shadow-lg'
        )}
        title="Open AI Coach (⌘J)"
      >
        <Bot className="w-5 h-5 text-[var(--accent-primary)]" />
        <span className="text-xs text-[var(--text-muted)] writing-mode-vertical">
          AI Coach
        </span>
        {hasMessages && (
          <span className="w-2 h-2 bg-[var(--accent-primary)] rounded-full" />
        )}
      </button>
    </motion.div>
  );
}

// =============================================================================
// Main AICommandCenter Component
// =============================================================================

export function AICommandCenter() {
  const {
    context,
    panelState,
    togglePanel,
    setPanel,
    sendMessage,
    clearHistory,
    executeQuickAction,
  } = useAIContext();

  // Get context-aware quick actions
  const quickActions = getQuickActionsForPage(context.currentPage, context.user.isAdmin);

  // Build selected item description
  const getSelectedItemDescription = useCallback(() => {
    if (context.selectedTrade) {
      return `${context.selectedTrade.symbol} ${context.selectedTrade.direction} trade`;
    }
    if (context.selectedLesson) {
      return context.selectedLesson.title;
    }
    if (context.selectedSymbol) {
      return context.selectedSymbol;
    }
    if (context.selectedSetup) {
      return `${context.selectedSetup.symbol} ${context.selectedSetup.direction} setup`;
    }
    if (context.selectedScenario) {
      return context.selectedScenario.title;
    }
    return undefined;
  }, [context]);

  const handleQuickAction = useCallback(
    async (actionId: string) => {
      await executeQuickAction(actionId as any);
    },
    [executeQuickAction]
  );

  // Collapsed state
  if (panelState.panelState === 'collapsed') {
    return (
      <CollapsedPanel
        onExpand={togglePanel}
        hasMessages={panelState.messages.length > 0}
      />
    );
  }

  // Expanded panel
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={cn(
          'fixed top-0 right-0 h-screen z-40',
          'bg-[var(--bg-secondary)] border-l border-[var(--border-primary)]',
          'flex flex-col shadow-2xl',
          panelState.panelState === 'focused' ? 'w-[600px]' : 'w-[400px]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--accent-primary-glow)] flex items-center justify-center">
              <Bot className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">KCU Coach</h3>
              <p className="text-xs text-[var(--text-tertiary)]">AI Trading Mentor</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {panelState.messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setPanel(panelState.panelState === 'focused' ? 'expanded' : 'focused')}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              title={panelState.panelState === 'focused' ? 'Minimize' : 'Expand'}
            >
              {panelState.panelState === 'focused' ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={togglePanel}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Context Header */}
        <ContextHeader
          currentPage={context.currentPage}
          selectedItem={getSelectedItemDescription()}
        />

        {/* Quick Actions */}
        <QuickActions
          actions={quickActions}
          onAction={handleQuickAction}
          isLoading={panelState.isLoading}
        />

        {/* Messages */}
        <MessageList
          messages={panelState.messages}
          isLoading={panelState.isLoading}
        />

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          isLoading={panelState.isLoading}
        />
      </motion.div>
    </AnimatePresence>
  );
}

export default AICommandCenter;
