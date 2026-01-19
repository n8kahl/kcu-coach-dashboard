'use client';

/**
 * AI Context Provider
 *
 * Global provider for AI Command Center context. Wraps the dashboard
 * to provide page awareness, selection tracking, and AI state management.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import type {
  AIContext,
  AIContextValue,
  AIContextProviderProps,
  AICommandCenterState,
  AIMessage,
  AIMode,
  AISuggestion,
  DashboardPage,
  PageSpecificData,
  PanelState,
  QuickActionId,
  QuickActionResult,
  SearchScope,
  SemanticSearchResponse,
} from '@/types/ai';
import type { TradeEntry, DetectedSetup, PracticeScenario } from '@/types';
import { createInitialContext, mergeContext, compressContext, getQuickAction } from '@/lib/ai-context';

// =============================================================================
// State Types
// =============================================================================

interface State {
  context: AIContext;
  panel: AICommandCenterState;
}

type Action =
  | { type: 'SET_PAGE_CONTEXT'; page: DashboardPage; data?: PageSpecificData }
  | { type: 'SET_SELECTED_TRADE'; trade: TradeEntry | undefined }
  | { type: 'SET_SELECTED_LESSON'; lesson: { moduleId: string; lessonId: string; title: string } | undefined }
  | { type: 'SET_SELECTED_SYMBOL'; symbol: string | undefined }
  | { type: 'SET_SELECTED_SETUP'; setup: DetectedSetup | undefined }
  | { type: 'SET_SELECTED_SCENARIO'; scenario: PracticeScenario | undefined }
  | { type: 'SET_PANEL_STATE'; state: PanelState }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'ADD_MESSAGE'; message: AIMessage }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | undefined }
  | { type: 'ADD_SUGGESTION'; suggestion: AISuggestion }
  | { type: 'DISMISS_SUGGESTION'; id: string }
  | { type: 'CLEAR_SUGGESTIONS' }
  | { type: 'ADD_RECENT_SEARCH'; query: string }
  | { type: 'UPDATE_CONTEXT'; updates: Partial<AIContext> }
  | { type: 'SET_MODE'; mode: AIMode };

// =============================================================================
// Reducer
// =============================================================================

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PAGE_CONTEXT':
      return {
        ...state,
        context: mergeContext(state.context, {
          currentPage: action.page,
          pageData: action.data || {},
          // Clear selections when changing pages
          selectedTrade: undefined,
          selectedLesson: undefined,
          selectedSymbol: undefined,
          selectedSetup: undefined,
          selectedScenario: undefined,
        }),
      };

    case 'SET_SELECTED_TRADE':
      return {
        ...state,
        context: { ...state.context, selectedTrade: action.trade },
      };

    case 'SET_SELECTED_LESSON':
      return {
        ...state,
        context: { ...state.context, selectedLesson: action.lesson },
      };

    case 'SET_SELECTED_SYMBOL':
      return {
        ...state,
        context: { ...state.context, selectedSymbol: action.symbol },
      };

    case 'SET_SELECTED_SETUP':
      return {
        ...state,
        context: { ...state.context, selectedSetup: action.setup },
      };

    case 'SET_SELECTED_SCENARIO':
      return {
        ...state,
        context: { ...state.context, selectedScenario: action.scenario },
      };

    case 'SET_PANEL_STATE':
      return {
        ...state,
        panel: { ...state.panel, panelState: action.state },
      };

    case 'TOGGLE_PANEL':
      return {
        ...state,
        panel: {
          ...state.panel,
          panelState: state.panel.panelState === 'collapsed' ? 'expanded' : 'collapsed',
        },
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        panel: {
          ...state.panel,
          messages: [...state.panel.messages, action.message],
        },
      };

    case 'CLEAR_MESSAGES':
      return {
        ...state,
        panel: { ...state.panel, messages: [] },
      };

    case 'SET_LOADING':
      return {
        ...state,
        panel: { ...state.panel, isLoading: action.loading },
      };

    case 'SET_ERROR':
      return {
        ...state,
        panel: { ...state.panel, error: action.error },
      };

    case 'ADD_SUGGESTION':
      return {
        ...state,
        panel: {
          ...state.panel,
          suggestions: [...state.panel.suggestions, action.suggestion],
        },
      };

    case 'DISMISS_SUGGESTION':
      return {
        ...state,
        panel: {
          ...state.panel,
          suggestions: state.panel.suggestions.filter((s) => s.id !== action.id),
        },
      };

    case 'CLEAR_SUGGESTIONS':
      return {
        ...state,
        panel: { ...state.panel, suggestions: [] },
      };

    case 'ADD_RECENT_SEARCH':
      return {
        ...state,
        panel: {
          ...state.panel,
          recentSearches: [
            action.query,
            ...state.panel.recentSearches.filter((q) => q !== action.query),
          ].slice(0, 10),
        },
      };

    case 'UPDATE_CONTEXT':
      return {
        ...state,
        context: mergeContext(state.context, action.updates),
      };

    case 'SET_MODE':
      return {
        ...state,
        panel: { ...state.panel, activeMode: action.mode },
      };

    default:
      return state;
  }
}

// =============================================================================
// Context
// =============================================================================

const AIContextReact = createContext<AIContextValue | null>(null);

// =============================================================================
// Provider Component
// =============================================================================

export function AIContextProvider({ children, initialContext }: AIContextProviderProps) {
  // Initialize state
  const [state, dispatch] = useReducer(reducer, {
    context: createInitialContext(initialContext?.user || {}, initialContext?.currentPage),
    panel: {
      panelState: 'collapsed',
      activeMode: 'chat',
      messages: [],
      isLoading: false,
      suggestions: [],
      recentSearches: [],
    },
  });

  // ==========================================================================
  // Context Actions
  // ==========================================================================

  const updatePageContext = useCallback(
    (page: DashboardPage, data?: PageSpecificData) => {
      dispatch({ type: 'SET_PAGE_CONTEXT', page, data });
    },
    []
  );

  const setSelectedTrade = useCallback(
    (trade: TradeEntry | undefined) => {
      dispatch({ type: 'SET_SELECTED_TRADE', trade });
    },
    []
  );

  const setSelectedLesson = useCallback(
    (lesson: { moduleId: string; lessonId: string; title: string } | undefined) => {
      dispatch({ type: 'SET_SELECTED_LESSON', lesson });
    },
    []
  );

  const setSelectedSymbol = useCallback(
    (symbol: string | undefined) => {
      dispatch({ type: 'SET_SELECTED_SYMBOL', symbol });
    },
    []
  );

  const setSelectedSetup = useCallback(
    (setup: DetectedSetup | undefined) => {
      dispatch({ type: 'SET_SELECTED_SETUP', setup });
    },
    []
  );

  const setSelectedScenario = useCallback(
    (scenario: PracticeScenario | undefined) => {
      dispatch({ type: 'SET_SELECTED_SCENARIO', scenario });
    },
    []
  );

  // ==========================================================================
  // Panel Actions
  // ==========================================================================

  const togglePanel = useCallback(() => {
    dispatch({ type: 'TOGGLE_PANEL' });
  }, []);

  const setPanel = useCallback((panelState: PanelState) => {
    dispatch({ type: 'SET_PANEL_STATE', state: panelState });
  }, []);

  // ==========================================================================
  // Chat Actions
  // ==========================================================================

  const sendMessage = useCallback(
    async (message: string, mode: AIMode = 'chat') => {
      if (!message.trim()) return;

      // Add user message
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message.trim(),
        timestamp: new Date(),
      };
      dispatch({ type: 'ADD_MESSAGE', message: userMessage });
      dispatch({ type: 'SET_LOADING', loading: true });
      dispatch({ type: 'SET_ERROR', error: undefined });

      try {
        const response = await fetch('/api/ai/unified', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message.trim(),
            mode,
            context: compressContext(state.context),
            conversationHistory: state.panel.messages.slice(-10).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to send message');
        }

        const data = await response.json();

        const assistantMessage: AIMessage = {
          id: data.id || `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          richContent: data.richContent,
          sources: data.sources,
          actions: data.actions,
        };

        dispatch({ type: 'ADD_MESSAGE', message: assistantMessage });
      } catch (error) {
        console.error('AI chat error:', error);
        dispatch({
          type: 'SET_ERROR',
          error: error instanceof Error ? error.message : 'Failed to send message',
        });

        // Add error message
        const errorMessage: AIMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        };
        dispatch({ type: 'ADD_MESSAGE', message: errorMessage });
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },
    [state.context, state.panel.messages]
  );

  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, []);

  // ==========================================================================
  // Search Actions
  // ==========================================================================

  const semanticSearch = useCallback(
    async (query: string, scope: SearchScope = 'all'): Promise<SemanticSearchResponse> => {
      dispatch({ type: 'ADD_RECENT_SEARCH', query });
      dispatch({ type: 'SET_LOADING', loading: true });

      try {
        const response = await fetch('/api/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            scope,
            context: compressContext(state.context),
          }),
        });

        if (!response.ok) {
          throw new Error('Search failed');
        }

        return await response.json();
      } catch (error) {
        console.error('Semantic search error:', error);
        return {
          results: [],
          interpretation: '',
          suggestions: ['Try a different search term'],
          totalCount: 0,
          processingTime: 0,
        };
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },
    [state.context]
  );

  // ==========================================================================
  // Quick Action Actions
  // ==========================================================================

  const executeQuickAction = useCallback(
    async (actionId: QuickActionId): Promise<QuickActionResult> => {
      const action = getQuickAction(actionId);
      if (!action) {
        return {
          actionId,
          success: false,
          error: 'Unknown action',
        };
      }

      dispatch({ type: 'SET_LOADING', loading: true });

      try {
        const response = await fetch('/api/ai/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionId,
            context: compressContext(state.context),
          }),
        });

        if (!response.ok) {
          throw new Error('Action failed');
        }

        const result = await response.json();

        // Add result as assistant message if it has content
        if (result.result) {
          const actionMessage: AIMessage = {
            id: `action-${Date.now()}`,
            role: 'assistant',
            content: result.result,
            timestamp: new Date(),
            richContent: result.richContent,
          };
          dispatch({ type: 'ADD_MESSAGE', message: actionMessage });
        }

        return result;
      } catch (error) {
        console.error('Quick action error:', error);
        return {
          actionId,
          success: false,
          error: error instanceof Error ? error.message : 'Action failed',
        };
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },
    [state.context]
  );

  // ==========================================================================
  // Suggestion Actions
  // ==========================================================================

  const dismissSuggestion = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_SUGGESTION', id });
  }, []);

  const clearSuggestions = useCallback(() => {
    dispatch({ type: 'CLEAR_SUGGESTIONS' });
  }, []);

  // ==========================================================================
  // Keyboard Shortcuts
  // ==========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + J to toggle AI panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        togglePanel();
      }
      // Escape to close panel
      if (e.key === 'Escape' && state.panel.panelState !== 'collapsed') {
        setPanel('collapsed');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePanel, setPanel, state.panel.panelState]);

  // ==========================================================================
  // Context Value
  // ==========================================================================

  const value: AIContextValue = useMemo(
    () => ({
      context: state.context,
      panelState: state.panel,
      updatePageContext,
      setSelectedTrade,
      setSelectedLesson,
      setSelectedSymbol,
      setSelectedSetup,
      setSelectedScenario,
      togglePanel,
      setPanel,
      sendMessage,
      clearHistory,
      semanticSearch,
      executeQuickAction,
      dismissSuggestion,
      clearSuggestions,
    }),
    [
      state,
      updatePageContext,
      setSelectedTrade,
      setSelectedLesson,
      setSelectedSymbol,
      setSelectedSetup,
      setSelectedScenario,
      togglePanel,
      setPanel,
      sendMessage,
      clearHistory,
      semanticSearch,
      executeQuickAction,
      dismissSuggestion,
      clearSuggestions,
    ]
  );

  return (
    <AIContextReact.Provider value={value}>
      {children}
    </AIContextReact.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useAIContext(): AIContextValue {
  const context = useContext(AIContextReact);
  if (!context) {
    throw new Error('useAIContext must be used within an AIContextProvider');
  }
  return context;
}

export default AIContextProvider;
