/**
 * Practice Scenario Data Generator
 *
 * Generates realistic historical candle data for practice scenarios
 * with 150+ candles including pre-market, historical context, decision point, and outcome.
 */

export interface GeneratedCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface ScenarioDataConfig {
  symbol: string;
  basePrice: number;
  volatility: number; // Daily volatility as percentage (e.g., 2 = 2%)
  trend: 'bullish' | 'bearish' | 'neutral' | 'choppy';
  setupType: 'support_bounce' | 'resistance_rejection' | 'vwap_reclaim' | 'failed_breakdown' |
             'trend_continuation' | 'breakout' | 'double_bottom' | 'gap_fill' |
             'exhaustion' | 'liquidity_sweep' | 'bear_trap' | 'divergence';
  timeframe: '1m' | '2m' | '5m' | '15m';
  totalCandles: number;
  decisionPointIndex: number; // Which candle is the decision point
  outcomeCandles: number; // How many candles after decision point
  outcome: 'win' | 'loss' | 'neutral';
  targetPercent?: number; // Target move percentage
  startTime?: number; // Start timestamp (defaults to a typical trading day)
}

// Market hours in milliseconds
const MARKET_OPEN_HOUR = 9.5; // 9:30 AM ET
const MARKET_CLOSE_HOUR = 16; // 4:00 PM ET
const PREMARKET_START_HOUR = 4; // 4:00 AM ET

// Timeframe to milliseconds
const TIMEFRAME_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '2m': 2 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
};

/**
 * Generate a random number with normal distribution
 */
function randomNormal(mean: number = 0, stdDev: number = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Generate volume with realistic patterns
 */
function generateVolume(
  baseVolume: number,
  timeOfDay: number, // 0-1 representing position in trading day
  isBreakout: boolean,
  isDecisionPoint: boolean
): number {
  // U-shaped volume pattern (high at open/close, low midday)
  const timeVolumeFactor = 1 + 0.5 * Math.cos(Math.PI * (timeOfDay - 0.5));

  // Random variation
  const randomFactor = 0.5 + Math.random();

  // Special events
  let eventFactor = 1;
  if (isBreakout) eventFactor = 2 + Math.random();
  if (isDecisionPoint) eventFactor = 1.5 + Math.random();

  return Math.round(baseVolume * timeVolumeFactor * randomFactor * eventFactor);
}

/**
 * Generate a single candle
 */
function generateCandle(
  prevCandle: GeneratedCandle | null,
  timestamp: number,
  basePrice: number,
  volatility: number,
  trend: number, // -1 to 1
  timeOfDay: number,
  baseVolume: number,
  isBreakout: boolean = false,
  isDecisionPoint: boolean = false
): GeneratedCandle {
  const open = prevCandle ? prevCandle.c : basePrice;

  // Calculate typical move
  const typicalMove = basePrice * (volatility / 100) / Math.sqrt(78); // Assuming 78 5-min bars per day

  // Trend bias
  const trendBias = typicalMove * trend * 0.3;

  // Random walk
  const randomMove = randomNormal(0, typicalMove);

  // Calculate close
  const closeChange = trendBias + randomMove;
  const close = open + closeChange;

  // Calculate high and low
  const range = Math.abs(randomNormal(0, typicalMove * 1.5));
  const highBias = close > open ? 0.6 : 0.4;
  const lowBias = close > open ? 0.4 : 0.6;

  const high = Math.max(open, close) + range * highBias;
  const low = Math.min(open, close) - range * lowBias;

  const volume = generateVolume(baseVolume, timeOfDay, isBreakout, isDecisionPoint);

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
 * Generate pre-market candles
 */
function generatePremarketCandles(
  basePrice: number,
  volatility: number,
  trend: number,
  dayStart: number,
  timeframeMs: number,
  baseVolume: number
): GeneratedCandle[] {
  const candles: GeneratedCandle[] = [];
  const premarketStart = dayStart + (PREMARKET_START_HOUR * 60 * 60 * 1000);
  const marketOpen = dayStart + (MARKET_OPEN_HOUR * 60 * 60 * 1000);

  let currentTime = premarketStart;
  let prevCandle: GeneratedCandle | null = null;

  // Pre-market has lower volume
  const premarketVolume = baseVolume * 0.1;

  while (currentTime < marketOpen) {
    const candle = generateCandle(
      prevCandle,
      currentTime,
      basePrice,
      volatility * 0.5, // Lower volatility pre-market
      trend * 0.3, // Weaker trend pre-market
      0, // Time of day doesn't matter for premarket
      premarketVolume,
      false,
      false
    );
    candles.push(candle);
    prevCandle = candle;
    currentTime += timeframeMs;
  }

  return candles;
}

/**
 * Generate the setup pattern before decision point
 */
function generateSetupPattern(
  config: ScenarioDataConfig,
  startCandle: GeneratedCandle,
  candles: GeneratedCandle[],
  startTimestamp: number,
  timeframeMs: number,
  baseVolume: number
): void {
  const { setupType, basePrice, volatility, decisionPointIndex } = config;

  // Calculate how many candles we need for the setup
  const setupCandles = decisionPointIndex - candles.length;

  let prevCandle = startCandle;
  let currentTime = startTimestamp;

  for (let i = 0; i < setupCandles; i++) {
    const progress = i / setupCandles;
    const timeOfDay = 0.1 + progress * 0.6; // First 60% of day

    let trend = 0;
    let isBreakout = false;

    // Create pattern-specific price action
    switch (setupType) {
      case 'support_bounce':
        // Downtrend into support level
        trend = progress < 0.7 ? -0.6 : 0.1; // Downtrend then stabilize
        break;

      case 'resistance_rejection':
        // Uptrend into resistance
        trend = progress < 0.8 ? 0.5 : 0; // Uptrend then stall
        break;

      case 'vwap_reclaim':
        // Down below VWAP then recovery
        trend = progress < 0.4 ? -0.5 : progress < 0.7 ? 0 : 0.4;
        break;

      case 'failed_breakdown':
        // Downtrend, brief break, sharp recovery
        trend = progress < 0.6 ? -0.4 : progress < 0.75 ? -0.8 : 0.7;
        isBreakout = progress > 0.75;
        break;

      case 'trend_continuation':
        // Steady trend with pullback
        trend = progress < 0.6 ? 0.5 : progress < 0.85 ? -0.2 : 0.3;
        break;

      case 'breakout':
        // Consolidation then breakout
        trend = progress < 0.7 ? 0.1 * Math.sin(progress * 10) : 0.6;
        isBreakout = progress > 0.8;
        break;

      case 'double_bottom':
        // Down, up, down to similar level
        const phase = Math.floor(progress * 3);
        trend = phase === 0 ? -0.5 : phase === 1 ? 0.4 : -0.3;
        break;

      case 'gap_fill':
        // Start high, trend down toward gap fill
        trend = -0.4;
        break;

      case 'exhaustion':
        // Strong trend that's slowing
        trend = (1 - progress) * 0.6;
        break;

      case 'liquidity_sweep':
        // Build up to resistance, spike through, reverse
        trend = progress < 0.6 ? 0.4 : progress < 0.8 ? 0.7 : -0.3;
        isBreakout = progress > 0.75 && progress < 0.85;
        break;

      case 'bear_trap':
        // Break down then sharp recovery
        trend = progress < 0.7 ? -0.3 : progress < 0.85 ? -0.8 : 0.8;
        isBreakout = progress > 0.85;
        break;

      case 'divergence':
        // Lower lows but weakening momentum
        trend = -0.3 + progress * 0.2;
        break;

      default:
        trend = 0;
    }

    const candle = generateCandle(
      prevCandle,
      currentTime,
      basePrice,
      volatility,
      trend,
      timeOfDay,
      baseVolume,
      isBreakout,
      false
    );

    candles.push(candle);
    prevCandle = candle;
    currentTime += timeframeMs;
  }
}

/**
 * Generate outcome candles after decision point
 */
function generateOutcomeCandles(
  config: ScenarioDataConfig,
  decisionCandle: GeneratedCandle,
  startTimestamp: number,
  timeframeMs: number,
  baseVolume: number
): GeneratedCandle[] {
  const { outcome, outcomeCandles, targetPercent = 1.5, basePrice, volatility, setupType } = config;
  const candles: GeneratedCandle[] = [];

  let prevCandle = decisionCandle;
  let currentTime = startTimestamp;

  // Determine outcome direction based on setup type and outcome
  let outcomeDirection = 0;

  switch (setupType) {
    case 'support_bounce':
    case 'vwap_reclaim':
    case 'failed_breakdown':
    case 'trend_continuation':
    case 'breakout':
    case 'double_bottom':
    case 'bear_trap':
    case 'divergence':
      outcomeDirection = outcome === 'win' ? 1 : outcome === 'loss' ? -1 : 0;
      break;

    case 'resistance_rejection':
    case 'gap_fill':
    case 'exhaustion':
    case 'liquidity_sweep':
      outcomeDirection = outcome === 'win' ? -1 : outcome === 'loss' ? 1 : 0;
      break;
  }

  // Generate outcome candles with momentum that fades
  for (let i = 0; i < outcomeCandles; i++) {
    const progress = i / outcomeCandles;
    const timeOfDay = 0.7 + progress * 0.2; // Last 20% of day

    // Momentum fades over time
    const momentumFade = 1 - progress * 0.5;
    const trend = outcomeDirection * momentumFade * 0.6;

    // Initial breakout has higher volatility
    const outcomeVol = i < 3 ? volatility * 1.5 : volatility;

    const candle = generateCandle(
      prevCandle,
      currentTime,
      basePrice,
      outcomeVol,
      trend,
      timeOfDay,
      baseVolume,
      i < 3, // First few candles are breakout candles
      false
    );

    candles.push(candle);
    prevCandle = candle;
    currentTime += timeframeMs;
  }

  return candles;
}

/**
 * Generate complete scenario data
 */
export function generateScenarioData(config: ScenarioDataConfig): {
  candles: GeneratedCandle[];
  premarketHigh: number;
  premarketLow: number;
  decisionPointCandle: GeneratedCandle;
  outcomeCandles: GeneratedCandle[];
} {
  const {
    basePrice,
    volatility,
    trend,
    timeframe,
    totalCandles,
    decisionPointIndex,
    outcomeCandles: numOutcomeCandles,
  } = config;

  const timeframeMs = TIMEFRAME_MS[timeframe] || TIMEFRAME_MS['5m'];

  // Default to a Monday at 9:30 AM ET in January 2024
  const dayStart = config.startTime || new Date('2024-01-10T00:00:00-05:00').getTime();
  const marketOpen = dayStart + (MARKET_OPEN_HOUR * 60 * 60 * 1000);

  // Base volume scaled to timeframe (longer timeframes have higher volume)
  const baseVolume = Math.round(150000 * (TIMEFRAME_MS[timeframe] / TIMEFRAME_MS['5m']));

  // Calculate trend direction
  const trendDirection = trend === 'bullish' ? 0.5 : trend === 'bearish' ? -0.5 :
                         trend === 'choppy' ? 0 : 0.1;

  // Generate pre-market candles
  const premarketCandles = generatePremarketCandles(
    basePrice,
    volatility,
    trendDirection,
    dayStart,
    timeframeMs,
    baseVolume
  );

  const premarketHigh = Math.max(...premarketCandles.map(c => c.h));
  const premarketLow = Math.min(...premarketCandles.map(c => c.l));

  // Start main session
  const candles: GeneratedCandle[] = [];

  // First candle at market open - often gaps from premarket
  const premarketClose = premarketCandles.length > 0
    ? premarketCandles[premarketCandles.length - 1].c
    : basePrice;

  const openGap = premarketClose + randomNormal(0, basePrice * 0.002);
  const firstCandle = generateCandle(
    { t: 0, o: openGap, h: openGap, l: openGap, c: openGap, v: baseVolume },
    marketOpen,
    basePrice,
    volatility * 1.5, // Higher volatility at open
    trendDirection,
    0,
    baseVolume * 2, // Higher volume at open
    true,
    false
  );
  candles.push(firstCandle);

  // Generate setup pattern
  generateSetupPattern(
    config,
    firstCandle,
    candles,
    marketOpen + timeframeMs,
    timeframeMs,
    baseVolume
  );

  // Mark decision point candle
  const decisionPointCandle = candles[candles.length - 1];

  // Generate outcome candles
  const decisionTimestamp = decisionPointCandle.t + timeframeMs;
  const outcomeCandles = generateOutcomeCandles(
    config,
    decisionPointCandle,
    decisionTimestamp,
    timeframeMs,
    baseVolume
  );

  // Combine all candles
  const allCandles = [...candles, ...outcomeCandles];

  return {
    candles: allCandles,
    premarketHigh,
    premarketLow,
    decisionPointCandle,
    outcomeCandles,
  };
}

/**
 * Generate chart data JSON for a specific scenario type
 */
export function generateChartDataJSON(
  symbol: string,
  basePrice: number,
  setupType: ScenarioDataConfig['setupType'],
  outcome: 'win' | 'loss' | 'neutral'
): string {
  const config: ScenarioDataConfig = {
    symbol,
    basePrice,
    volatility: getVolatilityForSymbol(symbol),
    trend: getTrendForSetup(setupType),
    setupType,
    timeframe: '5m',
    totalCandles: 150,
    decisionPointIndex: 120,
    outcomeCandles: 25,
    outcome,
    targetPercent: 1.5,
  };

  const data = generateScenarioData(config);

  return JSON.stringify({
    candles: data.candles,
    volume_profile: {
      high_vol_node: Math.round((data.decisionPointCandle.h + data.decisionPointCandle.l) / 2 * 100) / 100,
      low_vol_node: data.decisionPointCandle.c,
    },
    premarket: {
      high: data.premarketHigh,
      low: data.premarketLow,
    },
  });
}

function getVolatilityForSymbol(symbol: string): number {
  const volatilities: Record<string, number> = {
    'SPY': 1.2,
    'QQQ': 1.5,
    'AAPL': 1.8,
    'NVDA': 3.5,
    'TSLA': 4.0,
    'META': 2.5,
    'MSFT': 1.6,
    'AMZN': 2.2,
    'GOOGL': 1.8,
    'AMD': 3.0,
    'NFLX': 2.8,
    'BA': 2.5,
    'COIN': 5.0,
    'CRM': 2.2,
    'PYPL': 2.8,
    'SHOP': 3.5,
    'RIVN': 4.5,
    'SMCI': 6.0,
    'DIS': 2.0,
    'GME': 8.0,
    'PLTR': 3.5,
    'XLF': 1.0,
    'IWM': 1.5,
    'TTD': 3.0,
    'INTC': 2.2,
  };
  return volatilities[symbol] || 2.0;
}

function getTrendForSetup(setupType: ScenarioDataConfig['setupType']): ScenarioDataConfig['trend'] {
  switch (setupType) {
    case 'support_bounce':
    case 'failed_breakdown':
    case 'double_bottom':
    case 'bear_trap':
    case 'divergence':
      return 'bearish'; // Setup requires prior down move

    case 'resistance_rejection':
    case 'exhaustion':
    case 'liquidity_sweep':
      return 'bullish'; // Setup requires prior up move

    case 'trend_continuation':
    case 'breakout':
      return 'bullish';

    case 'vwap_reclaim':
    case 'gap_fill':
      return 'choppy';

    default:
      return 'neutral';
  }
}

/**
 * Batch generate data for all default scenarios
 */
export function generateAllScenarioData(): Map<string, ReturnType<typeof generateScenarioData>> {
  const scenarios = new Map<string, ReturnType<typeof generateScenarioData>>();

  const defaultScenarios: Array<{ id: string; symbol: string; basePrice: number; setupType: ScenarioDataConfig['setupType']; outcome: 'win' | 'loss' | 'neutral' }> = [
    { id: 'aapl-support-bounce', symbol: 'AAPL', basePrice: 185.00, setupType: 'support_bounce', outcome: 'win' },
    { id: 'msft-resistance-rejection', symbol: 'MSFT', basePrice: 378.00, setupType: 'resistance_rejection', outcome: 'win' },
    { id: 'nvda-vwap-reclaim', symbol: 'NVDA', basePrice: 480.00, setupType: 'vwap_reclaim', outcome: 'win' },
    { id: 'amd-failed-breakdown', symbol: 'AMD', basePrice: 142.00, setupType: 'failed_breakdown', outcome: 'win' },
    { id: 'spy-trend-continuation', symbol: 'SPY', basePrice: 472.00, setupType: 'trend_continuation', outcome: 'win' },
    { id: 'tsla-orb-breakout', symbol: 'TSLA', basePrice: 245.00, setupType: 'breakout', outcome: 'win' },
    { id: 'ba-double-bottom', symbol: 'BA', basePrice: 215.00, setupType: 'double_bottom', outcome: 'win' },
    { id: 'nflx-gap-fill', symbol: 'NFLX', basePrice: 485.00, setupType: 'gap_fill', outcome: 'win' },
    { id: 'coin-exhaustion', symbol: 'COIN', basePrice: 145.00, setupType: 'exhaustion', outcome: 'neutral' },
    { id: 'rivn-bear-trap', symbol: 'RIVN', basePrice: 18.00, setupType: 'bear_trap', outcome: 'win' },
    { id: 'smci-fomo', symbol: 'SMCI', basePrice: 45.00, setupType: 'exhaustion', outcome: 'neutral' },
    { id: 'dis-divergence', symbol: 'DIS', basePrice: 92.00, setupType: 'divergence', outcome: 'win' },
    { id: 'gme-liquidity-sweep', symbol: 'GME', basePrice: 15.50, setupType: 'liquidity_sweep', outcome: 'win' },
  ];

  for (const scenario of defaultScenarios) {
    const config: ScenarioDataConfig = {
      symbol: scenario.symbol,
      basePrice: scenario.basePrice,
      volatility: getVolatilityForSymbol(scenario.symbol),
      trend: getTrendForSetup(scenario.setupType),
      setupType: scenario.setupType,
      timeframe: '5m',
      totalCandles: 150,
      decisionPointIndex: 120,
      outcomeCandles: 25,
      outcome: scenario.outcome,
    };

    scenarios.set(scenario.id, generateScenarioData(config));
  }

  return scenarios;
}
