import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withRateLimitAndTimeout, getEndpointUserKey } from '@/lib/rate-limit';

// GET - Fetch real-time quote from Massive.com
async function quoteHandler(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
    }

    const apiKey = process.env.MASSIVE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Market data not configured' }, { status: 503 });
    }

    const response = await fetch(
      `https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers/${symbol.toUpperCase()}?apiKey=${apiKey}`
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error');
      console.error(`Massive API error for ${symbol}: ${response.status} - ${errorText}`);
      return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
    }

    const data = await response.json();

    if (!data?.ticker) {
      return NextResponse.json({ error: 'Symbol not found' }, { status: 404 });
    }

    const t = data.ticker;
    const quote = {
      symbol: t.ticker,
      price: t.lastTrade?.p || t.prevDay?.c,
      change: t.todaysChange,
      changePercent: t.todaysChangePerc,
      open: t.day?.o,
      high: t.day?.h,
      low: t.day?.l,
      volume: t.day?.v,
      vwap: t.day?.vw,
      prevClose: t.prevDay?.c,
      prevHigh: t.prevDay?.h,
      prevLow: t.prevDay?.l,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('Error fetching quote:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export with rate limiting (60 requests/minute) and timeout (10 seconds)
export const GET = withRateLimitAndTimeout(
  quoteHandler,
  getEndpointUserKey('market-quote'),
  { limit: 60, windowSeconds: 60, timeoutMs: 10000 }
);
