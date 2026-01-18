/**
 * Practice Win Card API
 *
 * POST /api/practice/win-card - Generate a win card for practice achievements
 * GET /api/practice/win-card - Get user's win cards
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

interface CreateWinCardRequest {
  winCardType: 'streak' | 'accuracy' | 'milestone' | 'perfect_session';
  title: string;
  description?: string;
  stats: Record<string, unknown>;
  template?: string;
}

/**
 * POST - Generate a new win card
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateWinCardRequest = await request.json();
    const { winCardType, title, description, stats, template } = body;

    if (!winCardType || !title || !stats) {
      return NextResponse.json({
        error: 'winCardType, title, and stats are required',
      }, { status: 400 });
    }

    // Get user info for the card
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('username, avatar_url')
      .eq('id', session.userId)
      .single();

    // Create the win card
    const { data: winCard, error } = await supabaseAdmin
      .from('practice_win_cards')
      .insert({
        user_id: session.userId,
        win_card_type: winCardType,
        title,
        description: description || generateDescription(winCardType, stats),
        stats: {
          ...stats,
          username: user?.username || 'Trader',
          avatarUrl: user?.avatar_url,
          createdAt: new Date().toISOString(),
        },
        template: template || getDefaultTemplate(winCardType),
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating win card', { error: error.message });
      return NextResponse.json({ error: 'Failed to create win card' }, { status: 500 });
    }

    logger.info('Win card created', {
      userId: session.userId,
      winCardId: winCard.id,
      type: winCardType,
    });

    // Generate shareable content
    const shareContent = generateShareContent(winCardType, title, stats);

    return NextResponse.json({
      winCard: {
        id: winCard.id,
        type: winCard.win_card_type,
        title: winCard.title,
        description: winCard.description,
        stats: winCard.stats,
        template: winCard.template,
        createdAt: winCard.created_at,
      },
      shareContent,
    });
  } catch (error) {
    logger.error('Error in win card POST', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET - Get user's win cards
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const type = searchParams.get('type');

    let query = supabaseAdmin
      .from('practice_win_cards')
      .select('*')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('win_card_type', type);
    }

    const { data: winCards, error } = await query;

    if (error) {
      logger.error('Error fetching win cards', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch win cards' }, { status: 500 });
    }

    return NextResponse.json({
      winCards: winCards || [],
      count: winCards?.length || 0,
    });
  } catch (error) {
    logger.error('Error in win card GET', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions

function generateDescription(
  type: string,
  stats: Record<string, unknown>
): string {
  switch (type) {
    case 'streak':
      return `Achieved a ${stats.streak} correct answer streak in LTP practice!`;
    case 'accuracy':
      return `Reached ${stats.accuracy}% accuracy on ${stats.totalAttempts} practice scenarios!`;
    case 'milestone':
      return `Completed ${stats.milestone} practice scenarios!`;
    case 'perfect_session':
      return `Perfect session: ${stats.correct}/${stats.total} correct!`;
    default:
      return 'Practice achievement unlocked!';
  }
}

function getDefaultTemplate(type: string): string {
  switch (type) {
    case 'streak':
      return 'practice_streak';
    case 'accuracy':
      return 'practice_accuracy';
    case 'milestone':
      return 'practice_milestone';
    case 'perfect_session':
      return 'practice_perfect';
    default:
      return 'practice_default';
  }
}

function generateShareContent(
  type: string,
  title: string,
  stats: Record<string, unknown>
): {
  twitter: string;
  instagram: string;
  general: string;
} {
  const hashtags = '#KCU #LTPFramework #DayTrading #TradingPractice';

  let message = '';
  switch (type) {
    case 'streak':
      message = `${stats.streak} correct in a row on my LTP practice! The framework is clicking. ${hashtags}`;
      break;
    case 'accuracy':
      message = `Hit ${stats.accuracy}% accuracy on ${stats.totalAttempts} LTP practice scenarios! Consistency is key. ${hashtags}`;
      break;
    case 'milestone':
      message = `Just completed ${stats.milestone} practice scenarios! Putting in the reps. ${hashtags}`;
      break;
    case 'perfect_session':
      message = `Perfect practice session! ${stats.correct}/${stats.total} Level, Trend, Patience - locked in. ${hashtags}`;
      break;
    default:
      message = `${title} ${hashtags}`;
  }

  return {
    twitter: message.slice(0, 280),
    instagram: message,
    general: message.replace(/#\w+/g, '').trim(),
  };
}
