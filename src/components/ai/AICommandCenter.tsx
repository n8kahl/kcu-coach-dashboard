'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAIContext } from './AIContextProvider';
import { AIQuickActions } from './AIQuickActions';
import { AIMarketIntel } from './AIMarketIntel';
import { AISuggestions } from './AISuggestions';
import { RichContentRenderer } from '@/components/chat/rich-content';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import {
  Bot,
  Send,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  MapPin,
  MessageSquare,
  Trash2,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import type { AIMessage, AIPage } from '@/types/ai';

// ============================================
// Page Display Names
// ============================================

const PAGE_DISPLAY_NAMES: Record<AIPage, string> = {
  overview: 'Overview',
  journal: 'Trade Journal',
  learning: 'Learning Hub',
  coach: 'AI Coach',
  companion: 'Market Companion',
  practice: 'Practice Mode',
  progress: 'Progress',
  achievements: 'Achievements',
  leaderboard: 'Leaderboard',
  'win-cards': 'Win Cards',
  resources: 'Resources',
  admin: 'Admin',
};

// ============================================
// Suggested Prompts
// ============================================

const SUGGESTED_PROMPTS = [
  'Explain the LTP framework',
  'How do I identify a patience candle?',
  'Review my recent trades',
  'What makes a good support level?',
];

// ============================================
// Main Command Center Component
// ============================================

export function AICommandCenter() {
  const {
    context,
    isOpen,
    isCollapsed,
    messages,
    isLoading,
    closePanel,
    toggleCollapsed,
    sendMessage,
    clearMessages,
  } = useAIContext();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !isCollapsed && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isCollapsed]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt);
  };

  // Build context indicator text
  const getContextIndicator = () => {
    const parts: string[] = [];

    if (context.selectedTrade) {
      parts.push(`Trade: ${context.selectedTrade.symbol} ${context.selectedTrade.direction}`);
    }
    if (context.selectedSetup) {
      parts.push(`Setup: ${context.selectedSetup.symbol} ${context.selectedSetup.direction}`);
    }
    if (context.selectedSymbol && !context.selectedSetup) {
      parts.push(`Symbol: ${context.selectedSymbol}`);
    }
    if (context.selectedLesson) {
      parts.push(`Lesson: ${context.selectedLesson.title}`);
    }

    return parts.length > 0 ? parts.join(' | ') : null;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePanel}
            className="lg:hidden fixed inset-0 z-40 bg-black/50"
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'fixed top-0 right-0 h-screen z-50',
              'bg-[var(--bg-secondary)] border-l border-[var(--border-primary)]',
              'flex flex-col',
              'transition-all duration-300',
              // Desktop: side panel, Mobile: full screen sheet
              isCollapsed
                ? 'w-[60px]'
                : 'w-full sm:w-[420px]'
            )}
          >
            {/* Collapsed State */}
            {isCollapsed ? (
              <CollapsedPanel onExpand={toggleCollapsed} />
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[var(--accent-primary-glow)] flex items-center justify-center">
                      <Bot className="w-5 h-5 text-[var(--accent-primary)]" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-[var(--text-primary)]">KCU Coach</h2>
                      <p className="text-xs text-[var(--text-tertiary)]">AI Trading Mentor</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={toggleCollapsed}
                      className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      title="Collapse panel"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={closePanel}
                      className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      title="Close panel (Esc)"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Context Indicator */}
                <div className="px-4 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)]">
                  <div className="flex items-center gap-2 text-xs">
                    <MapPin className="w-3 h-3 text-[var(--accent-primary)]" />
                    <span className="text-[var(--text-secondary)]">
                      {PAGE_DISPLAY_NAMES[context.currentPage]}
                    </span>
                    {getContextIndicator() && (
                      <>
                        <span className="text-[var(--text-muted)]">|</span>
                        <span className="text-[var(--text-tertiary)] truncate">
                          {getContextIndicator()}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <AIQuickActions onAction={handleQuickAction} />

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <EmptyState onPromptClick={handleQuickAction} />
                  ) : (
                    <>
                      {messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                      ))}
                      {isLoading && <LoadingIndicator />}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Clear Chat Button (when messages exist) */}
                {messages.length > 0 && (
                  <div className="px-4 py-2 border-t border-[var(--border-primary)]">
                    <button
                      onClick={clearMessages}
                      className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear conversation
                    </button>
                  </div>
                )}

                {/* AI Suggestions (when no messages) */}
                {messages.length === 0 && (
                  <AISuggestions position="panel" maxSuggestions={2} />
                )}

                {/* Market Intel (for trading-related pages) */}
                {['companion', 'journal', 'overview', 'practice'].includes(context.currentPage) && (
                  <AIMarketIntel
                    symbols={['SPY', 'QQQ']}
                    compact={messages.length > 0}
                  />
                )}

                {/* Input Area */}
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
                      disabled={isLoading}
                      className={cn(
                        'flex-1 resize-none bg-[var(--bg-primary)] border border-[var(--border-primary)]',
                        'p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
                        'focus:outline-none focus:border-[var(--accent-primary)]',
                        'transition-colors disabled:opacity-50'
                      )}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={!input.trim() || isLoading}
                      icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--text-muted)] text-center">
                    Press <kbd className="px-1 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--text-tertiary)]">Cmd+J</kbd> to toggle
                  </p>
                </form>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Collapsed Panel
// ============================================

function CollapsedPanel({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="flex flex-col items-center py-4 gap-4">
      <button
        onClick={onExpand}
        className="p-3 bg-[var(--accent-primary-glow)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors"
        title="Expand AI Coach"
      >
        <Bot className="w-5 h-5" />
      </button>
      <button
        onClick={onExpand}
        className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        title="Expand panel"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================
// Empty State with Suggested Prompts
// ============================================

function EmptyState({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 bg-[var(--accent-primary-glow)] flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-[var(--accent-primary)]" />
      </div>
      <h4 className="font-semibold text-[var(--text-primary)] mb-2">
        Hey trader! How can I help?
      </h4>
      <p className="text-sm text-[var(--text-tertiary)] mb-6 max-w-[280px]">
        Ask me about the LTP framework, analyze your trades, or get trading guidance.
      </p>
      <div className="space-y-2 w-full">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptClick(prompt)}
            className="w-full p-3 text-left text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:border-[var(--accent-primary-muted)] hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <MessageSquare className="w-4 h-4 inline-block mr-2 text-[var(--accent-primary)]" />
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Message Bubble
// ============================================

function MessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      {isUser ? (
        <Avatar size="sm" />
      ) : (
        <div className="w-8 h-8 bg-[var(--accent-primary-glow)] flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-[var(--accent-primary)]" />
        </div>
      )}

      {/* Content */}
      <div className={cn('max-w-[85%]', isUser && 'text-right')}>
        <div
          className={cn(
            'p-3 text-sm',
            isUser
              ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)]'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Rich Content */}
        {message.role === 'assistant' && message.richContent && message.richContent.length > 0 && (
          <RichContentRenderer content={message.richContent} className="mt-2" />
        )}

        {/* Sources */}
        {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
          <div className="mt-2 text-xs text-[var(--text-muted)]">
            Sources: {message.sources.map(s => s.title).join(', ')}
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-1 text-[10px] text-[var(--text-muted)]">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// Loading Indicator
// ============================================

function LoadingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 bg-[var(--accent-primary-glow)] flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-[var(--accent-primary)]" />
      </div>
      <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] p-3">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
      </div>
    </motion.div>
  );
}
