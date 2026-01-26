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
  UserProfileContext,
} from '@/types/ai';
import { getCurriculumReference } from './curriculum-context';
import {
  STRUCTURED_OUTPUT_PROMPT,
  formatScoreExplanationForPrompt,
} from './ai-output-schema';
import type { ScoreExplanation } from './ltp-engine';
import type { LTP2ScoreExplanation } from './ltp-gamma-engine';

// =============================================================================
// Input Sanitization
// =============================================================================

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Limit length to prevent DoS
  const MAX_LENGTH = 10000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.slice(0, MAX_LENGTH);
  }

  // Remove potential script injection patterns
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');

  // Normalize whitespace but preserve intentional formatting
  sanitized = sanitized
    .replace(/[\r\n]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return sanitized;
}

/**
 * Validate message content
 */
export function validateMessage(message: string): { valid: boolean; error?: string } {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message is required' };
  }

  const sanitized = sanitizeInput(message);

  if (sanitized.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (sanitized.length < 2) {
    return { valid: false, error: 'Message is too short' };
  }

  return { valid: true };
}

// =============================================================================
// Quick Actions Registry
// =============================================================================

export const quickActionsRegistry: QuickAction[] = [
  // Overview actions
  {
    id: 'daily_briefing',
    label: 'Daily Briefing',
    description: 'Get your personalized trading briefing for today',
    prompt: 'Give me my daily trading briefing. Include market conditions, what to focus on today based on my recent performance, and any key reminders.',
    icon: 'Sun',
    pages: ['overview'],
  },
  {
    id: 'review_week',
    label: 'Review Week',
    description: 'Analyze your trading performance this week',
    prompt: 'Review my trading performance this week. Analyze my win rate, P&L, LTP scores, and identify patterns in my recent trades.',
    icon: 'Calendar',
    pages: ['overview'],
  },
  {
    id: 'what_to_study',
    label: 'What to Study',
    description: 'Get personalized learning recommendations',
    prompt: 'Based on my recent trading performance and progress, what should I study next to improve my trading?',
    icon: 'GraduationCap',
    pages: ['overview', 'learning'],
  },
  {
    id: 'identify_patterns',
    label: 'Identify Patterns',
    description: 'Discover patterns in your recent trading',
    prompt: 'Analyze my recent trades and identify any patterns - both good habits I should keep and bad patterns I should address.',
    icon: 'TrendingUp',
    pages: ['overview', 'journal'],
  },

  // Journal actions
  {
    id: 'analyze_trade',
    label: 'Analyze Trade',
    description: 'Get detailed analysis of the selected trade',
    prompt: 'Analyze this trade in detail. Break down the entry, management, and exit. Was this trade following the LTP framework correctly?',
    icon: 'Search',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },
  {
    id: 'grade_ltp',
    label: 'Grade LTP',
    description: 'Get an LTP framework grade for this trade',
    prompt: 'Grade this trade using the LTP framework. Score it on Levels (was it at a key level?), Trend (was it with the trend?), and Patience Candle (was there proper confirmation?).',
    icon: 'Award',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },
  {
    id: 'find_similar',
    label: 'Find Similar',
    description: 'Find trades with similar setups',
    prompt: 'Find trades with similar setups to this one in my journal. Compare outcomes and identify patterns.',
    icon: 'Copy',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },
  {
    id: 'related_lesson',
    label: 'Related Lesson',
    description: 'Find lessons related to this trade setup',
    prompt: 'What lessons in the KCU curriculum are most relevant to this trade setup? Recommend what I should review.',
    icon: 'BookOpen',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },
  {
    id: 'what_went_right',
    label: 'What Went Right?',
    description: 'Analyze the strengths of this trade',
    prompt: 'What went right in this trade? Identify the strengths and what I should continue doing.',
    icon: 'ThumbsUp',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },
  {
    id: 'what_went_wrong',
    label: 'What Went Wrong?',
    description: 'Identify areas for improvement',
    prompt: 'What went wrong in this trade? Identify mistakes or areas for improvement.',
    icon: 'AlertTriangle',
    pages: ['journal'],
    requiresSelection: true,
    selectionType: 'trade',
  },
  {
    id: 'how_to_improve',
    label: 'How to Improve',
    description: 'Get actionable improvement suggestions',
    prompt: 'How could I have improved this trade? Give me specific, actionable suggestions.',
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
    prompt: 'Where should I pick up in my learning? Remind me what I was studying and what comes next.',
    icon: 'Play',
    pages: ['learning'],
  },
  {
    id: 'test_knowledge',
    label: 'Test Knowledge',
    description: 'Take a quiz on recent material',
    prompt: 'Test my knowledge with a quiz on the material I\'ve recently studied.',
    icon: 'CheckSquare',
    pages: ['learning'],
  },
  {
    id: 'explain_concept',
    label: 'Explain This',
    description: 'Get a detailed explanation of the current concept',
    prompt: 'Explain this concept in more detail. Use examples and relate it to the LTP framework.',
    icon: 'HelpCircle',
    pages: ['learning'],
    requiresSelection: true,
    selectionType: 'lesson',
  },
  {
    id: 'show_example',
    label: 'Show Example',
    description: 'See a real trading example of this concept',
    prompt: 'Show me a real trading example that demonstrates this concept.',
    icon: 'Image',
    pages: ['learning'],
    requiresSelection: true,
    selectionType: 'lesson',
  },
  {
    id: 'practice_this',
    label: 'Practice This',
    description: 'Practice scenarios related to this lesson',
    prompt: 'Give me a practice scenario related to this lesson so I can apply what I learned.',
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
    prompt: 'Analyze this setup using the LTP framework. Is this a valid trade opportunity?',
    icon: 'Target',
    pages: ['companion'],
    requiresSelection: true,
    selectionType: 'setup',
  },
  {
    id: 'grade_level',
    label: 'Grade Level',
    description: 'Evaluate the strength of this level',
    prompt: 'Grade this price level. How strong is it? What makes it significant?',
    icon: 'Layers',
    pages: ['companion'],
    requiresSelection: true,
    selectionType: 'symbol',
  },
  {
    id: 'whats_the_trend',
    label: "What's the Trend?",
    description: 'Get trend analysis for this symbol',
    prompt: 'What is the current trend for this symbol? Analyze multiple timeframes.',
    icon: 'TrendingUp',
    pages: ['companion'],
    requiresSelection: true,
    selectionType: 'symbol',
  },
  {
    id: 'when_to_enter',
    label: 'When to Enter?',
    description: 'Get entry timing guidance',
    prompt: 'Based on the LTP framework, when should I enter this trade? What patience candle signal should I wait for?',
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
    prompt: 'Give me a hint for this practice scenario without giving away the answer.',
    icon: 'Lightbulb',
    pages: ['practice'],
    requiresSelection: true,
    selectionType: 'scenario',
  },
  {
    id: 'explain_setup',
    label: 'Explain Setup',
    description: 'Understand the current practice setup',
    prompt: 'Explain this practice setup. What are the key elements I should be looking at?',
    icon: 'Info',
    pages: ['practice'],
    requiresSelection: true,
    selectionType: 'scenario',
  },
  {
    id: 'try_similar',
    label: 'Try Similar',
    description: 'Practice a similar scenario',
    prompt: 'Give me a similar practice scenario to try.',
    icon: 'RefreshCw',
    pages: ['practice'],
  },
  {
    id: 'review_mistakes',
    label: 'Review Mistakes',
    description: 'Analyze your recent practice mistakes',
    prompt: 'Review my recent practice mistakes. What patterns do you see and how can I improve?',
    icon: 'AlertCircle',
    pages: ['practice'],
  },

  // Admin actions
  {
    id: 'generate_caption',
    label: 'Generate Caption',
    description: 'Create a social media caption',
    prompt: 'Generate an engaging social media caption for this trading content.',
    icon: 'MessageSquare',
    pages: ['admin/social-builder'],
    adminOnly: true,
  },
  {
    id: 'find_trending',
    label: 'Find Trending',
    description: 'Discover trending topics in trading',
    prompt: 'What trading topics are trending right now that we should create content about?',
    icon: 'TrendingUp',
    pages: ['admin/social-builder'],
    adminOnly: true,
  },
  {
    id: 'analyze_competitors',
    label: 'Analyze Competitors',
    description: 'See what competitors are posting',
    prompt: 'Analyze what competitor trading educators are posting about. What topics are performing well?',
    icon: 'Users',
    pages: ['admin/social-builder'],
    adminOnly: true,
  },
  {
    id: 'best_post_time',
    label: 'Best Post Time',
    description: 'Find optimal posting times',
    prompt: 'When are the best times to post trading content for maximum engagement?',
    icon: 'Clock',
    pages: ['admin/social-builder'],
    adminOnly: true,
  },

  // Additional Overview actions
  {
    id: 'compare_week_over_week',
    label: 'Compare Weeks',
    description: 'Compare your performance to last week',
    prompt: 'Compare my trading performance this week vs last week. Show me the differences in win rate, P&L, and LTP scores.',
    icon: 'BarChart',
    pages: ['overview'],
  },
  {
    id: 'check_status',
    label: 'Check Status',
    description: 'Current streaks, milestones, rankings',
    prompt: 'What is my current status? Show my streaks, milestones I am close to, and my ranking.',
    icon: 'Trophy',
    pages: ['overview'],
  },

  // Additional Journal actions
  {
    id: 'export_trades',
    label: 'Export Trades',
    description: 'Export your trade journal data',
    prompt: 'Help me export my trade journal. What formats are available and what data will be included?',
    icon: 'Download',
    pages: ['journal'],
  },
  {
    id: 'backtest_strategy',
    label: 'Backtest Strategy',
    description: 'Test a pattern against historical trades',
    prompt: 'Analyze my historical trades to backtest my strategy. What patterns have been most successful?',
    icon: 'FlaskConical',
    pages: ['journal'],
  },
  {
    id: 'trade_statistics',
    label: 'Trade Statistics',
    description: 'Detailed statistical analysis',
    prompt: 'Give me detailed statistics on my trading. Include win rate by symbol, direction, time of day, and day of week.',
    icon: 'PieChart',
    pages: ['journal'],
  },
  {
    id: 'find_losses',
    label: 'Find Losses',
    description: 'Analyze your losing trades',
    prompt: 'Show me my losing trades and analyze them. What patterns do you see in my losses?',
    icon: 'TrendingDown',
    pages: ['journal'],
  },

  // Additional Learning actions
  {
    id: 'get_learning_plan',
    label: 'Learning Plan',
    description: 'Get an AI-generated learning path',
    prompt: 'Create a personalized learning plan for me based on my current progress and weak areas.',
    icon: 'Map',
    pages: ['learning'],
  },
  {
    id: 'prerequisite_check',
    label: 'Prerequisites',
    description: 'Check prerequisites before proceeding',
    prompt: 'What prerequisites should I complete before this lesson? Am I ready for this content?',
    icon: 'ListChecks',
    pages: ['learning'],
    requiresSelection: true,
    selectionType: 'lesson',
  },

  // Additional Companion actions
  {
    id: 'watch_symbol',
    label: 'Add to Watchlist',
    description: 'Add symbol to your watchlist',
    prompt: 'Add this symbol to my watchlist and tell me what levels I should watch.',
    icon: 'Eye',
    pages: ['companion'],
    requiresSelection: true,
    selectionType: 'symbol',
  },
  {
    id: 'set_alert',
    label: 'Set Alert',
    description: 'Set a price or pattern alert',
    prompt: 'Help me set up an alert for this symbol. What price levels or patterns should I watch for?',
    icon: 'Bell',
    pages: ['companion'],
    requiresSelection: true,
    selectionType: 'symbol',
  },
  {
    id: 'compare_setups',
    label: 'Compare Setups',
    description: 'Compare multiple setups side-by-side',
    prompt: 'Compare the setups on my watchlist. Which one has the best LTP score right now?',
    icon: 'Columns',
    pages: ['companion'],
  },
  {
    id: 'market_opportunity',
    label: 'Find Opportunities',
    description: 'Find real-time setup opportunities',
    prompt: 'What are the best trading opportunities right now based on the LTP framework?',
    icon: 'Radar',
    pages: ['companion', 'overview'],
  },

  // Additional Admin actions
  {
    id: 'user_engagement_report',
    label: 'Engagement Report',
    description: 'Deep dive into user metrics',
    prompt: 'Generate a detailed user engagement report. Show me active users, retention, and feature usage.',
    icon: 'UserCheck',
    pages: ['admin/analytics', 'admin/users'],
    adminOnly: true,
  },
  {
    id: 'content_gap_analysis',
    label: 'Content Gaps',
    description: 'Identify missing content areas',
    prompt: 'Analyze our content for gaps. What topics are users asking about that we don\'t cover well?',
    icon: 'Search',
    pages: ['admin/knowledge'],
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
 * Get current market time info in Eastern timezone
 */
function getMarketTimeInfo(): {
  currentTime: string;
  marketPhase: string;
  timeUntilChange: string;
} {
  // Get current time in Eastern timezone
  const now = new Date();
  const etOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  const etTime = new Intl.DateTimeFormat('en-US', etOptions).format(now);
  const [hours, minutes] = etTime.split(':').map(Number);
  const currentMinutes = hours * 60 + minutes;

  // Market hours (Eastern)
  const preMarketStart = 4 * 60; // 4:00 AM
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM
  const afterHoursEnd = 20 * 60; // 8:00 PM

  let marketPhase: string;
  let timeUntilChange: string;

  if (currentMinutes < preMarketStart) {
    marketPhase = 'CLOSED (overnight)';
    const minsUntil = preMarketStart - currentMinutes;
    timeUntilChange = `${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m until pre-market`;
  } else if (currentMinutes < marketOpen) {
    marketPhase = 'PRE-MARKET';
    const minsUntil = marketOpen - currentMinutes;
    timeUntilChange = `${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m until open`;
  } else if (currentMinutes < marketClose) {
    marketPhase = 'MARKET OPEN';
    const minsUntil = marketClose - currentMinutes;
    timeUntilChange = `${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m until close`;
  } else if (currentMinutes < afterHoursEnd) {
    marketPhase = 'AFTER-HOURS';
    const minsUntil = afterHoursEnd - currentMinutes;
    timeUntilChange = `${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m until after-hours ends`;
  } else {
    marketPhase = 'CLOSED';
    const minsUntil = 24 * 60 - currentMinutes + preMarketStart;
    timeUntilChange = `${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m until pre-market`;
  }

  return {
    currentTime: etTime,
    marketPhase,
    timeUntilChange,
  };
}

/**
 * Generate market context for the system prompt
 */
function getMarketContextPrompt(marketContext?: MarketContext): string {
  // Always include timezone info even without market data
  const timeInfo = getMarketTimeInfo();

  let prompt = `
=== MARKET CONTEXT ===
Current Eastern Time: ${timeInfo.currentTime}
Market Phase: ${timeInfo.marketPhase}
${timeInfo.timeUntilChange}`;

  if (!marketContext) {
    prompt += '\n(Real-time market data not loaded)';
    return prompt;
  }

  const { spy, qqq, vix, keyLevelsNearby } = marketContext;

  // Safely access price data with fallbacks
  if (spy?.price) {
    prompt += `\nSPY: $${spy.price.toFixed(2)} (${spy.change >= 0 ? '+' : ''}${spy.changePercent?.toFixed(2) || '0.00'}%) - ${spy.trend || 'neutral'}`;
    if (spy.previousClose) {
      prompt += ` | Prev Close: $${spy.previousClose.toFixed(2)}`;
    }
  }

  if (qqq?.price) {
    prompt += `\nQQQ: $${qqq.price.toFixed(2)} (${qqq.change >= 0 ? '+' : ''}${qqq.changePercent?.toFixed(2) || '0.00'}%) - ${qqq.trend || 'neutral'}`;
    if (qqq.previousClose) {
      prompt += ` | Prev Close: $${qqq.previousClose.toFixed(2)}`;
    }
  }

  if (vix) {
    prompt += `\nVIX: ${vix.toFixed(2)}`;
    // Add VIX interpretation
    if (vix < 15) prompt += ' (Low volatility - calm market)';
    else if (vix < 20) prompt += ' (Normal volatility)';
    else if (vix < 30) prompt += ' (Elevated volatility - be cautious)';
    else prompt += ' (High volatility - extreme caution)';
  }

  if (keyLevelsNearby && keyLevelsNearby.length > 0) {
    prompt += `\n\nKey Levels Nearby:`;
    keyLevelsNearby.slice(0, 5).forEach((l) => {
      prompt += `\n- ${l.symbol}: ${l.level.level_type} at $${l.level.price.toFixed(2)} (${l.distancePercent.toFixed(2)}% away)`;
    });
  }

  // Add earnings warnings if present
  if (marketContext.upcomingEarnings && marketContext.upcomingEarnings.length > 0) {
    prompt += `\n\n⚠️ Upcoming Earnings:`;
    marketContext.upcomingEarnings.slice(0, 3).forEach((e) => {
      prompt += `\n- ${e.symbol}: ${e.date} (${e.timing} market)`;
    });
  }

  return prompt;
}

/**
 * Generate trading profile context for proactive coaching
 * This is the "Elephant's Memory" - the AI knows WHO it is coaching
 */
function getTradingProfilePrompt(profile?: UserProfileContext): string {
  if (!profile) {
    return '';
  }

  let prompt = `
=== USER TRADING PROFILE (CRITICAL FOR PROACTIVE COACHING) ===`;

  // Weaknesses - AI should watch for these
  if (profile.weaknesses && profile.weaknesses.length > 0) {
    const weaknessDescriptions: Record<string, string> = {
      'chasing_entries': "CHASING - They enter too late, FOMO-driven. WARN them immediately if they're entering after a big move.",
      'no_stop_loss': "NO STOP DISCIPLINE - They don't set or honor stops. ALWAYS ask about their stop before any trade discussion.",
      'trend_fighting': "TREND FIGHTER - They go against the trend. If breadth is bearish and they want to go long, BLOCK IT.",
      'overtrading': "OVERTRADER - Too many trades. Track their daily count and WARN after 2-3 trades.",
      'revenge_trading': "REVENGE TRADER - Trades after losses to 'make it back'. After a loss, encourage stepping away.",
      'early_profit_taking': "EARLY PROFIT TAKER - Takes profits too soon. Remind them to let winners run.",
      'moving_stops': "STOP MOVER - Moves stops to 'give room'. This is account killer behavior. Call it out HARD.",
      'size_too_big': "POSITION SIZE ISSUES - Trades too big. Always verify their size is appropriate for the setup.",
      'averaging_down': "AVERAGES DOWN - Adds to losers. This is DUMB SHIT. Never let them do this.",
      'not_waiting': "IMPATIENT - Doesn't wait for patience candle. Always remind them to wait for the close.",
      'level_ignoring': "LEVEL IGNORANT - Doesn't trade at levels. Ask 'Where's your level?' for every setup.",
      'fomo_buying': "FOMO BUYER - Fear of missing out. Remind them: Missed trades are NOT losses.",
      'fear_selling': "PANIC SELLER - Sells at lows. When VIX spikes, check in on them.",
      'holding_losers': "LOSS HOLDER - Doesn't cut losses. Remind them: Cut losers, let winners run.",
      'lack_of_plan': "NO PLAN - Trades without entry/exit plan. Always ask for their plan before entry.",
    };

    prompt += `

🚨 USER WEAKNESSES (WATCH FOR THESE AND INTERVENE):`;
    profile.weaknesses.forEach(weakness => {
      const severity = profile.weaknessSeverity?.[weakness] || 5;
      const desc = weaknessDescriptions[weakness] || weakness;
      prompt += `\n- [Severity ${severity}/10] ${desc}`;
    });
  }

  // Mental Capital
  prompt += `

🧠 MENTAL CAPITAL: ${profile.mentalCapital}/100`;
  if (profile.mentalCapital <= 40) {
    prompt += `
⚠️ CRITICAL: Mental capital is LOW. This user should probably NOT be trading today.
${profile.warningMessage || 'Recommend they step away and reset.'}`;
  } else if (profile.mentalCapital <= 60) {
    prompt += `
⚠️ Mental capital is below optimal. Encourage smaller position sizes.`;
  }

  // Consecutive losses/wins
  if (profile.consecutiveLosses >= 2) {
    prompt += `
🔴 ALERT: ${profile.consecutiveLosses} consecutive losses. Watch for revenge trading behavior.`;
  }
  if (profile.consecutiveWins >= 3) {
    prompt += `
🟢 Note: ${profile.consecutiveWins} consecutive wins. Watch for overconfidence and size inflation.`;
  }

  // Risk profile
  prompt += `

📊 RISK PROFILE:
- Tolerance: ${profile.riskTolerance}
- Max Daily Trades: ${profile.maxDailyTrades}
- Max Daily Loss: ${profile.maxDailyLossPercent}%`;

  // Coaching preferences
  prompt += `

🎯 COACHING STYLE: ${profile.coachingIntensity.toUpperCase()}`;
  if (profile.coachingIntensity === 'intense') {
    prompt += ` - Be DIRECT, call out mistakes immediately, use strong language.`;
  } else if (profile.coachingIntensity === 'light') {
    prompt += ` - Be supportive, gentle nudges rather than warnings.`;
  } else {
    prompt += ` - Balanced approach, firm but fair.`;
  }

  if (profile.allowBlockingWarnings) {
    prompt += `\nUser has OPTED IN to blocking warnings. You CAN prevent trades that violate rules.`;
  }

  // Personal rules
  if (profile.personalRules && profile.personalRules.length > 0) {
    prompt += `

📜 USER'S PERSONAL TRADING RULES (They set these - help them follow them):`;
    profile.personalRules.forEach((rule, i) => {
      prompt += `\n${i + 1}. ${rule}`;
    });
  }

  // Coach notes
  if (profile.coachNotes && profile.coachNotes.length > 0) {
    prompt += `

📝 SOMESH-STYLE REMINDERS FOR THIS USER:`;
    profile.coachNotes.forEach(note => {
      prompt += `\n- ${note}`;
    });
  }

  return prompt;
}

/**
 * Generate proactive coaching context from market hot context
 */
function getProactiveCoachingPrompt(marketContext?: MarketContext): string {
  if (!marketContext) {
    return '';
  }

  let prompt = '';

  // Market Breadth Context
  if (marketContext.breadth) {
    const { breadth } = marketContext;
    prompt += `

=== MARKET BREADTH (Live Situational Awareness) ===
ADD (Advance-Decline): ${breadth.add.value} (${breadth.add.trend})
VOLD (Volume Delta): ${breadth.vold.value} (${breadth.vold.trend})
TICK: ${breadth.tick.current}${breadth.tick.extremeReading ? ' ⚡ EXTREME' : ''}
Market Health Score: ${breadth.healthScore}/100
Trading Bias: ${breadth.tradingBias.toUpperCase()}
${breadth.coachingMessage ? `\n💬 ${breadth.coachingMessage}` : ''}`;
  }

  // Trading Conditions
  if (marketContext.tradingConditions) {
    const { tradingConditions } = marketContext;
    const statusEmoji = tradingConditions.status === 'red' ? '🔴' :
                        tradingConditions.status === 'yellow' ? '🟡' : '🟢';
    prompt += `

=== TRADING CONDITIONS: ${statusEmoji} ${tradingConditions.status.toUpperCase()} ===
${tradingConditions.message}`;
    if (tradingConditions.restrictions.length > 0) {
      prompt += `\nRestrictions:`;
      tradingConditions.restrictions.forEach(r => {
        prompt += `\n- ${r}`;
      });
    }
  }

  // Active Warnings
  if (marketContext.activeWarnings && marketContext.activeWarnings.length > 0) {
    prompt += `

=== ACTIVE WARNINGS (Surface these to the user!) ===`;
    marketContext.activeWarnings.forEach(warning => {
      const emoji = warning.severity === 'critical' ? '🚨' :
                    warning.severity === 'warning' ? '⚠️' : 'ℹ️';
      prompt += `\n${emoji} [${warning.severity.toUpperCase()}] ${warning.title}: ${warning.message}`;
    });
  }

  // Next Event
  if (marketContext.nextEvent) {
    const { nextEvent } = marketContext;
    if (nextEvent.isImminent) {
      prompt += `

🚨 IMMINENT EVENT: ${nextEvent.event} in ${nextEvent.minutesUntil} MINUTES!
Impact: ${nextEvent.impact.toUpperCase()} - Warn user to flatten or avoid new trades!`;
    } else if (nextEvent.minutesUntil <= 60 && nextEvent.impact === 'high') {
      prompt += `

⏰ UPCOMING: ${nextEvent.event} in ${nextEvent.minutesUntil} minutes (${nextEvent.impact} impact)`;
    }
  }

  return prompt;
}

/** Options for system prompt generation */
export interface SystemPromptOptions {
  /** Enable structured JSON output mode (for trustworthy coaching) */
  structuredOutput?: boolean;
  /** Pre-computed score explanation from LTP engine (AI must not compute its own) */
  scoreExplanation?: ScoreExplanation | LTP2ScoreExplanation | null;
}

/**
 * Generate the complete system prompt based on context
 */
export function generateSystemPrompt(
  context: AIContext,
  options?: SystemPromptOptions
): string {
  const parts = [
    BASE_SYSTEM_PROMPT,
    RICH_CONTENT_INSTRUCTIONS,
    getCurriculumReference(),
    `\n=== CURRENT PAGE CONTEXT ===\n${getPageContextPrompt(context)}`,
    getUserContextPrompt(context),
    getTradingProfilePrompt(context.tradingProfile),
    getMarketContextPrompt(context.marketContext),
    getProactiveCoachingPrompt(context.marketContext),
  ];

  // Add structured output instructions if enabled
  if (options?.structuredOutput) {
    parts.push(STRUCTURED_OUTPUT_PROMPT);
  }

  // Add pre-computed score explanation if provided
  if (options?.scoreExplanation !== undefined) {
    parts.push(formatScoreExplanationForPrompt(options.scoreExplanation));
  }

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

// =============================================================================
// Context-Aware Suggested Prompts
// =============================================================================

interface SuggestedPrompt {
  text: string;
  priority: number;
}

/**
 * Get context-aware suggested prompts based on current page and selections
 */
export function getSuggestedPrompts(context: AIContext): string[] {
  const prompts: SuggestedPrompt[] = [];
  const { currentPage, selectedTrade, selectedLesson, selectedSymbol, selectedSetup, selectedScenario } = context;

  // Page-specific prompts
  const pagePrompts: Record<DashboardPage, SuggestedPrompt[]> = {
    overview: [
      { text: 'Give me my daily trading briefing', priority: 10 },
      { text: 'What should I focus on today?', priority: 8 },
      { text: 'Review my performance this week', priority: 7 },
      { text: 'What are the best opportunities right now?', priority: 6 },
    ],
    journal: [
      { text: 'Analyze my recent trades for patterns', priority: 8 },
      { text: 'What are my most common mistakes?', priority: 7 },
      { text: 'Show me my best performing setups', priority: 6 },
      { text: 'Compare my wins vs losses', priority: 5 },
    ],
    learning: [
      { text: 'What should I study next?', priority: 8 },
      { text: 'Explain the LTP framework', priority: 7 },
      { text: 'How do I identify patience candles?', priority: 6 },
      { text: 'Quiz me on what I learned', priority: 5 },
    ],
    coach: [
      { text: 'Explain the LTP framework', priority: 8 },
      { text: 'How do I identify a good entry?', priority: 7 },
      { text: 'What makes a strong support level?', priority: 6 },
      { text: 'Help me with risk management', priority: 5 },
    ],
    companion: [
      { text: 'What setups look good right now?', priority: 8 },
      { text: 'Analyze the current market trend', priority: 7 },
      { text: 'Where are the key levels to watch?', priority: 6 },
      { text: 'Is there a patience candle forming?', priority: 5 },
    ],
    practice: [
      { text: 'Give me a hint for this scenario', priority: 8 },
      { text: 'Explain what I should look for here', priority: 7 },
      { text: 'Review my recent practice mistakes', priority: 6 },
      { text: 'Try a different scenario type', priority: 5 },
    ],
    achievements: [
      { text: 'What achievements am I close to?', priority: 8 },
      { text: 'How can I earn more badges?', priority: 7 },
      { text: 'What does this achievement require?', priority: 6 },
    ],
    leaderboard: [
      { text: 'How can I improve my ranking?', priority: 8 },
      { text: 'What do top traders do differently?', priority: 7 },
      { text: 'Analyze my recent performance', priority: 6 },
    ],
    'win-cards': [
      { text: 'Help me analyze this winning trade', priority: 8 },
      { text: 'What made this trade successful?', priority: 7 },
      { text: 'Show me similar successful setups', priority: 6 },
    ],
    progress: [
      { text: 'What areas need the most work?', priority: 8 },
      { text: 'Create a learning plan for me', priority: 7 },
      { text: 'Review my progress this month', priority: 6 },
    ],
    resources: [
      { text: 'Find videos about patience candles', priority: 8 },
      { text: 'What resources cover key levels?', priority: 7 },
      { text: 'Recommend content for my level', priority: 6 },
    ],
    'admin/users': [
      { text: 'Show user engagement metrics', priority: 8 },
      { text: 'Which users need attention?', priority: 7 },
    ],
    'admin/social-builder': [
      { text: 'Generate a caption for this post', priority: 8 },
      { text: 'What topics are trending now?', priority: 7 },
      { text: 'Best time to post today?', priority: 6 },
    ],
    'admin/knowledge': [
      { text: 'What content gaps exist?', priority: 8 },
      { text: 'Review pending content', priority: 7 },
    ],
    'admin/analytics': [
      { text: 'Show me the engagement report', priority: 8 },
      { text: 'What features are most used?', priority: 7 },
    ],
    'admin/settings': [
      { text: 'Help me configure settings', priority: 8 },
    ],
    'admin/card-builder': [
      { text: 'Help me design a win card', priority: 8 },
    ],
  };

  // Add page-specific prompts
  const pageSpecificPrompts = pagePrompts[currentPage] || [];
  prompts.push(...pageSpecificPrompts);

  // Selection-specific prompts (higher priority)
  if (selectedTrade) {
    prompts.push(
      { text: `Analyze my ${selectedTrade.symbol} ${selectedTrade.direction} trade`, priority: 12 },
      { text: 'Grade this trade with LTP framework', priority: 11 },
      { text: 'What could I have done better?', priority: 10 },
      { text: 'Find similar trades in my journal', priority: 9 }
    );
  }

  if (selectedLesson) {
    prompts.push(
      { text: `Explain "${selectedLesson.title}" in more detail`, priority: 12 },
      { text: 'Show me a real example of this concept', priority: 11 },
      { text: 'Quiz me on this lesson', priority: 10 }
    );
  }

  if (selectedSymbol) {
    prompts.push(
      { text: `Analyze ${selectedSymbol} using LTP`, priority: 12 },
      { text: `What are the key levels for ${selectedSymbol}?`, priority: 11 },
      { text: `Is ${selectedSymbol} showing any setups?`, priority: 10 }
    );
  }

  if (selectedSetup) {
    prompts.push(
      { text: `Grade this ${selectedSetup.symbol} setup`, priority: 12 },
      { text: 'When should I enter this trade?', priority: 11 },
      { text: 'What is the risk/reward here?', priority: 10 }
    );
  }

  if (selectedScenario) {
    prompts.push(
      { text: 'Give me a hint without the answer', priority: 12 },
      { text: 'What should I be looking for?', priority: 11 },
      { text: 'Explain the setup in this scenario', priority: 10 }
    );
  }

  // Sort by priority and return top 4 unique prompts
  return prompts
    .sort((a, b) => b.priority - a.priority)
    .map(p => p.text)
    .filter((text, index, self) => self.indexOf(text) === index)
    .slice(0, 4);
}
