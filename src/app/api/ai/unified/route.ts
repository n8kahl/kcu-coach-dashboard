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
import { generateSystemPrompt } from '@/lib/ai-context';
import { getMarketDataTools, executeMarketDataTool } from '@/lib/market-data-tools';
import logger from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import type { UnifiedAIRequest, UnifiedAIResponse, AIContext } from '@/types/ai';

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
  // Get RAG context for the user's message
  let ragContext = '';
  let ragSources: Array<{
    id: string;
    title: string;
    type: 'lesson' | 'video' | 'transcript' | 'documentation';
    relevance: number;
  }> = [];

  try {
    const rag = await getEnhancedRAGContext(message);
    if (rag.hasContext) {
      ragContext = rag.contextText;
      ragSources = rag.sources.map((s) => ({
        id: s.title,
        title: s.title,
        type: (s.type || 'documentation') as 'lesson' | 'video' | 'transcript' | 'documentation',
        relevance: s.relevance,
      }));
    }
  } catch (ragError) {
    logger.warn('RAG context retrieval failed', {
      error: ragError instanceof Error ? ragError.message : String(ragError),
    });
  }

  // Build system prompt with context
  let systemPrompt = generateSystemPrompt(context);
  if (ragContext) {
    systemPrompt += `\n\n=== RELEVANT KNOWLEDGE ===\n${ragContext}`;
  }

  // Add today's date for relative date parsing
  const today = new Date().toISOString().split('T')[0];
  systemPrompt += `\n\n=== MARKET DATA ACCESS ===
Today's date is ${today}. You have access to real-time market data tools.
When users ask about stock prices, market conditions, or trading setups:
1. Use the appropriate market data tool to get current/historical data
2. Parse relative dates (e.g., "last Friday" = calculate from today)
3. Present the data clearly and apply LTP Framework analysis when relevant
4. For questions about specific dates, convert to YYYY-MM-DD format`;

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

export async function POST(request: Request) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UnifiedAIRequest = await request.json();
    const { message, mode = 'chat', context: partialContext, conversationHistory = [], options } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build full context with database data
    const context = await buildFullContext(partialContext, sessionUser.discordId || '');

    logger.info('Unified AI request', {
      mode,
      page: context.currentPage,
      userId: sessionUser.discordId,
      messageLength: message.length,
    });

    let response: UnifiedAIResponse;

    switch (mode) {
      case 'search':
        response = await handleSearchMode(message, context);
        break;
      case 'analyze':
        response = await handleAnalyzeMode(message, context);
        break;
      case 'chat':
      default:
        response = await handleChatMode(message, context, conversationHistory, options);
        break;
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Unified AI error', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Provide specific error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service configuration error', code: 'API_KEY_ERROR' },
          { status: 500 }
        );
      }
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json(
          { error: 'AI service is temporarily busy. Please try again.', code: 'RATE_LIMIT' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'UNKNOWN_ERROR' },
      { status: 500 }
    );
  }
}
