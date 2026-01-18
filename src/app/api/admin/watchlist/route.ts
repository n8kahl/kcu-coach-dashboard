import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import logger from '@/lib/logger';

/**
 * GET /api/admin/watchlist
 * Fetch the admin/shared watchlist
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get admin shared watchlist
    const { data: watchlist, error } = await supabaseAdmin
      .from('watchlists')
      .select('*')
      .eq('is_shared', true)
      .eq('is_admin_watchlist', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching admin watchlist', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 });
    }

    return NextResponse.json({
      watchlist: watchlist || { symbols: [], name: 'Coach Watchlist' },
      exists: !!watchlist
    });
  } catch (error) {
    logger.error('Error in admin watchlist GET', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/watchlist
 * Add symbols to the admin/shared watchlist
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

    const { symbols, name } = await request.json();

    if (!symbols || !Array.isArray(symbols)) {
      return NextResponse.json({ error: 'Symbols array required' }, { status: 400 });
    }

    // Normalize symbols
    const normalizedSymbols = symbols.map((s: string) => s.toUpperCase().trim()).filter(Boolean);

    // Check if admin watchlist exists
    const { data: existing } = await supabaseAdmin
      .from('watchlists')
      .select('id, symbols')
      .eq('is_shared', true)
      .eq('is_admin_watchlist', true)
      .single();

    if (existing) {
      // Merge symbols
      const mergedSymbols = Array.from(new Set([
        ...(existing.symbols || []),
        ...normalizedSymbols
      ]));

      const { data, error } = await supabaseAdmin
        .from('watchlists')
        .update({
          symbols: mergedSymbols,
          ...(name && { name }),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating admin watchlist', { error: error.message });
        return NextResponse.json({ error: 'Failed to update watchlist' }, { status: 500 });
      }

      logger.info('Admin watchlist updated', {
        addedSymbols: normalizedSymbols,
        totalSymbols: mergedSymbols.length,
        adminId: session.userId
      });

      return NextResponse.json({ success: true, watchlist: data });
    } else {
      // Create new admin watchlist
      const { data, error } = await supabaseAdmin
        .from('watchlists')
        .insert({
          name: name || 'Coach Watchlist',
          symbols: normalizedSymbols,
          is_shared: true,
          is_admin_watchlist: true,
          owner_id: session.userId,
          user_id: session.userId
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating admin watchlist', { error: error.message });
        return NextResponse.json({ error: 'Failed to create watchlist' }, { status: 500 });
      }

      logger.info('Admin watchlist created', {
        symbols: normalizedSymbols,
        adminId: session.userId
      });

      return NextResponse.json({ success: true, watchlist: data, created: true });
    }
  } catch (error) {
    logger.error('Error in admin watchlist POST', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/watchlist
 * Replace the entire admin watchlist symbols
 */
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { symbols, name } = await request.json();

    if (!symbols || !Array.isArray(symbols)) {
      return NextResponse.json({ error: 'Symbols array required' }, { status: 400 });
    }

    // Normalize symbols
    const normalizedSymbols = symbols.map((s: string) => s.toUpperCase().trim()).filter(Boolean);

    // Check if admin watchlist exists
    const { data: existing } = await supabaseAdmin
      .from('watchlists')
      .select('id')
      .eq('is_shared', true)
      .eq('is_admin_watchlist', true)
      .single();

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('watchlists')
        .update({
          symbols: normalizedSymbols,
          ...(name && { name }),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        logger.error('Error replacing admin watchlist', { error: error.message });
        return NextResponse.json({ error: 'Failed to update watchlist' }, { status: 500 });
      }

      logger.info('Admin watchlist replaced', {
        symbols: normalizedSymbols,
        adminId: session.userId
      });

      return NextResponse.json({ success: true, watchlist: data });
    } else {
      // Create new
      const { data, error } = await supabaseAdmin
        .from('watchlists')
        .insert({
          name: name || 'Coach Watchlist',
          symbols: normalizedSymbols,
          is_shared: true,
          is_admin_watchlist: true,
          owner_id: session.userId,
          user_id: session.userId
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating admin watchlist', { error: error.message });
        return NextResponse.json({ error: 'Failed to create watchlist' }, { status: 500 });
      }

      return NextResponse.json({ success: true, watchlist: data, created: true });
    }
  } catch (error) {
    logger.error('Error in admin watchlist PUT', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/watchlist
 * Remove symbols from the admin/shared watchlist
 */
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    if (!symbolsParam) {
      return NextResponse.json({ error: 'Symbols parameter required' }, { status: 400 });
    }

    const symbolsToRemove = symbolsParam.split(',').map(s => s.toUpperCase().trim());

    // Get current admin watchlist
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('watchlists')
      .select('id, symbols')
      .eq('is_shared', true)
      .eq('is_admin_watchlist', true)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Admin watchlist not found' }, { status: 404 });
    }

    // Remove specified symbols
    const updatedSymbols = (existing.symbols || []).filter(
      (s: string) => !symbolsToRemove.includes(s.toUpperCase())
    );

    const { data, error } = await supabaseAdmin
      .from('watchlists')
      .update({
        symbols: updatedSymbols,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      logger.error('Error removing from admin watchlist', { error: error.message });
      return NextResponse.json({ error: 'Failed to update watchlist' }, { status: 500 });
    }

    logger.info('Symbols removed from admin watchlist', {
      removedSymbols: symbolsToRemove,
      remainingSymbols: updatedSymbols.length,
      adminId: session.userId
    });

    return NextResponse.json({ success: true, watchlist: data, removed: symbolsToRemove });
  } catch (error) {
    logger.error('Error in admin watchlist DELETE', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
