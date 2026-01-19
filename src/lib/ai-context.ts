/**
 * AI Context Utilities
 *
 * Helper functions for managing AI context, generating system prompts,
 * and building context-aware AI interactions.
 */

import type {
  AIContext,
  DashboardPage,
  PageSpecificData,
  QuickAction,
  QuickActionId,
  MarketContext,
} from '@/types/ai';
import { getCurriculumReference } from './curriculum-context';

// =============================================================================
// Quick Actions Registry
// =============================================================================

export const quickActionsRegistry: QuickAction[] = [
  // Overview actions
  {
    id: 'daily_briefing',
    label: 'Daily Briefing',
    description: 'Get your personalized trading briefing for today',
    icon: 'Sun',
    pages: ['overview'],
  },
  {
    id: 'review_week',
    label: 'Review Week',
    description: 'Analyze your trading performance this week',
    icon: 'Calendar',
    pages: ['overview'],
  },
  {
    id: 'what_to_study',
    label: 'What to Study',
    description: 'Get personalized learning recommendations',
    icon: 'GraduationCap',
    pages: ['overview', 'learning'],
  },
  {
    id: 'identify_patterns',
    label: 'Identify Patterns',
    description: 'Discover patterns in your recent trading',
    icon: 'TrendingUp',
    pages: ['overview', 'journal'],
  },

  // Journal actions
  {
    id: 'analyze_trade',
    label: 'Analyze Trade',
    description: 'Get detailed analysis of the selected trade',
    icon: 'Search',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },
  {
    id: 'grade_ltp',
    label: 'Grade LTP',
    description: 'Get an LTP framework grade for this trade',
    icon: 'Award',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },
  {
    id: 'find_similar',
    label: 'Find Similar',
    description: 'Find trades with similar setups',
    icon: 'Copy',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },
  {
    id: 'related_lesson',
    label: 'Related Lesson',
    description: 'Find lessons related to this trade setup',
    icon: 'BookOpen',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },
  {
    id: 'what_went_right',
    label: 'What Went Right?',
    description: 'Analyze the strengths of this trade',
    icon: 'ThumbsUp',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },
  {
    id: 'what_went_wrong',
    label: 'What Went Wrong?',
    description: 'Identify areas for improvement',
    icon: 'AlertTriangle',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },
  {
    id: 'how_to_improve',
    label: 'How to Improve',
    description: 'Get actionable improvement suggestions',
    icon: 'ArrowUp',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },

  // Learning actions
  {
    id: 'resume_learning',
    label: 'Resume Learning',
    description: 'Continue where you left off',
    icon: 'Play',
    pages: ['learning'],
  },
  {
    id: 'test_knowledge',
    label: 'Test Knowledge',
    description: 'Take a quiz on recent material',
    icon: 'CheckSquare',
    pages: ['learning'],
  },
  {
    id: 'explain_concept',
    label: 'Explain This',
    description: 'Get a detailed explanation of the current concept',
    icon: 'HelpCircle',
    pages: ['learning'],
    requiresSelection: true,
    selectionType: 'lesson',
  },
  {
    id: 'show_example',
    label: 'Show Example',
    description: 'See a real trading example of this concept',
    icon: 'Image',
    pages: ['learning'],
    requiresSelection: true,
    selectionType: 'lesson',
  },
  {
    id: 'practice_this',
    label: 'Practice This',
    description: 'Practice scenarios related to this lesson',
    icon: 'Dumbbell',
    pages: ['learning'],
    requiresSelection: true,
    selectionType: 'lesson',
  },

  // Companion actions
  {
    id: 'analyze_setup',
    label: 'Analyze Setup',
    description: 'Get AI analysis of the current setup',
    icon: 'Target',
    pages: ['companion'],
    requiresSelection: true,
    selectionType: 'setup',
  },
  {
    id: 'grade_level',
    label: 'Grade Level',
    description: 'Evaluate the strength of this level',
    icon: 'Layers',
    pages: ['companion'],
    requiresSelection: true,
    selectionType: 'symbol',
  },
  {
    id: 'whats_the_trend',
    label: "What's the Trend?",
    description: 'Get trend analysis for this symbol',
    icon: 'TrendingUp',
    pages: ['companion'],
    requiresSelection: true,
    selectionType: 'symbol',
  },
  {
    id: 'when_to_enter',
    label: 'When to Enter?',
    description: 'Get entry timing guidance',
    icon: 'Clock',
    pages: ['companion'],
    requiresSelection: true,
    selectionType: 'setup',
  },

  // Practice actions
  {
    id: 'get_hint',
    label: 'Get Hint',
    description: 'Get a hint for the current scenario',
    icon: 'Lightbulb',
    pages: ['practice'],
    requiresSelection: true,
    selectionType: 'scenario',
  },
  {
    id: 'explain_setup',
    label: 'Explain Setup',
    description: 'Understand the current practice setup',
    icon: 'Info',
    pages: ['practice'],
    requiresSelection: true,
    selectionType: 'scenario',
  },
  {
    id: 'try_similar',
    label: 'Try Similar',
    description: 'Practice a similar scenario',
    icon: 'RefreshCw',
    pages: ['practice'],
  },
  {
    id: 'review_mistakes',
    label: 'Review Mistakes',
    description: 'Analyze your recent practice mistakes',
    icon: 'AlertCircle',
    pages: ['practice'],
  },

  // Admin actions
  {
    id: 'generate_caption',
    label: 'Generate Caption',
    description: 'Create a social media caption',
    icon: 'MessageSquare',
    pages: ['admin/social-builder'],
    adminOnly: true,
  },
  {
    id: 'find_trending',
    label: 'Find Trending',
    description: 'Discover trending topics in trading',
    icon: 'TrendingUp',
    pages: ['admin/social-builder'],
    adminOnly: true,
  },
  {
    id: 'analyze_competitors',
    label: 'Analyze Competitors',
    description: 'See what competitors are posting',
    icon: 'Users',
    pages: ['admin/social-builder'],
    adminOnly: true,
  },
  {
    id: 'best_post_time',
    label: 'Best Post Time',
    description: 'Find optimal posting times',
    icon: 'Clock',
    pages: ['admin/social-builder'],
    adminOnly: true,
  },
];

/**
 * Get quick actions available for a specific page
 */
export function getQuickActionsForPage(
  page: DashboardPage,
  isAdmin: boolean = false
): QuickAction[] {
  return quickActionsRegistry.filter((action) => {
    // Check if action is available on this page
    if (!action.pages.includes(page)) return false;

    // Check admin-only actions
    if (action.adminOnly && !isAdmin) return false;

    return true;
  });
}

/**
 * Get a quick action by ID
 */
export function getQuickAction(id: QuickActionId): QuickAction | undefined {
  return quickActionsRegistry.find((action) => action.id === id);
}

// =============================================================================
// System Prompt Generation
// =============================================================================

const BASE_SYSTEM_PROMPT = `You are the KCU Coach, an expert AI trading mentor for Kay Capitals University. You specialize in teaching the LTP Framework (Levels, Trends, Patience Candles) for day trading.

Your role is to:
1. Answer questions about trading concepts, especially the LTP framework
2. Help traders analyze their trades and identify areas for improvement
3. Provide encouragement and support while maintaining high standards
4. Guide users through their learning journey in a structured way
5. Link to relevant training lessons when explaining concepts
6. Show visual setups and charts when helpful

Key LTP Framework concepts:
- LEVELS: Support and resistance zones where price is likely to react
- TRENDS: The overall direction of price movement (higher highs/lows or lower highs/lows)
- PATIENCE CANDLES: Confirmation candles that signal a valid entry after price reaches a level

Trading rules to emphasize:
- Always trade at key levels
- Trade with the trend, not against it
- Wait for patience candle confirmation before entering
- Use proper position sizing (1-2% risk per trade)
- Set stop losses before entering
- Have a clear profit target

Be friendly but professional. Use trading terminology appropriately.`;

const RICH_CONTENT_INSTRUCTIONS = `
=== RICH CONTENT INSTRUCTIONS ===

You can embed rich content in your responses using special markers:

1. LESSON LINKS - Link to training content:
   Format: [[LESSON:module-slug/lesson-slug|Title|Duration]]
   Example: [[LESSON:ltp-framework/patience-candles|Patience Candles Explained|9 min]]

2. CHARTS - Show a symbol's chart:
   Format: [[CHART:SYMBOL|interval|indicators]]
   Example: [[CHART:AAPL|15|MA,VWAP]]

3. SETUP VISUALIZATIONS - Show an LTP setup with scores:
   Format: [[SETUP:SYMBOL|direction|entry|stop|target|level%|trend%|patience%]]
   Example: [[SETUP:SPY|long|445.50|444.20|448.00|90|85|88]]

4. QUIZ PROMPTS - Suggest a quiz:
   Format: [[QUIZ:module-slug|Quiz Title]]
   Example: [[QUIZ:ltp-framework|Test Your LTP Knowledge]]

5. VIDEO TIMESTAMPS - Link to specific moments:
   Format: [[VIDEO:videoId|startMs|endMs|Title]]
   Example: [[VIDEO:dQw4w9WgXcQ|120000|180000|Understanding Support Levels]]

6. THINKIFIC LINKS - Deep link to course content:
   Format: [[THINKIFIC:courseSlug|lessonSlug|timestampSeconds|Title]]
   Example: [[THINKIFIC:ltp-framework|patience-candles|120|Patience Candles Deep Dive]]

RULES:
- Always include 1-2 lesson links when explaining concepts
- When asked to "show" something, use charts or setup visualizations
- Place rich content markers on their own lines
- Don't overuse - 2-3 rich content items per response maximum`;

/**
 * Generate page-specific context for the system prompt
 */
function getPageContextPrompt(context: AIContext): string {
  const { currentPage, pageData, selectedTrade, selectedLesson, selectedSymbol, selectedSetup, selectedScenario } = context;

  const pagePrompts: Record<DashboardPage, () => string> = {
    overview: () => `The user is on the Overview dashboard. They can see their performance metrics, recent trades, and learning progress. Help them understand their overall trading journey and suggest next steps.`,

    journal: () => {
      if (selectedTrade) {
        return `The user is viewing their Trade Journal and has selected a ${selectedTrade.direction.toUpperCase()} trade on ${selectedTrade.symbol} from ${selectedTrade.entry_time}. Entry: $${selectedTrade.entry_price}, Exit: $${selectedTrade.exit_price || 'Still open'}. P&L: ${selectedTrade.pnl !== undefined ? `$${selectedTrade.pnl.toFixed(2)}` : 'N/A'}. Help them analyze this specific trade.`;
      }
      return `The user is browsing their Trade Journal. Help them find trades, identify patterns, and learn from their history.`;
    },

    learning: () => {
      if (selectedLesson) {
        return `The user is studying "${selectedLesson.title}" in the ${selectedLesson.moduleId} module. Help them understand the concepts and apply them to trading.`;
      }
      return `The user is in the Learning Hub browsing available lessons. Help guide their learning path based on their progress.`;
    },

    coach: () => `The user is on the dedicated AI Coach page. This is a general coaching context - help with any trading questions.`,

    companion: () => {
      if (selectedSymbol) {
        return `The user is analyzing ${selectedSymbol} in the Market Companion. ${selectedSetup ? `They are looking at a potential ${selectedSetup.direction} setup.` : ''} Provide real-time market insights and setup analysis.`;
      }
      return `The user is monitoring their watchlist in the Market Companion. Help them analyze symbols and identify opportunities.`;
    },

    practice: () => {
      if (selectedScenario) {
        return `The user is practicing with a ${selectedScenario.difficulty} scenario on ${selectedScenario.symbol}. Scenario: "${selectedScenario.title}". Help them apply LTP principles but don't give away the answer directly.`;
      }
      return `The user is in Practice Mode. Help them improve their trading decisions through deliberate practice.`;
    },

    achievements: () => `The user is viewing their Achievements. Celebrate their progress and suggest what to work toward next.`,

    leaderboard: () => `The user is viewing the Leaderboard. Help them understand how to improve their ranking through consistent learning and trading.`,

    'win-cards': () => `The user is viewing Win Cards - shareable trade achievements. Help them celebrate wins and learn from successful trades.`,

    progress: () => `The user is reviewing their Progress. Help them understand their learning journey and identify areas for growth.`,

    resources: () => `The user is browsing Resources including YouTube videos and supplementary materials. Help them find relevant content.`,

    'admin/users': () => `ADMIN MODE: User management. Help with user administration tasks.`,
    'admin/social-builder': () => `ADMIN MODE: Social content creation. Help generate engaging trading content for social media.`,
    'admin/knowledge': () => `ADMIN MODE: Knowledge CMS. Help manage educational content.`,
    'admin/analytics': () => `ADMIN MODE: Analytics dashboard. Help interpret platform metrics.`,
    'admin/settings': () => `ADMIN MODE: Platform settings. Help with configuration.`,
    'admin/card-builder': () => `ADMIN MODE: Card builder. Help create visual content.`,
  };

  return pagePrompts[currentPage]?.() || '';
}

/**
 * Generate user context for the system prompt
 */
function getUserContextPrompt(context: AIContext): string {
  const { user, stats, recentTrades, learningState } = context;

  let prompt = `
=== USER CONTEXT ===
Username: ${user.username}
Experience Level: ${user.experienceLevel}
Current Module: ${learningState.currentModule}
Streak Days: ${stats.currentStreak}
Practice Accuracy: ${stats.practiceAccuracy.toFixed(1)}%
Win Rate: ${stats.winRate.toFixed(1)}%`;

  if (learningState.weakAreas.length > 0) {
    prompt += `\nWeak Areas: ${learningState.weakAreas.join(', ')}`;
  }

  if (recentTrades.length > 0) {
    prompt += `\n\nRecent Trading Performance:`;
    recentTrades.slice(0, 5).forEach((t) => {
      prompt += `\n- ${t.symbol} ${t.direction}: ${t.pnl !== undefined ? (t.pnl > 0 ? '+' : '') + `$${t.pnl.toFixed(2)}` : 'N/A'}`;
    });
  }

  return prompt;
}

/**
 * Generate market context for the system prompt
 */
function getMarketContextPrompt(marketContext?: MarketContext): string {
  if (!marketContext) return '';

  const { spy, qqq, vix, marketStatus, keyLevelsNearby } = marketContext;

  let prompt = `
=== MARKET CONTEXT ===
Market Status: ${marketStatus.toUpperCase()}
SPY: $${spy.price.toFixed(2)} (${spy.change >= 0 ? '+' : ''}${spy.changePercent.toFixed(2)}%) - ${spy.trend}
QQQ: $${qqq.price.toFixed(2)} (${qqq.change >= 0 ? '+' : ''}${qqq.changePercent.toFixed(2)}%) - ${qqq.trend}
VIX: ${vix.toFixed(2)}`;

  if (keyLevelsNearby.length > 0) {
    prompt += `\n\nKey Levels Nearby:`;
    keyLevelsNearby.slice(0, 5).forEach((l) => {
      prompt += `\n- ${l.symbol}: ${l.level.level_type} at $${l.level.price.toFixed(2)} (${l.distancePercent.toFixed(2)}% away)`;
    });
  }

  return prompt;
}

/**
 * Generate the complete system prompt based on context
 */
export function generateSystemPrompt(context: AIContext): string {
  const parts = [
    BASE_SYSTEM_PROMPT,
    RICH_CONTENT_INSTRUCTIONS,
    getCurriculumReference(),
    `\n=== CURRENT PAGE CONTEXT ===\n${getPageContextPrompt(context)}`,
    getUserContextPrompt(context),
    getMarketContextPrompt(context.marketContext),
  ];

  return parts.filter(Boolean).join('\n');
}

// =============================================================================
// Context Initialization
// =============================================================================

/**
 * Create initial AI context with default values
 */
export function createInitialContext(
  user: Partial<AIContext['user']>,
  page: DashboardPage = 'overview'
): AIContext {
  return {
    currentPage: page,
    pageData: {},
    user: {
      id: user.id || '',
      discordId: user.discordId || '',
      username: user.username || 'Guest',
      avatarUrl: user.avatarUrl,
      experienceLevel: user.experienceLevel || 'beginner',
      subscriptionTier: user.subscriptionTier || 'free',
      isAdmin: user.isAdmin || false,
      createdAt: user.createdAt || new Date(),
    },
    stats: {
      totalTrades: 0,
      winRate: 0,
      avgLtpScore: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalQuizzes: 0,
      lessonsCompleted: 0,
      practiceAttempts: 0,
      practiceAccuracy: 0,
    },
    recentTrades: [],
    learningState: {
      currentModule: 'ltp-framework',
      moduleProgress: [],
      completedLessons: [],
      weakAreas: [],
      recommendedLessons: [],
    },
    achievements: [],
    sessionStarted: new Date(),
    interactionCount: 0,
  };
}

/**
 * Merge partial context updates with existing context
 */
export function mergeContext(
  existing: AIContext,
  updates: Partial<AIContext>
): AIContext {
  return {
    ...existing,
    ...updates,
    user: { ...existing.user, ...updates.user },
    stats: { ...existing.stats, ...updates.stats },
    learningState: { ...existing.learningState, ...updates.learningState },
    pageData: { ...existing.pageData, ...updates.pageData },
    lastInteraction: new Date(),
    interactionCount: existing.interactionCount + 1,
  };
}

// =============================================================================
// Context Compression (for API calls)
// =============================================================================

/**
 * Compress context for API transmission (remove unnecessary data)
 */
export function compressContext(context: AIContext): Partial<AIContext> {
  return {
    currentPage: context.currentPage,
    pageData: context.pageData,
    selectedTrade: context.selectedTrade,
    selectedLesson: context.selectedLesson,
    selectedSymbol: context.selectedSymbol,
    selectedSetup: context.selectedSetup,
    selectedScenario: context.selectedScenario,
    user: {
      id: context.user.id,
      discordId: context.user.discordId,
      username: context.user.username,
      experienceLevel: context.user.experienceLevel,
      isAdmin: context.user.isAdmin,
      subscriptionTier: context.user.subscriptionTier,
      createdAt: context.user.createdAt,
    },
    stats: context.stats,
    learningState: {
      currentModule: context.learningState.currentModule,
      weakAreas: context.learningState.weakAreas,
      completedLessons: [], // Don't send full list
      moduleProgress: [], // Don't send full list
      recommendedLessons: context.learningState.recommendedLessons.slice(0, 3),
    },
    recentTrades: context.recentTrades.slice(0, 5),
    marketContext: context.marketContext,
    interactionCount: context.interactionCount,
  };
}
