// ============================================
// AI Command Center - Type Definitions
// ============================================

import type { TradeEntry, DetectedSetup, Lesson, ModuleProgress, Achievement } from './index';

// ============================================
// AI Context Types
// ============================================

export type AIPage =
  | 'overview'
  | 'journal'
  | 'learning'
  | 'coach'
  | 'companion'
  | 'practice'
  | 'progress'
  | 'achievements'
  | 'leaderboard'
  | 'win-cards'
  | 'resources'
  | 'admin';

export type AIMode = 'coach' | 'companion' | 'practice' | 'social' | 'search';

export interface AIContext {
  // Page Awareness
  currentPage: AIPage;
  pageData?: PageSpecificData;

  // Selection Awareness
  selectedTrade?: TradeEntry;
  selectedLesson?: Lesson;
  selectedSymbol?: string;
  selectedSetup?: DetectedSetup;

  // User State
  user?: UserAIProfile;
  recentTrades?: TradeEntry[];
  learningProgress?: ModuleProgress[];
  achievements?: Achievement[];

  // Market State (for trading-related pages)
  marketContext?: MarketContext;

  // Admin-specific (for admin pages)
  adminContext?: AdminContext;
}

export interface PageSpecificData {
  // Journal page
  tradeFilter?: string;
  dateRange?: { start: string; end: string };

  // Learning page
  currentModuleId?: string;
  currentLessonId?: string;
  watchProgress?: number;

  // Companion page
  watchlist?: string[];
  activeSetups?: DetectedSetup[];

  // Practice page
  currentScenario?: string;
  practiceScore?: number;

  // Admin pages
  contentType?: string;
}

export interface UserAIProfile {
  id: string;
  username: string;
  experienceLevel?: string;
  currentModule?: string;
  streakDays?: number;
  totalQuizzes?: number;
  winRate?: number;
  isAdmin?: boolean;
}

export interface MarketContext {
  spyPrice?: number;
  spyTrend?: 'bullish' | 'bearish' | 'neutral';
  qqqPrice?: number;
  marketStatus?: 'open' | 'premarket' | 'afterhours' | 'closed';
  keyLevelsNearby?: KeyLevel[];
}

export interface KeyLevel {
  symbol: string;
  type: string;
  price: number;
  distance: number;
}

export interface AdminContext {
  trendingTopics?: TrendingTopic[];
  contentPerformance?: ContentMetrics;
}

export interface TrendingTopic {
  topic: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ContentMetrics {
  totalViews: number;
  engagement: number;
  topContent: string[];
}

// ============================================
// Quick Actions Types
// ============================================

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  requiresSelection?: boolean;
  selectionType?: 'trade' | 'lesson' | 'setup' | 'symbol';
}

export type QuickActionsByPage = Record<AIPage, QuickAction[]>;

export const quickActionsByPage: QuickActionsByPage = {
  journal: [
    { id: 'analyze-trade', label: 'Analyze Trade', icon: 'search', prompt: 'Analyze this trade and provide feedback on my LTP execution.', requiresSelection: true, selectionType: 'trade' },
    { id: 'find-patterns', label: 'Find Patterns', icon: 'trending-up', prompt: 'Look at my recent trades and identify any patterns in my trading behavior.' },
    { id: 'grade-ltp', label: 'Grade LTP', icon: 'award', prompt: 'Grade my LTP execution on the selected trade.', requiresSelection: true, selectionType: 'trade' },
    { id: 'related-lessons', label: 'Related Lessons', icon: 'book-open', prompt: 'Based on my trading mistakes, what lessons should I review?' },
  ],
  learning: [
    { id: 'explain-this', label: 'Explain This', icon: 'help-circle', prompt: 'Explain this concept in more detail with examples.' },
    { id: 'quiz-me', label: 'Quiz Me', icon: 'brain', prompt: 'Quiz me on the key concepts from this lesson.' },
    { id: 'show-example', label: 'Show Example', icon: 'eye', prompt: 'Show me a real-world example of this concept in action.' },
    { id: 'whats-next', label: "What's Next", icon: 'arrow-right', prompt: 'What should I learn next based on my progress?' },
  ],
  companion: [
    { id: 'grade-setup', label: 'Grade Setup', icon: 'award', prompt: 'Grade this setup based on the LTP framework.', requiresSelection: true, selectionType: 'setup' },
    { id: 'key-levels', label: 'Key Levels', icon: 'layers', prompt: 'What are the key levels to watch for this symbol?', requiresSelection: true, selectionType: 'symbol' },
    { id: 'trend-analysis', label: 'Trend Analysis', icon: 'trending-up', prompt: 'Analyze the current trend for this symbol.', requiresSelection: true, selectionType: 'symbol' },
    { id: 'when-to-enter', label: 'When to Enter', icon: 'target', prompt: 'When would be a good entry point for this setup?', requiresSelection: true, selectionType: 'setup' },
  ],
  overview: [
    { id: 'daily-briefing', label: 'Daily Briefing', icon: 'sunrise', prompt: 'Give me a personalized daily briefing based on my trading goals and recent performance.' },
    { id: 'review-week', label: 'Review Week', icon: 'calendar', prompt: 'Review my trading week and highlight areas of improvement.' },
    { id: 'study-plan', label: 'Study Plan', icon: 'book', prompt: 'Create a study plan based on my trading weaknesses.' },
    { id: 'win-rate-tips', label: 'Win Rate Tips', icon: 'percent', prompt: 'How can I improve my win rate based on my trade history?' },
  ],
  practice: [
    { id: 'hint', label: 'Hint', icon: 'lightbulb', prompt: 'Give me a hint about this practice scenario without giving away the answer.' },
    { id: 'explain-ltp', label: 'Explain LTP', icon: 'book-open', prompt: 'Explain how the LTP framework applies to this practice scenario.' },
    { id: 'similar-setups', label: 'Similar Setups', icon: 'copy', prompt: 'Show me similar setups to practice with.' },
    { id: 'review-mistake', label: 'Review Mistake', icon: 'alert-triangle', prompt: 'Help me understand what I did wrong in this practice scenario.' },
  ],
  admin: [
    { id: 'generate-content', label: 'Generate Content', icon: 'edit', prompt: 'Generate social media content about trading education.' },
    { id: 'trending-topics', label: 'Trending Topics', icon: 'trending-up', prompt: 'What are the trending topics in trading education right now?' },
    { id: 'user-struggles', label: 'User Struggles', icon: 'users', prompt: 'What concepts are users struggling with most?' },
    { id: 'best-post-time', label: 'Best Post Time', icon: 'clock', prompt: 'When is the best time to post content for maximum engagement?' },
  ],
  coach: [
    { id: 'explain-ltp', label: 'Explain LTP', icon: 'book-open', prompt: 'Explain the LTP framework to me.' },
    { id: 'review-trade', label: 'Review Trade', icon: 'search', prompt: 'Help me review my last trade.' },
    { id: 'psychology', label: 'Psychology', icon: 'brain', prompt: 'Help me with trading psychology.' },
    { id: 'next-steps', label: 'Next Steps', icon: 'arrow-right', prompt: 'What should I focus on next in my trading journey?' },
  ],
  progress: [
    { id: 'analyze-progress', label: 'Analyze Progress', icon: 'chart', prompt: 'Analyze my learning progress and suggest improvements.' },
    { id: 'weak-areas', label: 'Weak Areas', icon: 'alert-triangle', prompt: 'What are my weak areas that need more attention?' },
    { id: 'celebrate-wins', label: 'Celebrate Wins', icon: 'trophy', prompt: 'Celebrate my recent achievements and wins.' },
    { id: 'set-goals', label: 'Set Goals', icon: 'target', prompt: 'Help me set realistic trading and learning goals.' },
  ],
  achievements: [
    { id: 'next-achievement', label: 'Next Achievement', icon: 'trophy', prompt: 'What achievement am I closest to unlocking?' },
    { id: 'achievement-tips', label: 'Get Tips', icon: 'lightbulb', prompt: 'Give me tips to unlock more achievements.' },
    { id: 'share-achievement', label: 'Share', icon: 'share', prompt: 'Help me create a post to share my achievement.' },
    { id: 'achievement-path', label: 'Path', icon: 'map', prompt: 'What achievements should I focus on next?' },
  ],
  leaderboard: [
    { id: 'climb-ranks', label: 'Climb Ranks', icon: 'trending-up', prompt: 'How can I climb higher on the leaderboard?' },
    { id: 'compare-top', label: 'Compare to Top', icon: 'users', prompt: 'How do I compare to top performers?' },
    { id: 'improve-stats', label: 'Improve Stats', icon: 'bar-chart', prompt: 'Which stats should I focus on improving?' },
    { id: 'consistency', label: 'Consistency', icon: 'calendar', prompt: 'How can I improve my consistency?' },
  ],
  'win-cards': [
    { id: 'create-card', label: 'Create Card', icon: 'plus', prompt: 'Help me create a win card for my best trade.' },
    { id: 'card-caption', label: 'Write Caption', icon: 'edit', prompt: 'Write a caption for my win card.' },
    { id: 'best-trades', label: 'Best Trades', icon: 'star', prompt: 'Which of my trades would make the best win card?' },
    { id: 'share-tips', label: 'Share Tips', icon: 'share', prompt: 'Tips for sharing win cards effectively.' },
  ],
  resources: [
    { id: 'find-video', label: 'Find Video', icon: 'video', prompt: 'Find a video that explains this topic.' },
    { id: 'recommend', label: 'Recommend', icon: 'thumbs-up', prompt: 'Recommend resources based on my learning level.' },
    { id: 'summarize', label: 'Summarize', icon: 'file-text', prompt: 'Summarize the key points from this resource.' },
    { id: 'related', label: 'Related', icon: 'link', prompt: 'Show me related resources on this topic.' },
  ],
};

// ============================================
// Chat Message Types (for Command Center)
// ============================================

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  richContent?: import('./index').RichContent[];
  sources?: AISource[];
  context?: Partial<AIContext>;
}

export interface AISource {
  title: string;
  type: string;
  relevance: number;
}

// ============================================
// Unified API Types
// ============================================

export interface UnifiedAIRequest {
  message: string;
  mode: AIMode;
  context: AIContext;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface UnifiedAIResponse {
  message: string;
  richContent?: import('./index').RichContent[];
  sources?: AISource[];
  conversationId?: string;
  suggestions?: string[];
}

// ============================================
// Command Center State Types
// ============================================

export interface CommandCenterState {
  isOpen: boolean;
  isCollapsed: boolean;
  messages: AIMessage[];
  isLoading: boolean;
  error: string | null;
}
