/**
 * Unified AI API
 *
 * POST /api/ai/unified - Single endpoint for all AI interactions
 *
 * Replaces:
 * - /api/chat (generic chat)
 * - /api/coach/chat (coach page)
 * - /api/companion/messages (companion questions)
 *
 * Provides mode-aware, context-aware AI responses.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';
import { getCurriculumReference } from '@/lib/curriculum-context';
import { parseAIResponse } from '@/lib/rich-content-parser';
import { getEnhancedRAGContext } from '@/lib/rag';
import logger from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';
import type { AIContext, AIMode, UnifiedAIRequest, UnifiedAIResponse } from '@/types/ai';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// System Prompts by Mode
// ============================================

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

Be friendly but professional. Use trading terminology appropriately. When a user shares a trade, analyze it for LTP compliance and provide constructive feedback.

If you don't know something specific about the user's broker or platform, admit it and suggest they check their platform's documentation.`;

const RICH_CONTENT_INSTRUCTIONS = `
=== RICH CONTENT INSTRUCTIONS ===

You can embed rich content in your responses using special markers. The frontend will render these as interactive components.

1. LESSON LINKS - Link to training content when explaining concepts:
   Format: [[LESSON:module-slug/lesson-slug|Title|Duration]]
   Example: [[LESSON:ltp-framework/patience-candles|Patience Candles Explained|9 min]]

2. CHARTS - Show a symbol's chart:
   Format: [[CHART:SYMBOL|interval|indicators]]
   Example: [[CHART:AAPL|15|MA,VWAP]]

3. SETUP VISUALIZATIONS - Show an LTP setup with scores:
   Format: [[SETUP:SYMBOL|direction|entry|stop|target|level%|trend%|patience%]]
   Example: [[SETUP:SPY|long|445.50|444.20|448.00|90|85|88]]

4. QUIZ PROMPTS - Suggest a quiz to test knowledge:
   Format: [[QUIZ:module-slug|Quiz Title]]
   Example: [[QUIZ:ltp-framework|Test Your LTP Knowledge]]

5. VIDEO TIMESTAMPS - Link to specific moments in YouTube tutorial videos:
   Format: [[VIDEO:videoId|startMs|endMs|Title]]
   Example: [[VIDEO:dQw4w9WgXcQ|120000|180000|Understanding Support Levels]]

6. THINKIFIC LINKS - Deep link to official Thinkific course content:
   Format: [[THINKIFIC:courseSlug|lessonSlug|timestampSeconds|Title]]
   Example: [[THINKIFIC:ltp-framework|patience-candles|120|Patience Candles Deep Dive]]

IMPORTANT RULES:
- Always include 1-2 lesson links when explaining concepts
- When asked to "show" something, use charts or setup visualizations
- Place rich content markers on their own lines after your explanation
- Don't overuse - 2-3 rich content items per response maximum
- Make sure the lesson slug matches exactly from the curriculum below
- Prefer THINKIFIC links for official course content that users should complete
- Use VIDEO links for supplementary YouTube content and alternative explanations`;

const MODE_PROMPTS: Record<AIMode, string> = {
  coach: `
You are in Coach mode. Focus on:
- Teaching trading concepts and the LTP framework
- Answering questions about trading psychology
- Providing personalized learning recommendations
- Analyzing trades when shared
- Encouraging consistent learning habits`,

  companion: `
You are in Market Companion mode. Focus on:
- Analyzing current market conditions and setups
- Grading LTP setups based on level, trend, and patience scores
- Providing real-time guidance on entry/exit decisions
- Explaining why certain levels matter
- Helping the user wait for proper confirmation
- Being concise - traders need quick, actionable insights`,

  practice: `
You are in Practice mode. Focus on:
- Providing hints without giving away answers
- Explaining LTP concepts as they apply to specific scenarios
- Helping users understand their mistakes
- Reinforcing proper decision-making process
- Celebrating correct decisions while explaining why they were right`,

  social: `
You are in Social Content mode (admin only). Focus on:
- Generating educational trading content for social media
- Creating engaging captions about the LTP framework
- Identifying trending trading topics
- Optimizing content for engagement
- Maintaining the KCU brand voice`,

  search: `
You are in Search mode. Focus on:
- Finding relevant lessons, trades, or resources
- Interpreting user intent from natural language queries
- Providing structured search results
- Suggesting related content`,
};

// ============================================
// Context Builder
// ============================================

function buildContextString(context: AIContext): string {
  const parts: string[] = [];

  // Page context
  parts.push(`Current Page: ${context.currentPage}`);

  // User context
  if (context.user) {
    parts.push(`
User Context:
- Username: ${context.user.username}
- Experience Level: ${context.user.experienceLevel || 'Not specified'}
- Current Module: ${context.user.currentModule || 'Not started'}
- Streak Days: ${context.user.streakDays || 0}
- Win Rate: ${context.user.winRate ? `${context.user.winRate}%` : 'Not tracked'}
- Is Admin: ${context.user.isAdmin ? 'Yes' : 'No'}`);
  }

  // Selected trade context
  if (context.selectedTrade) {
    const trade = context.selectedTrade;
    parts.push(`
Selected Trade:
- Symbol: ${trade.symbol}
- Direction: ${trade.direction}
- Entry: $${trade.entry_price?.toFixed(2)}
- Exit: ${trade.exit_price ? `$${trade.exit_price.toFixed(2)}` : 'Still open'}
- P&L: ${trade.pnl ? `$${trade.pnl.toFixed(2)}` : 'N/A'}
- LTP Score: ${trade.ltp_score ? `L:${trade.ltp_score.level} T:${trade.ltp_score.trend} P:${trade.ltp_score.patience}` : 'Not graded'}
- Notes: ${trade.notes || 'None'}`);
  }

  // Selected setup context
  if (context.selectedSetup) {
    const setup = context.selectedSetup;
    parts.push(`
Selected Setup:
- Symbol: ${setup.symbol}
- Direction: ${setup.direction}
- Confluence Score: ${setup.confluence_score}%
- Level Score: ${setup.level_score}%
- Trend Score: ${setup.trend_score}%
- Patience Score: ${setup.patience_score}%
- Status: ${setup.status}`);
  }

  // Selected symbol
  if (context.selectedSymbol && !context.selectedSetup) {
    parts.push(`Selected Symbol: ${context.selectedSymbol}`);
  }

  // Selected lesson
  if (context.selectedLesson) {
    parts.push(`
Currently Viewing Lesson:
- Title: ${context.selectedLesson.title}
- Module: ${context.selectedLesson.module_id}
- Key Concepts: ${context.selectedLesson.key_concepts?.join(', ') || 'N/A'}`);
  }

  // Market context
  if (context.marketContext) {
    const market = context.marketContext;
    parts.push(`
Market Context:
- SPY: ${market.spyPrice ? `$${market.spyPrice.toFixed(2)}` : 'N/A'} (${market.spyTrend || 'neutral'})
- Market Status: ${market.marketStatus || 'unknown'}`);
  }

  return parts.join('\n\n');
}

// ============================================
// API Handler
// ============================================

export async function POST(request: Request): Promise<Response> {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UnifiedAIRequest = await request.json();
    const { message, mode = 'coach', context, conversationHistory = [] } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get user profile from database for additional context
    let userProfile = null;
    let recentTrades: Array<{
      symbol: string;
      direction: string;
      pnl: number;
      ltp_grade?: { grade: string };
    }> = [];

    if (sessionUser.discordId) {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('discord_id', sessionUser.discordId)
        .single();
      userProfile = profile;

      if (userProfile) {
        const { data: trades } = await supabaseAdmin
          .from('trade_journal')
          .select('*')
          .eq('user_id', userProfile.id)
          .order('entry_time', { ascending: false })
          .limit(5);
        recentTrades = trades || [];
      }
    }

    // Build recent trades context
    const recentTradesContext =
      recentTrades.length > 0
        ? `\nRecent Trading Performance:\n${recentTrades
            .map(
              (t) =>
                `- ${t.symbol} ${t.direction}: ${t.pnl > 0 ? '+' : ''}$${t.pnl?.toFixed(2)} (LTP Grade: ${t.ltp_grade?.grade || 'N/A'})`
            )
            .join('\n')}`
        : '';

    // Build context from request
    const contextString = buildContextString(context);

    // Get RAG context
    let ragContext = '';
    let ragSources: Array<{ title: string; type: string; relevance: number }> = [];
    try {
      const rag = await getEnhancedRAGContext(message);
      if (rag.hasContext) {
        ragContext = rag.contextText;
        ragSources = rag.sources;
        logger.info('RAG context retrieved', {
          sourceCount: rag.sources.length,
          query: message.slice(0, 50),
        });
      }
    } catch (ragError) {
      logger.warn('RAG context retrieval failed', {
        error: ragError instanceof Error ? ragError.message : String(ragError),
      });
    }

    // Build system prompt
    const systemPrompt = [
      BASE_SYSTEM_PROMPT,
      RICH_CONTENT_INSTRUCTIONS,
      getCurriculumReference(),
      MODE_PROMPTS[mode],
      '\n=== CURRENT CONTEXT ===',
      contextString,
      recentTradesContext,
      ragContext ? `\n=== RELEVANT KNOWLEDGE BASE CONTENT ===\n${ragContext}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    // Build messages array
    const messages = [
      ...conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const rawMessage =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse rich content markers
    const { cleanText, richContent } = parseAIResponse(rawMessage);

    const result: UnifiedAIResponse = {
      message: cleanText,
      richContent,
      conversationId: response.id,
      sources: ragSources.length > 0 ? ragSources : undefined,
    };

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error in unified AI API', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Provide specific error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          {
            error: 'AI service configuration error. Please contact support.',
            code: 'API_KEY_ERROR',
          },
          { status: 500 }
        );
      }
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json(
          {
            error: 'AI service is temporarily busy. Please try again in a moment.',
            code: 'RATE_LIMIT',
          },
          { status: 429 }
        );
      }
      if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          {
            error: 'Unable to connect to AI service. Please check your internet connection.',
            code: 'NETWORK_ERROR',
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}
