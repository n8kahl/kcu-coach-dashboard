/**
 * Quick Action API Endpoint
 *
 * Handles context-aware quick actions from the AI Command Center.
 * Each action generates targeted AI responses based on the current context.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { parseAIResponse } from '@/lib/rich-content-parser';
import { getQuickAction, generateSystemPrompt } from '@/lib/ai-context';
import logger from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';
import type { AIContext, QuickActionId } from '@/types/ai';
import type { RichContent } from '@/types';

interface QuickActionResultLocal {
  actionId: QuickActionId;
  success: boolean;
  result?: string;
  richContent?: RichContent[];
  error?: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ActionRequest {
  actionId: QuickActionId;
  context: Partial<AIContext>;
}

/**
 * Action handlers for each quick action
 */
const actionHandlers: Record<
  QuickActionId,
  (context: AIContext) => Promise<{ prompt: string; systemAddition?: string }>
> = {
  // Overview actions
  daily_briefing: async (context) => ({
    prompt: `Generate a personalized daily trading briefing for ${context.user.username}. Include:
1. A motivational opening
2. Key lessons to focus on today based on their weak areas: ${context.learningState?.weakAreas?.join(', ') || 'general LTP concepts'}
3. Trading mindset reminder
4. One practice scenario suggestion

Keep it concise and actionable.`,
  }),

  review_week: async (context) => {
    const trades = context.recentTrades || [];
    const winCount = trades.filter((t) => (t.pnl || 0) > 0).length;
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    return {
      prompt: `Review this trader's week:
- Total trades: ${trades.length}
- Wins: ${winCount}/${trades.length}
- Total P&L: $${totalPnL.toFixed(2)}
- Practice accuracy: ${context.stats?.practiceAccuracy?.toFixed(1) || 0}%
- Current streak: ${context.stats?.currentStreak || 0} days

Provide:
1. Performance summary
2. Pattern observations
3. Top improvement area
4. Next week's focus

Include relevant lesson links.`,
    };
  },

  what_to_study: async (context) => ({
    prompt: `Based on this trader's profile:
- Experience: ${context.user.experienceLevel}
- Current module: ${context.learningState?.currentModule || 'ltp-framework'}
- Weak areas: ${context.learningState?.weakAreas?.join(', ') || 'not identified'}
- Practice accuracy: ${context.stats?.practiceAccuracy?.toFixed(1) || 0}%

Recommend the top 3 lessons they should study next. For each:
1. Lesson name and link
2. Why it's relevant to them
3. Expected outcome

Include [[LESSON:...]] markers.`,
  }),

  identify_patterns: async (context) => {
    const trades = context.recentTrades || [];
    return {
      prompt: `Analyze these recent trades for patterns:
${trades
  .map(
    (t) =>
      `- ${t.symbol} ${t.direction}: Entry $${t.entry_price}, P&L ${t.pnl !== undefined ? `$${t.pnl.toFixed(2)}` : 'N/A'}`
  )
  .join('\n')}

Identify:
1. Common mistakes
2. Strengths
3. Time-of-day patterns
4. Symbol preferences
5. LTP compliance trends

Provide actionable insights with lesson recommendations.`,
    };
  },

  // Journal actions
  analyze_trade: async (context) => {
    if (!context.selectedTrade) {
      return { prompt: 'Please select a trade to analyze.' };
    }
    const t = context.selectedTrade;
    return {
      prompt: `Perform a comprehensive LTP analysis of this trade:

Symbol: ${t.symbol}
Direction: ${t.direction}
Entry: $${t.entry_price}
Exit: ${t.exit_price ? `$${t.exit_price}` : 'Still open'}
P&L: ${t.pnl !== undefined ? `$${t.pnl.toFixed(2)}` : 'N/A'}
Notes: ${t.notes || 'None'}

Provide:
1. LTP Score breakdown with percentages
2. Setup visualization [[SETUP:...]]
3. What was done well
4. Areas for improvement
5. Similar winning setups to study
6. Relevant lesson links`,
    };
  },

  grade_ltp: async (context) => {
    if (!context.selectedTrade) {
      return { prompt: 'Please select a trade to grade.' };
    }
    const t = context.selectedTrade;
    return {
      prompt: `Grade this trade using the LTP framework:

Symbol: ${t.symbol}
Direction: ${t.direction}
Entry: $${t.entry_price}

Provide:
1. Level Score (0-100): Was entry at a key level?
2. Trend Score (0-100): Was trade with the trend?
3. Patience Score (0-100): Was there a patience candle?
4. Overall Grade (A-F)
5. Brief explanation for each score

Show as [[SETUP:${t.symbol}|${t.direction}|${t.entry_price}|...|L%|T%|P%]]`,
    };
  },

  find_similar: async (context) => {
    if (!context.selectedTrade) {
      return { prompt: 'Please select a trade to find similar setups.' };
    }
    const t = context.selectedTrade;
    return {
      prompt: `Based on this ${t.direction} trade on ${t.symbol}:
- Entry: $${t.entry_price}
- Result: ${(t.pnl || 0) > 0 ? 'Winner' : 'Loser'}

Find and describe 2-3 similar setups from the curriculum that would have been:
1. Similar entry conditions
2. Better execution examples
3. Relevant lessons to study

Include lesson links and setup visualizations.`,
    };
  },

  related_lesson: async (context) => {
    if (!context.selectedTrade) {
      return { prompt: 'Please select a trade to find related lessons.' };
    }
    const t = context.selectedTrade;
    return {
      prompt: `For this ${t.direction} trade on ${t.symbol}, recommend the most relevant lessons:

1. If it was a winner: Lessons to reinforce what went right
2. If it was a loser: Lessons addressing what went wrong

Consider:
- The setup type
- Entry/exit execution
- Risk management
- Psychology aspects

Include 2-3 [[LESSON:...]] links with brief explanations.`,
    };
  },

  what_went_right: async (context) => {
    if (!context.selectedTrade) {
      return { prompt: 'Please select a trade to analyze.' };
    }
    return {
      prompt: `Analyze what went RIGHT in this trade:
${JSON.stringify(context.selectedTrade, null, 2)}

Focus on:
1. LTP compliance strengths
2. Good decision-making
3. Proper execution
4. What to repeat in future trades`,
    };
  },

  what_went_wrong: async (context) => {
    if (!context.selectedTrade) {
      return { prompt: 'Please select a trade to analyze.' };
    }
    return {
      prompt: `Analyze what could be IMPROVED in this trade:
${JSON.stringify(context.selectedTrade, null, 2)}

Focus on:
1. LTP compliance gaps
2. Decision-making issues
3. Execution problems
4. Specific lessons to address each issue

Be constructive, not critical.`,
    };
  },

  how_to_improve: async (context) => {
    if (!context.selectedTrade) {
      return { prompt: 'Please select a trade to analyze.' };
    }
    return {
      prompt: `Create an improvement plan for trades like this:
${JSON.stringify(context.selectedTrade, null, 2)}

Provide:
1. Top 3 actionable improvements
2. Specific practice scenarios to try
3. Lessons to review
4. Checklist items to add before taking similar trades`,
    };
  },

  // Learning actions
  resume_learning: async (context) => ({
    prompt: `Help this trader continue their learning journey:
- Current module: ${context.learningState?.currentModule || 'ltp-framework'}
- Completed lessons: ${context.learningState?.completedLessons?.length || 0}
- Last active: ${context.lastInteraction || 'Unknown'}

Suggest:
1. The next lesson to watch
2. A quick recap of the previous lesson
3. What to focus on in the upcoming content

Include [[LESSON:...]] and [[QUIZ:...]] links.`,
  }),

  test_knowledge: async (context) => ({
    prompt: `Suggest a quiz for this trader based on:
- Current module: ${context.learningState?.currentModule || 'ltp-framework'}
- Weak areas: ${context.learningState?.weakAreas?.join(', ') || 'not identified'}

Recommend:
1. The most relevant quiz
2. What it tests
3. How it will help them improve

Include [[QUIZ:...]] marker.`,
  }),

  explain_concept: async (context) => {
    if (!context.selectedLesson) {
      return { prompt: 'Please select a lesson to explain.' };
    }
    return {
      prompt: `Explain the key concepts from "${context.selectedLesson.title}" in simple terms:

1. Main concept summary
2. Why it matters for trading
3. Real-world example
4. Common mistakes to avoid
5. Related lessons for deeper learning

Include [[CHART:...]] if helpful for visualization.`,
    };
  },

  show_example: async (context) => {
    if (!context.selectedLesson) {
      return { prompt: 'Please select a lesson to show examples.' };
    }
    return {
      prompt: `Show a real trading example for the concepts in "${context.selectedLesson.title}":

1. Describe a specific setup (use [[SETUP:...]])
2. Explain how it demonstrates the concept
3. Walk through the decision-making process
4. Show the LTP analysis

Use [[CHART:...]] for visualization.`,
    };
  },

  practice_this: async (context) => {
    if (!context.selectedLesson) {
      return { prompt: 'Please select a lesson to practice.' };
    }
    return {
      prompt: `Suggest practice scenarios related to "${context.selectedLesson.title}":

1. Describe 2-3 scenario types to practice
2. What to focus on in each
3. How to know if you're improving
4. Link to Practice Mode

Encourage deliberate practice.`,
    };
  },

  // Companion actions
  analyze_setup: async (context) => {
    if (!context.selectedSetup) {
      return { prompt: 'Please select a setup to analyze.' };
    }
    const s = context.selectedSetup;
    return {
      prompt: `Analyze this detected setup:

Symbol: ${s.symbol}
Direction: ${s.direction}
Confluence Score: ${s.confluence_score}%
Status: ${s.status}

Provide:
1. Full LTP breakdown
2. Entry, stop, and target recommendations
3. Risk/reward assessment
4. What to watch for confirmation
5. When to abandon the setup`,
    };
  },

  grade_level: async (context) => {
    if (!context.selectedSymbol) {
      return { prompt: 'Please select a symbol to analyze levels.' };
    }
    return {
      prompt: `Grade the key levels on ${context.selectedSymbol}:

For each significant level, rate:
1. Strength (1-10)
2. Number of touches
3. Volume at level
4. Recency

Identify the most tradeable levels with [[CHART:${context.selectedSymbol}|15|MA,VWAP]].`,
    };
  },

  whats_the_trend: async (context) => {
    if (!context.selectedSymbol) {
      return { prompt: 'Please select a symbol to analyze.' };
    }
    return {
      prompt: `Analyze the current trend on ${context.selectedSymbol}:

1. Higher timeframe trend (Daily)
2. Intraday trend (15m)
3. Key moving averages position
4. VWAP relationship
5. Overall trend score

Show [[CHART:${context.selectedSymbol}|15|MA,VWAP]] with analysis.`,
    };
  },

  when_to_enter: async (context) => {
    if (!context.selectedSetup) {
      return { prompt: 'Please select a setup to get entry guidance.' };
    }
    const s = context.selectedSetup;
    return {
      prompt: `Provide entry timing guidance for this ${s.direction} setup on ${s.symbol}:

1. What confirmation to wait for
2. Ideal entry zone
3. Stop placement
4. Position sizing suggestion
5. Warning signs to abort

Be specific about patience candle requirements.`,
    };
  },

  // Practice actions
  get_hint: async (context) => {
    if (!context.selectedScenario) {
      return { prompt: 'No scenario selected for hint.' };
    }
    return {
      prompt: `Give a SUBTLE hint for this practice scenario without revealing the answer:

Title: ${context.selectedScenario.title}
Symbol: ${context.selectedScenario.symbol}
Description: ${context.selectedScenario.description}

Hint should:
1. Point to what to examine
2. Ask a guiding question
3. NOT reveal the correct action`,
    };
  },

  explain_setup: async (context) => {
    if (!context.selectedScenario) {
      return { prompt: 'No scenario selected.' };
    }
    return {
      prompt: `Explain the setup in this practice scenario (without revealing the answer):

Title: ${context.selectedScenario.title}
Symbol: ${context.selectedScenario.symbol}

Describe:
1. The market context
2. Key levels present
3. Current price action
4. What an LTP trader should be examining`,
    };
  },

  try_similar: async (context) => ({
    prompt: `Suggest a similar practice scenario based on:
- Last scenario: ${context.selectedScenario?.title || 'Unknown'}
- Accuracy: ${context.stats?.practiceAccuracy?.toFixed(1) || 0}%
- Weak areas: ${context.learningState?.weakAreas?.join(', ') || 'not identified'}

Recommend a scenario that builds on their progress.`,
  }),

  review_mistakes: async (context) => ({
    prompt: `Analyze recent practice mistakes for this trader:
- Practice accuracy: ${context.stats?.practiceAccuracy?.toFixed(1) || 0}%
- Total attempts: ${context.stats?.practiceAttempts || 0}

Identify:
1. Common mistake patterns
2. Specific concepts to review
3. Targeted practice recommendations
4. Lesson links for improvement`,
  }),

  // Admin actions
  generate_caption: async () => ({
    prompt: `Generate 3 social media caption options for trading education content:

1. Educational tip about patience candles
2. Motivational trading mindset post
3. LTP framework reminder

Each should be:
- Engaging and shareable
- Include relevant hashtags
- Appropriate for Twitter/Instagram`,
  }),

  find_trending: async () => ({
    prompt: `Identify current trending topics in trading education that KCU could create content about:

1. Hot topics in retail trading
2. Recent market events worth discussing
3. Common trader struggles right now
4. Viral trading content themes

Suggest content angles for each.`,
  }),

  analyze_competitors: async () => ({
    prompt: `Suggest competitor analysis approach for trading education space:

1. Types of content performing well
2. Engagement strategies to consider
3. Content gaps to fill
4. Unique angles KCU could take`,
  }),

  best_post_time: async () => ({
    prompt: `Suggest optimal posting times for trading education content:

1. Pre-market content timing
2. Market hours engagement windows
3. After-hours educational content
4. Weekend strategy content

Base on typical trader behavior patterns.`,
  }),

  // New overview actions
  compare_week_over_week: async (context) => {
    const trades = context.recentTrades || [];
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    return {
      prompt: `Compare this trader's recent performance week over week:

Current Week Stats:
- Trades: ${trades.length}
- Total P&L: $${totalPnL.toFixed(2)}
- Practice accuracy: ${context.stats?.practiceAccuracy?.toFixed(1) || 0}%
- Current streak: ${context.stats?.currentStreak || 0} days

Provide:
1. Week-over-week comparison (assume previous week was similar baseline)
2. Trend analysis (improving/declining/stable)
3. Key metrics to focus on
4. Actionable goals for next week`,
    };
  },

  check_status: async (context) => ({
    prompt: `Provide a quick status check for ${context.user.username}:

Current Stats:
- Experience: ${context.user.experienceLevel}
- Streak: ${context.stats?.currentStreak || 0} days
- Practice accuracy: ${context.stats?.practiceAccuracy?.toFixed(1) || 0}%
- Lessons completed: ${context.stats?.lessonsCompleted || 0}

Give a brief:
1. Current standing summary
2. Recent progress highlights
3. Quick wins they can achieve today
4. Encouragement message`,
  }),

  market_opportunity: async (context) => ({
    prompt: `Identify current market opportunities for an ${context.user.experienceLevel} trader:

Consider:
1. Current market conditions (volatility, trend)
2. Setups that match their skill level
3. Symbols showing LTP-compatible patterns
4. Risk considerations for their experience level

Provide 2-3 specific opportunities with [[SETUP:...]] visualizations.`,
  }),

  // New journal actions
  export_trades: async (context) => {
    const trades = context.recentTrades || [];
    return {
      prompt: `Help this trader understand their trade data for export:

Recent trades count: ${trades.length}
${trades.map((t) => `- ${t.symbol} ${t.direction}: $${t.pnl?.toFixed(2) || 'N/A'}`).join('\n')}

Provide:
1. Summary statistics they can export
2. Key fields to include in their export
3. Tips for organizing trade data in a spreadsheet
4. How to track LTP scores over time

Note: Actual export happens in the UI - this provides guidance.`,
    };
  },

  backtest_strategy: async (context) => {
    const trades = context.recentTrades || [];
    return {
      prompt: `Analyze this trader's strategy based on their recent trades:

${trades
  .map(
    (t) =>
      `- ${t.symbol} ${t.direction}: Entry $${t.entry_price}, P&L ${t.pnl !== undefined ? `$${t.pnl.toFixed(2)}` : 'N/A'}`
  )
  .join('\n')}

Provide:
1. Win rate analysis
2. Average R:R ratio
3. Best performing setups
4. Suggested modifications to improve results
5. Backtesting approach for their strategy`,
    };
  },

  trade_statistics: async (context) => {
    const trades = context.recentTrades || [];
    const winners = trades.filter((t) => (t.pnl || 0) > 0);
    const losers = trades.filter((t) => (t.pnl || 0) < 0);

    return {
      prompt: `Generate detailed trading statistics:

Overview:
- Total trades: ${trades.length}
- Winners: ${winners.length}
- Losers: ${losers.length}
- Win rate: ${trades.length > 0 ? ((winners.length / trades.length) * 100).toFixed(1) : 0}%
- Total P&L: $${trades.reduce((sum, t) => sum + (t.pnl || 0), 0).toFixed(2)}

Provide:
1. Key performance metrics
2. Comparison to typical trader benchmarks
3. Areas of strength
4. Areas needing improvement
5. Specific recommendations`,
    };
  },

  find_losses: async (context) => {
    const trades = context.recentTrades || [];
    const losers = trades.filter((t) => (t.pnl || 0) < 0);

    return {
      prompt: `Analyze losing trades for patterns:

Recent losses:
${losers.map((t) => `- ${t.symbol} ${t.direction}: $${t.pnl?.toFixed(2)}`).join('\n') || 'No recent losses'}

Identify:
1. Common patterns in losses
2. LTP compliance issues
3. Timing problems
4. Position sizing concerns
5. Specific lessons to address each issue

Be constructive and actionable.`,
    };
  },

  // New learning actions
  get_learning_plan: async (context) => ({
    prompt: `Create a personalized learning plan for ${context.user.username}:

Current state:
- Experience: ${context.user.experienceLevel}
- Current module: ${context.learningState?.currentModule || 'ltp-framework'}
- Completed lessons: ${context.learningState?.completedLessons?.length || 0}
- Weak areas: ${context.learningState?.weakAreas?.join(', ') || 'not identified'}
- Practice accuracy: ${context.stats?.practiceAccuracy?.toFixed(1) || 0}%

Create a 2-week learning plan with:
1. Daily lesson recommendations
2. Practice goals
3. Knowledge checkpoints
4. Progress milestones

Include [[LESSON:...]] and [[QUIZ:...]] markers.`,
  }),

  prerequisite_check: async (context) => {
    const currentModule = context.learningState?.currentModule || 'ltp-framework';
    return {
      prompt: `Check prerequisites for ${currentModule}:

Completed lessons: ${context.learningState?.completedLessons?.length || 0}
Practice accuracy: ${context.stats?.practiceAccuracy?.toFixed(1) || 0}%

Assess:
1. Required foundational knowledge
2. Any gaps in prerequisites
3. Recommended review material
4. Readiness score for current module

Include [[LESSON:...]] links for any gaps found.`,
    };
  },

  // New companion actions
  watch_symbol: async (context) => {
    const symbol = context.selectedSymbol || 'SPY';
    return {
      prompt: `Provide a watchlist brief for ${symbol}:

Include:
1. Key levels to watch
2. Current trend assessment
3. Potential setups forming
4. Important news/events to be aware of
5. When to look for entries

Use [[CHART:${symbol}|15|MA,VWAP]] for visualization.`,
    };
  },

  set_alert: async (context) => {
    const symbol = context.selectedSymbol;
    if (!symbol) {
      return { prompt: 'Please select a symbol to set alerts for.' };
    }
    return {
      prompt: `Recommend price alerts for ${symbol}:

Suggest alert levels based on:
1. Key support/resistance levels
2. Moving average crosses
3. VWAP zones
4. Previous day high/low

For each alert, explain:
- Why this level matters
- What action to consider if triggered
- How to use with LTP framework`,
    };
  },

  compare_setups: async (context) => ({
    prompt: `Compare current setups in the watchlist:

Consider these factors:
1. LTP scores for each
2. Risk/reward ratios
3. Confluence factors
4. Time horizon
5. Experience level required

Rank from best to worst opportunity with explanations.
Include [[SETUP:...]] visualizations for top picks.`,
  }),

  // New admin actions
  user_engagement_report: async () => ({
    prompt: `Generate a user engagement analysis report:

Analyze typical patterns for:
1. Active user metrics
2. Content engagement rates
3. Learning completion rates
4. Practice mode participation
5. Community activity trends

Provide:
- Key insights
- Areas for improvement
- Content recommendations
- Engagement strategies`,
  }),

  content_gap_analysis: async () => ({
    prompt: `Perform a content gap analysis for the trading education platform:

Evaluate:
1. Topics not yet covered
2. Skill levels underserved
3. Content formats missing
4. User-requested topics
5. Industry trends not addressed

Prioritize gaps by:
- User impact
- Implementation effort
- Business value

Suggest specific content pieces to create.`,
  }),
};

export async function POST(request: Request) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ActionRequest = await request.json();
    const { actionId, context: partialContext } = body;

    if (!actionId) {
      return NextResponse.json({ error: 'Action ID is required' }, { status: 400 });
    }

    // Get action definition
    const action = getQuickAction(actionId);
    if (!action) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    // Check admin-only actions
    if (action.adminOnly && !partialContext.user?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    logger.info('Quick action request', {
      actionId,
      page: partialContext.currentPage,
      userId: sessionUser.discordId,
    });

    // Get action handler
    const handler = actionHandlers[actionId];
    if (!handler) {
      return NextResponse.json({ error: 'Action not implemented' }, { status: 501 });
    }

    // Build context and get prompt
    const context = partialContext as AIContext;
    const { prompt, systemAddition } = await handler(context);

    // Generate AI response
    let systemPrompt = generateSystemPrompt(context);
    if (systemAddition) {
      systemPrompt += `\n\n${systemAddition}`;
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawMessage =
      response.content[0].type === 'text' ? response.content[0].text : '';

    const { cleanText, richContent } = parseAIResponse(rawMessage);

    const result: QuickActionResultLocal = {
      actionId,
      success: true,
      result: cleanText,
      richContent,
    };

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Quick action error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        actionId: 'unknown',
        success: false,
        error: 'Failed to execute action',
      },
      { status: 500 }
    );
  }
}
