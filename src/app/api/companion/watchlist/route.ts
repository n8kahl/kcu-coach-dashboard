import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import logger from '@/lib/logger';

// GET - Fetch user's watchlist with key levels
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    logger.debug('Fetching watchlist for user', { userId });

    // Get user's personal watchlist
    // Try user_id first (this is what the actual schema uses based on Railway logs)
    let { data: watchlist, error: watchlistError } = await supabaseAdmin
      .from('watchlists')
      .select('id, name, is_shared, is_admin_watchlist, symbols')
      .eq('user_id', userId)
      .eq('is_shared', false)
      .single();

    logger.debug('Watchlist query result (user_id)', {
      hasWatchlist: !!watchlist,
      errorCode: watchlistError?.code,
      errorMessage: watchlistError?.message
    });

    // Check if table doesn't exist
    if (watchlistError && watchlistError.code === '42P01') {
      logger.error('Watchlists table does not exist in database');
      return NextResponse.json({
        error: 'Database not configured',
        detail: 'The watchlists table has not been created. Please run database migrations.'
      }, { status: 500 });
    }

    // Fallback: try owner_id if user_id didn't find anything (for schema compatibility)
    if (!watchlist && watchlistError?.code === 'PGRST116') {
      const { data: watchlistByOwnerId, error: ownerIdError } = await supabaseAdmin
        .from('watchlists')
        .select('id, name, is_shared, is_admin_watchlist, symbols')
        .eq('owner_id', userId)
        .eq('is_shared', false)
        .single();

      // Only use owner_id result if it worked (column exists and found data)
      if (!ownerIdError || ownerIdError.code === 'PGRST116') {
        watchlist = watchlistByOwnerId;
      }
    }

    if (!watchlist) {
      // Create personal watchlist if doesn't exist
      // Try with user_id first (matches actual schema), fall back to owner_id
      let createError;
      let newWatchlist;

      // Try user_id first (this is what the actual schema uses)
      const result1 = await supabaseAdmin
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

      if (result1.error?.message?.includes('user_id') && result1.error.message.includes('does not exist')) {
        // Column doesn't exist, try owner_id
        const result2 = await supabaseAdmin
          .from('watchlists')
          .insert({
            owner_id: userId,
            name: 'My Watchlist',
            is_shared: false,
            is_admin_watchlist: false,
            symbols: []
          })
          .select()
          .single();
        createError = result2.error;
        newWatchlist = result2.data;
      } else {
        createError = result1.error;
        newWatchlist = result1.data;
      }

      if (createError || !newWatchlist) {
        logger.error('Error creating watchlist', {
          errorCode: createError?.code,
          errorMessage: createError?.message,
          errorDetails: createError?.details
        });
        return NextResponse.json({
          error: 'Failed to create watchlist',
          detail: createError?.message || 'Unknown error'
        }, { status: 500 });
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

    // Fetch key levels for all symbols (gracefully handle missing table)
    const symbolList = Array.from(new Set([...personalSymbols, ...sharedSymbols]));
    let levels: Array<{ symbol: string; [key: string]: unknown }> | null = null;
    let marketData: Array<{ symbol: string; [key: string]: unknown }> | null = null;

    if (symbolList.length > 0) {
      // Try to fetch key levels - table may not exist yet
      const levelsResult = await supabaseAdmin
        .from('key_levels')
        .select('*')
        .in('symbol', symbolList)
        .gt('expires_at', new Date().toISOString());

      if (levelsResult.error) {
        logger.warn('Failed to fetch key_levels (table may not exist)', { error: levelsResult.error.message });
      } else {
        levels = levelsResult.data;
      }

      // Try to fetch market data cache - table may not exist yet
      const marketResult = await supabaseAdmin
        .from('market_data_cache')
        .select('*')
        .in('symbol', symbolList);

      if (marketResult.error) {
        logger.warn('Failed to fetch market_data_cache (table may not exist)', { error: marketResult.error.message });
      } else {
        marketData = marketResult.data;
      }
    }

    // Combine data - normalize quote field names for frontend consistency
    const symbols = allSymbols.map((item: { symbol: string; is_shared: boolean }, index: number) => {
      const rawQuote = marketData?.find(m => m.symbol === item.symbol);
      // Normalize quote fields: API may return 'price'/'changePercent' but frontend expects 'last_price'/'change_percent'
      const quote = rawQuote ? {
        last_price: rawQuote.price ?? rawQuote.last_price ?? 0,
        change_percent: rawQuote.changePercent ?? rawQuote.change_percent ?? 0,
        change: rawQuote.change ?? 0,
        vwap: rawQuote.vwap ?? 0,
        volume: rawQuote.volume ?? 0,
        high: rawQuote.high ?? 0,
        low: rawQuote.low ?? 0,
        open: rawQuote.open ?? 0,
      } : null;

      return {
        id: `${currentWatchlist.id}-${index}`,
        symbol: item.symbol,
        is_shared: item.is_shared,
        added_at: new Date().toISOString(),
        levels: levels?.filter(l => l.symbol === item.symbol) || [],
        quote,
      };
    });

    return NextResponse.json({
      watchlist_id: currentWatchlist.id,
      symbols
    });
  } catch (error) {
    logger.error('Error fetching watchlist', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({
      error: 'Internal server error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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

    // Get user's watchlist - try user_id first (matches actual schema)
    let { data: watchlist } = await supabaseAdmin
      .from('watchlists')
      .select('id, symbols')
      .eq('user_id', userId)
      .eq('is_shared', false)
      .single();

    if (!watchlist) {
      // Try owner_id as fallback for schema compatibility
      const { data: watchlistByOwnerId } = await supabaseAdmin
        .from('watchlists')
        .select('id, symbols')
        .eq('owner_id', userId)
        .eq('is_shared', false)
        .single();
      watchlist = watchlistByOwnerId;
    }

    if (!watchlist) {
      // Create watchlist with the symbol - try user_id first (matches actual schema)
      const result1 = await supabaseAdmin
        .from('watchlists')
        .insert({
          user_id: userId,
          name: 'My Watchlist',
          is_shared: false,
          is_admin_watchlist: false,
          symbols: [normalizedSymbol]
        });

      if (result1.error?.message?.includes('user_id') && result1.error.message.includes('does not exist')) {
        // Try owner_id instead
        const result2 = await supabaseAdmin
          .from('watchlists')
          .insert({
            owner_id: userId,
            name: 'My Watchlist',
            is_shared: false,
            is_admin_watchlist: false,
            symbols: [normalizedSymbol]
          });

        if (result2.error) {
          logger.error('Error creating watchlist (owner_id)', { error: result2.error.message });
          return NextResponse.json({ error: 'Failed to add symbol', detail: result2.error.message }, { status: 500 });
        }
      } else if (result1.error) {
        logger.error('Error creating watchlist (user_id)', { error: result1.error.message });
        return NextResponse.json({ error: 'Failed to add symbol', detail: result1.error.message }, { status: 500 });
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
          logger.error('Error updating watchlist', { error: updateError.message });
          return NextResponse.json({ error: 'Failed to add symbol', detail: updateError.message }, { status: 500 });
        }
      }
    }

    // Trigger async level calculation (in production this would be a background job)
    // For now, we'll let the LTP engine handle this on its next scan

    return NextResponse.json({ success: true, symbol: normalizedSymbol });
  } catch (error) {
    logger.error('Error adding symbol', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({
      error: 'Internal server error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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

    // Get user's watchlist - try user_id first (matches actual schema)
    let { data: watchlist } = await supabaseAdmin
      .from('watchlists')
      .select('id, symbols')
      .eq('user_id', userId)
      .eq('is_shared', false)
      .single();

    if (!watchlist) {
      // Try owner_id as fallback for schema compatibility
      const { data: watchlistByOwnerId } = await supabaseAdmin
        .from('watchlists')
        .select('id, symbols')
        .eq('owner_id', userId)
        .eq('is_shared', false)
        .single();
      watchlist = watchlistByOwnerId;
    }

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
      logger.error('Error updating watchlist (DELETE)', { error: updateError.message });
      return NextResponse.json({ error: 'Failed to remove symbol', detail: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error removing symbol', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({
      error: 'Internal server error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
