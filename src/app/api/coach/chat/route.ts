import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthenticatedUserId } from '@/lib/auth';
import { withRateLimitAndTimeout, getEndpointUserKey } from '@/lib/rate-limit';

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are an expert trading coach specializing in the King Cartel University (KCU) methodology. You help traders master the LTP (Levels, Trends, Patience) framework and related strategies.

Your expertise includes:
- LTP Framework: Identifying key levels (support/resistance, EMAs, VWAP), analyzing trends, and waiting for patience candles
- ORB (Opening Range Breakout): First 15 minutes high/low, breakout entries
- Order Flow: Reading bid/ask walls, time-based validation (walls that hold for 2+ minutes)
- MTF Analysis: Multi-timeframe confluence (5m, 15m, 1h, 4h, Daily, Weekly levels)
- Key Levels: PDH/PDL, VWAP, 8/21 EMAs, 50/200 SMAs, Weekly/Monthly highs/lows
- Risk Management: Position sizing, stop placement, taking profits

Guidelines:
- Be concise but thorough
- Use specific examples when explaining concepts
- Reference the LTP framework in your advice
- Encourage patience and discipline
- Focus on process over outcomes
- Ask clarifying questions when needed
- Be supportive but honest about mistakes

When reviewing trades, look for:
- Was there a clear LTP setup?
- Was the entry at a key level?
- Was the trend in their favor?
- Did they wait for patience candles?
- Was risk managed properly?`;

async function coachChatHandler(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: anthropicMessages,
    });

    const textContent = response.content.find(block => block.type === 'text');
    const message = textContent ? textContent.text : 'I apologize, but I could not generate a response.';

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Coach chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export with rate limiting (30 requests/minute) and timeout (60 seconds)
export const POST = withRateLimitAndTimeout(
  coachChatHandler,
  getEndpointUserKey('coach-chat'),
  { limit: 30, windowSeconds: 60, timeoutMs: 60000 }
);
