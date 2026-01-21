/**
 * LTP 2.0 Gamma Engine
 *
 * Enhanced scoring system that combines traditional LTP (Level, Trend, Patience)
 * with institutional Gamma exposure data for better trade setups.
 */

export interface MarketContext {
  // Price data
  currentPrice: number;
  previousClose: number;

  // EMAs for trend cloud
  ema8: number;
  ema21: number;

  // VWAP
  vwap: number;

  // Gamma levels from Massive
  callWall: number;
  putWall: number;
  zeroGamma: number;
  gammaExposure: number; // Positive = bullish regime, Negative = bearish

  // Patience candle detection
  hasPatienceCandle: boolean;
  patienceDirection?: 'bullish' | 'bearish';

  // Optional: Previous candle data for inside bar detection
  previousHigh?: number;
  previousLow?: number;
  currentHigh?: number;
  currentLow?: number;
}

export interface LTP2Score {
  score: number;
  grade: 'Sniper' | 'Decent' | 'Dumb Shit';
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100, based on how many factors align
  breakdown: ScoreBreakdown;
  warnings: string[];
  recommendation: string;
}

export interface ScoreBreakdown {
  cloudScore: number;
  vwapScore: number;
  gammaWallScore: number;
  gammaRegimeScore: number;
  patienceScore: number;
  resistancePenalty: number;
  total: number;
}

// Score weights
const WEIGHTS = {
  BULLISH_CLOUD: 25,       // 8 EMA > 21 EMA
  BEARISH_CLOUD: 25,       // 8 EMA < 21 EMA (for shorts)
  ABOVE_VWAP: 20,          // Price > VWAP
  BELOW_VWAP: 20,          // Price < VWAP (for shorts)
  ABOVE_PUT_WALL: 20,      // Price > Put Wall (support)
  BELOW_CALL_WALL: 20,     // Price < Call Wall (resistance) - for shorts
  POSITIVE_GAMMA: 15,      // Gamma > 0 (bullish regime)
  NEGATIVE_GAMMA: 15,      // Gamma < 0 (bearish regime) - for shorts
  PATIENCE_CANDLE: 10,     // Inside bar / patience candle confirmed
  RESISTANCE_PENALTY: -20, // Too close to Call Wall
  SUPPORT_PENALTY: -20,    // Too close to Put Wall (for shorts)
} as const;

// Grade thresholds
const GRADE_THRESHOLDS = {
  SNIPER: 75,
  DECENT: 50,
} as const;

/**
 * Calculate LTP 2.0 Score for bullish setups
 */
export function calculateLTP2Score(context: MarketContext): LTP2Score {
  const breakdown: ScoreBreakdown = {
    cloudScore: 0,
    vwapScore: 0,
    gammaWallScore: 0,
    gammaRegimeScore: 0,
    patienceScore: 0,
    resistancePenalty: 0,
    total: 0,
  };

  const warnings: string[] = [];
  let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';

  // Determine trend direction from EMA cloud
  const isBullishCloud = context.ema8 > context.ema21;
  const isBearishCloud = context.ema8 < context.ema21;

  if (isBullishCloud) {
    direction = 'bullish';
  } else if (isBearishCloud) {
    direction = 'bearish';
  }

  // --- BULLISH SCORING ---
  if (direction === 'bullish' || direction === 'neutral') {
    // +25: Bullish Cloud (8 EMA > 21 EMA)
    if (isBullishCloud) {
      breakdown.cloudScore = WEIGHTS.BULLISH_CLOUD;
    }

    // +20: Price > VWAP
    if (context.currentPrice > context.vwap) {
      breakdown.vwapScore = WEIGHTS.ABOVE_VWAP;
    }

    // +20: Price > Put Wall (holding above support)
    if (context.currentPrice > context.putWall) {
      breakdown.gammaWallScore = WEIGHTS.ABOVE_PUT_WALL;
    } else {
      warnings.push('Price below Put Wall support');
    }

    // +15: Positive Gamma Regime
    if (context.gammaExposure > 0) {
      breakdown.gammaRegimeScore = WEIGHTS.POSITIVE_GAMMA;
    } else {
      warnings.push('Negative gamma regime - expect volatility');
    }

    // +10: Patience Candle detected
    if (context.hasPatienceCandle && context.patienceDirection === 'bullish') {
      breakdown.patienceScore = WEIGHTS.PATIENCE_CANDLE;
    }

    // -20: Approaching Call Wall resistance (within 1%)
    const callWallProximity = context.callWall * 0.99;
    if (context.currentPrice > callWallProximity) {
      breakdown.resistancePenalty = WEIGHTS.RESISTANCE_PENALTY;
      warnings.push('Approaching Call Wall resistance - watch for rejection');
    }
  }

  // --- BEARISH SCORING ---
  if (direction === 'bearish') {
    // +25: Bearish Cloud (8 EMA < 21 EMA)
    if (isBearishCloud) {
      breakdown.cloudScore = WEIGHTS.BEARISH_CLOUD;
    }

    // +20: Price < VWAP
    if (context.currentPrice < context.vwap) {
      breakdown.vwapScore = WEIGHTS.BELOW_VWAP;
    }

    // +20: Price < Call Wall (below resistance)
    if (context.currentPrice < context.callWall) {
      breakdown.gammaWallScore = WEIGHTS.BELOW_CALL_WALL;
    }

    // +15: Negative Gamma Regime (more volatility = better for shorts)
    if (context.gammaExposure < 0) {
      breakdown.gammaRegimeScore = WEIGHTS.NEGATIVE_GAMMA;
    }

    // +10: Patience Candle detected (bearish)
    if (context.hasPatienceCandle && context.patienceDirection === 'bearish') {
      breakdown.patienceScore = WEIGHTS.PATIENCE_CANDLE;
    }

    // -20: Approaching Put Wall support (within 1%)
    const putWallProximity = context.putWall * 1.01;
    if (context.currentPrice < putWallProximity) {
      breakdown.resistancePenalty = WEIGHTS.SUPPORT_PENALTY;
      warnings.push('Approaching Put Wall support - watch for bounce');
    }
  }

  // Calculate total score (clamped 0-90, max possible score is 90)
  breakdown.total = Math.max(0, Math.min(90,
    breakdown.cloudScore +
    breakdown.vwapScore +
    breakdown.gammaWallScore +
    breakdown.gammaRegimeScore +
    breakdown.patienceScore +
    breakdown.resistancePenalty
  ));

  // Determine grade
  let grade: LTP2Score['grade'];
  if (breakdown.total >= GRADE_THRESHOLDS.SNIPER) {
    grade = 'Sniper';
  } else if (breakdown.total >= GRADE_THRESHOLDS.DECENT) {
    grade = 'Decent';
  } else {
    grade = 'Dumb Shit';
  }

  // Generate recommendation
  const recommendation = generateRecommendation(breakdown, direction, warnings);

  // Calculate confidence (how many factors are aligned)
  let alignedFactors = 0;
  let totalFactors = 5;
  if (breakdown.cloudScore > 0) alignedFactors++;
  if (breakdown.vwapScore > 0) alignedFactors++;
  if (breakdown.gammaWallScore > 0) alignedFactors++;
  if (breakdown.gammaRegimeScore > 0) alignedFactors++;
  if (breakdown.patienceScore > 0) alignedFactors++;
  const confidence = Math.round((alignedFactors / totalFactors) * 100);

  return {
    score: breakdown.total,
    grade,
    direction,
    confidence,
    breakdown,
    warnings,
    recommendation,
  };
}

/**
 * Detect if current candle is a patience (inside) candle
 */
export function detectPatienceCandle(
  previousHigh: number,
  previousLow: number,
  currentHigh: number,
  currentLow: number,
  currentClose: number,
  currentOpen: number
): { isPatienceCandle: boolean; direction: 'bullish' | 'bearish' | null } {
  // Inside bar: current high < previous high AND current low > previous low
  const isInsideBar = currentHigh < previousHigh && currentLow > previousLow;

  if (!isInsideBar) {
    return { isPatienceCandle: false, direction: null };
  }

  // Determine direction based on close vs open
  const isBullish = currentClose > currentOpen;

  return {
    isPatienceCandle: true,
    direction: isBullish ? 'bullish' : 'bearish',
  };
}

/**
 * Calculate EMAs from price data
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) return prices[prices.length - 1];

  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Generate human-readable recommendation
 */
function generateRecommendation(
  breakdown: ScoreBreakdown,
  direction: 'bullish' | 'bearish' | 'neutral',
  warnings: string[]
): string {
  if (breakdown.total >= GRADE_THRESHOLDS.SNIPER) {
    const dirText = direction === 'bullish' ? 'long' : direction === 'bearish' ? 'short' : 'position';
    return `Sniper setup. Valid ${dirText} at current levels. All confluence factors aligned.`;
  }

  if (breakdown.total >= GRADE_THRESHOLDS.DECENT) {
    if (warnings.length > 0) {
      return `Decent setup but watch for: ${warnings[0]}. Consider smaller size.`;
    }
    return `Decent setup. Missing some confluence. Trade with caution.`;
  }

  // Dumb Shit score
  if (breakdown.resistancePenalty < 0) {
    return direction === 'bullish'
      ? `Chasing tops near Call Wall. Wait for pullback to VWAP.`
      : `Chasing lows near Put Wall. Wait for bounce rejection.`;
  }

  if (breakdown.cloudScore === 0) {
    return `No clear trend. Sit on hands and wait for direction.`;
  }

  return `Low probability setup. Multiple factors missing. Stay patient.`;
}

/**
 * Create MarketContext from chart data and Massive API response
 */
export function createMarketContext(
  chartData: {
    close: number;
    high: number;
    low: number;
    open: number;
    previousClose?: number;
    previousHigh?: number;
    previousLow?: number;
  },
  emaData: {
    ema8: number;
    ema21: number;
  },
  vwap: number,
  gammaData: {
    callWall: number;
    putWall: number;
    zeroGamma: number;
    gammaExposure: number;
  },
  patienceCandle?: {
    detected: boolean;
    direction: 'bullish' | 'bearish';
  }
): MarketContext {
  return {
    currentPrice: chartData.close,
    previousClose: chartData.previousClose ?? chartData.close,
    ema8: emaData.ema8,
    ema21: emaData.ema21,
    vwap,
    callWall: gammaData.callWall,
    putWall: gammaData.putWall,
    zeroGamma: gammaData.zeroGamma,
    gammaExposure: gammaData.gammaExposure,
    hasPatienceCandle: patienceCandle?.detected ?? false,
    patienceDirection: patienceCandle?.direction,
    previousHigh: chartData.previousHigh,
    previousLow: chartData.previousLow,
    currentHigh: chartData.high,
    currentLow: chartData.low,
  };
}

// Export grade thresholds for external use
export { GRADE_THRESHOLDS, WEIGHTS };
