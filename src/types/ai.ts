/**
 * AI-First Transformation Types
 *
 * Type definitions for the unified AI Command Center system.
 * These types enable context-aware AI interactions across all pages.
 */

import type {
  TradeEntry,
  Achievement,
  ModuleProgress,
  DetectedSetup,
  SymbolLevel,
  PracticeScenario,
  RichContent,
} from './index';

// Alias for backward compatibility
type Level = SymbolLevel;

// =============================================================================
// Page Context Types
// =============================================================================

export type DashboardPage =
  | 'overview'
  | 'journal'
  | 'learning'
  | 'coach'
  | 'companion'
  | 'practice'
  | 'achievements'
  | 'leaderboard'
  | 'win-cards'
  | 'progress'
  | 'resources'
  | 'admin/users'
  | 'admin/social-builder'
  | 'admin/knowledge'
  | 'admin/analytics'
  | 'admin/settings'
  | 'admin/card-builder';

export interface PageSpecificData {
  // Trade Journal
  selectedTrade?: TradeEntry;
  tradeFilters?: {
    symbol?: string;
    dateRange?: { start: Date; end: Date };
    direction?: 'long' | 'short';
  };

  // Learning
  currentModule?: string;
  currentLesson?: string;
  videoTimestamp?: number;

  // Companion
  watchlistSymbols?: string[];
  focusedSymbol?: string;

  // Practice
  currentScenario?: PracticeScenario;
  practiceMode?: 'historical' | 'ai-generated' | 'daily-challenge';

  // Admin
  adminSection?: string;
}

// =============================================================================
// User Context Types
// =============================================================================

export interface UserContext {
  id: string;
  discordId: string;
  username: string;
  avatarUrl?: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  subscriptionTier: 'free' | 'premium' | 'pro';
  isAdmin: boolean;
  createdAt: Date;
}

export interface UserStats {
  totalTrades: number;
  winRate: number;
  avgLtpScore: number;
  currentStreak: number;
  bestStreak: number;
  totalQuizzes: number;
  lessonsCompleted: number;
  practiceAttempts: number;
  practiceAccuracy: number;
}

export interface LearningState {
  currentModule: string;
  moduleProgress: ModuleProgress[];
  completedLessons: string[];
  weakAreas: string[];
  recommendedLessons: string[];
}

// =============================================================================
// Market Context Types
// =============================================================================

export interface MarketContext {
  // Main indices
  spy: {
    price: number;
    change: number;
    changePercent: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  qqq: {
    price: number;
    change: number;
    changePercent: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  vix: number;

  // Market status
  marketStatus: 'pre' | 'open' | 'after' | 'closed';
  lastUpdated: Date;

  // Key levels nearby (for watched symbols)
  keyLevelsNearby: Array<{
    symbol: string;
    level: Level;
    distance: number;
    distancePercent: number;
  }>;

  // Recent patience candles detected
  recentPatienceCandles: Array<{
    symbol: string;
    timeframe: string;
    timestamp: Date;
    direction: 'bullish' | 'bearish';
  }>;
}

// =============================================================================
// Admin Context Types
// =============================================================================

export interface AdminContext {
  // Content metrics
  contentPerformance: {
    topPosts: Array<{ id: string; engagement: number; platform: string }>;
    avgEngagement: number;
    postsThisWeek: number;
  };

  // Trending topics
  trendingTopics: Array<{
    topic: string;
    volume: number;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>;

  // User insights
  userInsights: {
    activeUsers: number;
    newUsersThisWeek: number;
    commonStruggles: string[];
  };

  // Influencer activity
  influencerActivity: Array<{
    name: string;
    platform: string;
    recentPost: string;
    engagement: number;
  }>;
}

// =============================================================================
// Main AI Context Type
// =============================================================================

export interface AIContext {
  // Page awareness
  currentPage: DashboardPage;
  pageData: PageSpecificData;

  // Selection awareness
  selectedTrade?: TradeEntry;
  selectedLesson?: { moduleId: string; lessonId: string; title: string };
  selectedSymbol?: string;
  selectedSetup?: DetectedSetup;
  selectedScenario?: PracticeScenario;

  // User state
  user: UserContext;
  stats: UserStats;
  recentTrades: TradeEntry[];
  learningState: LearningState;
  achievements: Achievement[];

  // Market state (lazy-loaded, may be undefined)
  marketContext?: MarketContext;

  // Admin context (only for admin users)
  adminContext?: AdminContext;

  // Session state
  sessionStarted: Date;
  lastInteraction?: Date;
  interactionCount: number;
}

// =============================================================================
// AI API Types
// =============================================================================

export type AIMode = 'chat' | 'search' | 'action' | 'analyze' | 'suggest';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  richContent?: RichContent[];
  sources?: RAGSource[];
  actions?: QuickActionResult[];
}

export interface UnifiedAIRequest {
  message: string;
  mode: AIMode;
  context: Partial<AIContext>;
  conversationHistory?: AIMessage[];
  options?: {
    stream?: boolean;
    maxTokens?: number;
    includeRichContent?: boolean;
    includeSuggestions?: boolean;
  };
}

export interface UnifiedAIResponse {
  id: string;
  message: string;
  richContent?: RichContent[];
  suggestions?: string[];
  sources?: RAGSource[];
  actions?: QuickActionResult[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
  };
}

// =============================================================================
// Rich Content Types
// =============================================================================

// Re-export RichContent from main types to avoid conflicts
// The main RichContent type is defined in @/types/index.ts
// Import it from there when needed: import type { RichContent } from '@/types';

// =============================================================================
// Quick Actions Types
// =============================================================================

export type QuickActionId =
  // Overview actions
  | 'daily_briefing'
  | 'review_week'
  | 'what_to_study'
  | 'identify_patterns'
  // Journal actions
  | 'analyze_trade'
  | 'grade_ltp'
  | 'find_similar'
  | 'related_lesson'
  | 'what_went_right'
  | 'what_went_wrong'
  | 'how_to_improve'
  // Learning actions
  | 'resume_learning'
  | 'test_knowledge'
  | 'explain_concept'
  | 'show_example'
  | 'practice_this'
  // Companion actions
  | 'analyze_setup'
  | 'grade_level'
  | 'whats_the_trend'
  | 'when_to_enter'
  // Practice actions
  | 'get_hint'
  | 'explain_setup'
  | 'try_similar'
  | 'review_mistakes'
  // Admin actions
  | 'generate_caption'
  | 'find_trending'
  | 'analyze_competitors'
  | 'best_post_time';

export interface QuickAction {
  id: QuickActionId;
  label: string;
  description: string;
  prompt: string;
  icon: string;
  pages: DashboardPage[];
  requiresSelection?: boolean;
  selectionType?: 'trade' | 'lesson' | 'symbol' | 'setup' | 'scenario';
  adminOnly?: boolean;
}

export interface QuickActionResult {
  actionId: QuickActionId;
  success: boolean;
  result?: string;
  richContent?: RichContent[];
  error?: string;
}

// =============================================================================
// Semantic Search Types
// =============================================================================

export type SearchScope = 'trades' | 'lessons' | 'videos' | 'setups' | 'all';

export interface SemanticSearchRequest {
  query: string;
  scope: SearchScope;
  filters?: {
    dateRange?: { start: Date; end: Date };
    symbol?: string;
    module?: string;
    difficulty?: string;
  };
  limit?: number;
  offset?: number;
}

export interface SemanticSearchResult {
  id: string;
  type: 'trade' | 'lesson' | 'video' | 'setup' | 'chunk';
  title: string;
  snippet: string;
  relevanceScore: number;
  metadata: Record<string, unknown>;
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  interpretation: string;
  suggestions: string[];
  totalCount: number;
  processingTime: number;
}

// =============================================================================
// RAG Types
// =============================================================================

export interface RAGSource {
  id: string;
  title: string;
  type: 'lesson' | 'video' | 'transcript' | 'documentation';
  relevance: number;
  snippet?: string;
  metadata?: {
    moduleId?: string;
    lessonId?: string;
    videoId?: string;
    timestamp?: number;
  };
}

// =============================================================================
// Suggestion Types
// =============================================================================

export type SuggestionTrigger =
  | 'after_losing_trade'
  | 'pattern_detected'
  | 'module_completed'
  | 'market_setup'
  | 'streak_risk'
  | 'weak_area_identified'
  | 'practice_milestone'
  | 'idle_user';

export interface AISuggestion {
  id: string;
  trigger: SuggestionTrigger;
  message: string;
  actionLabel?: string;
  actionHandler?: () => void;
  priority: 'low' | 'medium' | 'high';
  dismissible: boolean;
  expiresAt?: Date;
}

// =============================================================================
// Panel State Types
// =============================================================================

export type PanelState = 'collapsed' | 'expanded' | 'focused';

export interface AICommandCenterState {
  panelState: PanelState;
  activeMode: AIMode;
  messages: AIMessage[];
  isLoading: boolean;
  error?: string;
  suggestions: AISuggestion[];
  recentSearches: string[];
}

// =============================================================================
// Context Provider Types
// =============================================================================

export interface AIContextProviderProps {
  children: React.ReactNode;
  initialContext?: Partial<AIContext>;
}

export interface AIContextValue {
  context: AIContext;
  panelState: AICommandCenterState;
  // Context actions
  updatePageContext: (page: DashboardPage, data?: PageSpecificData) => void;
  setSelectedTrade: (trade: TradeEntry | undefined) => void;
  setSelectedLesson: (lesson: { moduleId: string; lessonId: string; title: string } | undefined) => void;
  setSelectedSymbol: (symbol: string | undefined) => void;
  setSelectedSetup: (setup: DetectedSetup | undefined) => void;
  setSelectedScenario: (scenario: PracticeScenario | undefined) => void;
  // Panel actions
  togglePanel: () => void;
  setPanel: (state: PanelState) => void;
  // Chat actions
  sendMessage: (message: string, mode?: AIMode) => Promise<void>;
  clearHistory: () => void;
  // Search actions
  semanticSearch: (query: string, scope?: SearchScope) => Promise<SemanticSearchResponse>;
  // Quick actions
  executeQuickAction: (actionId: QuickActionId) => Promise<QuickActionResult>;
  // Suggestions
  dismissSuggestion: (id: string) => void;
  clearSuggestions: () => void;
}
