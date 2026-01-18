import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { analyzeOnDemand, getWatchlist, isDetectorRunning } from '@/lib/ltp-detector';

/**
 * GET /api/setups
 * Get detected setups
 */
export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const minScore = parseInt(searchParams.get('minScore') || '50');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build query
    let query = supabaseAdmin
      .from('detected_setups')
      .select('*')
      .gte('confluence_score', minScore)
      .gt('detected_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 mins
      .order('confluence_score', { ascending: false })
      .limit(limit);

    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    }

    const { data: setups, error } = await query;

    if (error) {
      console.error('[Setups API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      setups: setups || [],
      watchlist: getWatchlist(),
      detectorRunning: isDetectorRunning(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Setups API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/setups
 * Analyze a symbol on-demand
 */
export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { symbol } = body;

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const setup = await analyzeOnDemand(symbol.toUpperCase());

    if (!setup) {
      return NextResponse.json({
        setup: null,
        message: 'Could not analyze symbol. Market data may be unavailable.',
      });
    }

    return NextResponse.json({
      setup,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Setups API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
