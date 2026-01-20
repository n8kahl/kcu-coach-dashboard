/**
 * Chart Data API Endpoint
 *
 * Returns historical candle data with LTP analysis overlays for the
 * interactive chart modal in the AI Coach.
 *
 * GET /api/market-data/chart?symbol=TSLA&date=2026-01-17&timeframe=5m
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { marketDataService, type Bar, type KeyLevel } from '@/lib/market-data';
import logger from '@/lib/logger';

export interface ChartCandle {
  time: number; // Unix timestamp in seconds for lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PatienceCandle {
  time: number;
  direction: 'bullish' | 'bearish';
  confirmed: boolean;
}

export interface ChartDataResponse {
  symbol: string;
  date: string;
  timeframe: string;
  candles: ChartCandle[];
  keyLevels: Array<{
    type: string;
    price: number;
    label: string;
    strength: number;
  }>;
  patienceCandles: PatienceCandle[];
  indicators: {
    vwap: number | null;
    ema9: number | null;
    ema21: number | null;
    sma200: number | null;
  };
  ltpAnalysis: {
    grade: string;
    levelScore: number;
    trendScore: number;
    patienceScore: number;
    recommendation: string;
  } | null;
}

export async function GET(request: Request) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();
    const date = searchParams.get('date'); // YYYY-MM-DD
    const timeframe = searchParams.get('timeframe') || '5m';

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Check if service is configured
    if (!marketDataService.isConfigured()) {
      return NextResponse.json(
        { error: 'Market data service not configured' },
        { status: 503 }
      );
    }

    // Parse timeframe to API parameters
    let timespan = 'minute';
    let multiplier = 5;

    switch (timeframe) {
      case '1m':
        timespan = 'minute';
        multiplier = 1;
        break;
      case '5m':
        timespan = 'minute';
        multiplier = 5;
        break;
      case '15m':
        timespan = 'minute';
        multiplier = 15;
        break;
      case '1h':
        timespan = 'hour';
        multiplier = 1;
        break;
      case 'day':
        timespan = 'day';
        multiplier = 1;
        break;
    }

    logger.info('Fetching chart data', { symbol, date, timeframe });

    // Fetch historical bars for the specific date
    const bars = await marketDataService.getHistoricalBars(
      symbol,
      date,
      date,
      timespan,
      multiplier
    );

    if (!bars || bars.length === 0) {
      return NextResponse.json(
        {
          error: 'No data available',
          message: `No market data found for ${symbol} on ${date}. This might be a weekend or holiday.`,
        },
        { status: 404 }
      );
    }

    // Convert bars to chart candles (lightweight-charts format)
    // Filter out bars with invalid OHLC values to prevent chart errors
    const candles: ChartCandle[] = bars
      .filter((bar: Bar) =>
        bar.timestamp != null && isFinite(bar.timestamp) &&
        bar.open != null && isFinite(bar.open) &&
        bar.high != null && isFinite(bar.high) &&
        bar.low != null && isFinite(bar.low) &&
        bar.close != null && isFinite(bar.close)
      )
      .map((bar: Bar) => ({
        time: Math.floor(bar.timestamp / 1000), // Convert to seconds
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume || 0,
      }));

    // Get key levels
    const levels = await marketDataService.getKeyLevels(symbol);
    const keyLevels = (levels || []).map((level: KeyLevel) => ({
      type: level.type,
      price: level.price,
      label: formatLevelLabel(level.type),
      strength: level.strength,
    }));

    // Get LTP analysis for patience candles and scores
    const ltpAnalysis = await marketDataService.getLTPAnalysis(symbol);

    // Build patience candles from the analysis
    // Note: For historical data, we identify potential patience candles
    // by looking for reversal patterns in the bar data
    const patienceCandles: PatienceCandle[] = identifyPatienceCandles(bars);

    // Build response
    const response: ChartDataResponse = {
      symbol,
      date,
      timeframe,
      candles,
      keyLevels,
      patienceCandles,
      indicators: {
        vwap: ltpAnalysis?.levels.vwap ?? null,
        ema9: ltpAnalysis?.levels.ema9 ?? null,
        ema21: ltpAnalysis?.levels.ema21 ?? null,
        sma200: ltpAnalysis?.levels.sma200 ?? null,
      },
      ltpAnalysis: ltpAnalysis
        ? {
            grade: ltpAnalysis.grade,
            levelScore: ltpAnalysis.levels.levelScore,
            trendScore: ltpAnalysis.trend.trendScore,
            patienceScore: ltpAnalysis.patience.patienceScore,
            recommendation: ltpAnalysis.recommendation,
          }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Chart data API error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Format level type to human-readable label
 */
function formatLevelLabel(type: string): string {
  const labels: Record<string, string> = {
    pdh: 'PDH',
    pdl: 'PDL',
    vwap: 'VWAP',
    orb_high: 'ORB High',
    orb_low: 'ORB Low',
    ema9: 'EMA 9',
    ema21: 'EMA 21',
    sma200: 'SMA 200',
    support: 'Support',
    resistance: 'Resistance',
  };
  return labels[type] || type.toUpperCase();
}

/**
 * Identify potential patience candles in historical bar data
 * A patience candle shows buyers/sellers stepping in at a key level
 */
function identifyPatienceCandles(bars: Bar[]): PatienceCandle[] {
  const patienceCandles: PatienceCandle[] = [];

  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    const prevBar = bars[i - 1];

    // Calculate candle body and wick ratios
    const bodySize = Math.abs(bar.close - bar.open);
    const upperWick = bar.high - Math.max(bar.open, bar.close);
    const lowerWick = Math.min(bar.open, bar.close) - bar.low;
    const totalRange = bar.high - bar.low;

    if (totalRange === 0) continue;

    // Bullish patience candle: Long lower wick, buyers stepped in
    // After a down move (previous candle was red)
    if (
      lowerWick > bodySize * 1.5 &&
      lowerWick > upperWick * 2 &&
      prevBar.close < prevBar.open
    ) {
      patienceCandles.push({
        time: Math.floor(bar.timestamp / 1000),
        direction: 'bullish',
        confirmed: bar.close > bar.open,
      });
    }

    // Bearish patience candle: Long upper wick, sellers stepped in
    // After an up move (previous candle was green)
    if (
      upperWick > bodySize * 1.5 &&
      upperWick > lowerWick * 2 &&
      prevBar.close > prevBar.open
    ) {
      patienceCandles.push({
        time: Math.floor(bar.timestamp / 1000),
        direction: 'bearish',
        confirmed: bar.close < bar.open,
      });
    }
  }

  return patienceCandles;
}
