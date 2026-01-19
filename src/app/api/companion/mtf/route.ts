import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { marketDataService } from '@/lib/market-data';
import { calculateEMA } from '@/lib/ltp-engine';
import logger from '@/lib/logger';
import { withRateLimitAndTimeout, getEndpointUserKey } from '@/lib/rate-limit';

interface MTFAnalysis {
  timeframe: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  structure: 'uptrend' | 'downtrend' | 'range';
  ema_position: 'above_all' | 'below_all' | 'mixed';
  momentum: 'strong' | 'moderate' | 'weak';
  ema9: number;
  ema21: number;
  currentPrice: number;
  change: number;
}

const TIMEFRAME_CONFIG: Record<string, { multiplier: string; period: number; label: string }> = {
  '2m': { multiplier: '2', period: 60, label: '2 Min' },
  '5m': { multiplier: '5', period: 48, label: '5 Min' },
  '15m': { multiplier: '15', period: 32, label: '15 Min' },
  '1h': { multiplier: '60', period: 24, label: '1 Hour' },
  '4h': { multiplier: '240', period: 30, label: '4 Hour' },
  'daily': { multiplier: 'day', period: 50, label: 'Daily' },
  'weekly': { multiplier: 'week', period: 20, label: 'Weekly' },
};

/**
 * Analyze a single timeframe for a symbol
 */
async function analyzeTimeframe(symbol: string, timeframe: string): Promise<MTFAnalysis> {
  const config = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG['5m'];
  const bars = await marketDataService.getAggregates(symbol, config.multiplier, config.period);

  if (bars.length < 21) {
    return {
      timeframe,
      trend: 'neutral',
      structure: 'range',
      ema_position: 'mixed',
      momentum: 'weak',
      ema9: 0,
      ema21: 0,
      currentPrice: 0,
      change: 0,
    };
  }

  const closes = bars.map(b => b.c);
  const currentPrice = closes[closes.length - 1];
  const firstPrice = closes[0];

  // Calculate EMAs
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);

  // Determine trend
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (currentPrice > ema9 && ema9 > ema21) trend = 'bullish';
  else if (currentPrice < ema9 && ema9 < ema21) trend = 'bearish';

  // Determine structure (higher highs/lows or lower highs/lows)
  const highs = bars.slice(-5).map(b => b.h);
  const lows = bars.slice(-5).map(b => b.l);
  let structure: 'uptrend' | 'downtrend' | 'range' = 'range';

  const isHigherHighs = highs.every((h, i) => i === 0 || h >= highs[i - 1]);
  const isHigherLows = lows.every((l, i) => i === 0 || l >= lows[i - 1]);
  const isLowerHighs = highs.every((h, i) => i === 0 || h <= highs[i - 1]);
  const isLowerLows = lows.every((l, i) => i === 0 || l <= lows[i - 1]);

  if (isHigherHighs && isHigherLows) structure = 'uptrend';
  else if (isLowerHighs && isLowerLows) structure = 'downtrend';

  // EMA position
  let emaPosition: 'above_all' | 'below_all' | 'mixed' = 'mixed';
  if (currentPrice > ema9 && currentPrice > ema21) emaPosition = 'above_all';
  else if (currentPrice < ema9 && currentPrice < ema21) emaPosition = 'below_all';

  // Momentum
  const change = ((currentPrice - firstPrice) / firstPrice) * 100;
  let momentum: 'strong' | 'moderate' | 'weak' = 'weak';
  if (Math.abs(change) > 2) momentum = 'strong';
  else if (Math.abs(change) > 1) momentum = 'moderate';

  return {
    timeframe,
    trend,
    structure,
    ema_position: emaPosition,
    momentum,
    ema9,
    ema21,
    currentPrice,
    change,
  };
}

/**
 * Calculate overall MTF alignment score
 */
function calculateAlignmentScore(analyses: MTFAnalysis[], direction: 'bullish' | 'bearish'): number {
  let score = 0;
  const weights: Record<string, number> = {
    '2m': 5,
    '5m': 10,
    '15m': 15,
    '1h': 25,
    '4h': 20,
    'daily': 15,
    'weekly': 10,
  };

  for (const analysis of analyses) {
    const weight = weights[analysis.timeframe] || 10;

    // Trend alignment
    if (analysis.trend === direction) {
      score += weight;
    } else if (analysis.trend === 'neutral') {
      score += weight * 0.5;
    }

    // Structure alignment
    const structureMatch = direction === 'bullish' ? 'uptrend' : 'downtrend';
    if (analysis.structure === structureMatch) {
      score += weight * 0.3;
    }

    // EMA position alignment
    const emaMatch = direction === 'bullish' ? 'above_all' : 'below_all';
    if (analysis.ema_position === emaMatch) {
      score += weight * 0.2;
    }
  }

  // Normalize to 100
  const maxScore = Object.values(weights).reduce((a, b) => a + b, 0) * 1.5;
  return Math.round((score / maxScore) * 100);
}

/**
 * GET /api/companion/mtf
 * Get multi-timeframe analysis for a symbol
 */
async function mtfHandler(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if market data API is configured
    if (!marketDataService.isConfigured()) {
      return NextResponse.json({
        error: 'Market data not configured',
        detail: 'MASSIVE_API_KEY environment variable is not set'
      }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframes = searchParams.get('timeframes')?.split(',') || ['5m', '15m', '1h', '4h', 'daily'];

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter required' }, { status: 400 });
    }

    logger.info('Running MTF analysis', { symbol, timeframes });

    // Analyze all requested timeframes
    const analyses: MTFAnalysis[] = [];
    for (const tf of timeframes) {
      if (TIMEFRAME_CONFIG[tf]) {
        try {
          const analysis = await analyzeTimeframe(symbol, tf);
          analyses.push(analysis);
        } catch (error) {
          logger.warn('Error analyzing timeframe', { symbol, timeframe: tf, error: String(error) });
        }
      }
    }

    if (analyses.length === 0) {
      return NextResponse.json({
        error: 'No data available',
        detail: 'Could not analyze any timeframes for this symbol'
      }, { status: 404 });
    }

    // Determine overall bias based on higher timeframes
    const htfAnalyses = analyses.filter(a => ['1h', '4h', 'daily', 'weekly'].includes(a.timeframe));
    const bullishCount = htfAnalyses.filter(a => a.trend === 'bullish').length;
    const bearishCount = htfAnalyses.filter(a => a.trend === 'bearish').length;
    const overallBias: 'bullish' | 'bearish' | 'neutral' =
      bullishCount > bearishCount ? 'bullish' :
      bearishCount > bullishCount ? 'bearish' : 'neutral';

    // Calculate alignment scores
    const bullishAlignment = calculateAlignmentScore(analyses, 'bullish');
    const bearishAlignment = calculateAlignmentScore(analyses, 'bearish');

    // Format analyses with labels
    const formattedAnalyses = analyses.map(a => ({
      ...a,
      label: TIMEFRAME_CONFIG[a.timeframe]?.label || a.timeframe,
    }));

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      analyses: formattedAnalyses,
      summary: {
        overallBias,
        bullishAlignment,
        bearishAlignment,
        recommendation: overallBias !== 'neutral'
          ? `${overallBias.charAt(0).toUpperCase() + overallBias.slice(1)} bias with ${overallBias === 'bullish' ? bullishAlignment : bearishAlignment}% alignment`
          : 'No clear directional bias - wait for alignment',
        tradeable: (overallBias === 'bullish' && bullishAlignment >= 60) ||
                   (overallBias === 'bearish' && bearishAlignment >= 60),
      },
      analyzedAt: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Error in MTF analysis', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({
      error: 'Internal server error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Export with rate limiting (10 requests/minute) and timeout (30 seconds)
export const GET = withRateLimitAndTimeout(
  mtfHandler,
  getEndpointUserKey('companion-mtf'),
  { limit: 10, windowSeconds: 60, timeoutMs: 30000 }
);
