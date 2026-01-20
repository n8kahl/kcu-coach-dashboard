import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withRateLimitAndTimeout, getEndpointUserKey } from '@/lib/rate-limit';

// GET - Fetch OHLCV bars from Massive.com
async function barsHandler(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timespan = searchParams.get('timespan') || 'day';
    const multiplier = searchParams.get('multiplier') || '1';
    const limit = searchParams.get('limit') || '50';

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
    }

    const apiKey = process.env.MASSIVE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Market data not configured' }, { status: 503 });
    }

    // Calculate date range
    const to = new Date().toISOString().split('T')[0];
    const daysBack = timespan === 'week' ? parseInt(limit) * 7 :
                     timespan === 'day' ? parseInt(limit) :
                     timespan === 'hour' ? Math.ceil(parseInt(limit) / 7) :
                     Math.ceil(parseInt(limit) / 78);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);
    const from = fromDate.toISOString().split('T')[0];

    const response = await fetch(
      `https://api.massive.com/v1/aggs/ticker/${symbol.toUpperCase()}/range/${multiplier}/${timespan}/${from}/${to}?limit=${limit}&sort=asc&apiKey=${apiKey}`
    );

    if (!response.ok) {
      console.error('Massive API error:', response.status);
      return NextResponse.json({ error: 'Failed to fetch bars' }, { status: 500 });
    }

    const data = await response.json();

    if (!data?.results) {
      return NextResponse.json({ bars: [] });
    }

    const bars = data.results.map((bar: { t: number; o: number; h: number; l: number; c: number; v: number; vw: number }) => ({
      timestamp: bar.t,
      date: new Date(bar.t).toISOString(),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw,
    }));

    return NextResponse.json({ bars, symbol: symbol.toUpperCase() });
  } catch (error) {
    console.error('Error fetching bars:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export with rate limiting (30 requests/minute) and timeout (15 seconds)
export const GET = withRateLimitAndTimeout(
  barsHandler,
  getEndpointUserKey('market-bars'),
  { limit: 30, windowSeconds: 60, timeoutMs: 15000 }
);
