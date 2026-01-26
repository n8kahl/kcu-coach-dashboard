/**
 * LTP Analysis API Endpoint
 *
 * Provides comprehensive Level, Trend, Patience analysis for a symbol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { marketDataService } from '@/lib/market-data';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    // Get comprehensive LTP analysis
    const analysis = await marketDataService.getLTPAnalysis(symbol.toUpperCase());

    if (!analysis) {
      return NextResponse.json(
        { error: 'Unable to fetch analysis for symbol' },
        { status: 404 }
      );
    }

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('[LTP API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[LTP API] Stack:', errorStack);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
