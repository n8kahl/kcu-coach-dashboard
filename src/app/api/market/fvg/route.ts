/**
 * Fair Value Gap (FVG) API Endpoint
 *
 * Provides FVG analysis for symbols across multiple timeframes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fvgDetector } from '@/lib/fvg-detector';

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

    const analysis = await fvgDetector.getFullAnalysis(symbol.toUpperCase());

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('[FVG API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST endpoint for batch FVG analysis
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols } = body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: 'Symbols array is required' },
        { status: 400 }
      );
    }

    // Limit to 5 symbols for performance
    const limitedSymbols = symbols.slice(0, 5);

    const results: Record<string, Awaited<ReturnType<typeof fvgDetector.getFullAnalysis>> | { error: string }> = {};

    for (const symbol of limitedSymbols) {
      try {
        results[symbol.toUpperCase()] = await fvgDetector.getFullAnalysis(symbol.toUpperCase());
      } catch {
        results[symbol.toUpperCase()] = { error: 'Failed to analyze' };
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[FVG API] Batch Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
