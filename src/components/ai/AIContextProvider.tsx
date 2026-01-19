'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import type {
  AIContext,
  AIPage,
  AIMessage,
  CommandCenterState,
  MarketContext,
} from '@/types/ai';
import type { TradeEntry, DetectedSetup, Lesson } from '@/types';

// ============================================
// Context Types
// ============================================

interface AIContextValue {
  // AI Context for prompts
  context: AIContext;

  // Command Center State
  isOpen: boolean;
  isCollapsed: boolean;
  messages: AIMessage[];
  isLoading: boolean;
  error: string | null;

  // Actions
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  toggleCollapsed: () => void;
  setSelectedTrade: (trade: TradeEntry | undefined) => void;
  setSelectedLesson: (lesson: Lesson | undefined) => void;
  setSelectedSymbol: (symbol: string | undefined) => void;
  setSelectedSetup: (setup: DetectedSetup | undefined) => void;
  setMarketContext: (market: MarketContext | undefined) => void;
  addMessage: (message: AIMessage) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  sendMessage: (content: string, quickActionPrompt?: string) => Promise<void>;
}

const AIContextProviderContext = createContext<AIContextValue | null>(null);

// ============================================
// Hook to use AI Context
// ============================================

export function useAIContext(): AIContextValue {
  const context = useContext(AIContextProviderContext);
  if (!context) {
    throw new Error('useAIContext must be used within AIContextProvider');
  }
  return context;
}

// ============================================
// Helper to determine current page from pathname
// ============================================

function getPageFromPathname(pathname: string): AIPage {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0] || 'overview';

  // Handle admin routes
  if (firstSegment === 'admin') {
    return 'admin';
  }

  // Map routes to AI pages
  const pageMap: Record<string, AIPage> = {
    overview: 'overview',
    journal: 'journal',
    learning: 'learning',
    coach: 'coach',
    companion: 'companion',
    practice: 'practice',
    progress: 'progress',
    achievements: 'achievements',
    leaderboard: 'leaderboard',
    'win-cards': 'win-cards',
    resources: 'resources',
  };

  return pageMap[firstSegment] || 'overview';
}

// ============================================
// Provider Component
// ============================================

interface AIContextProviderProps {
  children: ReactNode;
  user?: {
    id: string;
    username: string;
    experienceLevel?: string;
    currentModule?: string;
    streakDays?: number;
    totalQuizzes?: number;
    winRate?: number;
    isAdmin?: boolean;
  };
}

export function AIContextProvider({ children, user }: AIContextProviderProps) {
  const pathname = usePathname();

  // Command Center State
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection State
  const [selectedTrade, setSelectedTrade] = useState<TradeEntry | undefined>();
  const [selectedLesson, setSelectedLesson] = useState<Lesson | undefined>();
  const [selectedSymbol, setSelectedSymbol] = useState<string | undefined>();
  const [selectedSetup, setSelectedSetup] = useState<DetectedSetup | undefined>();
  const [marketContext, setMarketContext] = useState<MarketContext | undefined>();

  // Determine current page from pathname
  const currentPage = useMemo(() => getPageFromPathname(pathname || '/'), [pathname]);

  // Build the AI context object
  const context: AIContext = useMemo(
    () => ({
      currentPage,
      selectedTrade,
      selectedLesson,
      selectedSymbol,
      selectedSetup,
      marketContext,
      user: user
        ? {
            id: user.id,
            username: user.username,
            experienceLevel: user.experienceLevel,
            currentModule: user.currentModule,
            streakDays: user.streakDays,
            totalQuizzes: user.totalQuizzes,
            winRate: user.winRate,
            isAdmin: user.isAdmin,
          }
        : undefined,
    }),
    [
      currentPage,
      selectedTrade,
      selectedLesson,
      selectedSymbol,
      selectedSetup,
      marketContext,
      user,
    ]
  );

  // Reset selections when page changes
  useEffect(() => {
    // Keep symbol selection when moving between companion-related pages
    if (currentPage !== 'companion' && currentPage !== 'journal') {
      setSelectedSymbol(undefined);
      setSelectedSetup(undefined);
    }
    if (currentPage !== 'journal') {
      setSelectedTrade(undefined);
    }
    if (currentPage !== 'learning') {
      setSelectedLesson(undefined);
    }
  }, [currentPage]);

  // Keyboard shortcut for opening panel (Cmd/Ctrl + J)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Actions
  const openPanel = useCallback(() => setIsOpen(true), []);
  const closePanel = useCallback(() => setIsOpen(false), []);
  const togglePanel = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleCollapsed = useCallback(() => setIsCollapsed((prev) => !prev), []);

  const addMessage = useCallback((message: AIMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Send message to unified API
  const sendMessage = useCallback(
    async (content: string, quickActionPrompt?: string) => {
      const messageContent = quickActionPrompt || content;
      if (!messageContent.trim()) return;

      // Add user message
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: messageContent,
        timestamp: new Date(),
        context,
      };
      addMessage(userMessage);
      setIsLoading(true);
      setError(null);

      try {
        // Determine mode based on current page
        const mode =
          currentPage === 'companion'
            ? 'companion'
            : currentPage === 'practice'
            ? 'practice'
            : currentPage === 'admin'
            ? 'social'
            : 'coach';

        const response = await fetch('/api/ai/unified', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageContent,
            mode,
            context,
            conversationHistory: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response from AI');
        }

        const data = await response.json();

        // Add assistant message
        const assistantMessage: AIMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          richContent: data.richContent,
          sources: data.sources,
        };
        addMessage(assistantMessage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message');
        // Add error message
        const errorMessage: AIMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        };
        addMessage(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [context, currentPage, messages, addMessage]
  );

  // Context value
  const value: AIContextValue = useMemo(
    () => ({
      context,
      isOpen,
      isCollapsed,
      messages,
      isLoading,
      error,
      openPanel,
      closePanel,
      togglePanel,
      toggleCollapsed,
      setSelectedTrade,
      setSelectedLesson,
      setSelectedSymbol,
      setSelectedSetup,
      setMarketContext,
      addMessage,
      clearMessages,
      setLoading: setIsLoading,
      setError,
      sendMessage,
    }),
    [
      context,
      isOpen,
      isCollapsed,
      messages,
      isLoading,
      error,
      openPanel,
      closePanel,
      togglePanel,
      toggleCollapsed,
      addMessage,
      clearMessages,
      sendMessage,
    ]
  );

  return (
    <AIContextProviderContext.Provider value={value}>
      {children}
    </AIContextProviderContext.Provider>
  );
}
