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
    ltpGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
    pnlRange?: { min?: number; max?: number };
    timeframe?: '1m' | '5m' | '15m' | '1h' | 'day';
  };
  tradeSorting?: {
    sortBy: 'date' | 'symbol' | 'pnl' | 'ltp_score';
    sortOrder: 'asc' | 'desc';
  };
  searchQuery?: string;

  // Learning
  currentModule?: string;
  currentLesson?: string;
  videoTimestamp?: number;
  currentVideoId?: string;
  videoDuration?: number;
  completedVideos?: string[];
  difficultyLevel?: 'beginner' | 'intermediate' | 'advanced';

  // Progress Dashboard (Learning Intelligence)
  completionPercent?: number;
  currentStreak?: number;
  weakAreas?: string[];
  recommendedModule?: string;
  totalLessonsCompleted?: number;
  totalWatchTimeHours?: number;
  modulesInProgress?: number;
  modulesCompleted?: number;

  // Companion
  watchlistSymbols?: string[];
  focusedSymbol?: string;
  alertsSet?: Array<{ symbol: string; price: number; direction: 'above' | 'below' }>;

  // Practice
  currentScenario?: PracticeScenario;
  practiceMode?: 'historical' | 'ai-generated' | 'daily-challenge';
  practiceAttemptCount?: number;
  practiceCorrectCount?: number;
  practiceAccuracyOnType?: number;
  previousAttempts?: Array<{ scenarioId: string; correct: boolean; timestamp: Date }>;

  // Admin
  adminSection?: string;
  activeABTests?: Array<{ id: string; name: string; variant: string }>;
  contentToReview?: number;
  userReports?: number;
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
    previousClose?: number;
    yearHigh?: number;
    yearLow?: number;
  };
  qqq: {
    price: number;
    change: number;
    changePercent: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    previousClose?: number;
    yearHigh?: number;
    yearLow?: number;
  };
  vix: number;

  // Market status
  marketStatus: 'pre' | 'open' | 'after' | 'closed';
  lastUpdated: Date;

  // Timezone info (US Eastern by default)
  timezone: string;
  marketOpenTime?: string; // e.g., "09:30"
  marketCloseTime?: string; // e.g., "16:00"
  timeToOpen?: string; // e.g., "2h 30m"
  timeToClose?: string; // e.g., "4h 15m"

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

  // Earnings calendar for watched symbols
  upcomingEarnings?: Array<{
    symbol: string;
    date: string;
    timing: 'before' | 'after' | 'during';
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
  | 'compare_week_over_week'
  | 'check_status'
  | 'market_opportunity'
  // Journal actions
  | 'analyze_trade'
  | 'grade_ltp'
  | 'find_similar'
  | 'related_lesson'
  | 'what_went_right'
  | 'what_went_wrong'
  | 'how_to_improve'
  | 'export_trades'
  | 'backtest_strategy'
  | 'trade_statistics'
  | 'find_losses'
  // Learning actions
  | 'resume_learning'
  | 'test_knowledge'
  | 'explain_concept'
  | 'show_example'
  | 'practice_this'
  | 'get_learning_plan'
  | 'prerequisite_check'
  // Companion actions
  | 'analyze_setup'
  | 'grade_level'
  | 'whats_the_trend'
  | 'when_to_enter'
  | 'watch_symbol'
  | 'set_alert'
  | 'compare_setups'
  // Practice actions
  | 'get_hint'
  | 'explain_setup'
  | 'try_similar'
  | 'review_mistakes'
  // Admin actions
  | 'generate_caption'
  | 'find_trending'
  | 'analyze_competitors'
  | 'best_post_time'
  | 'user_engagement_report'
  | 'content_gap_analysis';

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
// Error Types
// =============================================================================

export type AIErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'API_KEY_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'CONTEXT_ERROR'
  | 'TOOL_ERROR'
  | 'UNKNOWN_ERROR';

export interface AIError {
  code: AIErrorCode;
  message: string;
  retryable: boolean;
  retryAfter?: number; // seconds until retry is allowed
  details?: Record<string, unknown>;
}

export const AI_ERROR_MESSAGES: Record<AIErrorCode, string> = {
  UNAUTHORIZED: 'Please log in to continue.',
  RATE_LIMITED: 'Too many requests. Please wait a moment.',
  API_KEY_ERROR: 'AI service configuration error. Please contact support.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  VALIDATION_ERROR: 'Invalid input. Please try again.',
  CONTEXT_ERROR: 'Unable to load context. Please refresh the page.',
  TOOL_ERROR: 'Error executing action. Please try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

export function createAIError(
  code: AIErrorCode,
  customMessage?: string,
  details?: Record<string, unknown>
): AIError {
  return {
    code,
    message: customMessage || AI_ERROR_MESSAGES[code],
    retryable: ['RATE_LIMITED', 'NETWORK_ERROR', 'TOOL_ERROR', 'UNKNOWN_ERROR'].includes(code),
    retryAfter: code === 'RATE_LIMITED' ? 30 : undefined,
    details,
  };
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
