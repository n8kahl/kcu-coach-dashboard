import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUserId } from '@/lib/auth';

// GET /api/companion/setups - Get active setups for user's watchlist
export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const stage = searchParams.get('stage'); // 'forming', 'ready', 'triggered'
    const minConfluence = parseInt(searchParams.get('minConfluence') || '0');

    // Get user's watchlist symbols
    const { data: watchlist } = await supabaseAdmin
      .from('watchlists')
      .select('id')
      .eq('user_id', userId)
      .single();

    let watchedSymbols: string[] = [];

    if (watchlist) {
      const { data: symbols } = await supabaseAdmin
        .from('watchlist_symbols')
        .select('symbol')
        .eq('watchlist_id', watchlist.id);

      watchedSymbols = (symbols || []).map(s => s.symbol);
    }

    // Build query
    let query = supabaseAdmin
      .from('detected_setups')
      .select('*')
      .in('setup_stage', ['forming', 'ready', 'triggered'])
      .gte('confluence_score', minConfluence)
      .order('confluence_score', { ascending: false });

    // Filter by symbol if specified
    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    } else if (watchedSymbols.length > 0) {
      // Only show setups for watched symbols
      query = query.in('symbol', watchedSymbols);
    }

    // Filter by stage if specified
    if (stage) {
      query = query.eq('setup_stage', stage);
    }

    const { data: setups, error } = await query.limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by stage for easier consumption
    const grouped = {
      ready: (setups || []).filter(s => s.setup_stage === 'ready'),
      forming: (setups || []).filter(s => s.setup_stage === 'forming'),
      triggered: (setups || []).filter(s => s.setup_stage === 'triggered')
    };

    return NextResponse.json({
      setups: setups || [],
      grouped,
      watchedSymbols
    });
  } catch (error) {
    console.error('Error fetching setups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/companion/setups/subscribe - Subscribe to setup alerts
export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { setupId, alertOnReady = true, alertOnTrigger = true } = body;

    if (!setupId) {
      return NextResponse.json({ error: 'Setup ID is required' }, { status: 400 });
    }

    // Verify setup exists
    const { data: setup } = await supabaseAdmin
      .from('detected_setups')
      .select('id')
      .eq('id', setupId)
      .single();

    if (!setup) {
      return NextResponse.json({ error: 'Setup not found' }, { status: 404 });
    }

    // Create subscription
    const { data: subscription, error } = await supabaseAdmin
      .from('setup_subscriptions')
      .upsert({
        user_id: userId,
        setup_id: setupId,
        alert_on_ready: alertOnReady,
        alert_on_trigger: alertOnTrigger
      }, {
        onConflict: 'user_id,setup_id'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Subscribed to setup alerts',
      subscription
    });
  } catch (error) {
    console.error('Error subscribing to setup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
