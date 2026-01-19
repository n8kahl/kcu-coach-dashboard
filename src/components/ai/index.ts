/**
 * AI Components Index
 *
 * Exports all AI-related components for easy importing.
 */

// Main components
export { AICommandCenter } from './AICommandCenter';
export { AIContextProvider, useAIContext } from './AIContextProvider';

// Hooks
export { usePageContext } from './hooks/usePageContext';

// Re-export types
export type {
  AIContext,
  AIContextValue,
  AICommandCenterState,
  AIMessage,
  AIMode,
  AISuggestion,
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
