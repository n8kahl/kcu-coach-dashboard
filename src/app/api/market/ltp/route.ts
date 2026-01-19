/**
 * LTP Analysis API Endpoint
 *
 * Provides comprehensive Level, Trend, Patience analysis for a symbol
 */

import { NextRequest, NextResponse } from 'next/server';
import { marketDataService } from '@/lib/market-data';

export async function GET(request: NextRequest) {
  try {
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
