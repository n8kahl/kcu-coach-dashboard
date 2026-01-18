import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUserId } from '@/lib/auth';
import type { WinCard, WinCardStat } from '@/types';

// GET - Fetch user's win cards
export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type'); // 'trade' | 'streak' | 'milestone' | 'achievement'

    let query = supabaseAdmin
      .from('win_cards')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    const { data: cards, error, count } = await query;

    if (error) {
      // If table doesn't exist, return empty array with generated cards from trades
      console.error('Error fetching win cards:', error);

      // Fall back to generating win cards from recent trades
      const generatedCards = await generateWinCardsFromTrades(userId);
      return NextResponse.json({ cards: generatedCards, total: generatedCards.length });
    }

    return NextResponse.json({ cards: cards || [], total: count || 0 });
  } catch (error) {
    console.error('Error fetching win cards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new win card
export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, title, subtitle, stats, trade_id } = body;

    if (!type || !title) {
      return NextResponse.json(
        { error: 'Type and title are required' },
        { status: 400 }
      );
    }

    const cardData = {
      user_id: userId,
      type,
      title,
      subtitle: subtitle || null,
      stats: stats || [],
      trade_id: trade_id || null,
      shared_count: 0,
      created_at: new Date().toISOString(),
    };

    const { data: card, error } = await supabaseAdmin
      .from('win_cards')
      .insert(cardData)
      .select()
      .single();

    if (error) {
      console.error('Error creating win card:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ card });
  } catch (error) {
    console.error('Error creating win card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to generate win cards from trades
async function generateWinCardsFromTrades(userId: string): Promise<WinCard[]> {
  try {
    // Fetch recent winning trades
    const { data: trades, error } = await supabaseAdmin
      .from('trade_journal')
      .select('*')
      .eq('user_id', userId)
      .gt('pnl', 0)
      .order('pnl', { ascending: false })
      .limit(10);

    if (error || !trades) {
      return [];
    }

    // Convert winning trades to win cards
    return trades.map((trade, index) => {
      const ltpGrade = trade.ltp_grade?.grade || 'B';
      const stats: WinCardStat[] = [
        { label: 'P&L', value: `+$${trade.pnl?.toFixed(2) || '0.00'}`, color: 'profit', highlight: true },
        { label: 'Return', value: `+${trade.pnl_percent?.toFixed(1) || '0'}%`, color: 'profit' },
        { label: 'Entry', value: `$${trade.entry_price?.toFixed(2) || '0.00'}` },
        { label: 'Exit', value: `$${trade.exit_price?.toFixed(2) || '0.00'}` },
        { label: 'LTP Grade', value: ltpGrade, color: ltpGrade === 'A' ? 'gold' : 'default' },
        { label: 'Direction', value: trade.direction?.toUpperCase() || 'LONG' },
      ];

      return {
        id: trade.id,
        user_id: userId,
        type: 'trade' as const,
        title: `${trade.symbol} ${trade.direction?.toUpperCase() || 'LONG'}`,
        subtitle: trade.pnl > 100 ? 'Big Winner!' : 'Nice Trade!',
        stats,
        created_at: trade.exit_time || trade.created_at,
        shared_count: 0,
        trade_id: trade.id,
      };
    });
  } catch (error) {
    console.error('Error generating win cards:', error);
    return [];
  }
}
