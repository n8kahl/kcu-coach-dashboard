/**
 * Market Data Types
 *
 * All type definitions for the market data service.
 * Extracted from market-data.ts for modularity.
 */

// ============================================
// Core Market Data Types
// ============================================

export interface Quote {
  symbol: string;
  last: number;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  prevClose: number;
  prevHigh: number;
  prevLow: number;
  timestamp: string;
}

export interface Bar {
  t: number;
  timestamp: number;
  date: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
}

export interface MarketStatus {
  market: 'open' | 'closed' | 'extended-hours' | 'unknown';
  afterHours: boolean;
  earlyHours: boolean;
  serverTime?: string;
}

export interface IndexQuote {
  symbol: string;
  value: number;
  open?: number;
  high?: number;
  low?: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

// ============================================
// Technical Indicator Types
// ============================================

export interface TechnicalIndicator {
  timestamp: number;
  value: number;
}

export interface SMAResult {
  values: TechnicalIndicator[];
  period: number;
}

export interface EMAResult {
  values: TechnicalIndicator[];
  period: number;
}

export interface MACDResult {
  values: Array<{
    timestamp: number;
    macd: number;
    signal: number;
    histogram: number;
  }>;
}

export interface RSIResult {
  values: TechnicalIndicator[];
  period: number;
}

// ============================================
// Key Levels Types
// ============================================

export interface KeyLevel {
  type: 'support' | 'resistance' | 'pdh' | 'pdl' | 'vwap' | 'orb_high' | 'orb_low' | 'ema9' | 'ema21' | 'sma200' | 'pmh' | 'pml' | 'swing_high_4h' | 'swing_low_4h' | 'swing_high_1h' | 'swing_low_1h';
  price: number;
  strength: number;
  distance?: number;
  /** Number of times price has touched this level (for swing points) */
  touchCount?: number;
  /** Timeframe the level was detected on */
  timeframe?: '1H' | '4H' | 'D';
}

// ============================================
// Options Types
// ============================================

export interface OptionContract {
  ticker: string;
  underlying: string;
  type: 'call' | 'put';
  strike: number;
  expiration: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface OptionsChain {
  underlying: string;
  expirationDate: string;
  calls: OptionContract[];
  puts: OptionContract[];
}

export interface OptionsFlow {
  ticker: string;
  timestamp: string;
  type: 'call' | 'put';
  strike: number;
  expiration: string;
  premium: number;
  volume: number;
  openInterest: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

// ============================================
// Market Snapshot Types
// ============================================

export interface MarketSnapshot {
  symbol: string;
  quote: Quote;
  keyLevels: KeyLevel[];
  trend: 'bullish' | 'bearish' | 'neutral';
  vwap: number;
  patienceCandle?: {
    timeframe: string;
    forming: boolean;
    confirmed: boolean;
    direction: 'bullish' | 'bearish';
  };
}

// ============================================
// Multi-Timeframe Analysis Types
// ============================================

export interface TimeframeTrend {
  timeframe: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  ema9: number;
  ema21: number;
  priceVsEma9: 'above' | 'below' | 'at';
  priceVsEma21: 'above' | 'below' | 'at';
  emaAlignment: 'bullish' | 'bearish' | 'mixed';
}

export interface MTFAnalysis {
  symbol: string;
  currentPrice: number;
  timeframes: TimeframeTrend[];
  overallBias: 'bullish' | 'bearish' | 'neutral';
  alignmentScore: number; // 0-100, how aligned are the timeframes
  conflictingTimeframes: string[];
}

// ============================================
// Economic Calendar Types
// ============================================

export interface EconomicEvent {
  date: string;
  time: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  forecast?: string;
  previous?: string;
}

export interface EarningsEvent {
  symbol: string;
  date: string;
  time: 'bmo' | 'amc' | 'unknown'; // Before Market Open, After Market Close
  epsEstimate?: number;
  revenueEstimate?: number;
}

// ============================================
// Proactive Coaching Types
// ============================================

/**
 * Market Breadth Data - The "pulse" of the market
 * ADD: Advance-Decline Line - net advancing stocks
 * VOLD: Volume Delta - buying vs selling volume difference
 * TICK: NYSE TICK - net upticks vs downticks
 */
export interface MarketBreadth {
  timestamp: string;

  // Advance-Decline Line (ADD)
  add: {
    value: number;           // Current ADD value (positive = more advancing)
    change: number;          // Change from open
    trend: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
    divergence?: 'bullish' | 'bearish' | null; // Divergence from price
  };

  // Volume Delta (VOLD)
  vold: {
    value: number;           // Current VOLD (millions)
    change: number;          // Change from previous reading
    trend: 'buying_pressure' | 'neutral' | 'selling_pressure';
    intensity: 'extreme' | 'strong' | 'moderate' | 'weak';
  };

  // NYSE TICK (instantaneous breadth)
  tick: {
    current: number;         // Current TICK reading (-1500 to +1500 typical)
    high: number;            // Session high
    low: number;             // Session low
    extremeReading: boolean; // True if |TICK| > 1000
    signal: 'buy_signal' | 'sell_signal' | 'neutral';
  };

  // Overall market health score (0-100)
  healthScore: number;

  // Coaching implications
  tradingBias: 'favor_longs' | 'favor_shorts' | 'neutral' | 'caution';
  coachingMessage?: string;
}

/**
 * Order Flow Intensity - Tape reading for the AI
 * Measures buying vs selling pressure momentum
 */
export interface OrderFlow {
  timestamp: string;
  symbol: string;

  // Buy/Sell Pressure Ratio (1.0 = balanced)
  pressureRatio: number;

  // Pressure direction
  direction: 'buying' | 'selling' | 'balanced';

  // Intensity level
  intensity: 'extreme' | 'strong' | 'moderate' | 'weak';

  // Large order activity (institutional)
  largeOrderActivity: {
    detected: boolean;
    direction: 'buying' | 'selling' | null;
    significance: 'high' | 'medium' | 'low';
  };

  // Volume analysis
  volumeProfile: {
    relativeVolume: number;  // vs 20-day average (1.5 = 50% higher)
    volumeSpike: boolean;    // Unusual volume detected
    volumeTrend: 'increasing' | 'decreasing' | 'stable';
  };

  // Tape momentum (short-term)
  tapeMomentum: {
    score: number;           // -100 to +100
    acceleration: 'accelerating' | 'decelerating' | 'stable';
  };
}

/**
 * Enhanced Economic Event with time-to-event calculations
 * For proactive "Fed speaks in 5 mins" warnings
 */
export interface EnhancedEconomicEvent {
  id: string;
  date: string;
  time: string;              // HH:MM ET format
  timezone: string;          // Always 'America/New_York'
  event: string;
  impact: 'high' | 'medium' | 'low';
  forecast?: string;
  previous?: string;
  actual?: string;

  // Time calculations (computed on fetch)
  eventTimestamp: number;    // Unix timestamp
  minutesUntilEvent: number; // Can be negative if passed
  isImminent: boolean;       // True if < 10 minutes away
  isPast: boolean;           // True if event has passed

  // Coaching implications
  tradingGuidance: 'flatten_positions' | 'reduce_size' | 'avoid_new_trades' | 'normal';
  warningLevel: 'critical' | 'warning' | 'info';
  coachingMessage: string;
}

/**
 * Market Hot Context - Combined situational awareness
 * This is what gets pushed to Redis for real-time coaching
 */
export interface MarketHotContext {
  timestamp: string;

  // Market Breadth (overall market health)
  breadth: MarketBreadth | null;

  // Symbol-specific order flow (for watched symbols)
  orderFlow: Map<string, OrderFlow> | null;

  // Economic calendar awareness
  calendar: {
    todayEvents: EnhancedEconomicEvent[];
    nextEvent: EnhancedEconomicEvent | null;
    hasHighImpactToday: boolean;
    isEventImminent: boolean;
    imminentEvent?: EnhancedEconomicEvent;
  };

  // Overall trading conditions
  tradingConditions: {
    status: 'green' | 'yellow' | 'red';
    message: string;
    restrictions: string[];
  };

  // Proactive warnings (to be surfaced immediately)
  activeWarnings: ProactiveWarning[];
}

/**
 * Proactive Warning - Triggers immediate coach intervention
 */
export interface ProactiveWarning {
  id: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'market_breadth' | 'economic_event' | 'volatility' | 'order_flow' | 'pattern';
  title: string;
  message: string;
  coachStyle: 'somesh'; // Always Somesh voice
  actionRequired: boolean;
  suggestedAction?: string;
  expiresAt?: string;
}

// ============================================
// LTP Framework Analysis Types
// ============================================

export interface LTPAnalysis {
  symbol: string;
  timestamp: string;

  // LEVELS
  levels: {
    nearest: KeyLevel[];
    pdh: number | null;
    pdl: number | null;
    vwap: number | null;
    orbHigh: number | null;
    orbLow: number | null;
    ema9: number | null;
    ema21: number | null;
    sma200: number | null;
    pmh: number | null;   // Premarket High
    pml: number | null;   // Premarket Low
    priceVsSma200: 'above' | 'below' | 'at' | null;
    pricePosition: 'above_vwap' | 'below_vwap' | 'at_vwap';
    levelProximity: 'at_level' | 'near_level' | 'between_levels';
    levelScore: number; // 0-100
  };

  // TREND
  trend: {
    mtf: MTFAnalysis;
    dailyTrend: 'bullish' | 'bearish' | 'neutral';
    intradayTrend: 'bullish' | 'bearish' | 'neutral';
    trendAlignment: 'aligned' | 'conflicting';
    trendScore: number; // 0-100
  };

  // PATIENCE
  patience: {
    candle5m: { forming: boolean; confirmed: boolean; direction: 'bullish' | 'bearish' } | null;
    candle15m: { forming: boolean; confirmed: boolean; direction: 'bullish' | 'bearish' } | null;
    candle1h: { forming: boolean; confirmed: boolean; direction: 'bullish' | 'bearish' } | null;
    patienceScore: number; // 0-100
  };

  // Overall LTP Grade
  confluenceScore: number; // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  setupQuality: 'Strong' | 'Moderate' | 'Weak' | 'No Setup';
  recommendation: string;
}

// ============================================
// Cache Types (Internal)
// ============================================

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

export interface CachedQuote {
  symbol: string;
  price: number;
  timestamp: number;
  data: {
    price?: number;
    size?: number;
    volume?: number;
    vwap?: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    timestamp?: number;
  } | undefined;
}

// ============================================
// Cache TTL Constants
// ============================================

export const CACHE_TTL = {
  quote: 5,
  snapshot: 10,
  aggregates: 60,
  levels: 30,  // Reduced from 300 to 30 seconds for fresher level data
  marketStatus: 30,
  indicators: 60,
  options: 30,
  index: 10,
} as const;
