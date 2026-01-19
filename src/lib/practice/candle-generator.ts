/**
 * Realistic Candle Data Generator for Practice Scenarios
 *
 * Generates 100+ candles for various scenario types with realistic
 * price action, volume profiles, and market microstructure.
 */

export interface GeneratedCandle {
  t: number;   // timestamp in milliseconds
  o: number;   // open
  h: number;   // high
  l: number;   // low
  c: number;   // close
  v: number;   // volume
}

export interface ScenarioGeneratorOptions {
  symbol: string;
  basePrice: number;
  volatility: number; // percentage, e.g., 0.5 for 0.5%
  candleCount: number;
  timeframeMinutes: number;
  startTime: number; // timestamp in ms
  scenarioType: ScenarioType;
  keyLevelPrice?: number;
}

export type ScenarioType =
  | 'support_bounce'
  | 'resistance_rejection'
  | 'vwap_reclaim'
  | 'failed_breakdown'
  | 'trend_following'
  | 'patience_test'
  | 'orb_breakout'
  | 'below_vwap_short'
  | 'mtf_confluence'
  | 'gap_fill'
  | 'double_bottom'
  | 'trend_exhaustion'
  | 'bear_trap'
  | 'bull_trap'
  | 'liquidity_sweep'
  | 'range_bound'
  | 'gap_and_go'
  | 'news_spike'
  | 'breakout_retest';

/**
 * Generate a single candle based on previous candle and parameters
 */
function generateCandle(
  prevCandle: GeneratedCandle | null,
  timestamp: number,
  basePrice: number,
  volatility: number,
  trend: number, // -1 to 1, bias direction
  volumeMultiplier: number = 1
): GeneratedCandle {
  const priceRange = basePrice * (volatility / 100);

  // Determine open (from previous close or base price)
  const open = prevCandle ? prevCandle.c : basePrice;

  // Apply trend bias with randomness
  const trendImpact = trend * priceRange * 0.3;
  const randomMove = (Math.random() - 0.5) * priceRange;
  const closeMove = trendImpact + randomMove;

  // Calculate close
  const close = open + closeMove;

  // Calculate high and low (always extend beyond open/close)
  const wickSize = Math.random() * priceRange * 0.5;
  const highWick = Math.random() * wickSize;
  const lowWick = Math.random() * wickSize;

  const high = Math.max(open, close) + highWick;
  const low = Math.min(open, close) - lowWick;

  // Generate volume (higher on trend candles)
  const baseVolume = 100000 + Math.random() * 200000;
  const trendVolume = Math.abs(closeMove / priceRange) * 100000;
  const volume = Math.round((baseVolume + trendVolume) * volumeMultiplier);

  return {
    t: timestamp,
    o: Math.round(open * 100) / 100,
    h: Math.round(high * 100) / 100,
    l: Math.round(low * 100) / 100,
    c: Math.round(close * 100) / 100,
    v: volume,
  };
}

/**
 * Generate candles with a specific trend pattern
 */
function generateTrendingCandles(
  count: number,
  startPrice: number,
  endPrice: number,
  volatility: number,
  startTime: number,
  intervalMs: number,
  volumeProfile: 'increasing' | 'decreasing' | 'climax' | 'normal' = 'normal'
): GeneratedCandle[] {
  const candles: GeneratedCandle[] = [];
  const priceStep = (endPrice - startPrice) / count;

  for (let i = 0; i < count; i++) {
    const timestamp = startTime + (i * intervalMs);
    const targetPrice = startPrice + (priceStep * i);
    const trend = priceStep > 0 ? 0.6 : -0.6;

    // Volume profile
    let volumeMult = 1;
    if (volumeProfile === 'increasing') {
      volumeMult = 0.7 + (0.6 * (i / count));
    } else if (volumeProfile === 'decreasing') {
      volumeMult = 1.3 - (0.6 * (i / count));
    } else if (volumeProfile === 'climax') {
      const midpoint = count / 2;
      const distFromMid = Math.abs(i - midpoint) / midpoint;
      volumeMult = 1.5 - (distFromMid * 0.8);
    }

    const prevCandle = candles.length > 0 ? candles[candles.length - 1] : null;
    const candle = generateCandle(
      prevCandle,
      timestamp,
      targetPrice,
      volatility,
      trend,
      volumeMult
    );

    candles.push(candle);
  }

  return candles;
}

/**
 * Generate consolidation/range candles at a level
 */
function generateConsolidationCandles(
  count: number,
  centerPrice: number,
  rangePercent: number,
  volatility: number,
  startTime: number,
  intervalMs: number
): GeneratedCandle[] {
  const candles: GeneratedCandle[] = [];
  const rangeSize = centerPrice * (rangePercent / 100);

  for (let i = 0; i < count; i++) {
    const timestamp = startTime + (i * intervalMs);
    // Oscillate within range
    const oscillation = Math.sin(i * 0.5) * (rangeSize / 2);
    const targetPrice = centerPrice + oscillation;

    const prevCandle = candles.length > 0 ? candles[candles.length - 1] : null;
    const candle = generateCandle(
      prevCandle,
      timestamp,
      targetPrice,
      volatility * 0.5, // Lower volatility during consolidation
      0, // No trend
      0.7 // Lower volume during consolidation
    );

    candles.push(candle);
  }

  return candles;
}

/**
 * Generate a support bounce scenario with 100+ candles
 */
export function generateSupportBounceScenario(options: ScenarioGeneratorOptions): GeneratedCandle[] {
  const { basePrice, volatility, startTime, timeframeMinutes, keyLevelPrice } = options;
  const intervalMs = timeframeMinutes * 60 * 1000;
  const supportLevel = keyLevelPrice || basePrice * 0.98;

  const candles: GeneratedCandle[] = [];
  let currentTime = startTime;

  // Phase 1: Initial uptrend (30 candles)
  const uptrendCandles = generateTrendingCandles(
    30,
    basePrice,
    basePrice * 1.02,
    volatility,
    currentTime,
    intervalMs,
    'normal'
  );
  candles.push(...uptrendCandles);
  currentTime += 30 * intervalMs;

  // Phase 2: Pullback to support (35 candles)
  const pullbackCandles = generateTrendingCandles(
    35,
    candles[candles.length - 1].c,
    supportLevel + (basePrice * 0.002), // Just above support
    volatility,
    currentTime,
    intervalMs,
    'decreasing'
  );
  candles.push(...pullbackCandles);
  currentTime += 35 * intervalMs;

  // Phase 3: Consolidation at support - decision point (15 candles)
  const consolidationCandles = generateConsolidationCandles(
    15,
    supportLevel + (basePrice * 0.003),
    0.3,
    volatility * 0.6,
    currentTime,
    intervalMs
  );
  candles.push(...consolidationCandles);
  currentTime += 15 * intervalMs;

  // Phase 4: Bounce (20 candles) - outcome
  const bounceCandles = generateTrendingCandles(
    20,
    candles[candles.length - 1].c,
    basePrice * 1.015,
    volatility,
    currentTime,
    intervalMs,
    'increasing'
  );
  candles.push(...bounceCandles);

  return candles;
}

/**
 * Generate a resistance rejection scenario with 100+ candles
 */
export function generateResistanceRejectionScenario(options: ScenarioGeneratorOptions): GeneratedCandle[] {
  const { basePrice, volatility, startTime, timeframeMinutes, keyLevelPrice } = options;
  const intervalMs = timeframeMinutes * 60 * 1000;
  const resistanceLevel = keyLevelPrice || basePrice * 1.02;

  const candles: GeneratedCandle[] = [];
  let currentTime = startTime;

  // Phase 1: Initial ranging/slight uptrend (25 candles)
  const initialCandles = generateTrendingCandles(
    25,
    basePrice * 0.98,
    basePrice,
    volatility,
    currentTime,
    intervalMs,
    'normal'
  );
  candles.push(...initialCandles);
  currentTime += 25 * intervalMs;

  // Phase 2: Rally toward resistance (40 candles)
  const rallyCandles = generateTrendingCandles(
    40,
    candles[candles.length - 1].c,
    resistanceLevel - (basePrice * 0.002),
    volatility,
    currentTime,
    intervalMs,
    'increasing'
  );
  candles.push(...rallyCandles);
  currentTime += 40 * intervalMs;

  // Phase 3: Test/rejection at resistance (15 candles)
  const testCandles: GeneratedCandle[] = [];
  for (let i = 0; i < 15; i++) {
    const timestamp = currentTime + (i * intervalMs);
    const prevCandle = [...candles, ...testCandles].slice(-1)[0];

    // Create wicks that test resistance then fail
    const wickToResistance = i < 5 ? Math.random() * 0.003 * basePrice : 0;
    const candle = generateCandle(
      prevCandle,
      timestamp,
      resistanceLevel - (i * 0.001 * basePrice),
      volatility * 0.7,
      i < 7 ? 0.2 : -0.4, // Transition from push to rejection
      0.9
    );

    // Ensure we wick up to resistance on early candles
    if (i < 5) {
      candle.h = Math.max(candle.h, resistanceLevel + (Math.random() * 0.001 * basePrice));
    }

    testCandles.push(candle);
  }
  candles.push(...testCandles);
  currentTime += 15 * intervalMs;

  // Phase 4: Rejection/pullback (20 candles) - outcome
  const rejectionCandles = generateTrendingCandles(
    20,
    candles[candles.length - 1].c,
    basePrice * 0.99,
    volatility,
    currentTime,
    intervalMs,
    'increasing'
  );
  candles.push(...rejectionCandles);

  return candles;
}

/**
 * Generate a VWAP reclaim scenario with 100+ candles
 */
export function generateVWAPReclaimScenario(options: ScenarioGeneratorOptions): GeneratedCandle[] {
  const { basePrice, volatility, startTime, timeframeMinutes, keyLevelPrice } = options;
  const intervalMs = timeframeMinutes * 60 * 1000;
  const vwapLevel = keyLevelPrice || basePrice;

  const candles: GeneratedCandle[] = [];
  let currentTime = startTime;

  // Phase 1: Open above VWAP, initial strength (15 candles)
  const openCandles = generateTrendingCandles(
    15,
    basePrice * 1.005,
    basePrice * 1.01,
    volatility,
    currentTime,
    intervalMs,
    'normal'
  );
  candles.push(...openCandles);
  currentTime += 15 * intervalMs;

  // Phase 2: Morning weakness, drop below VWAP (30 candles)
  const weaknessCandles = generateTrendingCandles(
    30,
    candles[candles.length - 1].c,
    vwapLevel - (basePrice * 0.015),
    volatility * 1.2,
    currentTime,
    intervalMs,
    'increasing'
  );
  candles.push(...weaknessCandles);
  currentTime += 30 * intervalMs;

  // Phase 3: Find support, base building (20 candles)
  const baseCandles = generateConsolidationCandles(
    20,
    vwapLevel - (basePrice * 0.01),
    0.4,
    volatility * 0.7,
    currentTime,
    intervalMs
  );
  candles.push(...baseCandles);
  currentTime += 20 * intervalMs;

  // Phase 4: Reclaim attempt - decision point (15 candles)
  const reclaimCandles = generateTrendingCandles(
    15,
    candles[candles.length - 1].c,
    vwapLevel + (basePrice * 0.003),
    volatility,
    currentTime,
    intervalMs,
    'increasing'
  );
  candles.push(...reclaimCandles);
  currentTime += 15 * intervalMs;

  // Phase 5: Continuation higher (20 candles) - outcome
  const continuationCandles = generateTrendingCandles(
    20,
    candles[candles.length - 1].c,
    basePrice * 1.02,
    volatility,
    currentTime,
    intervalMs,
    'normal'
  );
  candles.push(...continuationCandles);

  return candles;
}

/**
 * Generate a failed breakdown/bear trap scenario with 100+ candles
 */
export function generateFailedBreakdownScenario(options: ScenarioGeneratorOptions): GeneratedCandle[] {
  const { basePrice, volatility, startTime, timeframeMinutes, keyLevelPrice } = options;
  const intervalMs = timeframeMinutes * 60 * 1000;
  const supportLevel = keyLevelPrice || basePrice * 0.985;

  const candles: GeneratedCandle[] = [];
  let currentTime = startTime;

  // Phase 1: Downtrend approaching support (35 candles)
  const downtrendCandles = generateTrendingCandles(
    35,
    basePrice * 1.01,
    supportLevel + (basePrice * 0.005),
    volatility,
    currentTime,
    intervalMs,
    'normal'
  );
  candles.push(...downtrendCandles);
  currentTime += 35 * intervalMs;

  // Phase 2: Breakdown below support (10 candles) - trap forming
  const breakdownCandles = generateTrendingCandles(
    10,
    candles[candles.length - 1].c,
    supportLevel - (basePrice * 0.015),
    volatility * 1.5, // High volatility on breakdown
    currentTime,
    intervalMs,
    'climax'
  );
  candles.push(...breakdownCandles);
  currentTime += 10 * intervalMs;

  // Phase 3: Sharp reversal - decision point (10 candles)
  const reversalCandles = generateTrendingCandles(
    10,
    candles[candles.length - 1].c,
    supportLevel + (basePrice * 0.005),
    volatility * 1.3,
    currentTime,
    intervalMs,
    'climax'
  );
  candles.push(...reversalCandles);
  currentTime += 10 * intervalMs;

  // Phase 4: Continuation higher - short squeeze (25 candles)
  const squeezeCandles = generateTrendingCandles(
    25,
    candles[candles.length - 1].c,
    basePrice * 1.03,
    volatility,
    currentTime,
    intervalMs,
    'decreasing'
  );
  candles.push(...squeezeCandles);
  currentTime += 25 * intervalMs;

  // Phase 5: Consolidation at highs (20 candles)
  const consolidationCandles = generateConsolidationCandles(
    20,
    candles[candles.length - 1].c,
    0.3,
    volatility * 0.6,
    currentTime,
    intervalMs
  );
  candles.push(...consolidationCandles);

  return candles;
}

/**
 * Generate an ORB breakout scenario with 100+ candles
 */
export function generateORBBreakoutScenario(options: ScenarioGeneratorOptions): GeneratedCandle[] {
  const { basePrice, volatility, startTime, timeframeMinutes } = options;
  const intervalMs = timeframeMinutes * 60 * 1000;
  const orbHigh = basePrice * 1.008;
  const orbLow = basePrice * 0.992;

  const candles: GeneratedCandle[] = [];
  let currentTime = startTime;

  // Phase 1: Opening range formation (12 candles for first 30-60 min)
  const openingCandles: GeneratedCandle[] = [];
  let orbHighest = basePrice;
  let orbLowest = basePrice;

  for (let i = 0; i < 12; i++) {
    const timestamp = currentTime + (i * intervalMs);
    const prevCandle = openingCandles.length > 0 ? openingCandles[openingCandles.length - 1] : null;
    const candle = generateCandle(
      prevCandle,
      timestamp,
      basePrice,
      volatility * 1.2, // Higher opening volatility
      (Math.random() - 0.5) * 0.6, // Random direction
      1.5 // Higher opening volume
    );

    orbHighest = Math.max(orbHighest, candle.h);
    orbLowest = Math.min(orbLowest, candle.l);
    openingCandles.push(candle);
  }
  candles.push(...openingCandles);
  currentTime += 12 * intervalMs;

  // Phase 2: Consolidation within ORB (25 candles)
  const consolidationCandles = generateConsolidationCandles(
    25,
    (orbHighest + orbLowest) / 2,
    ((orbHighest - orbLowest) / basePrice) * 100 * 0.6,
    volatility * 0.7,
    currentTime,
    intervalMs
  );
  candles.push(...consolidationCandles);
  currentTime += 25 * intervalMs;

  // Phase 3: Breakout attempt (15 candles) - decision point
  const breakoutCandles = generateTrendingCandles(
    15,
    candles[candles.length - 1].c,
    orbHighest * 1.005,
    volatility,
    currentTime,
    intervalMs,
    'increasing'
  );
  candles.push(...breakoutCandles);
  currentTime += 15 * intervalMs;

  // Phase 4: Breakout continuation (30 candles) - outcome
  const continuationCandles = generateTrendingCandles(
    30,
    candles[candles.length - 1].c,
    basePrice * 1.025,
    volatility,
    currentTime,
    intervalMs,
    'normal'
  );
  candles.push(...continuationCandles);
  currentTime += 30 * intervalMs;

  // Phase 5: Profit taking/pullback (18 candles)
  const pullbackCandles = generateTrendingCandles(
    18,
    candles[candles.length - 1].c,
    basePrice * 1.018,
    volatility * 0.8,
    currentTime,
    intervalMs,
    'decreasing'
  );
  candles.push(...pullbackCandles);

  return candles;
}

/**
 * Generate a trend exhaustion/wait scenario with 100+ candles
 */
export function generateTrendExhaustionScenario(options: ScenarioGeneratorOptions): GeneratedCandle[] {
  const { basePrice, volatility, startTime, timeframeMinutes } = options;
  const intervalMs = timeframeMinutes * 60 * 1000;

  const candles: GeneratedCandle[] = [];
  let currentTime = startTime;

  // Phase 1: Strong rally (40 candles)
  const rallyCandles = generateTrendingCandles(
    40,
    basePrice * 0.92,
    basePrice * 1.02,
    volatility * 1.1,
    currentTime,
    intervalMs,
    'increasing'
  );
  candles.push(...rallyCandles);
  currentTime += 40 * intervalMs;

  // Phase 2: Exhaustion signs - smaller candles, declining volume (20 candles)
  const exhaustionCandles = generateTrendingCandles(
    20,
    candles[candles.length - 1].c,
    basePrice * 1.05,
    volatility * 0.6, // Decreasing volatility
    currentTime,
    intervalMs,
    'decreasing' // Declining volume
  );
  candles.push(...exhaustionCandles);
  currentTime += 20 * intervalMs;

  // Phase 3: Topping pattern - decision point (15 candles)
  const toppingCandles = generateConsolidationCandles(
    15,
    basePrice * 1.045,
    0.4,
    volatility * 0.5,
    currentTime,
    intervalMs
  );
  candles.push(...toppingCandles);
  currentTime += 15 * intervalMs;

  // Phase 4: Eventual breakdown (25 candles) - this happens after decision point
  const breakdownCandles = generateTrendingCandles(
    25,
    candles[candles.length - 1].c,
    basePrice * 0.99,
    volatility * 1.2,
    currentTime,
    intervalMs,
    'increasing'
  );
  candles.push(...breakdownCandles);

  return candles;
}

/**
 * Generate a patience test scenario (wait for confirmation)
 */
export function generatePatienceTestScenario(options: ScenarioGeneratorOptions): GeneratedCandle[] {
  const { basePrice, volatility, startTime, timeframeMinutes, keyLevelPrice } = options;
  const intervalMs = timeframeMinutes * 60 * 1000;
  const supportLevel = keyLevelPrice || basePrice * 0.98;

  const candles: GeneratedCandle[] = [];
  let currentTime = startTime;

  // Phase 1: Downtrend (40 candles)
  const downtrendCandles = generateTrendingCandles(
    40,
    basePrice * 1.02,
    supportLevel + (basePrice * 0.005),
    volatility,
    currentTime,
    intervalMs,
    'normal'
  );
  candles.push(...downtrendCandles);
  currentTime += 40 * intervalMs;

  // Phase 2: Approach support but no confirmation yet (25 candles) - decision point
  // Still making lower lows, no patience candles
  const approachCandles = generateTrendingCandles(
    25,
    candles[candles.length - 1].c,
    supportLevel - (basePrice * 0.01), // Goes below support
    volatility * 0.8,
    currentTime,
    intervalMs,
    'decreasing'
  );
  candles.push(...approachCandles);
  currentTime += 25 * intervalMs;

  // Phase 3: Eventually finds support and bounces (35 candles) - outcome
  const eventualBounceCandles = generateTrendingCandles(
    35,
    candles[candles.length - 1].c,
    basePrice,
    volatility,
    currentTime,
    intervalMs,
    'normal'
  );
  candles.push(...eventualBounceCandles);

  return candles;
}

/**
 * Generate a gap fill scenario
 */
export function generateGapFillScenario(options: ScenarioGeneratorOptions): GeneratedCandle[] {
  const { basePrice, volatility, startTime, timeframeMinutes } = options;
  const intervalMs = timeframeMinutes * 60 * 1000;
  const previousClose = basePrice * 0.98;
  const gapOpen = basePrice * 1.01; // Gap up

  const candles: GeneratedCandle[] = [];
  let currentTime = startTime;

  // Phase 1: Gap open and initial pop (10 candles)
  const gapCandles = generateTrendingCandles(
    10,
    gapOpen,
    gapOpen * 1.01,
    volatility * 1.3,
    currentTime,
    intervalMs,
    'climax'
  );
  candles.push(...gapCandles);
  currentTime += 10 * intervalMs;

  // Phase 2: Fail to hold, start fading (25 candles)
  const fadeStartCandles = generateTrendingCandles(
    25,
    candles[candles.length - 1].c,
    gapOpen * 0.995,
    volatility,
    currentTime,
    intervalMs,
    'normal'
  );
  candles.push(...fadeStartCandles);
  currentTime += 25 * intervalMs;

  // Phase 3: VWAP loss and continuation down (20 candles) - decision point
  const vwapLossCandles = generateTrendingCandles(
    20,
    candles[candles.length - 1].c,
    basePrice * 0.995,
    volatility,
    currentTime,
    intervalMs,
    'increasing'
  );
  candles.push(...vwapLossCandles);
  currentTime += 20 * intervalMs;

  // Phase 4: Gap fill (25 candles) - outcome
  const gapFillCandles = generateTrendingCandles(
    25,
    candles[candles.length - 1].c,
    previousClose * 1.002,
    volatility,
    currentTime,
    intervalMs,
    'decreasing'
  );
  candles.push(...gapFillCandles);
  currentTime += 25 * intervalMs;

  // Phase 5: Bounce from gap fill (20 candles)
  const bounceCandles = generateTrendingCandles(
    20,
    candles[candles.length - 1].c,
    basePrice,
    volatility * 0.8,
    currentTime,
    intervalMs,
    'normal'
  );
  candles.push(...bounceCandles);

  return candles;
}

/**
 * Main generator function that dispatches to specific scenario generators
 */
export function generateScenarioCandles(options: ScenarioGeneratorOptions): GeneratedCandle[] {
  switch (options.scenarioType) {
    case 'support_bounce':
      return generateSupportBounceScenario(options);
    case 'resistance_rejection':
      return generateResistanceRejectionScenario(options);
    case 'vwap_reclaim':
      return generateVWAPReclaimScenario(options);
    case 'failed_breakdown':
    case 'bear_trap':
      return generateFailedBreakdownScenario(options);
    case 'orb_breakout':
      return generateORBBreakoutScenario(options);
    case 'trend_exhaustion':
      return generateTrendExhaustionScenario(options);
    case 'patience_test':
      return generatePatienceTestScenario(options);
    case 'gap_fill':
      return generateGapFillScenario(options);
    default:
      // Default to support bounce pattern
      return generateSupportBounceScenario(options);
  }
}

/**
 * Convert candles to JSON string for SQL
 */
export function candlesToJSON(candles: GeneratedCandle[]): string {
  return JSON.stringify({ candles });
}

/**
 * Find decision point index (typically around 70-75% through the data)
 */
export function findDecisionPointIndex(candles: GeneratedCandle[]): number {
  return Math.floor(candles.length * 0.7);
}

/**
 * Get decision point from candles
 */
export function getDecisionPoint(candles: GeneratedCandle[], context: string): { price: number; time: number; context: string } {
  const index = findDecisionPointIndex(candles);
  const candle = candles[index];
  return {
    price: candle.c,
    time: candle.t,
    context,
  };
}
