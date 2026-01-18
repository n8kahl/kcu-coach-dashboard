import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// GET - Fetch real-time quote from Massive.com
export async function GET(request: Request) {
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
      `https://api.massive.com/v1/snapshot/stocks/tickers/${symbol.toUpperCase()}?apikey=${apiKey}`
    );

    if (!response.ok) {
      console.error('Massive API error:', response.status);
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
