/**
 * Briefings API
 *
 * GET /api/briefings - Get latest briefing by type
 * POST /api/briefings - Generate a new briefing (admin only)
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateMorningBriefing, generateEODBriefing, getLatestBriefing } from '@/lib/briefing-generator';
import { marketDataService } from '@/lib/market-data';
import logger from '@/lib/logger';

/**
 * GET /api/briefings
 * Get latest briefing by type
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'morning') as 'morning' | 'eod' | 'weekly';

    // Get latest briefing
    const briefing = await getLatestBriefing(type);

    if (!briefing) {
      // Try to get any recent briefing of this type
      const { data } = await supabaseAdmin
        .from('briefings')
        .select('*')
        .eq('briefing_type', type)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        return NextResponse.json({
          briefing: {
            id: data.id,
            briefingType: data.briefing_type,
            generatedAt: data.generated_at,
            content: data.content,
            marketContext: data.market_context,
            keyLevels: data.key_levels || [],
            setups: data.setups || [],
            economicEvents: data.economic_events || [],
            lessonOfDay: data.lesson_of_day,
          },
          isStale: true,
        });
      }

      // Fetch today's economic events for the default briefing
      const today = new Date().toISOString().split('T')[0];
      const { data: economicEventsData } = await supabaseAdmin
        .from('economic_events')
        .select('event_name, event_time, impact')
        .eq('event_date', today)
        .order('event_time', { ascending: true });

      const economicEvents = (economicEventsData || []).map((e: { event_name: string; event_time?: string; impact: string }) => ({
        eventName: e.event_name,
        eventTime: e.event_time || undefined,
        impact: e.impact,
      }));

      // Return a default briefing when none exists
      const defaultBriefing = {
        id: 'default',
        briefingType: type,
        generatedAt: new Date().toISOString(),
        content: {
          headline: 'Daily Trading Briefing',
          summary: 'Review key levels and wait for high-quality setups. Focus on LTP methodology.',
          marketBias: 'neutral' as const,
          actionItems: [
            'Review key support and resistance levels',
            'Check economic calendar for high-impact events',
            'Focus on A-grade setups only',
            'Wait for patience candle confirmation before entry',
          ],
          warnings: [],
        },
        marketContext: {
          spyPrice: 0,
          spyChange: 0,
          spyTrend: 'range',
          qqqPrice: 0,
          qqqChange: 0,
          qqqTrend: 'range',
          marketPhase: 'pre_market' as const,
          overallSentiment: 'neutral' as const,
        },
        keyLevels: [],
        setups: [],
        economicEvents,
        earnings: [],
        lessonOfDay: {
          title: 'Wait for Confirmation',
          content: 'Never enter a trade without a patience candle confirming your setup. The market rewards patience, not FOMO.',
          module: 'ltp-framework',
        },
      };

      return NextResponse.json({
        briefing: defaultBriefing,
        isDefault: true,
        message: 'Using default briefing. Generate a real briefing from admin panel.',
      });
    }

    return NextResponse.json({ briefing });

  } catch (error) {
    logger.error('Error fetching briefing', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/briefings
 * Generate a new briefing (admin only)
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if market data is configured
    if (!marketDataService.isConfigured()) {
      return NextResponse.json({
        error: 'Market data not configured',
        detail: 'MASSIVE_API_KEY is required for briefing generation',
      }, { status: 503 });
    }

    const body = await request.json();
    const { type = 'morning' } = body;

    if (!['morning', 'eod', 'weekly'].includes(type)) {
      return NextResponse.json({
        error: 'Invalid briefing type',
        validTypes: ['morning', 'eod', 'weekly'],
      }, { status: 400 });
    }

    logger.info('Manual briefing generation requested', { type, adminId: session.userId });

    let briefing;

    switch (type) {
      case 'morning':
        briefing = await generateMorningBriefing();
        break;
      case 'eod':
        briefing = await generateEODBriefing();
        break;
      case 'weekly':
        // Weekly briefing would be similar to morning but with weekly summary
        briefing = await generateMorningBriefing();
        break;
    }

    if (!briefing) {
      return NextResponse.json({
        error: 'Failed to generate briefing',
        detail: 'Could not fetch market data or generate content',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      briefing,
    });

  } catch (error) {
    logger.error('Error generating briefing', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
