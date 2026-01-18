import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// GET - Fetch detected setups
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const { searchParams } = new URL(request.url);

    const symbol = searchParams.get('symbol');
    const stage = searchParams.get('stage'); // forming, ready, triggered
    const minConfluence = parseInt(searchParams.get('minConfluence') || '0');

    // Get user's watchlist symbols
    const { data: watchlist } = await supabaseAdmin
      .from('watchlists')
      .select('symbols')
      .eq('owner_id', userId)
      .eq('is_shared', false)
      .single();

    // Get shared watchlist symbols
    const { data: sharedWatchlists } = await supabaseAdmin
      .from('watchlists')
      .select('symbols')
      .eq('is_shared', true)
      .eq('is_admin_watchlist', true);

    const personalSymbols = watchlist?.symbols || [];
    const sharedSymbols = sharedWatchlists?.flatMap(w => w.symbols || []) || [];
    const allWatchedSymbols = Array.from(new Set([...personalSymbols, ...sharedSymbols]));

    // Build query for detected setups
    let query = supabaseAdmin
      .from('detected_setups')
      .select('*')
      .order('confluence_score', { ascending: false })
      .limit(50);

    // Filter by symbol if specified, otherwise filter by watched symbols
    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    } else if (allWatchedSymbols.length > 0) {
      query = query.in('symbol', allWatchedSymbols);
    }

    // Filter by stage
    if (stage) {
      query = query.eq('setup_stage', stage);
    } else {
      // By default, show active setups (forming and ready)
      query = query.in('setup_stage', ['forming', 'ready']);
    }

    // Filter by minimum confluence score
    if (minConfluence > 0) {
      query = query.gte('confluence_score', minConfluence);
    }

    const { data: setups, error } = await query;

    if (error) {
      console.error('Error fetching setups:', error);
      return NextResponse.json({ error: 'Failed to fetch setups' }, { status: 500 });
    }

    // Group by stage for frontend
    const groupedSetups = {
      ready: setups?.filter(s => s.setup_stage === 'ready') || [],
      forming: setups?.filter(s => s.setup_stage === 'forming') || [],
      triggered: setups?.filter(s => s.setup_stage === 'triggered') || []
    };

    return NextResponse.json({
      setups: setups || [],
      grouped: groupedSetups,
      total: setups?.length || 0
    });
  } catch (error) {
    console.error('Error in setups GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Subscribe to setup alerts
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const { setupId, alertOnReady = true, alertOnTrigger = true } = await request.json();

    if (!setupId) {
      return NextResponse.json({ error: 'Setup ID required' }, { status: 400 });
    }

    // Verify setup exists
    const { data: setup, error: setupError } = await supabaseAdmin
      .from('detected_setups')
      .select('id')
      .eq('id', setupId)
      .single();

    if (!setup) {
      return NextResponse.json({ error: 'Setup not found' }, { status: 404 });
    }

    // Upsert subscription
    const { error: subscribeError } = await supabaseAdmin
      .from('setup_subscriptions')
      .upsert({
        user_id: userId,
        setup_id: setupId,
        notify_on_ready: alertOnReady,
        notify_on_trigger: alertOnTrigger,
        subscribed_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,setup_id'
      });

    if (subscribeError) {
      console.error('Error subscribing to setup:', subscribeError);
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
    }

    return NextResponse.json({ success: true, subscribed: true });
  } catch (error) {
    console.error('Error in setups POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Unsubscribe from setup alerts
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const { searchParams } = new URL(request.url);
    const setupId = searchParams.get('setupId');

    if (!setupId) {
      return NextResponse.json({ error: 'Setup ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('setup_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('setup_id', setupId);

    if (error) {
      console.error('Error unsubscribing from setup:', error);
      return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in setups DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
