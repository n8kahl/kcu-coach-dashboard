/**
 * Legacy Coach Chat API
 *
 * @deprecated This endpoint is deprecated. Use /api/ai/unified instead.
 *
 * This endpoint now proxies requests to the unified AI API for backward compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // Get the last user message
    const lastUserMessage = messages.filter((m: { role: string }) => m.role === 'user').pop();
    if (!lastUserMessage) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 });
    }

    // Proxy to unified API
    const unifiedResponse = await fetch(new URL('/api/ai/unified', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        message: lastUserMessage.content,
        mode: 'coach',
        context: {
          currentPage: 'coach',
        },
        conversationHistory: messages.slice(0, -1),
      }),
    });

    if (!unifiedResponse.ok) {
      const error = await unifiedResponse.json();
      return NextResponse.json(error, { status: unifiedResponse.status });
    }

    const data = await unifiedResponse.json();

    // Transform response to legacy format
    return NextResponse.json({
      message: data.message,
      richContent: data.richContent,
    });
  } catch (error) {
    console.error('Legacy coach chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
