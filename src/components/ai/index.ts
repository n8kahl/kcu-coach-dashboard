/**
 * AI Components Index
 *
 * Exports all AI-related components for easy importing.
 */

// Main components
export { AICommandCenter } from './AICommandCenter';
export { AIContextProvider, useAIContext } from './AIContextProvider';
export { AIQuickActions } from './AIQuickActions';
export { AIMarketIntel } from './AIMarketIntel';
export { AISearchBar, type SearchResult, type SearchInterpretation } from './AISearchBar';
export { AISuggestions, type SuggestionType, type AISuggestion } from './AISuggestions';

// Hooks
export { usePageContext } from './hooks/usePageContext';

// Re-export types
export type {
  AIContext,
  AIContextValue,
  AICommandCenterState,
  AIMessage,
  AIMode,
  DashboardPage,
  PageSpecificData,
  PanelState,
  QuickAction,
  QuickActionId,
  QuickActionResult,
  SearchScope,
  SemanticSearchResponse,
} from '@/types/ai';

// RichContent comes from @/types/index, not @/types/ai
export type { RichContent } from '@/types';
