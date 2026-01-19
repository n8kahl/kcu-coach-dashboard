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
import { marketDataService } from '@/lib/market-data';
import logger from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';
import type { AIContext, AIMode, UnifiedAIRequest, UnifiedAIResponse } from '@/types/ai';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// System Prompts by Mode
// ============================================

const BASE_SYSTEM_PROMPT = `You are the KCU Coach, an AI trading mentor for Kay Capitals University. You teach the LTP Framework (Levels, Trends, Patience Candles) for day trading.

COMMUNICATION STYLE:
- Be conversational and friendly, like a knowledgeable trading buddy
- Keep responses SHORT and actionable (2-4 sentences for simple questions)
- Avoid bullet points and numbered lists unless specifically asked
- Never use markdown formatting like ** or ## - just write naturally
- Don't ask multiple clarifying questions - make reasonable assumptions and help
- Be direct and confident in your analysis

Your expertise:
- LEVELS: Support/resistance zones where price reacts
- TRENDS: Direction of price (higher highs/lows = up, lower highs/lows = down)
- PATIENCE CANDLES: Confirmation signals before entry

Key trading rules:
- Trade at key levels, with the trend
- Wait for patience candle confirmation
- Risk 1-2% per trade with clear stops and targets

When you don't have specific data (like watchlist symbols), work with what's available - analyze SPY/QQQ or ask for ONE specific symbol rather than a list of questions.`;

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
  coach: `You're in learning mode. Help users understand trading concepts and the LTP framework. Keep explanations simple and practical. If they share a trade, analyze it constructively.`,

  companion: `You're in live trading mode. Be VERY concise - traders need quick answers. If asked about setups, analyze what's forming on SPY/QQQ unless they specify a symbol. Grade setups as Strong/Moderate/Weak based on LTP alignment.`,

  practice: `You're helping with practice scenarios. Give hints, not answers. When they get it right, tell them why. When wrong, guide them to the right thinking.`,

  social: `You're generating social content for KCU. Create engaging, educational posts about trading and the LTP framework.`,

  search: `You're helping find content. Interpret what they're looking for and point them to relevant lessons or resources.`,
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

    // Get live market data for context (if service is configured)
    let liveMarketContext = '';
    if (marketDataService.isConfigured()) {
      try {
        // Get comprehensive LTP analysis for SPY and QQQ plus economic events
        const [spyLTP, qqqLTP, marketContext] = await Promise.all([
          marketDataService.getLTPAnalysis('SPY'),
          marketDataService.getLTPAnalysis('QQQ'),
          marketDataService.getMarketContext(),
        ]);

        const formatMTFTrends = (mtf: { timeframes: Array<{ timeframe: string; trend: string; ema9: number; ema21: number }> } | null) => {
          if (!mtf) return 'N/A';
          return mtf.timeframes.map(t => `${t.timeframe}: ${t.trend} (EMA9: $${t.ema9.toFixed(2)}, EMA21: $${t.ema21.toFixed(2)})`).join('\n    ');
        };

        const formatLTPAnalysis = (ltp: typeof spyLTP, symbol: string) => {
          if (!ltp) return `${symbol}: Data unavailable`;

          return `${symbol}: $${ltp.trend.mtf.currentPrice.toFixed(2)}
  LTP Grade: ${ltp.grade} (${ltp.setupQuality}) - Confluence: ${ltp.confluenceScore}%

  KEY LEVELS (Score: ${ltp.levels.levelScore}%):
    Position: ${ltp.levels.pricePosition.replace(/_/g, ' ')} | Proximity: ${ltp.levels.levelProximity.replace(/_/g, ' ')}
    VWAP: ${ltp.levels.vwap ? '$' + ltp.levels.vwap.toFixed(2) : 'N/A'}
    PDH: ${ltp.levels.pdh ? '$' + ltp.levels.pdh.toFixed(2) : 'N/A'} | PDL: ${ltp.levels.pdl ? '$' + ltp.levels.pdl.toFixed(2) : 'N/A'}
    ORB High: ${ltp.levels.orbHigh ? '$' + ltp.levels.orbHigh.toFixed(2) : 'N/A'} | ORB Low: ${ltp.levels.orbLow ? '$' + ltp.levels.orbLow.toFixed(2) : 'N/A'}
    EMA9: ${ltp.levels.ema9 ? '$' + ltp.levels.ema9.toFixed(2) : 'N/A'} | EMA21: ${ltp.levels.ema21 ? '$' + ltp.levels.ema21.toFixed(2) : 'N/A'}
    SMA200: ${ltp.levels.sma200 ? '$' + ltp.levels.sma200.toFixed(2) + ' (Price ' + (ltp.levels.priceVsSma200 || 'N/A') + ')' : 'N/A'}

  TREND (Score: ${ltp.trend.trendScore}%):
    Daily: ${ltp.trend.dailyTrend} | Intraday Bias: ${ltp.trend.intradayTrend}
    Alignment: ${ltp.trend.trendAlignment}${ltp.trend.mtf.conflictingTimeframes.length > 0 ? ` (Conflicts: ${ltp.trend.mtf.conflictingTimeframes.join(', ')})` : ''}
    MTF Analysis:
    ${formatMTFTrends(ltp.trend.mtf)}

  PATIENCE (Score: ${ltp.patience.patienceScore}%):
    5m: ${ltp.patience.candle5m ? (ltp.patience.candle5m.confirmed ? 'CONFIRMED ' : ltp.patience.candle5m.forming ? 'Forming ' : 'None ') + ltp.patience.candle5m.direction : 'None'}
    15m: ${ltp.patience.candle15m ? (ltp.patience.candle15m.confirmed ? 'CONFIRMED ' : ltp.patience.candle15m.forming ? 'Forming ' : 'None ') + ltp.patience.candle15m.direction : 'None'}
    1h: ${ltp.patience.candle1h ? (ltp.patience.candle1h.confirmed ? 'CONFIRMED ' : ltp.patience.candle1h.forming ? 'Forming ' : 'None ') + ltp.patience.candle1h.direction : 'None'}

  RECOMMENDATION: ${ltp.recommendation}`;
        };

        // Format economic events
        const formatEconomicEvents = () => {
          if (marketContext.upcomingEvents.length === 0) return 'No major economic events in next 7 days.';
          return marketContext.upcomingEvents.slice(0, 5).map(e =>
            `- ${e.date} ${e.time}: ${e.event} (${e.impact.toUpperCase()} impact)`
          ).join('\n');
        };

        liveMarketContext = `
=== LIVE LTP ANALYSIS (Real-Time from Massive.com) ===
Market Status: ${marketContext.marketStatus.market} ${marketContext.marketStatus.earlyHours ? '(Pre-market)' : marketContext.marketStatus.afterHours ? '(After hours)' : ''}
VIX: ${marketContext.vix.toFixed(2)} (${marketContext.volatilityLevel} volatility)
${marketContext.highImpactToday ? '⚠️ HIGH-IMPACT EVENT TODAY - Trade with caution!' : ''}

${formatLTPAnalysis(spyLTP, 'SPY')}

${formatLTPAnalysis(qqqLTP, 'QQQ')}

=== ECONOMIC CALENDAR ===
${formatEconomicEvents()}

Use this LTP analysis to answer questions about setups, levels, trends, and trade recommendations. Always reference specific data (price, EMAs, SMA200, VWAP, levels) when discussing market conditions. Warn users about trading during high-impact economic events.`;
      } catch (marketError) {
        logger.warn('Live market data fetch failed', {
          error: marketError instanceof Error ? marketError.message : String(marketError),
        });
      }
    }

    // Build system prompt
    const systemPrompt = [
      BASE_SYSTEM_PROMPT,
      RICH_CONTENT_INSTRUCTIONS,
      getCurriculumReference(),
      MODE_PROMPTS[mode],
      liveMarketContext,
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
