import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// GET - Fetch user's watchlist with key levels
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;

    // Get or create user's personal watchlist
    let { data: watchlist, error: watchlistError } = await supabaseAdmin
      .from('watchlists')
      .select('id, name, is_shared, is_admin_watchlist, symbols')
      .eq('user_id', userId)
      .eq('is_shared', false)
      .single();

    if (!watchlist) {
      // Create personal watchlist if doesn't exist
      const { data: newWatchlist, error: createError } = await supabaseAdmin
        .from('watchlists')
        .insert({
          user_id: userId,
          name: 'My Watchlist',
          is_shared: false,
          is_admin_watchlist: false,
          symbols: []
        })
        .select()
        .single();

      if (createError || !newWatchlist) {
        console.error('Error creating watchlist:', createError);
        return NextResponse.json({ error: 'Failed to create watchlist' }, { status: 500 });
      }
      watchlist = newWatchlist;
    }

    // At this point watchlist is guaranteed to exist
    const currentWatchlist = watchlist!;

    // Get shared admin watchlist(s)
    const { data: sharedWatchlists } = await supabaseAdmin
      .from('watchlists')
      .select('id, name, symbols')
      .eq('is_shared', true)
      .eq('is_admin_watchlist', true);

    // Combine all symbols
    const personalSymbols = currentWatchlist.symbols || [];
    const sharedSymbols = sharedWatchlists?.flatMap(w => w.symbols || []) || [];

    // Create combined list with source info
    const allSymbols = [
      ...sharedSymbols.map((s: string) => ({ symbol: s, is_shared: true })),
      ...personalSymbols.filter((s: string) => !sharedSymbols.includes(s)).map((s: string) => ({ symbol: s, is_shared: false }))
    ];

    // Fetch key levels for all symbols
    const symbolList = Array.from(new Set([...personalSymbols, ...sharedSymbols]));

    const { data: levels } = symbolList.length > 0
      ? await supabaseAdmin
          .from('key_levels')
          .select('*')
          .in('symbol', symbolList)
          .gt('expires_at', new Date().toISOString())
      : { data: [] };

    // Fetch market data cache
    const { data: marketData } = symbolList.length > 0
      ? await supabaseAdmin
          .from('market_data_cache')
          .select('*')
          .in('symbol', symbolList)
      : { data: [] };

    // Combine data
    const symbols = allSymbols.map((item: { symbol: string; is_shared: boolean }, index: number) => ({
      id: `${currentWatchlist.id}-${index}`,
      symbol: item.symbol,
      is_shared: item.is_shared,
      added_at: new Date().toISOString(),
      levels: levels?.filter(l => l.symbol === item.symbol) || [],
      quote: marketData?.find(m => m.symbol === item.symbol) || null
    }));

    return NextResponse.json({
      watchlist_id: currentWatchlist.id,
      symbols
    });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add symbol to watchlist
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const { symbol } = await request.json();

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
    }

    const normalizedSymbol = symbol.trim().toUpperCase();

    // Get user's watchlist
    const { data: watchlist, error: watchlistError } = await supabaseAdmin
      .from('watchlists')
      .select('id, symbols')
      .eq('user_id', userId)
      .eq('is_shared', false)
      .single();

    if (!watchlist) {
      // Create watchlist with the symbol
      const { error: createError } = await supabaseAdmin
        .from('watchlists')
        .insert({
          user_id: userId,
          name: 'My Watchlist',
          is_shared: false,
          is_admin_watchlist: false,
          symbols: [normalizedSymbol]
        });

      if (createError) {
        console.error('Error creating watchlist:', createError);
        return NextResponse.json({ error: 'Failed to add symbol' }, { status: 500 });
      }
    } else {
      // Add symbol if not already present
      const currentSymbols = watchlist.symbols || [];
      if (!currentSymbols.includes(normalizedSymbol)) {
        const { error: updateError } = await supabaseAdmin
          .from('watchlists')
          .update({ symbols: [...currentSymbols, normalizedSymbol] })
          .eq('id', watchlist.id);

        if (updateError) {
          console.error('Error updating watchlist:', updateError);
          return NextResponse.json({ error: 'Failed to add symbol' }, { status: 500 });
        }
      }
    }

    // Trigger async level calculation (in production this would be a background job)
    // For now, we'll let the LTP engine handle this on its next scan

    return NextResponse.json({ success: true, symbol: normalizedSymbol });
  } catch (error) {
    console.error('Error adding symbol:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove symbol from watchlist
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
    }

    const normalizedSymbol = symbol.trim().toUpperCase();

    // Get user's watchlist
    const { data: watchlist, error: watchlistError } = await supabaseAdmin
      .from('watchlists')
      .select('id, symbols')
      .eq('user_id', userId)
      .eq('is_shared', false)
      .single();

    if (!watchlist) {
      return NextResponse.json({ error: 'Watchlist not found' }, { status: 404 });
    }

    // Remove symbol
    const updatedSymbols = (watchlist.symbols || []).filter((s: string) => s !== normalizedSymbol);

    const { error: updateError } = await supabaseAdmin
      .from('watchlists')
      .update({ symbols: updatedSymbols })
      .eq('id', watchlist.id);

    if (updateError) {
      console.error('Error updating watchlist:', updateError);
      return NextResponse.json({ error: 'Failed to remove symbol' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing symbol:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
