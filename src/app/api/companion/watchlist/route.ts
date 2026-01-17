import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUserId } from '@/lib/auth';

// GET /api/companion/watchlist - Get user's watchlist with key levels
export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create watchlist
    let { data: watchlist } = await supabaseAdmin
      .from('watchlists')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!watchlist) {
      const { data: newWatchlist } = await supabaseAdmin
        .from('watchlists')
        .insert({ user_id: userId })
        .select('id')
        .single();
      watchlist = newWatchlist;
    }

    if (!watchlist) {
      return NextResponse.json({ error: 'Failed to get watchlist' }, { status: 500 });
    }

    // Get symbols with their settings
    const { data: symbols, error } = await supabaseAdmin
      .from('watchlist_symbols')
      .select('*')
      .eq('watchlist_id', watchlist.id)
      .order('added_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get key levels for each symbol
    const symbolsWithLevels = await Promise.all(
      (symbols || []).map(async (sym) => {
        const { data: levels } = await supabaseAdmin
          .from('symbol_levels')
          .select('*')
          .eq('symbol', sym.symbol)
          .gt('expires_at', new Date().toISOString());

        // Get current quote from cache
        const { data: quote } = await supabaseAdmin
          .from('market_data_cache')
          .select('*')
          .eq('symbol', sym.symbol)
          .single();

        return {
          ...sym,
          levels: levels || [],
          quote
        };
      })
    );

    return NextResponse.json({
      watchlistId: watchlist.id,
      symbols: symbolsWithLevels
    });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/companion/watchlist - Add symbol to watchlist
export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { symbol } = body;

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const normalizedSymbol = symbol.toUpperCase().trim();

    // Get or create watchlist
    let { data: watchlist } = await supabaseAdmin
      .from('watchlists')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!watchlist) {
      const { data: newWatchlist } = await supabaseAdmin
        .from('watchlists')
        .insert({ user_id: userId })
        .select('id')
        .single();
      watchlist = newWatchlist;
    }

    if (!watchlist) {
      return NextResponse.json({ error: 'Failed to get watchlist' }, { status: 500 });
    }

    // Add symbol (upsert to handle duplicates)
    const { data: added, error } = await supabaseAdmin
      .from('watchlist_symbols')
      .upsert({
        watchlist_id: watchlist.id,
        symbol: normalizedSymbol
      }, {
        onConflict: 'watchlist_id,symbol'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger level calculation for this symbol (async)
    // In production, this would be a background job
    triggerLevelCalculation(normalizedSymbol);

    return NextResponse.json({
      message: `${normalizedSymbol} added to watchlist`,
      symbol: added
    });
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/companion/watchlist - Remove symbol from watchlist
export async function DELETE(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    // Get watchlist
    const { data: watchlist } = await supabaseAdmin
      .from('watchlists')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!watchlist) {
      return NextResponse.json({ error: 'Watchlist not found' }, { status: 404 });
    }

    // Remove symbol
    const { error } = await supabaseAdmin
      .from('watchlist_symbols')
      .delete()
      .eq('watchlist_id', watchlist.id)
      .eq('symbol', symbol.toUpperCase());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `${symbol.toUpperCase()} removed from watchlist`
    });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper to trigger level calculation (would be a queue job in production)
async function triggerLevelCalculation(symbol: string) {
  // This would typically add to a job queue
  // For now, we'll just log it
  console.log(`Level calculation triggered for ${symbol}`);
}
