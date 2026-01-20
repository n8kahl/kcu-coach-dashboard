// ============================================
// Market Pulse API Route
// Real-time news reactions using Somesh's voice
// ============================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, internalError, badRequest } from '@/lib/api-errors';
import { z } from 'zod';
import {
  fetchTriggerNews,
  generateReactionContent,
  generateBatchReactions,
  getTriggerTopics,
  NewsItem,
} from '@/lib/social/trending-aggregator';

// ============================================
// Request Validation
// ============================================

const GenerateReactionSchema = z.object({
  newsItem: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    source: z.string(),
    sourceUrl: z.string().optional(),
    publishedAt: z.string(),
    category: z.string(),
    triggerTopics: z.array(z.string()),
    urgency: z.enum(['breaking', 'high', 'medium', 'low']),
    sentiment: z.enum(['bullish', 'bearish', 'neutral']).optional(),
  }),
});

// ============================================
// GET - Fetch trigger news
// ============================================

export const GET = withErrorHandler(async (request: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Get trigger topics list
  if (action === 'topics') {
    return NextResponse.json({
      success: true,
      data: getTriggerTopics(),
    });
  }

  // Default: Fetch trigger news
  try {
    const newsItems = await fetchTriggerNews();

    return NextResponse.json({
      success: true,
      data: newsItems,
      count: newsItems.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[MarketPulse] Fetch error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch news';
    return internalError(message);
  }
});

// ============================================
// POST - Generate reaction content
// ============================================

export const POST = withErrorHandler(async (request: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const body = await request.json();

  // Batch generate reactions for multiple news items
  if (action === 'batch') {
    const newsItems = body.newsItems as NewsItem[];

    if (!newsItems || !Array.isArray(newsItems) || newsItems.length === 0) {
      return badRequest('newsItems array is required');
    }

    try {
      const reactions = await generateBatchReactions(newsItems);

      return NextResponse.json({
        success: true,
        data: reactions,
        generated: reactions.length,
        requested: newsItems.length,
      });
    } catch (error) {
      console.error('[MarketPulse] Batch generation error:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate batch reactions';
      return internalError(message);
    }
  }

  // Single reaction generation
  try {
    const { newsItem } = GenerateReactionSchema.parse(body);

    const reaction = await generateReactionContent(newsItem as NewsItem);

    return NextResponse.json({
      success: true,
      data: reaction,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }

    console.error('[MarketPulse] Generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate reaction';
    return internalError(message);
  }
});
