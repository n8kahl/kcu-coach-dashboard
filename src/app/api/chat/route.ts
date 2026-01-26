/**
 * Legacy Chat API
 *
 * @deprecated This endpoint continues to work but new integrations should use
 * /api/ai/unified instead which provides mode-aware, context-aware AI responses.
 *
 * This endpoint is used by:
 * - src/components/chat/ai-coach.tsx (floating button - deprecated)
 *
 * For new features, use the unified API with mode='coach' for equivalent functionality.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';
import { getCurriculumReference } from '@/lib/curriculum-context';
import { parseAIResponse } from '@/lib/rich-content-parser';
import { getEnhancedRAGContext } from '@/lib/rag';
import { findRelevantContent } from '@/lib/ai/knowledge-retrieval';
import logger from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are the KCU Coach, an expert AI trading mentor for Kay Capitals University. You specialize in teaching the LTP Framework (Levels, Trends, Patience Candles) for day trading.

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

If you don't know something specific about the user's broker or platform, admit it and suggest they check their platform's documentation.

=== RICH CONTENT INSTRUCTIONS ===

You can embed rich content in your responses using special markers. The frontend will render these as interactive components.

1. LESSON LINKS - Link to training content when explaining concepts:
   Format: [[LESSON:module-slug/lesson-slug|Title|Duration]]
   Example: [[LESSON:ltp-framework/patience-candles|Patience Candles Explained|9 min]]

   Use these when:
   - Explaining a concept that has a dedicated lesson
   - The user asks "how do I..." questions
   - Recommending what to study next

2. CHARTS - Show a symbol's chart:
   Format: [[CHART:SYMBOL|interval|indicators]]
   Example: [[CHART:AAPL|15|MA,VWAP]]

   Use these when:
   - Discussing a specific symbol
   - The user asks to see a chart
   - Showing an example of price action

3. SETUP VISUALIZATIONS - Show an LTP setup with scores:
   Format: [[SETUP:SYMBOL|direction|entry|stop|target|level%|trend%|patience%]]
   Example: [[SETUP:SPY|long|445.50|444.20|448.00|90|85|88]]

   Use these when:
   - Showing what an A-grade setup looks like
   - Explaining trade planning
   - Demonstrating proper entry/stop/target placement

4. QUIZ PROMPTS - Suggest a quiz to test knowledge:
   Format: [[QUIZ:module-slug|Quiz Title]]
   Example: [[QUIZ:ltp-framework|Test Your LTP Knowledge]]

   Use these when:
   - User has learned a concept and should test themselves
   - Suggesting practice after explanation

5. VIDEO TIMESTAMPS - Link to specific moments in YouTube tutorial videos:
   Format: [[VIDEO:videoId|startMs|endMs|Title]]
   Example: [[VIDEO:dQw4w9WgXcQ|120000|180000|Understanding Support Levels]]

   Use these when:
   - RAG context includes YouTube video segments with timestamps
   - Providing supplementary explanations from KayCapitals YouTube
   - Offering alternative explanations to structured course content

6. COURSE VIDEO LINKS - Deep link to internal course content with timestamp:
   Format: [[COURSE:courseSlug/moduleSlug/lessonSlug|timestampSeconds|Title]]
   Example: [[COURSE:ltp-framework/core-concepts/patience-candles|120|Patience Candles Deep Dive]]

   Use these when:
   - Directing users to specific moments in course videos
   - RAG context includes transcript segments with timestamps
   - The official lesson provides the best explanation

IMPORTANT RULES:
- Always include 1-2 lesson links when explaining concepts
- When asked to "show" something, use charts or setup visualizations
- Place rich content markers on their own lines after your explanation
- Don't overuse - 2-3 rich content items per response maximum
- Make sure the lesson slug matches exactly from the curriculum below
- Prefer COURSE links for internal course content with timestamps
- Use VIDEO links for supplementary YouTube content
- When RAG context includes transcript timestamps, include COURSE markers to jump to specific moments

${getCurriculumReference()}`;

export async function POST(request: Request) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get user context from database
    let user = null;
    let recentTrades = null;

    if (sessionUser.discordId) {
      const { data } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('discord_id', sessionUser.discordId)
        .single();
      user = data;

      if (user) {
        // Get recent trades for context
        const { data: trades } = await supabaseAdmin
          .from('trade_journal')
          .select('*')
          .eq('user_id', user.id)
          .order('entry_time', { ascending: false })
          .limit(5);
        recentTrades = trades;
      }
    }

    // Build context about the user
    const userContext = user
      ? `
User Context:
- Username: ${user.discord_username}
- Experience Level: ${user.experience_level}
- Current Module: ${user.current_module}
- Streak Days: ${user.streak_days}
- Total Quizzes: ${user.total_quizzes}

Recent Trading Performance:
${
  recentTrades && recentTrades.length > 0
    ? recentTrades
        .map(
          (t: { symbol: string; direction: string; pnl: number; ltp_grade?: { grade: string } }) =>
            `- ${t.symbol} ${t.direction}: ${t.pnl > 0 ? '+' : ''}$${t.pnl?.toFixed(2)} (LTP Grade: ${t.ltp_grade?.grade || 'N/A'})`
        )
        .join('\n')
    : 'No recent trades logged'
}
`
      : '';

    // Build messages array for Claude
    const messages = [
      ...conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    // Get course content context (from course_lessons)
    let courseContentContext = '';
    let ragContext = '';
    let ragSources: Array<{ title: string; type: string; relevance: number }> = [];

    // Search course content first (primary knowledge source)
    try {
      const courseContent = await findRelevantContent(message, { limit: 3 });
      if (courseContent.hasContent) {
        courseContentContext = courseContent.contextText;
        courseContent.lessons.forEach((lesson) => {
          ragSources.push({
            title: lesson.title,
            type: 'lesson',
            relevance: lesson.relevance,
          });
        });
        logger.info('Course content retrieved', {
          lessonCount: courseContent.lessons.length,
          query: message.slice(0, 50),
        });
      }
    } catch (contentError) {
      logger.warn('Course content retrieval failed', {
        error: contentError instanceof Error ? contentError.message : String(contentError),
      });
    }

    // Also get RAG context from knowledge_chunks (YouTube, docs)
    try {
      const rag = await getEnhancedRAGContext(message);
      if (rag.hasContext) {
        ragContext = rag.contextText;
        rag.sources.forEach((s) => {
          if (!ragSources.find(r => r.title === s.title)) {
            ragSources.push(s);
          }
        });
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

    // Build system prompt with all context
    let systemPrompt = SYSTEM_PROMPT;
    if (userContext) {
      systemPrompt += `\n\n${userContext}`;
    }
    if (courseContentContext) {
      systemPrompt += `\n\n${courseContentContext}`;
    }
    if (ragContext) {
      systemPrompt += `\n\n=== SUPPLEMENTARY KNOWLEDGE ===\n${ragContext}`;
    }

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const rawMessage =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse rich content markers from the response
    const { cleanText, richContent } = parseAIResponse(rawMessage);

    return NextResponse.json({
      message: cleanText,
      richContent,
      conversationId: response.id,
      sources: ragSources.length > 0 ? ragSources : undefined,
    });
  } catch (error) {
    console.error('Error in chat:', error);

    // Provide more specific error messages for debugging
    if (error instanceof Error) {
      // Check for common API errors
      if (error.message.includes('API key')) {
        console.error('Anthropic API key issue - check ANTHROPIC_API_KEY environment variable');
        return NextResponse.json({
          error: 'AI service configuration error. Please contact support.',
          code: 'API_KEY_ERROR'
        }, { status: 500 });
      }
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json({
          error: 'AI service is temporarily busy. Please try again in a moment.',
          code: 'RATE_LIMIT'
        }, { status: 429 });
      }
      if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json({
          error: 'Unable to connect to AI service. Please check your internet connection.',
          code: 'NETWORK_ERROR'
        }, { status: 503 });
      }
    }

    return NextResponse.json({
      error: 'Internal server error',
      code: 'UNKNOWN_ERROR'
    }, { status: 500 });
  }
}
