'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAIContext } from './AIContextProvider';
import { AIQuickActions } from './AIQuickActions';
import { AIMarketIntel } from './AIMarketIntel';
import { AISuggestions } from './AISuggestions';
import { RichContentRenderer } from '@/components/chat/rich-content';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { getSuggestedPrompts } from '@/lib/ai-context';
import {
  Bot,
  Send,
  X,
  ChevronLeft,
  Loader2,
  Sparkles,
  Zap,
  MessageSquare,
  Trash2,
  Minimize2,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Radio,
} from 'lucide-react';
import type { AIMessage, DashboardPage } from '@/types/ai';

// ============================================
// Page Display Names
// ============================================

const PAGE_DISPLAY_NAMES: Record<DashboardPage, string> = {
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
  'admin/users': 'Admin: Users',
  'admin/social-builder': 'Admin: Social Builder',
  'admin/knowledge': 'Admin: Knowledge CMS',
  'admin/analytics': 'Admin: Analytics',
  'admin/settings': 'Admin: Settings',
  'admin/card-builder': 'Admin: Card Builder',
};

// ============================================
// Local Storage Keys
// ============================================

const STORAGE_KEY_MESSAGES = 'kcu_ai_messages';
const STORAGE_KEY_LAST_PAGE = 'kcu_ai_last_page';

// ============================================
// Main Command Center Component
// ============================================

export function AICommandCenter() {
  const {
    context,
    panelState,
    setPanel,
    togglePanel,
    sendMessage,
    clearHistory,
  } = useAIContext();

  // Derive state from panelState
  const isOpen = panelState.panelState !== 'collapsed';
  const isCollapsed = false; // We don't use mini-collapsed mode
  const messages = panelState.messages;
  const isLoading = panelState.isLoading;
  const closePanel = () => setPanel('collapsed');
  const toggleCollapsed = closePanel; // Toggle just closes
  const clearMessages = clearHistory;

  const [input, setInput] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get context-aware suggested prompts
  const suggestedPrompts = useMemo(() => getSuggestedPrompts(context), [context]);

  // Load messages from localStorage on mount (for persistence)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MESSAGES);
      const lastPage = localStorage.getItem(STORAGE_KEY_LAST_PAGE);

      // Only restore if on the same page (to keep context relevant)
      if (stored && lastPage === context.currentPage) {
        // Messages are managed by context provider, this is just a placeholder
        // for future implementation where we'd dispatch to restore messages
      }

      // Store current page
      localStorage.setItem(STORAGE_KEY_LAST_PAGE, context.currentPage);
    } catch {
      // localStorage might not be available
    }
  }, [context.currentPage]);

  // Save messages to localStorage when they change
  useEffect(() => {
    try {
      if (messages.length > 0) {
        const toStore = messages.slice(-20).map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }));
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(toStore));
      }
    } catch {
      // localStorage might not be available
    }
  }, [messages]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      const messageToSend = input;
      setInput('');
      setLastFailedMessage(null);
      try {
        await sendMessage(messageToSend);
      } catch {
        setLastFailedMessage(messageToSend);
      }
    }
  };

  const handleRetry = async () => {
    if (lastFailedMessage) {
      const messageToRetry = lastFailedMessage;
      setLastFailedMessage(null);
      try {
        await sendMessage(messageToRetry);
      } catch {
        setLastFailedMessage(messageToRetry);
      }
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
              'bg-neutral-950 border-l border-neutral-800',
              'flex flex-col rounded-none',
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
                {/* Header - Coach Mode with Live Indicator */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 flex items-center justify-center rounded-none">
                      <Zap className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-white">Coach Mode</h2>
                        {/* Pulsing Live Indicator */}
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 rounded-none">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">Live</span>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-500">AI-powered trading assistant</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={toggleCollapsed}
                      className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors rounded-none"
                      title="Collapse panel"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={closePanel}
                      className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors rounded-none"
                      title="Close panel (Esc)"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Context Banner - Analyzing indicator */}
                <div className="px-4 py-2.5 bg-neutral-900/80 border-b border-neutral-800">
                  <div className="flex items-center gap-2 text-xs">
                    <Radio className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400 font-medium">Analyzing:</span>
                    <span className="text-neutral-300">
                      {PAGE_DISPLAY_NAMES[context.currentPage]}
                    </span>
                    {getContextIndicator() && (
                      <>
                        <span className="text-neutral-600">→</span>
                        <span className="text-neutral-400 truncate font-mono text-[11px]">
                          {getContextIndicator()}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <AIQuickActions onAction={handleQuickAction} />

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-950">
                  {messages.length === 0 ? (
                    <EmptyState
                      onPromptClick={handleQuickAction}
                      suggestedPrompts={suggestedPrompts}
                    />
                  ) : (
                    <>
                      {messages.map((message, index) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          onRetry={
                            message.role === 'assistant' &&
                            message.content.includes('error') &&
                            index === messages.length - 1
                              ? handleRetry
                              : undefined
                          }
                          isLastError={
                            lastFailedMessage !== null &&
                            index === messages.length - 1 &&
                            message.role === 'assistant'
                          }
                        />
                      ))}
                      {isLoading && <LoadingIndicator />}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Clear Chat Button (when messages exist) */}
                {messages.length > 0 && (
                  <div className="px-4 py-2 border-t border-neutral-800 bg-neutral-950">
                    <button
                      onClick={clearMessages}
                      className="flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
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
                  className="p-4 border-t border-neutral-800 bg-neutral-900"
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
                        'flex-1 resize-none bg-neutral-950 border border-neutral-800 rounded-none',
                        'p-3 text-sm text-white placeholder:text-neutral-600',
                        'focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20',
                        'transition-colors disabled:opacity-50'
                      )}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className={cn(
                        'px-4 bg-emerald-500 text-white rounded-none',
                        'hover:bg-emerald-400 transition-colors',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'flex items-center justify-center'
                      )}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-neutral-600 text-center">
                    Press <kbd className="px-1 py-0.5 bg-neutral-800 rounded-none text-neutral-400 font-mono">⌘J</kbd> to toggle
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
    <div className="flex flex-col items-center py-4 gap-4 bg-neutral-950">
      <button
        onClick={onExpand}
        className="p-3 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors rounded-none"
        title="Expand Coach Mode"
      >
        <Zap className="w-5 h-5" />
      </button>
      <button
        onClick={onExpand}
        className="p-2 text-neutral-500 hover:text-white transition-colors rounded-none"
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

interface EmptyStateProps {
  onPromptClick: (prompt: string) => void;
  suggestedPrompts: string[];
}

function EmptyState({ onPromptClick, suggestedPrompts }: EmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 bg-emerald-500/10 flex items-center justify-center mb-4 rounded-none">
        <Sparkles className="w-8 h-8 text-emerald-400" />
      </div>
      <h4 className="font-semibold text-white mb-2">
        Hey trader! How can I help?
      </h4>
      <p className="text-sm text-neutral-400 mb-6 max-w-[280px]">
        Ask me about the LTP framework, analyze your trades, or get trading guidance.
      </p>
      <div className="space-y-2 w-full">
        {suggestedPrompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptClick(prompt)}
            className="w-full p-3 text-left text-sm bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 hover:bg-neutral-800 transition-colors rounded-none group"
          >
            <MessageSquare className="w-4 h-4 inline-block mr-2 text-emerald-400 group-hover:text-emerald-300" />
            <span className="text-neutral-300 group-hover:text-white">{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Message Bubble
// ============================================

interface MessageBubbleProps {
  message: AIMessage;
  onRetry?: () => void;
  isLastError?: boolean;
}

function MessageBubble({ message, onRetry, isLastError }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = message.content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Simple markdown-like rendering for code blocks and formatting
  const renderContent = (text: string) => {
    // Handle code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3);
        const firstNewline = code.indexOf('\n');
        const language = firstNewline > 0 ? code.slice(0, firstNewline).trim() : '';
        const codeContent = firstNewline > 0 ? code.slice(firstNewline + 1) : code;
        return (
          <pre
            key={index}
            className="my-2 p-2 bg-neutral-900 border border-neutral-800 overflow-x-auto text-xs font-mono rounded-none"
          >
            {language && (
              <div className="text-neutral-500 text-[10px] mb-1">{language}</div>
            )}
            <code className="text-neutral-200">{codeContent}</code>
          </pre>
        );
      }

      // Handle inline code
      const inlineParts = part.split(/(`[^`]+`)/g);
      return inlineParts.map((inlinePart, inlineIndex) => {
        if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
          return (
            <code
              key={`${index}-${inlineIndex}`}
              className="px-1 py-0.5 bg-neutral-800 text-emerald-400 text-xs font-mono rounded-none"
            >
              {inlinePart.slice(1, -1)}
            </code>
          );
        }

        // Handle bold
        const boldParts = inlinePart.split(/(\*\*[^*]+\*\*)/g);
        return boldParts.map((boldPart, boldIndex) => {
          if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
            return (
              <strong key={`${index}-${inlineIndex}-${boldIndex}`} className="text-white font-semibold">
                {boldPart.slice(2, -2)}
              </strong>
            );
          }
          return <span key={`${index}-${inlineIndex}-${boldIndex}`}>{boldPart}</span>;
        });
      });
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3 group', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      {isUser ? (
        <Avatar size="sm" />
      ) : (
        <div className="w-8 h-8 bg-emerald-500/10 flex items-center justify-center shrink-0 rounded-none">
          <Bot className="w-4 h-4 text-emerald-400" />
        </div>
      )}

      {/* Content */}
      <div className={cn('max-w-[85%]', isUser && 'text-right')}>
        <div
          className={cn(
            'p-3 text-sm relative rounded-none',
            isUser
              ? 'bg-emerald-500 text-white'
              : 'bg-neutral-900 text-neutral-200 border border-neutral-800',
            isLastError && 'border-red-500/50'
          )}
        >
          <div className="whitespace-pre-wrap">{renderContent(message.content)}</div>

          {/* Action buttons for assistant messages */}
          {!isUser && (
            <div className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <button
                onClick={handleCopy}
                className="p-1 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-none transition-colors"
                title="Copy message"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="p-1 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-none transition-colors"
                  title="Retry message"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error indicator */}
        {isLastError && (
          <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
            <AlertCircle className="w-3 h-3" />
            <span>Failed to send. Click retry to try again.</span>
          </div>
        )}

        {/* Rich Content */}
        {message.role === 'assistant' && message.richContent && message.richContent.length > 0 && (
          <RichContentRenderer content={message.richContent} className="mt-2" />
        )}

        {/* Sources */}
        {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
          <div className="mt-2 text-xs text-neutral-500">
            Sources: {message.sources.map(s => s.title).join(', ')}
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-1 text-[10px] text-neutral-600">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      <div className="w-8 h-8 bg-emerald-500/10 flex items-center justify-center shrink-0 rounded-none">
        <Bot className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-none">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span className="text-xs text-neutral-400">Thinking...</span>
        </div>
      </div>
    </motion.div>
  );
}
