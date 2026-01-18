import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';
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

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + (userContext ? `\n\n${userContext}` : ''),
      messages,
    });

    const assistantMessage =
      response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({
      message: assistantMessage,
      conversationId: response.id,
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
