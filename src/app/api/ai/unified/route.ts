/**
 * Unified AI API Endpoint
 *
 * Consolidates all AI chat functionality into a single context-aware endpoint.
 * Replaces the fragmented /api/chat, /api/coach/chat, and /api/companion/messages.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';
import { parseAIResponse } from '@/lib/rich-content-parser';
import { getEnhancedRAGContext } from '@/lib/rag';
import { findRelevantContent } from '@/lib/ai/knowledge-retrieval';
import { generateSystemPrompt, sanitizeInput, validateMessage } from '@/lib/ai-context';
import { getMarketDataTools, executeMarketDataTool } from '@/lib/market-data-tools';
import logger from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import type { UnifiedAIRequest, UnifiedAIResponse, AIContext, AIErrorCode } from '@/types/ai';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Build full context with database data
 */
async function buildFullContext(
  partialContext: Partial<AIContext>,
  userId: string
): Promise<AIContext> {
  const context = partialContext as AIContext;

  // Fetch user profile if not provided
  if (!context.user?.id && userId) {
    const { data: user } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('discord_id', userId)
      .single();

    if (user) {
      context.user = {
        id: user.id,
        discordId: user.discord_id,
        username: user.discord_username || 'Trader',
        avatarUrl: user.avatar_url,
        experienceLevel: user.experience_level || 'beginner',
        subscriptionTier: user.subscription_tier || 'free',
        isAdmin: user.is_admin || false,
        createdAt: new Date(user.created_at),
      };

      // Fetch recent trades
      const { data: trades } = await supabaseAdmin
        .from('trade_journal')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_time', { ascending: false })
        .limit(5);

      if (trades) {
        context.recentTrades = trades;
      }

      // Fetch stats
      const { data: stats } = await supabaseAdmin
        .from('user_profiles')
        .select('streak_days, total_quizzes')
        .eq('id', user.id)
        .single();

      if (stats) {
        context.stats = {
          ...context.stats,
          currentStreak: stats.streak_days || 0,
          totalQuizzes: stats.total_quizzes || 0,
        };
      }

      // Fetch practice stats
      const { count: totalAttempts } = await supabaseAdmin
        .from('practice_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: correctAttempts } = await supabaseAdmin
        .from('practice_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_correct', true);

      context.stats = {
        ...context.stats,
        practiceAttempts: totalAttempts || 0,
        practiceAccuracy:
          totalAttempts && totalAttempts > 0
            ? ((correctAttempts || 0) / totalAttempts) * 100
            : 0,
      };
    }
  }

  return context;
}

/**
 * Handle chat mode - standard conversation with market data tool use
 */
async function handleChatMode(
  message: string,
  context: AIContext,
  conversationHistory: Array<{ role: string; content: string }>,
  options: UnifiedAIRequest['options']
): Promise<UnifiedAIResponse> {
  // Get course content context for the user's message
  let courseContentContext = '';
  let ragContext = '';
  let ragSources: Array<{
    id: string;
    title: string;
    type: 'lesson' | 'video' | 'transcript' | 'documentation';
    relevance: number;
  }> = [];

  // Search course_lessons for relevant content (transcripts, descriptions)
  try {
    const courseContent = await findRelevantContent(message, { limit: 3 });
    if (courseContent.hasContent) {
      courseContentContext = courseContent.contextText;
      // Add course lessons to sources
      courseContent.lessons.forEach((lesson) => {
        ragSources.push({
          id: lesson.id,
          title: lesson.title,
          type: 'lesson',
          relevance: lesson.relevance,
        });
      });
      logger.info('Course content retrieved', {
        query: message.slice(0, 50),
        lessonCount: courseContent.lessons.length,
        processingTimeMs: courseContent.processingTimeMs,
      });
    }
  } catch (contentError) {
    logger.warn('Course content retrieval failed', {
      error: contentError instanceof Error ? contentError.message : String(contentError),
    });
  }

  // Also get RAG context from knowledge_chunks (for YouTube, docs, etc.)
  try {
    const rag = await getEnhancedRAGContext(message);
    if (rag.hasContext) {
      ragContext = rag.contextText;
      rag.sources.forEach((s) => {
        // Avoid duplicates from course content
        if (!ragSources.find(r => r.title === s.title)) {
          ragSources.push({
            id: s.title,
            title: s.title,
            type: (s.type || 'documentation') as 'lesson' | 'video' | 'transcript' | 'documentation',
            relevance: s.relevance,
          });
        }
      });
    }
  } catch (ragError) {
    logger.warn('RAG context retrieval failed', {
      error: ragError instanceof Error ? ragError.message : String(ragError),
    });
  }

  // Build system prompt with context
  let systemPrompt = generateSystemPrompt(context);

  // Add course content context first (primary source)
  if (courseContentContext) {
    systemPrompt += `\n\n${courseContentContext}`;
  }

  // Add supplementary RAG context (YouTube, documentation)
  if (ragContext) {
    systemPrompt += `\n\n=== SUPPLEMENTARY KNOWLEDGE ===\n${ragContext}`;
  }

  // Add today's date for relative date parsing
  const today = new Date().toISOString().split('T')[0];
  systemPrompt += `\n\n=== MARKET DATA ACCESS ===
Today's date is ${today}. You have access to real-time market data tools.
When users ask about stock prices, market conditions, or trading setups:
1. Use the appropriate market data tool to get current/historical data
2. Parse relative dates (e.g., "last Friday" = calculate from today)
3. Present the data clearly and apply LTP Framework analysis when relevant
4. For questions about specific dates, convert to YYYY-MM-DD format

=== INTERACTIVE CHART GENERATION ===
When providing historical market analysis (e.g., "What did TSLA open at on Friday?"), include an interactive LTP chart that users can click to view detailed analysis.

Use this marker format at the END of your response:
[[LTP_ANALYSIS:SYMBOL|DATE|TIMEFRAME|{"title":"...","summary":"...","ltpAnalysis":{"grade":"...","levelScore":N,"trendScore":N,"patienceScore":N,"recommendation":"..."},"keyLevels":[{"type":"...","price":N,"label":"...","strength":N}]}]]

Example:
[[LTP_ANALYSIS:TSLA|2026-01-17|5m|{"title":"TSLA Morning Analysis","summary":"Strong bullish momentum with trend alignment. Price bounced off VWAP support.","ltpAnalysis":{"grade":"B+","levelScore":85,"trendScore":78,"patienceScore":72,"recommendation":"Valid long setup at VWAP with trend confirmation"},"keyLevels":[{"type":"vwap","price":425.50,"label":"VWAP","strength":85},{"type":"pdh","price":428.00,"label":"PDH","strength":70}]}]]

Guidelines:
- Use this for historical price questions, not real-time quotes
- TIMEFRAME should be one of: 1m, 5m, 15m, 1h, day
- DATE must be YYYY-MM-DD format
- The JSON must be valid (no trailing commas, proper escaping)
- Include 2-4 key levels that were relevant for that day
- Estimate LTP scores based on the market data you retrieved`;

  // Build messages array for tool use
  const messages: MessageParam[] = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    {
      role: 'user' as const,
      content: message,
    },
  ];

  // Get market data tools
  const tools = getMarketDataTools();

  // Call Claude API with tools
  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: options?.maxTokens || 1024,
    system: systemPrompt,
    messages,
    tools,
  });

  let totalInputTokens = response.usage.input_tokens;
  let totalOutputTokens = response.usage.output_tokens;

  // Handle tool use loop
  while (response.stop_reason === 'tool_use') {
    // Find all tool use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) break;

    // Execute all tools in parallel
    const toolResults: ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        logger.info('Executing market data tool', {
          tool: toolUse.name,
          input: toolUse.input,
        });

        const result = await executeMarketDataTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );

        return {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: result,
        };
      })
    );

    // Add assistant response and tool results to messages
    messages.push({
      role: 'assistant',
      content: response.content as ContentBlock[],
    });
    messages.push({
      role: 'user',
      content: toolResults,
    });

    // Continue the conversation
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: options?.maxTokens || 1024,
      system: systemPrompt,
      messages,
      tools,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
  }

  // Extract final text response
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );
  const rawMessage = textBlock?.text || '';

  // Parse rich content markers from the response
  const { cleanText, richContent } = parseAIResponse(rawMessage);

  return {
    id: response.id,
    message: cleanText,
    richContent: options?.includeRichContent !== false ? richContent : undefined,
    sources: ragSources.length > 0 ? ragSources : undefined,
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
  };
}

/**
 * Handle search mode - semantic search
 */
async function handleSearchMode(
  query: string,
  context: AIContext
): Promise<UnifiedAIResponse> {
  // Use AI to interpret the search intent
  const interpretResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    system: `You are a search intent interpreter. Given a user's search query, determine:
1. What they're looking for (trades, lessons, setups, etc.)
2. Any filters to apply (date range, symbol, direction, etc.)
3. A simplified search query

Respond in JSON format:
{
  "intent": "trades" | "lessons" | "setups" | "general",
  "filters": { ... },
  "simplifiedQuery": "..."
}`,
    messages: [{ role: 'user', content: query }],
  });

  const interpretText =
    interpretResponse.content[0].type === 'text'
      ? interpretResponse.content[0].text
      : '{}';

  let interpretation;
  try {
    interpretation = JSON.parse(interpretText);
  } catch {
    interpretation = { intent: 'general', simplifiedQuery: query };
  }

  // Get RAG results
  const rag = await getEnhancedRAGContext(query);

  return {
    id: `search-${Date.now()}`,
    message: `Found ${rag.sources.length} relevant results for "${query}"`,
    sources: rag.sources.map((s) => ({
      id: s.title,
      title: s.title,
      type: (s.type || 'documentation') as 'lesson' | 'video' | 'transcript' | 'documentation',
      relevance: s.relevance,
    })),
    suggestions: [
      `Try: ${interpretation.simplifiedQuery}`,
      'Ask the AI Coach for more help',
    ],
  };
}

/**
 * Handle analyze mode - deep analysis of selected item
 */
async function handleAnalyzeMode(
  message: string,
  context: AIContext
): Promise<UnifiedAIResponse> {
  // Build analysis-specific prompt
  let analysisPrompt = '';

  if (context.selectedTrade) {
    const trade = context.selectedTrade;
    analysisPrompt = `Analyze this trade in detail using the LTP framework:

Symbol: ${trade.symbol}
Direction: ${trade.direction}
Entry: $${trade.entry_price}
Exit: ${trade.exit_price ? `$${trade.exit_price}` : 'Still open'}
P&L: ${trade.pnl !== undefined ? `$${trade.pnl.toFixed(2)}` : 'N/A'}

User's question: ${message}

Provide:
1. LTP Score breakdown (Level, Trend, Patience)
2. What was done well
3. Areas for improvement
4. Specific lesson recommendations`;
  } else if (context.selectedScenario) {
    analysisPrompt = `Analyze this practice scenario:

Title: ${context.selectedScenario.title}
Symbol: ${context.selectedScenario.symbol}
Difficulty: ${context.selectedScenario.difficulty}

User's question: ${message}

Provide guidance without giving away the answer directly.`;
  } else {
    analysisPrompt = message;
  }

  return handleChatMode(analysisPrompt, context, [], { includeRichContent: true });
}

/**
 * Helper to create standardized error responses
 */
function errorResponse(code: AIErrorCode, message: string, status: number) {
  return NextResponse.json(
    {
      error: message,
      code,
      retryable: ['RATE_LIMITED', 'NETWORK_ERROR', 'TOOL_ERROR', 'UNKNOWN_ERROR'].includes(code),
    },
    { status }
  );
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser) {
      return errorResponse('UNAUTHORIZED', 'Please log in to continue.', 401);
    }

    const body: UnifiedAIRequest = await request.json();
    const { message, mode = 'chat', context: partialContext, conversationHistory = [], options } = body;

    // Validate and sanitize message
    const validation = validateMessage(message);
    if (!validation.valid) {
      return errorResponse('VALIDATION_ERROR', validation.error || 'Invalid message', 400);
    }

    const sanitizedMessage = sanitizeInput(message);

    // Build full context with database data
    // Note: We verify admin status from the database, not from client-provided context
    const context = await buildFullContext(partialContext, sessionUser.discordId || '');

    // Double-check: Admin status comes from database, override any client claim
    if (partialContext.user?.isAdmin !== context.user?.isAdmin) {
      logger.warn('Admin status mismatch - client claimed different status', {
        clientClaimed: partialContext.user?.isAdmin,
        databaseValue: context.user?.isAdmin,
        userId: sessionUser.discordId,
      });
    }

    logger.info('Unified AI request', {
      mode,
      page: context.currentPage,
      userId: sessionUser.discordId,
      messageLength: sanitizedMessage.length,
    });

    let response: UnifiedAIResponse;

    switch (mode) {
      case 'search':
        response = await handleSearchMode(sanitizedMessage, context);
        break;
      case 'analyze':
        response = await handleAnalyzeMode(sanitizedMessage, context);
        break;
      case 'chat':
      default:
        response = await handleChatMode(sanitizedMessage, context, conversationHistory, options);
        break;
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Unified AI error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Provide specific error messages based on error type
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('api key') || message.includes('authentication')) {
        return errorResponse('API_KEY_ERROR', 'AI service configuration error. Please contact support.', 500);
      }

      if (message.includes('rate limit') || message.includes('429') || message.includes('too many')) {
        return errorResponse('RATE_LIMITED', 'Too many requests. Please wait a moment and try again.', 429);
      }

      if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
        return errorResponse('NETWORK_ERROR', 'Network error. Please check your connection and try again.', 503);
      }

      if (message.includes('tool') || message.includes('function')) {
        return errorResponse('TOOL_ERROR', 'Error executing action. Please try again.', 500);
      }
    }

    return errorResponse('UNKNOWN_ERROR', 'An unexpected error occurred. Please try again.', 500);
  }
}
