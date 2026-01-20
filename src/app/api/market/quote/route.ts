import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withRateLimitAndTimeout, getEndpointUserKey } from '@/lib/rate-limit';

// Index symbols that need the v3 indices endpoint
const INDEX_SYMBOLS = ['VIX', 'SPX', 'NDX', 'DJI', 'RUT', 'DXY', 'TNX'];

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

    const upperSymbol = symbol.toUpperCase();
    const isIndex = INDEX_SYMBOLS.includes(upperSymbol);

    let quote;

    if (isIndex) {
      // Use v3 indices endpoint for VIX, SPX, etc.
      const indexTicker = `I:${upperSymbol}`;
      const response = await fetch(
        `https://api.massive.com/v3/snapshot/indices?ticker.any_of=${indexTicker}&apiKey=${apiKey}`
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error');
        console.error(`Massive API error for ${symbol}: ${response.status} - ${errorText}`);
        return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
      }

      const data = await response.json();
      const result = data.results?.[0];

      if (!result) {
        return NextResponse.json({ error: 'Symbol not found' }, { status: 404 });
      }

      quote = {
        symbol: upperSymbol,
        price: result.value || result.session?.close || 0,
        change: result.session?.change || 0,
        changePercent: result.session?.change_percent || 0,
        open: result.session?.open || 0,
        high: result.session?.high || 0,
        low: result.session?.low || 0,
        volume: 0,
        vwap: 0,
        prevClose: result.session?.previous_close || 0,
        prevHigh: 0,
        prevLow: 0,
        timestamp: result.last_updated
          ? new Date(result.last_updated / 1000000).toISOString()
          : new Date().toISOString(),
      };
    } else {
      // Use v2 stocks snapshot for regular stocks
      const response = await fetch(
        `https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers/${upperSymbol}?apiKey=${apiKey}`
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
      quote = {
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
    }

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
