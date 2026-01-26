/**
 * LTP 2.0 Gamma Engine
 *
 * Enhanced scoring system that combines traditional LTP (Level, Trend, Patience)
 * with institutional Gamma exposure data for better trade setups.
 *
 * v2.1: Graduated scoring + hysteresis for stability
 * - Distance-based VWAP scoring (no binary flips)
 * - Graduated gamma wall penalties
 * - EMA cloud buffer zone to prevent oscillation
 * - Score hysteresis requiring sustained moves to change grade
 * - Enhanced patience candle detection at key levels
 */

import { safeDivideValue } from './number';

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
  /** Stability information for hysteresis */
  stability?: {
    /** Whether grade is being held due to hysteresis */
    gradeLocked: boolean;
    /** Raw score before smoothing */
    rawScore: number;
    /** Number of candles at current grade */
    candlesAtGrade: number;
    /** Trend strength indicator */
    cloudStrength: 'strong' | 'moderate' | 'weak' | 'neutral';
  };
}

/** State for score hysteresis - pass previous state to get stable grades */
export interface ScoreHysteresisState {
  previousGrade: LTP2Score['grade'] | null;
  previousScores: number[];
  candlesAtGrade: number;
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

// Hysteresis buffer - points required to cross grade boundary
const HYSTERESIS_BUFFER = 5;

// ============================================================================
// GRADUATED SCORING HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate VWAP score with graduated distance-based scoring
 * Prevents binary flips when price oscillates around VWAP
 */
function calculateVwapScore(
  currentPrice: number,
  vwap: number,
  direction: 'bullish' | 'bearish' | 'neutral'
): { score: number; distancePercent: number } {
  if (vwap <= 0) return { score: 0, distancePercent: 0 };

  const maxScore = WEIGHTS.ABOVE_VWAP; // 20 points max
  const distancePercent = ((currentPrice - vwap) / vwap) * 100;
  const absDistance = Math.abs(distancePercent);

  // Determine if price is on the "right" side for the direction
  const isAligned = direction === 'bullish'
    ? distancePercent > 0
    : direction === 'bearish'
    ? distancePercent < 0
    : true; // neutral accepts either

  if (!isAligned) {
    // Wrong side - give small partial credit if very close (within 0.1%)
    if (absDistance <= 0.1) {
      return { score: Math.round(maxScore * 0.25), distancePercent };
    }
    return { score: 0, distancePercent };
  }

  // Right side - graduated scoring based on distance
  if (absDistance >= 0.5) return { score: maxScore, distancePercent };      // 20 pts: Strong (≥0.5%)
  if (absDistance >= 0.3) return { score: Math.round(maxScore * 0.9), distancePercent }; // 18 pts
  if (absDistance >= 0.15) return { score: Math.round(maxScore * 0.75), distancePercent }; // 15 pts
  if (absDistance >= 0.05) return { score: Math.round(maxScore * 0.6), distancePercent }; // 12 pts
  return { score: Math.round(maxScore * 0.5), distancePercent }; // 10 pts: Right side but very close
}

/**
 * Calculate gamma wall penalty with graduated distance-based scoring
 * Prevents sudden -20 penalty when approaching wall
 */
function calculateGammaWallPenalty(
  currentPrice: number,
  opposingWall: number,
  direction: 'bullish' | 'bearish'
): { penalty: number; distancePercent: number } {
  if (opposingWall <= 0 || currentPrice <= 0) {
    return { penalty: 0, distancePercent: 100 };
  }

  // For bullish, we're worried about call wall (resistance above)
  // For bearish, we're worried about put wall (support below)
  const distancePercent = direction === 'bullish'
    ? ((opposingWall - currentPrice) / currentPrice) * 100
    : ((currentPrice - opposingWall) / currentPrice) * 100;

  // Graduated penalty based on distance
  if (distancePercent >= 2.0) return { penalty: 0, distancePercent };    // No penalty
  if (distancePercent >= 1.5) return { penalty: -5, distancePercent };   // Light warning
  if (distancePercent >= 1.0) return { penalty: -10, distancePercent };  // Moderate
  if (distancePercent >= 0.5) return { penalty: -15, distancePercent };  // Strong warning
  return { penalty: -20, distancePercent };                               // At the wall
}

/**
 * Calculate EMA cloud score with buffer zone to prevent oscillation
 * Neutral zone prevents rapid grade changes when EMAs are close
 */
function calculateCloudScore(
  ema8: number,
  ema21: number
): { score: number; strength: 'strong' | 'moderate' | 'weak' | 'neutral'; direction: 'bullish' | 'bearish' | 'neutral' } {
  if (ema21 <= 0) return { score: 0, strength: 'neutral', direction: 'neutral' };

  const maxScore = WEIGHTS.BULLISH_CLOUD; // 25 points max
  const spreadPercent = ((ema8 - ema21) / ema21) * 100;
  const absSpread = Math.abs(spreadPercent);

  // Neutral zone - EMAs within 0.1% are considered "crossed" / indeterminate
  if (absSpread < 0.1) {
    return { score: Math.round(maxScore * 0.3), strength: 'neutral', direction: 'neutral' };
  }

  const direction: 'bullish' | 'bearish' = spreadPercent > 0 ? 'bullish' : 'bearish';

  // Graduated based on spread size
  if (absSpread >= 0.5) return { score: maxScore, strength: 'strong', direction };      // 25 pts
  if (absSpread >= 0.3) return { score: Math.round(maxScore * 0.85), strength: 'moderate', direction }; // ~21 pts
  if (absSpread >= 0.15) return { score: Math.round(maxScore * 0.7), strength: 'weak', direction }; // ~18 pts
  return { score: Math.round(maxScore * 0.5), strength: 'weak', direction }; // ~12 pts
}

/**
 * Apply hysteresis to prevent rapid grade oscillation
 * Requires sustained score movement to change grade
 */
function applyHysteresis(
  rawScore: number,
  hysteresisState: ScoreHysteresisState | undefined
): {
  smoothedScore: number;
  effectiveGrade: LTP2Score['grade'];
  gradeLocked: boolean;
  candlesAtGrade: number;
} {
  if (!hysteresisState || hysteresisState.previousGrade === null) {
    // No previous state - use standard thresholds
    const effectiveGrade: LTP2Score['grade'] =
      rawScore >= GRADE_THRESHOLDS.SNIPER ? 'Sniper' :
      rawScore >= GRADE_THRESHOLDS.DECENT ? 'Decent' : 'Dumb Shit';
    return { smoothedScore: rawScore, effectiveGrade, gradeLocked: false, candlesAtGrade: 1 };
  }

  const { previousGrade, previousScores, candlesAtGrade } = hysteresisState;

  // Average recent scores for smoothing (last 3 + current)
  const recentScores = [...previousScores.slice(-3), rawScore];
  const smoothedScore = Math.round(
    recentScores.reduce((a, b) => a + b, 0) / recentScores.length
  );

  let effectiveGrade: LTP2Score['grade'];
  let gradeLocked = false;

  // Apply hysteresis based on previous grade
  if (previousGrade === 'Sniper') {
    // Harder to lose Sniper - need to drop below threshold minus buffer
    if (smoothedScore >= GRADE_THRESHOLDS.SNIPER - HYSTERESIS_BUFFER) {
      effectiveGrade = 'Sniper';
      gradeLocked = smoothedScore < GRADE_THRESHOLDS.SNIPER;
    } else if (smoothedScore >= GRADE_THRESHOLDS.DECENT) {
      effectiveGrade = 'Decent';
    } else {
      effectiveGrade = 'Dumb Shit';
    }
  } else if (previousGrade === 'Decent') {
    // Need clear break above Sniper threshold to upgrade
    if (smoothedScore >= GRADE_THRESHOLDS.SNIPER) {
      effectiveGrade = 'Sniper';
    } else if (smoothedScore >= GRADE_THRESHOLDS.DECENT - HYSTERESIS_BUFFER) {
      effectiveGrade = 'Decent';
      gradeLocked = smoothedScore < GRADE_THRESHOLDS.DECENT;
    } else {
      effectiveGrade = 'Dumb Shit';
    }
  } else {
    // Dumb Shit - standard thresholds to escape
    effectiveGrade =
      smoothedScore >= GRADE_THRESHOLDS.SNIPER ? 'Sniper' :
      smoothedScore >= GRADE_THRESHOLDS.DECENT ? 'Decent' : 'Dumb Shit';
  }

  const newCandlesAtGrade = effectiveGrade === previousGrade ? candlesAtGrade + 1 : 1;

  return { smoothedScore, effectiveGrade, gradeLocked, candlesAtGrade: newCandlesAtGrade };
}

/**
 * Enhanced patience candle detection with quality and level proximity
 */
export interface PatienceCandleResult {
  isPatienceCandle: boolean;
  direction: 'bullish' | 'bearish' | null;
  quality: 'high' | 'medium' | 'low';
  atLevel: boolean;
  score: number;
}

function detectEnhancedPatienceCandle(
  prevHigh: number,
  prevLow: number,
  currHigh: number,
  currLow: number,
  currClose: number,
  currOpen: number,
  keyLevels: { vwap?: number; putWall?: number; callWall?: number }
): PatienceCandleResult {
  const isInsideBar = currHigh < prevHigh && currLow > prevLow;
  const maxScore = WEIGHTS.PATIENCE_CANDLE; // 10 points

  if (!isInsideBar) {
    return { isPatienceCandle: false, direction: null, quality: 'low', atLevel: false, score: 0 };
  }

  // Direction based on close vs open
  const direction: 'bullish' | 'bearish' = currClose > currOpen ? 'bullish' : 'bearish';

  // Quality based on body size and compression
  const bodySize = Math.abs(currClose - currOpen);
  const range = currHigh - currLow;
  const prevRange = prevHigh - prevLow;
  const bodyRatio = range > 0 ? bodySize / range : 0;
  const compression = prevRange > 0 ? range / prevRange : 1;

  let quality: 'high' | 'medium' | 'low';
  if (bodyRatio < 0.35 && compression < 0.5) {
    quality = 'high';
  } else if (bodyRatio < 0.5 && compression < 0.7) {
    quality = 'medium';
  } else {
    quality = 'low';
  }

  // Check if at a key level (within 0.3%)
  const midPrice = (currHigh + currLow) / 2;
  const levels = [keyLevels.vwap, keyLevels.putWall, keyLevels.callWall].filter(
    (l): l is number => l !== undefined && l > 0
  );
  const atLevel = levels.some(level => Math.abs((midPrice - level) / level) <= 0.003);

  // Calculate score with quality and level multipliers
  const qualityMultiplier = quality === 'high' ? 1.0 : quality === 'medium' ? 0.7 : 0.4;
  const levelMultiplier = atLevel ? 1.0 : 0.5; // Half points if not at a key level
  const score = Math.round(maxScore * qualityMultiplier * levelMultiplier);

  return { isPatienceCandle: true, direction, quality, atLevel, score };
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate LTP 2.0 Score with graduated scoring and optional hysteresis
 * @param context Market data context
 * @param hysteresisState Optional previous state for score smoothing
 */
export function calculateLTP2Score(
  context: MarketContext,
  hysteresisState?: ScoreHysteresisState
): LTP2Score {
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

  // --- GRADUATED CLOUD SCORING ---
  // Uses buffer zone to prevent oscillation when EMAs are close
  const cloudResult = calculateCloudScore(context.ema8, context.ema21);
  breakdown.cloudScore = cloudResult.score;
  const direction = cloudResult.direction;
  const cloudStrength = cloudResult.strength;

  // --- GRADUATED VWAP SCORING ---
  // Distance-based scoring prevents binary flip on single ticks
  const vwapResult = calculateVwapScore(context.currentPrice, context.vwap, direction);
  breakdown.vwapScore = vwapResult.score;

  // --- GAMMA WALL POSITION SCORING ---
  // For bullish: above put wall = good, for bearish: below call wall = good
  if (direction === 'bullish' || direction === 'neutral') {
    if (context.currentPrice > context.putWall) {
      breakdown.gammaWallScore = WEIGHTS.ABOVE_PUT_WALL;
    } else {
      warnings.push('Price below Put Wall support');
    }
  } else {
    if (context.currentPrice < context.callWall) {
      breakdown.gammaWallScore = WEIGHTS.BELOW_CALL_WALL;
    }
  }

  // --- GAMMA REGIME SCORING ---
  if (direction === 'bullish' || direction === 'neutral') {
    if (context.gammaExposure > 0) {
      breakdown.gammaRegimeScore = WEIGHTS.POSITIVE_GAMMA;
    } else {
      warnings.push('Negative gamma regime - expect volatility');
    }
  } else {
    // Bearish - negative gamma is actually preferred
    if (context.gammaExposure < 0) {
      breakdown.gammaRegimeScore = WEIGHTS.NEGATIVE_GAMMA;
    }
  }

  // --- ENHANCED PATIENCE CANDLE SCORING ---
  // Only gives full points for quality inside bars AT key levels
  if (context.previousHigh !== undefined && context.previousLow !== undefined &&
      context.currentHigh !== undefined && context.currentLow !== undefined) {
    const patienceResult = detectEnhancedPatienceCandle(
      context.previousHigh,
      context.previousLow,
      context.currentHigh,
      context.currentLow,
      context.currentPrice, // close
      context.previousClose, // open approximation (use current open if available)
      {
        vwap: context.vwap,
        putWall: context.putWall,
        callWall: context.callWall,
      }
    );

    // Only count if direction matches
    if (patienceResult.isPatienceCandle) {
      if (direction === 'neutral' ||
          (direction === 'bullish' && patienceResult.direction === 'bullish') ||
          (direction === 'bearish' && patienceResult.direction === 'bearish')) {
        breakdown.patienceScore = patienceResult.score;
      }
    }
  } else if (context.hasPatienceCandle) {
    // Fallback to simple patience flag
    if (direction === 'neutral' ||
        (direction === 'bullish' && context.patienceDirection === 'bullish') ||
        (direction === 'bearish' && context.patienceDirection === 'bearish')) {
      breakdown.patienceScore = WEIGHTS.PATIENCE_CANDLE;
    }
  }

  // --- GRADUATED RESISTANCE PENALTY ---
  // Graduated penalty based on distance to opposing wall
  if (direction === 'bullish' || direction === 'neutral') {
    const penaltyResult = calculateGammaWallPenalty(
      context.currentPrice,
      context.callWall,
      'bullish'
    );
    breakdown.resistancePenalty = penaltyResult.penalty;
    if (penaltyResult.penalty < 0) {
      const severity = penaltyResult.penalty <= -15 ? 'watch for rejection' :
                       penaltyResult.penalty <= -10 ? 'approaching resistance' :
                       'nearing Call Wall';
      warnings.push(`${penaltyResult.distancePercent.toFixed(1)}% from Call Wall - ${severity}`);
    }
  } else {
    const penaltyResult = calculateGammaWallPenalty(
      context.currentPrice,
      context.putWall,
      'bearish'
    );
    breakdown.resistancePenalty = penaltyResult.penalty;
    if (penaltyResult.penalty < 0) {
      const severity = penaltyResult.penalty <= -15 ? 'watch for bounce' :
                       penaltyResult.penalty <= -10 ? 'approaching support' :
                       'nearing Put Wall';
      warnings.push(`${penaltyResult.distancePercent.toFixed(1)}% from Put Wall - ${severity}`);
    }
  }

  // Calculate raw total score (clamped 0-90)
  const rawTotal = Math.max(0, Math.min(90,
    breakdown.cloudScore +
    breakdown.vwapScore +
    breakdown.gammaWallScore +
    breakdown.gammaRegimeScore +
    breakdown.patienceScore +
    breakdown.resistancePenalty
  ));
  breakdown.total = rawTotal;

  // --- APPLY HYSTERESIS ---
  // Smooths score and applies grade stickiness
  const hysteresisResult = applyHysteresis(rawTotal, hysteresisState);
  const grade = hysteresisResult.effectiveGrade;
  const smoothedScore = hysteresisResult.smoothedScore;

  // Update total with smoothed score (if hysteresis is active)
  if (hysteresisState) {
    breakdown.total = smoothedScore;
  }

  // Generate recommendation
  const recommendation = generateRecommendation(breakdown, direction, warnings);

  // Calculate confidence with weighted scoring
  // Higher confidence = more factors aligned AND stronger alignment
  let confidenceScore = 0;
  const maxConfidence = 100;

  // Cloud strength contributes 0-30%
  if (cloudStrength === 'strong') confidenceScore += 30;
  else if (cloudStrength === 'moderate') confidenceScore += 20;
  else if (cloudStrength === 'weak') confidenceScore += 10;

  // VWAP alignment contributes 0-25%
  confidenceScore += Math.round((breakdown.vwapScore / WEIGHTS.ABOVE_VWAP) * 25);

  // Gamma wall position contributes 0-20%
  confidenceScore += Math.round((breakdown.gammaWallScore / WEIGHTS.ABOVE_PUT_WALL) * 20);

  // Gamma regime contributes 0-15%
  confidenceScore += Math.round((breakdown.gammaRegimeScore / WEIGHTS.POSITIVE_GAMMA) * 15);

  // Patience contributes 0-10%
  confidenceScore += Math.round((breakdown.patienceScore / WEIGHTS.PATIENCE_CANDLE) * 10);

  const confidence = Math.min(maxConfidence, confidenceScore);

  return {
    score: breakdown.total,
    grade,
    direction,
    confidence,
    breakdown,
    warnings,
    recommendation,
    stability: {
      gradeLocked: hysteresisResult.gradeLocked,
      rawScore: rawTotal,
      candlesAtGrade: hysteresisResult.candlesAtGrade,
      cloudStrength,
    },
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
  if (prices.length === 0 || period <= 0) return 0;
  if (prices.length < period) return prices[prices.length - 1];

  const multiplier = 2 / (period + 1);
  let ema = safeDivideValue(prices.slice(0, period).reduce((a, b) => a + b, 0), period, 0);

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

/**
 * LTP2ScoreExplanation provides a deterministic, human-readable breakdown
 * of an LTP 2.0 Gamma score calculation. This is passed to the AI coach for
 * explanation - the AI must NEVER compute scores directly.
 */
export interface LTP2ScoreExplanation {
  /** Overall assessment */
  score: number;
  grade: 'Sniper' | 'Decent' | 'Dumb Shit';
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;

  /** Component breakdown with human-readable reasons */
  breakdown: {
    cloud: { score: number; reason: string };
    vwap: { score: number; reason: string };
    gammaWall: { score: number; reason: string };
    gammaRegime: { score: number; reason: string };
    patience: { score: number; reason: string };
    resistancePenalty: { score: number; reason: string };
  };

  /** Warnings and recommendation */
  warnings: string[];
  recommendation: string;

  /** Input data used for calculation (audit trail) */
  inputs: {
    symbol: string;
    currentPrice: number;
    ema8: number;
    ema21: number;
    vwap: number;
    callWall: number;
    putWall: number;
    gammaExposure: number;
    timestamp: string;
  };
}

/**
 * Generate a deterministic LTP2ScoreExplanation for AI coaching.
 * The AI must use this pre-computed explanation - it cannot calculate scores.
 */
export function generateLTP2ScoreExplanation(
  symbol: string,
  context: MarketContext,
  ltp2Result: LTP2Score
): LTP2ScoreExplanation {
  const { breakdown, direction, confidence, warnings, recommendation, grade, score } = ltp2Result;

  // Generate human-readable reasons for each component
  const emaSpread = context.ema21 > 0
    ? ((context.ema8 - context.ema21) / context.ema21) * 100
    : 0;
  const cloudReason = Math.abs(emaSpread) < 0.1
    ? 'EMAs are crossed/neutral - no clear trend direction'
    : `8 EMA ${emaSpread > 0 ? 'above' : 'below'} 21 EMA by ${Math.abs(emaSpread).toFixed(2)}% - ${emaSpread > 0 ? 'bullish' : 'bearish'} cloud`;

  const vwapDistance = context.vwap > 0
    ? ((context.currentPrice - context.vwap) / context.vwap) * 100
    : 0;
  const vwapReason = `Price ${vwapDistance >= 0 ? 'above' : 'below'} VWAP by ${Math.abs(vwapDistance).toFixed(2)}%${
    (direction === 'bullish' && vwapDistance > 0) || (direction === 'bearish' && vwapDistance < 0)
      ? ' - aligned with direction'
      : ' - not aligned with direction'
  }`;

  const gammaWallReason = direction === 'bullish' || direction === 'neutral'
    ? context.currentPrice > context.putWall
      ? `Price above Put Wall (${context.putWall.toFixed(2)}) - institutional support intact`
      : `Price below Put Wall (${context.putWall.toFixed(2)}) - support broken`
    : context.currentPrice < context.callWall
      ? `Price below Call Wall (${context.callWall.toFixed(2)}) - resistance intact`
      : `Price above Call Wall (${context.callWall.toFixed(2)}) - resistance broken`;

  const gammaRegimeReason = context.gammaExposure > 0
    ? `Positive gamma (${context.gammaExposure.toFixed(0)}) - dealers buy dips, expect mean reversion`
    : `Negative gamma (${context.gammaExposure.toFixed(0)}) - dealers sell dips, expect volatility`;

  const patienceReason = breakdown.patienceScore > 0
    ? `Patience candle detected - confirmation present`
    : 'No patience candle - waiting for inside bar confirmation';

  const opposingWall = direction === 'bullish' ? context.callWall : context.putWall;
  const distanceToWall = opposingWall > 0
    ? Math.abs((context.currentPrice - opposingWall) / context.currentPrice) * 100
    : 100;
  const penaltyReason = breakdown.resistancePenalty < 0
    ? `${distanceToWall.toFixed(1)}% from ${direction === 'bullish' ? 'Call' : 'Put'} Wall - ${
        breakdown.resistancePenalty <= -15 ? 'high rejection risk' :
        breakdown.resistancePenalty <= -10 ? 'approaching resistance' : 'nearing wall'
      }`
    : 'Safe distance from opposing gamma wall';

  return {
    score,
    grade,
    direction,
    confidence,
    breakdown: {
      cloud: { score: breakdown.cloudScore, reason: cloudReason },
      vwap: { score: breakdown.vwapScore, reason: vwapReason },
      gammaWall: { score: breakdown.gammaWallScore, reason: gammaWallReason },
      gammaRegime: { score: breakdown.gammaRegimeScore, reason: gammaRegimeReason },
      patience: { score: breakdown.patienceScore, reason: patienceReason },
      resistancePenalty: { score: breakdown.resistancePenalty, reason: penaltyReason },
    },
    warnings,
    recommendation,
    inputs: {
      symbol,
      currentPrice: context.currentPrice,
      ema8: context.ema8,
      ema21: context.ema21,
      vwap: context.vwap,
      callWall: context.callWall,
      putWall: context.putWall,
      gammaExposure: context.gammaExposure,
      timestamp: new Date().toISOString(),
    },
  };
}

// Export grade thresholds and hysteresis config for external use
export { GRADE_THRESHOLDS, WEIGHTS, HYSTERESIS_BUFFER };
