/**
 * Market Data Service (TypeScript)
 *
 * Integrates with Massive.com for real-time and historical market data.
 * Uses Redis caching when available, falls back to in-memory.
 *
 * Data Consistency Strategy:
 * - First checks Redis hot cache (from MarketRedistributor) for real-time data
 * - Falls back to Massive.com REST API if cache miss or stale
 * - This ensures REST API and WebSocket users see the same price data
 */

// Redis is imported dynamically to avoid bundling issues in edge runtime
// Define types inline to avoid static import analysis
interface CacheOptions {
  ttl?: number;
  prefix?: string;
}
interface RedisModule {
  getCache: <T>(key: string, prefix?: string) => Promise<T | null>;
  setCache: <T>(key: string, value: T, options?: CacheOptions) => Promise<boolean>;
  getRedisClient: () => import('ioredis').Redis | null;
}
let redisModule: RedisModule | null = null;

// MarketRedistributor module for hot cache access
interface CachedQuote {
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

// Hot cache freshness threshold (5 seconds)
const HOT_CACHE_FRESHNESS_MS = 5000;

async function getRedis() {
  if (!redisModule && typeof window === 'undefined') {
    try {
      // Use webpackIgnore to prevent bundling ioredis in edge runtime
      redisModule = await import(/* webpackIgnore: true */ './redis');
    } catch {
      // Redis not available
    }
  }
  return redisModule;
}

/**
 * Get quote from Redis hot cache (populated by market-worker)
 * Returns null if not found or stale (> 5 seconds old)
 */
async function getHotCachedQuote(symbol: string): Promise<CachedQuote | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const client = redis.getRedisClient();
  if (!client) return null;

  try {
    const cacheKey = `quote:${symbol.toUpperCase()}`;
    const data = await client.get(cacheKey);
    if (!data) return null;

    const cached = JSON.parse(data) as CachedQuote;

    // Check freshness (must be < 5 seconds old)
    const age = Date.now() - cached.timestamp;
    if (age > HOT_CACHE_FRESHNESS_MS) {
      return null; // Stale cache, will fallback to REST API
    }

    return cached;
  } catch {
    return null;
  }
}

async function getCacheValue<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  if (redis) {
    return redis.getCache<T>(key, 'market');
  }
  return null;
}

async function setCacheValue<T>(key: string, value: T, ttl?: number): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.setCache(key, value, { ttl, prefix: 'market' });
  }
}

// Types
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

export interface KeyLevel {
  type: 'support' | 'resistance' | 'pdh' | 'pdl' | 'vwap' | 'orb_high' | 'orb_low' | 'ema9' | 'ema21' | 'sma200' | 'pmh' | 'pml';
  price: number;
  strength: number;
  distance?: number;
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

// Multi-Timeframe Analysis Types
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

// Economic Calendar Event
export interface EconomicEvent {
  date: string;
  time: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  forecast?: string;
  previous?: string;
}

// Earnings Event
export interface EarningsEvent {
  symbol: string;
  date: string;
  time: 'bmo' | 'amc' | 'unknown'; // Before Market Open, After Market Close
  epsEstimate?: number;
  revenueEstimate?: number;
}

// =============================================================================
// PROACTIVE COACHING DATA TYPES
// =============================================================================

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

// Cache TTLs in seconds
const CACHE_TTL = {
  quote: 5,
  snapshot: 10,
  aggregates: 60,
  levels: 300,
  marketStatus: 30,
  indicators: 60,
  options: 30,
  index: 10,
};

// In-memory cache fallback
const memoryCache = new Map<string, { data: unknown; timestamp: number }>();

/**
 * Market Data Service Class
 */
class MarketDataService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.MASSIVE_API_KEY || '';
    this.baseUrl = 'https://api.massive.com';
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Make authenticated request to API
   */
  private async fetch<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T | null> {
    if (!this.apiKey) {
      console.warn('[MarketData] API key not configured');
      return null;
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set('apiKey', this.apiKey);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[MarketData] API error for ${endpoint}: ${response.status} - ${error}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[MarketData] Fetch error:', error);
      return null;
    }
  }

  /**
   * Get cached data with Redis fallback to memory
   */
  private async getCached<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T | null>
  ): Promise<T | null> {
    // Try Redis cache first (dynamic import)
    // Note: getCacheValue already uses 'market' prefix
    const redisData = await getCacheValue<T>(key);
    if (redisData) {
      return redisData;
    }

    // Try memory cache
    const memData = memoryCache.get(key);
    if (memData && Date.now() - memData.timestamp < ttlSeconds * 1000) {
      return memData.data as T;
    }

    // Fetch fresh data
    const data = await fetchFn();
    if (data) {
      // Store in both caches
      await setCacheValue(key, data, ttlSeconds);
      memoryCache.set(key, { data, timestamp: Date.now() });
    }

    return data;
  }

  /**
   * Get current quote for a ticker
   *
   * Data consistency strategy:
   * 1. First check Redis hot cache (populated by market-worker via Redis Pub/Sub)
   * 2. If data exists and is fresh (< 5s old), return it immediately
   * 3. Otherwise, fallback to Massive.com REST API
   *
   * This ensures REST API users and WebSocket stream users see the same price data.
   */
  async getQuote(ticker: string): Promise<Quote | null> {
    const symbol = ticker.toUpperCase();

    // First, check the Redis hot cache from market-worker
    // This ensures consistency with real-time WebSocket data
    const hotCached = await getHotCachedQuote(symbol);
    if (hotCached) {
      // Convert hot cache format to Quote format
      // Note: Hot cache has limited data, so some fields may be 0
      return {
        symbol: hotCached.symbol,
        last: hotCached.price,
        price: hotCached.price,
        change: 0, // Not available from hot cache
        changePercent: 0, // Not available from hot cache
        open: hotCached.data?.open || 0,
        high: hotCached.data?.high || 0,
        low: hotCached.data?.low || 0,
        close: hotCached.data?.close || 0,
        volume: hotCached.data?.volume || 0,
        vwap: hotCached.data?.vwap || 0,
        prevClose: 0, // Not available from hot cache
        prevHigh: 0, // Not available from hot cache
        prevLow: 0, // Not available from hot cache
        timestamp: new Date(hotCached.timestamp).toISOString(),
      };
    }

    // Fallback to REST API with standard caching
    return this.getCached<Quote>(
      `quote:${symbol}`,
      CACHE_TTL.quote,
      async () => {
        interface SnapshotResponse {
          ticker?: {
            ticker: string;
            lastTrade?: { p: number };
            todaysChange?: number;
            todaysChangePerc?: number;
            day?: { o: number; h: number; l: number; v: number; vw: number };
            prevDay?: { c: number; h: number; l: number };
          };
        }

        const data = await this.fetch<SnapshotResponse>(`/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`);

        if (!data?.ticker) return null;

        const t = data.ticker;
        return {
          symbol: t.ticker,
          last: t.lastTrade?.p || t.prevDay?.c || 0,
          price: t.lastTrade?.p || t.prevDay?.c || 0,
          change: t.todaysChange || 0,
          changePercent: t.todaysChangePerc || 0,
          open: t.day?.o || 0,
          high: t.day?.h || 0,
          low: t.day?.l || 0,
          close: t.prevDay?.c || 0,
          volume: t.day?.v || 0,
          vwap: t.day?.vw || 0,
          prevClose: t.prevDay?.c || 0,
          prevHigh: t.prevDay?.h || 0,
          prevLow: t.prevDay?.l || 0,
          timestamp: new Date().toISOString(),
        };
      }
    );
  }

  /**
   * Get multiple quotes at once
   */
  async getQuotes(tickers: string[]): Promise<Map<string, Quote>> {
    const results = new Map<string, Quote>();

    // Fetch in parallel
    const promises = tickers.map(async (ticker) => {
      const quote = await this.getQuote(ticker);
      if (quote) {
        results.set(ticker.toUpperCase(), quote);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get OHLCV bars/aggregates
   */
  async getAggregates(
    ticker: string,
    timespan: string = 'day',
    limit: number = 50
  ): Promise<Bar[]> {
    const symbol = ticker.toUpperCase();

    // Parse timespan
    let actualTimespan = 'day';
    let multiplier = 1;

    if (timespan === 'day' || timespan === 'daily') {
      actualTimespan = 'day';
      multiplier = 1;
    } else if (timespan === 'week' || timespan === 'weekly') {
      actualTimespan = 'week';
      multiplier = 1;
    } else if (timespan === 'hour' || timespan === '60') {
      actualTimespan = 'hour';
      multiplier = 1;
    } else if (timespan === '240') {
      actualTimespan = 'hour';
      multiplier = 4;
    } else if (!isNaN(parseInt(timespan))) {
      actualTimespan = 'minute';
      multiplier = parseInt(timespan);
    } else {
      actualTimespan = timespan;
    }

    const cacheKey = `aggs:${symbol}:${actualTimespan}:${multiplier}:${limit}`;

    const bars = await this.getCached<Bar[]>(
      cacheKey,
      CACHE_TTL.aggregates,
      async () => {
        // Calculate date range
        const to = this.getDateString(0);
        const daysBack =
          actualTimespan === 'week' ? limit * 7 :
          actualTimespan === 'day' ? limit :
          actualTimespan === 'hour' ? Math.ceil(limit / 7) :
          Math.ceil(limit / 78);
        const from = this.getDateString(-daysBack);

        interface AggregatesResponse {
          results?: Array<{
            t: number;
            o: number;
            h: number;
            l: number;
            c: number;
            v: number;
            vw?: number;
          }>;
        }

        const data = await this.fetch<AggregatesResponse>(
          `/v2/aggs/ticker/${symbol}/range/${multiplier}/${actualTimespan}/${from}/${to}`,
          { limit, sort: 'asc' }
        );

        if (!data?.results) return [];

        // Filter out bars with invalid OHLC values to prevent chart errors
        return data.results
          .filter((bar) =>
            bar.t != null && isFinite(bar.t) &&
            bar.o != null && isFinite(bar.o) &&
            bar.h != null && isFinite(bar.h) &&
            bar.l != null && isFinite(bar.l) &&
            bar.c != null && isFinite(bar.c)
          )
          .map((bar) => ({
            t: bar.t,
            timestamp: bar.t,
            date: new Date(bar.t).toISOString(),
            o: bar.o,
            h: bar.h,
            l: bar.l,
            c: bar.c,
            v: bar.v || 0,
            vw: bar.vw,
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v || 0,
            vwap: bar.vw,
          }));
      }
    );

    return bars || [];
  }

  /**
   * Get intraday bars for today
   */
  async getIntradayBars(ticker: string, intervalMinutes: number = 5): Promise<Bar[]> {
    return this.getAggregates(ticker, String(intervalMinutes), 500);
  }

  /**
   * Get premarket bars for today (4:00 AM - 9:30 AM ET)
   * Returns extended hours data from Polygon API
   */
  async getPremarketBars(ticker: string): Promise<Bar[]> {
    const symbol = ticker.toUpperCase();
    const today = this.getDateString(0);
    const cacheKey = `premarket:${symbol}:${today}`;

    const bars = await this.getCached<Bar[]>(
      cacheKey,
      CACHE_TTL.aggregates,
      async () => {
        // Calculate premarket window in ET
        // 4:00 AM ET to 9:30 AM ET
        const etDate = new Date(today + 'T04:00:00-05:00');
        const etMarketOpen = new Date(today + 'T09:30:00-05:00');
        const fromTs = etDate.getTime();
        const toTs = etMarketOpen.getTime();

        interface AggregatesResponse {
          results?: Array<{
            t: number;
            o: number;
            h: number;
            l: number;
            c: number;
            v: number;
            vw?: number;
          }>;
        }

        // Fetch 1-minute bars during premarket hours
        const data = await this.fetch<AggregatesResponse>(
          `/v2/aggs/ticker/${symbol}/range/1/minute/${today}/${today}`,
          {
            limit: 500,
            sort: 'asc',
            // Note: Polygon returns extended hours data by default
          }
        );

        if (!data?.results) return [];

        // Filter to only premarket hours (before 9:30 AM ET)
        return data.results
          .filter(bar => bar.t >= fromTs && bar.t < toTs)
          .map((bar) => ({
            t: bar.t,
            timestamp: bar.t,
            date: new Date(bar.t).toISOString(),
            o: bar.o,
            h: bar.h,
            l: bar.l,
            c: bar.c,
            v: bar.v,
            vw: bar.vw,
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v,
            vwap: bar.vw,
          }));
      }
    );

    return bars || [];
  }

  /**
   * Get weekly bars for historical analysis
   */
  async getWeeklyBars(ticker: string, limit: number = 52): Promise<Bar[]> {
    return this.getAggregates(ticker, 'week', limit);
  }

  /**
   * Get market status
   */
  async getMarketStatus(): Promise<MarketStatus> {
    const status = await this.getCached<MarketStatus>(
      'market:status',
      CACHE_TTL.marketStatus,
      async () => {
        interface StatusResponse {
          market?: string;
          afterHours?: boolean;
          earlyHours?: boolean;
          serverTime?: string;
        }

        const data = await this.fetch<StatusResponse>('/v1/marketstatus/now');

        if (!data) {
          return { market: 'unknown' as const, afterHours: false, earlyHours: false };
        }

        return {
          market: (data.market as MarketStatus['market']) || 'unknown',
          afterHours: data.afterHours || false,
          earlyHours: data.earlyHours || false,
          serverTime: data.serverTime,
        };
      }
    );

    return status || { market: 'unknown', afterHours: false, earlyHours: false };
  }

  /**
   * Check if market is open
   */
  async isMarketOpen(): Promise<boolean> {
    const status = await this.getMarketStatus();
    return status.market === 'open';
  }

  /**
   * Get date string for API calls
   */
  private getDateString(daysOffset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
  }

  /**
   * Clear cache for a symbol or all cache
   */
  clearCache(symbol?: string): void {
    if (symbol) {
      const upperSymbol = symbol.toUpperCase();
      const keysToDelete: string[] = [];
      const cacheKeys = Array.from(memoryCache.keys());
      for (const key of cacheKeys) {
        if (key.includes(upperSymbol)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => memoryCache.delete(key));
    } else {
      memoryCache.clear();
    }
  }

  // ============================================
  // Index Data Methods
  // ============================================

  /**
   * Get index quote (VIX, SPX, NDX, DJI, etc.)
   * Uses Massive.com Indices API: /v3/snapshot/indices and /v2/aggs/ticker/{ticker}/prev
   */
  async getIndexQuote(index: string): Promise<IndexQuote | null> {
    const symbol = index.toUpperCase();

    // Map common index names to Massive.com index tickers
    const indexMap: Record<string, string> = {
      'VIX': 'I:VIX',
      'SPX': 'I:SPX',
      'NDX': 'I:NDX',
      'DJI': 'I:DJI',
      'RUT': 'I:RUT',
      'DJIA': 'I:DJI',
      'SP500': 'I:SPX',
      'NASDAQ': 'I:NDX',
      'RUSSELL': 'I:RUT',
    };

    const ticker = indexMap[symbol] || (symbol.startsWith('I:') ? symbol : `I:${symbol}`);

    // First check Redis hot cache (populated by indices-worker if running)
    const hotCached = await this.getHotCachedIndex(ticker);
    if (hotCached) {
      return hotCached;
    }

    return this.getCached<IndexQuote>(
      `index:${symbol}`,
      CACHE_TTL.index,
      async () => {
        // Try the indices snapshot endpoint first (real-time)
        interface IndicesSnapshotResponse {
          results?: Array<{
            ticker: string;
            name?: string;
            value?: number;
            last_updated?: number;
            session?: {
              open?: number;
              high?: number;
              low?: number;
              close?: number;
              change?: number;
              change_percent?: number;
            };
          }>;
        }

        const snapshotData = await this.fetch<IndicesSnapshotResponse>(
          `/v3/snapshot/indices`,
          { 'ticker.gte': ticker, 'ticker.lte': ticker, limit: 1 }
        );

        if (snapshotData?.results?.[0]) {
          const r = snapshotData.results[0];
          return {
            symbol,
            value: r.value || r.session?.close || 0,
            open: r.session?.open || 0,
            high: r.session?.high || 0,
            low: r.session?.low || 0,
            change: r.session?.change || 0,
            changePercent: r.session?.change_percent || 0,
            timestamp: r.last_updated
              ? new Date(r.last_updated / 1000000).toISOString()
              : new Date().toISOString(),
          };
        }

        // Fallback to previous day bar endpoint
        interface PrevDayResponse {
          results?: Array<{
            T?: string;
            v?: number;
            o?: number;
            c?: number;
            h?: number;
            l?: number;
            t?: number;
          }>;
        }

        const prevData = await this.fetch<PrevDayResponse>(
          `/v2/aggs/ticker/${ticker}/prev`
        );

        if (prevData?.results?.[0]) {
          const r = prevData.results[0];
          return {
            symbol,
            value: r.c || 0,
            open: r.o || 0,
            high: r.h || 0,
            low: r.l || 0,
            change: (r.c || 0) - (r.o || 0),
            changePercent: r.o ? (((r.c || 0) - r.o) / r.o) * 100 : 0,
            timestamp: r.t ? new Date(r.t).toISOString() : new Date().toISOString(),
          };
        }

        return null;
      }
    );
  }

  /**
   * Get hot cached index value from Redis (populated by indices-worker)
   */
  private async getHotCachedIndex(ticker: string): Promise<IndexQuote | null> {
    const redis = await getRedis();
    if (!redis) return null;

    const client = redis.getRedisClient();
    if (!client) return null;

    try {
      const cacheKey = `index:${ticker.toUpperCase()}`;
      const data = await client.get(cacheKey);
      if (!data) return null;

      const cached = JSON.parse(data);
      const age = Date.now() - cached.timestamp;
      if (age > HOT_CACHE_FRESHNESS_MS) return null;

      return cached as IndexQuote;
    } catch {
      return null;
    }
  }

  /**
   * Get VIX (Volatility Index) value
   */
  async getVIX(): Promise<number> {
    const vix = await this.getIndexQuote('VIX');
    return vix?.value || 0;
  }

  // ============================================
  // Technical Indicators
  // ============================================

  /**
   * Get Simple Moving Average
   */
  async getSMA(ticker: string, period: number = 20, timespan: string = 'day', limit: number = 50): Promise<SMAResult | null> {
    const symbol = ticker.toUpperCase();

    return this.getCached<SMAResult>(
      `sma:${symbol}:${period}:${timespan}:${limit}`,
      CACHE_TTL.indicators,
      async () => {
        interface SMAResponse {
          results?: {
            values?: Array<{ timestamp: number; value: number }>;
          };
        }

        const data = await this.fetch<SMAResponse>(
          `/v1/indicators/sma/${symbol}`,
          { timespan, 'window': period, limit, series_type: 'close' }
        );

        if (!data?.results?.values) return null;

        return {
          period,
          values: data.results.values.map((v) => ({
            timestamp: v.timestamp,
            value: v.value,
          })),
        };
      }
    );
  }

  /**
   * Get Exponential Moving Average
   */
  async getEMA(ticker: string, period: number = 9, timespan: string = 'day', limit: number = 50): Promise<EMAResult | null> {
    const symbol = ticker.toUpperCase();

    return this.getCached<EMAResult>(
      `ema:${symbol}:${period}:${timespan}:${limit}`,
      CACHE_TTL.indicators,
      async () => {
        interface EMAResponse {
          results?: {
            values?: Array<{ timestamp: number; value: number }>;
          };
        }

        const data = await this.fetch<EMAResponse>(
          `/v1/indicators/ema/${symbol}`,
          { timespan, 'window': period, limit, series_type: 'close' }
        );

        if (!data?.results?.values) return null;

        return {
          period,
          values: data.results.values.map((v) => ({
            timestamp: v.timestamp,
            value: v.value,
          })),
        };
      }
    );
  }

  /**
   * Get MACD (Moving Average Convergence Divergence)
   */
  async getMACD(
    ticker: string,
    timespan: string = 'day',
    shortWindow: number = 12,
    longWindow: number = 26,
    signalWindow: number = 9,
    limit: number = 50
  ): Promise<MACDResult | null> {
    const symbol = ticker.toUpperCase();

    return this.getCached<MACDResult>(
      `macd:${symbol}:${timespan}:${shortWindow}:${longWindow}:${signalWindow}`,
      CACHE_TTL.indicators,
      async () => {
        interface MACDResponse {
          results?: {
            values?: Array<{
              timestamp: number;
              value: number;
              signal: number;
              histogram: number;
            }>;
          };
        }

        const data = await this.fetch<MACDResponse>(
          `/v1/indicators/macd/${symbol}`,
          {
            timespan,
            short_window: shortWindow,
            long_window: longWindow,
            signal_window: signalWindow,
            limit,
            series_type: 'close',
          }
        );

        if (!data?.results?.values) return null;

        return {
          values: data.results.values.map((v) => ({
            timestamp: v.timestamp,
            macd: v.value,
            signal: v.signal,
            histogram: v.histogram,
          })),
        };
      }
    );
  }

  /**
   * Get RSI (Relative Strength Index)
   */
  async getRSI(ticker: string, period: number = 14, timespan: string = 'day', limit: number = 50): Promise<RSIResult | null> {
    const symbol = ticker.toUpperCase();

    return this.getCached<RSIResult>(
      `rsi:${symbol}:${period}:${timespan}:${limit}`,
      CACHE_TTL.indicators,
      async () => {
        interface RSIResponse {
          results?: {
            values?: Array<{ timestamp: number; value: number }>;
          };
        }

        const data = await this.fetch<RSIResponse>(
          `/v1/indicators/rsi/${symbol}`,
          { timespan, 'window': period, limit, series_type: 'close' }
        );

        if (!data?.results?.values) return null;

        return {
          period,
          values: data.results.values.map((v) => ({
            timestamp: v.timestamp,
            value: v.value,
          })),
        };
      }
    );
  }

  // ============================================
  // Options Data Methods
  // ============================================

  /**
   * Get options chain for a ticker
   */
  async getOptionsChain(ticker: string, expirationDate?: string): Promise<OptionsChain | null> {
    const symbol = ticker.toUpperCase();
    const expDate = expirationDate || this.getNextFridayDate();

    return this.getCached<OptionsChain>(
      `options:${symbol}:${expDate}`,
      CACHE_TTL.options,
      async () => {
        // Massive.com v3 options snapshot response structure
        // Fields are nested under 'details' and 'underlying_asset'
        interface OptionsResponse {
          results?: Array<{
            details: {
              ticker: string;
              contract_type: 'call' | 'put';
              strike_price: number;
              expiration_date: string;
              shares_per_contract: number;
              exercise_style: string;
            };
            underlying_asset?: {
              ticker: string;
              price: number;
            };
            day?: {
              open: number;
              high: number;
              low: number;
              close: number;
              volume: number;
              vwap: number;
            };
            last_quote?: {
              bid: number;
              ask: number;
              midpoint: number;
              last_updated: number;
            };
            last_trade?: {
              price: number;
              size: number;
            };
            open_interest?: number;
            implied_volatility?: number;
            greeks?: {
              delta: number;
              gamma: number;
              theta: number;
              vega: number;
            };
          }>;
        }

        const data = await this.fetch<OptionsResponse>(
          `/v3/snapshot/options/${symbol}`,
          { expiration_date: expDate, limit: 250 }
        );

        if (!data?.results || data.results.length === 0) return null;

        const calls: OptionContract[] = [];
        const puts: OptionContract[] = [];

        for (const opt of data.results) {
          // Skip if details is missing (malformed response)
          if (!opt.details) continue;

          const contract: OptionContract = {
            ticker: opt.details.ticker,
            underlying: opt.underlying_asset?.ticker || symbol,
            type: opt.details.contract_type,
            strike: opt.details.strike_price,
            expiration: opt.details.expiration_date,
            bid: opt.last_quote?.bid || 0,
            ask: opt.last_quote?.ask || 0,
            last: opt.last_trade?.price || opt.day?.close || 0,
            volume: opt.day?.volume || 0,
            openInterest: opt.open_interest || 0,
            impliedVolatility: opt.implied_volatility || 0,
            delta: opt.greeks?.delta || 0,
            gamma: opt.greeks?.gamma || 0,
            theta: opt.greeks?.theta || 0,
            vega: opt.greeks?.vega || 0,
          };

          if (opt.details.contract_type === 'call') {
            calls.push(contract);
          } else if (opt.details.contract_type === 'put') {
            puts.push(contract);
          }
        }

        // Sort by strike price
        calls.sort((a, b) => a.strike - b.strike);
        puts.sort((a, b) => a.strike - b.strike);

        return {
          underlying: symbol,
          expirationDate: expDate,
          calls,
          puts,
        };
      }
    );
  }

  /**
   * Get single options contract snapshot with Greeks
   * Uses Massive.com endpoint: /v3/snapshot/options/{underlyingAsset}
   *
   * @param contractTicker - Full options contract ticker (e.g., O:SPY251219C00600000)
   * @returns Option contract with Greeks (delta, gamma, theta, vega, IV)
   */
  async getOptionsContract(contractTicker: string): Promise<OptionContract | null> {
    const ticker = contractTicker.toUpperCase();

    return this.getCached<OptionContract>(
      `option:${ticker}`,
      CACHE_TTL.options,
      async () => {
        // Parse the contract ticker to get underlying and details
        // Format: O:AAPL251219C00150000
        const match = ticker.match(/^O?:?([A-Z]+)(\d{6})([CP])(\d+)$/);
        if (!match) {
          console.warn(`[MarketData] Invalid options contract ticker: ${ticker}`);
          return null;
        }

        const underlying = match[1];
        const dateStr = match[2];
        const contractType = match[3] === 'C' ? 'call' : 'put';
        const strikeRaw = parseInt(match[4], 10);
        const strike = strikeRaw / 1000; // Convert to actual price

        // Parse expiration date (YYMMDD format)
        const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        const expiration = `${year}-${month}-${day}`;

        // Massive.com v3 options snapshot response structure
        interface OptionSnapshotResponse {
          results?: Array<{
            details: {
              ticker: string;
              contract_type: 'call' | 'put';
              strike_price: number;
              expiration_date: string;
            };
            underlying_asset?: {
              ticker: string;
              price: number;
            };
            last_quote?: { bid: number; ask: number; midpoint: number };
            last_trade?: { price: number; size: number };
            day?: { volume: number; close: number };
            open_interest?: number;
            implied_volatility?: number;
            greeks?: {
              delta: number;
              gamma: number;
              theta: number;
              vega: number;
            };
            break_even_price?: number;
          }>;
        }

        // Query options snapshot with specific filters
        const data = await this.fetch<OptionSnapshotResponse>(
          `/v3/snapshot/options/${underlying}`,
          {
            strike_price: strike,
            expiration_date: expiration,
            contract_type: contractType,
            limit: 1,
          }
        );

        if (!data?.results?.[0]?.details) return null;

        const opt = data.results[0];
        return {
          ticker: opt.details.ticker,
          underlying: opt.underlying_asset?.ticker || underlying,
          type: opt.details.contract_type,
          strike: opt.details.strike_price,
          expiration: opt.details.expiration_date,
          bid: opt.last_quote?.bid || 0,
          ask: opt.last_quote?.ask || 0,
          last: opt.last_trade?.price || opt.day?.close || 0,
          volume: opt.day?.volume || 0,
          openInterest: opt.open_interest || 0,
          impliedVolatility: opt.implied_volatility || 0,
          delta: opt.greeks?.delta || 0,
          gamma: opt.greeks?.gamma || 0,
          theta: opt.greeks?.theta || 0,
          vega: opt.greeks?.vega || 0,
        };
      }
    );
  }

  /**
   * Get options contracts near the money for a ticker
   * Useful for finding liquid options for trading
   */
  async getOptionsNearMoney(
    ticker: string,
    expirationDate?: string,
    strikeRange: number = 5
  ): Promise<OptionContract[]> {
    const symbol = ticker.toUpperCase();
    const expDate = expirationDate || this.getNextFridayDate();

    // Get current price to determine ATM strike
    const quote = await this.getQuote(symbol);
    if (!quote) return [];

    const currentPrice = quote.price;
    const chain = await this.getOptionsChain(symbol, expDate);
    if (!chain) return [];

    // Filter to strikes within range of current price
    const nearMoney: OptionContract[] = [];
    const minStrike = currentPrice * (1 - strikeRange / 100);
    const maxStrike = currentPrice * (1 + strikeRange / 100);

    for (const contract of [...chain.calls, ...chain.puts]) {
      if (contract.strike >= minStrike && contract.strike <= maxStrike) {
        nearMoney.push(contract);
      }
    }

    // Sort by distance from current price
    nearMoney.sort((a, b) =>
      Math.abs(a.strike - currentPrice) - Math.abs(b.strike - currentPrice)
    );

    return nearMoney;
  }

  /**
   * Get next Friday's date (common options expiration)
   */
  private getNextFridayDate(): string {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    return nextFriday.toISOString().split('T')[0];
  }

  // ============================================
  // Historical Data Methods
  // ============================================

  /**
   * Get historical bars for a specific date range
   * Useful for analyzing price action during events (FOMC, earnings, etc.)
   */
  async getHistoricalBars(
    ticker: string,
    fromDate: string,
    toDate: string,
    timespan: string = 'minute',
    multiplier: number = 5
  ): Promise<Bar[]> {
    const symbol = ticker.toUpperCase();
    const cacheKey = `hist:${symbol}:${fromDate}:${toDate}:${timespan}:${multiplier}`;

    const bars = await this.getCached<Bar[]>(
      cacheKey,
      CACHE_TTL.aggregates * 10, // Cache historical data longer
      async () => {
        interface AggregatesResponse {
          results?: Array<{
            t: number;
            o: number;
            h: number;
            l: number;
            c: number;
            v: number;
            vw?: number;
          }>;
        }

        const data = await this.fetch<AggregatesResponse>(
          `/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${fromDate}/${toDate}`,
          { limit: 50000, sort: 'asc' }
        );

        if (!data?.results) return [];

        // Filter out bars with invalid OHLC values to prevent chart errors
        return data.results
          .filter((bar) =>
            bar.t != null && isFinite(bar.t) &&
            bar.o != null && isFinite(bar.o) &&
            bar.h != null && isFinite(bar.h) &&
            bar.l != null && isFinite(bar.l) &&
            bar.c != null && isFinite(bar.c)
          )
          .map((bar) => ({
            t: bar.t,
            timestamp: bar.t,
            date: new Date(bar.t).toISOString(),
            o: bar.o,
            h: bar.h,
            l: bar.l,
            c: bar.c,
            v: bar.v || 0,
            vw: bar.vw,
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v || 0,
            vwap: bar.vw,
          }));
      }
    );

    return bars || [];
  }

  /**
   * Get bars around a specific event date (e.g., FOMC meeting)
   * Returns data from daysBefore to daysAfter the event
   */
  async getEventBars(
    ticker: string,
    eventDate: string,
    daysBefore: number = 2,
    daysAfter: number = 2,
    timespan: string = 'minute',
    multiplier: number = 5
  ): Promise<Bar[]> {
    const event = new Date(eventDate);
    const from = new Date(event);
    from.setDate(event.getDate() - daysBefore);
    const to = new Date(event);
    to.setDate(event.getDate() + daysAfter);

    return this.getHistoricalBars(
      ticker,
      from.toISOString().split('T')[0],
      to.toISOString().split('T')[0],
      timespan,
      multiplier
    );
  }

  // ============================================
  // Key Levels & Analysis Methods
  // ============================================

  /**
   * Calculate key levels for a ticker using real market data
   */
  async getKeyLevels(ticker: string): Promise<KeyLevel[]> {
    const symbol = ticker.toUpperCase();

    const result = await this.getCached<KeyLevel[]>(
      `levels:${symbol}`,
      CACHE_TTL.levels,
      async () => {
        const levels: KeyLevel[] = [];
        const quote = await this.getQuote(symbol);
        if (!quote) return levels;

        const currentPrice = quote.price;

        // PDH/PDL from quote - validate price > 0 to avoid invalid levels
        if (quote.prevHigh && quote.prevHigh > 0) {
          levels.push({
            type: 'pdh',
            price: quote.prevHigh,
            strength: 85,
            distance: ((currentPrice - quote.prevHigh) / currentPrice) * 100,
          });
        }
        if (quote.prevLow && quote.prevLow > 0) {
          levels.push({
            type: 'pdl',
            price: quote.prevLow,
            strength: 85,
            distance: ((currentPrice - quote.prevLow) / currentPrice) * 100,
          });
        }

        // VWAP from quote - validate price > 0 to avoid invalid levels
        if (quote.vwap && quote.vwap > 0) {
          levels.push({
            type: 'vwap',
            price: quote.vwap,
            strength: 90,
            distance: ((currentPrice - quote.vwap) / currentPrice) * 100,
          });
        }

        // Get EMAs
        const [ema9, ema21] = await Promise.all([
          this.getEMA(symbol, 9, 'day', 1),
          this.getEMA(symbol, 21, 'day', 1),
        ]);

        if (ema9?.values?.[0]?.value && ema9.values[0].value > 0) {
          levels.push({
            type: 'ema9',
            price: ema9.values[0].value,
            strength: 70,
            distance: ((currentPrice - ema9.values[0].value) / currentPrice) * 100,
          });
        }
        if (ema21?.values?.[0]?.value && ema21.values[0].value > 0) {
          levels.push({
            type: 'ema21',
            price: ema21.values[0].value,
            strength: 75,
            distance: ((currentPrice - ema21.values[0].value) / currentPrice) * 100,
          });
        }

        // Get SMA 200 for major support/resistance
        const sma200 = await this.getSMA(symbol, 200, 'day', 1);
        if (sma200?.values?.[0]?.value && sma200.values[0].value > 0) {
          levels.push({
            type: 'sma200',
            price: sma200.values[0].value,
            strength: 95,
            distance: ((currentPrice - sma200.values[0].value) / currentPrice) * 100,
          });
        }

        // Get ORB levels from intraday data
        // CRITICAL: ORB = Opening Range Breakout = first 30 min AFTER market open (9:30-10:00 AM ET)
        const intradayBars = await this.getIntradayBars(symbol, 1);
        if (intradayBars.length > 0) {
          // Filter to bars within 9:30-10:00 AM ET only (30-min ORB per KCU rules)
          const orbBars = intradayBars.filter(bar => {
            const barTime = new Date(bar.t);
            const etTime = barTime.toLocaleTimeString('en-US', {
              timeZone: 'America/New_York',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            const [hours, minutes] = etTime.split(':').map(Number);
            // 9:30 AM to 10:00 AM ET
            return hours === 9 && minutes >= 30;
          });

          if (orbBars.length > 0) {
            const orbHigh = Math.max(...orbBars.map((b) => b.high));
            const orbLow = Math.min(...orbBars.map((b) => b.low));

            // Validate ORB prices > 0
            if (orbHigh > 0) {
              levels.push({
                type: 'orb_high',
                price: orbHigh,
                strength: 80,
                distance: ((currentPrice - orbHigh) / currentPrice) * 100,
              });
            }
            if (orbLow > 0) {
              levels.push({
                type: 'orb_low',
                price: orbLow,
                strength: 80,
                distance: ((currentPrice - orbLow) / currentPrice) * 100,
              });
            }
          }
        }

        // Get PMH/PML (Premarket High/Low)
        try {
          const premarketBars = await this.getPremarketBars(symbol);
          if (premarketBars.length > 0) {
            const pmh = Math.max(...premarketBars.map(b => b.high));
            const pml = Math.min(...premarketBars.map(b => b.low));

            if (pmh > 0) {
              levels.push({
                type: 'pmh',
                price: pmh,
                strength: 75,
                distance: ((currentPrice - pmh) / currentPrice) * 100,
              });
            }
            if (pml > 0) {
              levels.push({
                type: 'pml',
                price: pml,
                strength: 75,
                distance: ((currentPrice - pml) / currentPrice) * 100,
              });
            }
          }
        } catch (err) {
          // Premarket data may not be available, continue without it
          console.warn(`[Market Data] Failed to fetch premarket for ${symbol}:`, err);
        }

        // Sort by distance from current price
        levels.sort((a, b) => Math.abs(a.distance || 0) - Math.abs(b.distance || 0));

        return levels;
      }
    );

    return result || [];
  }

  /**
   * Detect patience candle pattern in recent bars
   */
  detectPatienceCandle(bars: Bar[]): { forming: boolean; confirmed: boolean; direction: 'bullish' | 'bearish' } | null {
    if (bars.length < 3) return null;

    const recentBars = bars.slice(-3);
    const [bar1, bar2, bar3] = recentBars;

    // Patience candle characteristics:
    // - Small body relative to recent bars
    // - Low volume relative to recent bars
    // - Often appears after a directional move

    const avgBodySize = recentBars.reduce((sum, b) => sum + Math.abs(b.close - b.open), 0) / 3;
    const currentBodySize = Math.abs(bar3.close - bar3.open);
    const avgVolume = recentBars.reduce((sum, b) => sum + b.volume, 0) / 3;

    const isSmallBody = currentBodySize < avgBodySize * 0.5;
    const isLowVolume = bar3.volume < avgVolume * 0.7;
    const forming = isSmallBody && isLowVolume;

    // Confirmed if next candle shows direction
    const direction = bar3.close > bar3.open ? 'bullish' : 'bearish';
    const confirmed = forming && (
      (direction === 'bullish' && bar2.close < bar2.open) ||
      (direction === 'bearish' && bar2.close > bar2.open)
    );

    return { forming, confirmed, direction };
  }

  /**
   * Get complete market snapshot with all data for AI analysis
   */
  async getMarketSnapshot(ticker: string): Promise<MarketSnapshot | null> {
    const symbol = ticker.toUpperCase();

    const [quote, keyLevels, intradayBars] = await Promise.all([
      this.getQuote(symbol),
      this.getKeyLevels(symbol),
      this.getIntradayBars(symbol, 5),
    ]);

    if (!quote) return null;

    // Determine trend based on price vs EMAs
    const ema9 = keyLevels.find((l) => l.type === 'ema9');
    const ema21 = keyLevels.find((l) => l.type === 'ema21');
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';

    if (ema9 && ema21) {
      if (quote.price > ema9.price && ema9.price > ema21.price) {
        trend = 'bullish';
      } else if (quote.price < ema9.price && ema9.price < ema21.price) {
        trend = 'bearish';
      }
    } else if (quote.changePercent > 0.5) {
      trend = 'bullish';
    } else if (quote.changePercent < -0.5) {
      trend = 'bearish';
    }

    // Detect patience candle
    const patienceCandle = intradayBars.length > 0
      ? this.detectPatienceCandle(intradayBars)
      : null;

    return {
      symbol,
      quote,
      keyLevels,
      trend,
      vwap: quote.vwap,
      patienceCandle: patienceCandle ? {
        timeframe: '5m',
        ...patienceCandle,
      } : undefined,
    };
  }

  /**
   * Get multiple market snapshots at once
   */
  async getMarketSnapshots(tickers: string[]): Promise<Map<string, MarketSnapshot>> {
    const results = new Map<string, MarketSnapshot>();

    const promises = tickers.map(async (ticker) => {
      const snapshot = await this.getMarketSnapshot(ticker);
      if (snapshot) {
        results.set(ticker.toUpperCase(), snapshot);
      }
    });

    await Promise.all(promises);
    return results;
  }

  // ============================================
  // Multi-Timeframe (MTF) Analysis Methods
  // ============================================

  /**
   * Calculate EMA from bars
   */
  private calculateEMAFromBars(bars: Bar[], period: number): number {
    if (bars.length < period) return 0;

    const multiplier = 2 / (period + 1);
    let ema = bars.slice(0, period).reduce((sum, b) => sum + b.close, 0) / period;

    for (let i = period; i < bars.length; i++) {
      ema = (bars[i].close - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Get trend analysis for a specific timeframe
   */
  async getTimeframeTrend(ticker: string, timeframe: string): Promise<TimeframeTrend | null> {
    const symbol = ticker.toUpperCase();

    // Map timeframe to minutes/timespan
    const timespanMap: Record<string, { timespan: string; limit: number }> = {
      '5m': { timespan: '5', limit: 50 },
      '15m': { timespan: '15', limit: 50 },
      '1h': { timespan: '60', limit: 50 },
      '4h': { timespan: '240', limit: 50 },
      'daily': { timespan: 'day', limit: 50 },
    };

    const config = timespanMap[timeframe];
    if (!config) return null;

    const bars = await this.getAggregates(symbol, config.timespan, config.limit);
    if (bars.length < 21) return null;

    const currentPrice = bars[bars.length - 1]?.close || 0;
    const ema9 = this.calculateEMAFromBars(bars, 9);
    const ema21 = this.calculateEMAFromBars(bars, 21);

    // Determine price position relative to EMAs
    const threshold = currentPrice * 0.001; // 0.1% threshold for "at"
    const priceVsEma9: 'above' | 'below' | 'at' =
      currentPrice > ema9 + threshold ? 'above' :
      currentPrice < ema9 - threshold ? 'below' : 'at';
    const priceVsEma21: 'above' | 'below' | 'at' =
      currentPrice > ema21 + threshold ? 'above' :
      currentPrice < ema21 - threshold ? 'below' : 'at';

    // Determine EMA alignment
    const emaAlignment: 'bullish' | 'bearish' | 'mixed' =
      ema9 > ema21 ? 'bullish' :
      ema9 < ema21 ? 'bearish' : 'mixed';

    // Determine overall trend for this timeframe
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (priceVsEma9 === 'above' && priceVsEma21 === 'above' && emaAlignment === 'bullish') {
      trend = 'bullish';
    } else if (priceVsEma9 === 'below' && priceVsEma21 === 'below' && emaAlignment === 'bearish') {
      trend = 'bearish';
    }

    return {
      timeframe,
      trend,
      ema9,
      ema21,
      priceVsEma9,
      priceVsEma21,
      emaAlignment,
    };
  }

  /**
   * Get Multi-Timeframe (MTF) Analysis
   * Analyzes trend across 5m, 15m, 1h, and daily timeframes
   */
  async getMTFAnalysis(ticker: string): Promise<MTFAnalysis | null> {
    const symbol = ticker.toUpperCase();
    const cacheKey = `mtf:${symbol}`;

    const result = await this.getCached<MTFAnalysis>(
      cacheKey,
      CACHE_TTL.indicators,
      async () => {
        const quote = await this.getQuote(symbol);
        if (!quote) return null;

        // Analyze all timeframes in parallel
        const timeframePromises = ['5m', '15m', '1h', 'daily'].map(tf =>
          this.getTimeframeTrend(symbol, tf)
        );
        const timeframeResults = await Promise.all(timeframePromises);
        const timeframes = timeframeResults.filter((t): t is TimeframeTrend => t !== null);

        if (timeframes.length === 0) return null;

        // Calculate alignment score
        const bullishCount = timeframes.filter(t => t.trend === 'bullish').length;
        const bearishCount = timeframes.filter(t => t.trend === 'bearish').length;
        const totalTimeframes = timeframes.length;

        let overallBias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        let alignmentScore = 0;

        if (bullishCount === totalTimeframes) {
          overallBias = 'bullish';
          alignmentScore = 100;
        } else if (bearishCount === totalTimeframes) {
          overallBias = 'bearish';
          alignmentScore = 100;
        } else if (bullishCount > bearishCount) {
          overallBias = 'bullish';
          alignmentScore = Math.round((bullishCount / totalTimeframes) * 100);
        } else if (bearishCount > bullishCount) {
          overallBias = 'bearish';
          alignmentScore = Math.round((bearishCount / totalTimeframes) * 100);
        } else {
          alignmentScore = 50;
        }

        // Find conflicting timeframes
        const conflictingTimeframes = timeframes
          .filter(t => t.trend !== overallBias && t.trend !== 'neutral')
          .map(t => t.timeframe);

        return {
          symbol,
          currentPrice: quote.price,
          timeframes,
          overallBias,
          alignmentScore,
          conflictingTimeframes,
        };
      }
    );

    return result;
  }

  // ============================================
  // LTP Framework Analysis
  // ============================================

  /**
   * Get comprehensive LTP (Levels, Trend, Patience) Analysis
   * This is the core analysis method for the KCU trading framework
   */
  async getLTPAnalysis(ticker: string): Promise<LTPAnalysis | null> {
    const symbol = ticker.toUpperCase();
    const cacheKey = `ltp:${symbol}`;

    const result = await this.getCached<LTPAnalysis>(
      cacheKey,
      CACHE_TTL.snapshot,
      async () => {
        // Fetch all required data in parallel
        const [quote, keyLevels, mtf, bars5m, bars15m, bars1h] = await Promise.all([
          this.getQuote(symbol),
          this.getKeyLevels(symbol),
          this.getMTFAnalysis(symbol),
          this.getAggregates(symbol, '5', 50),
          this.getAggregates(symbol, '15', 50),
          this.getAggregates(symbol, '60', 50),
        ]);

        if (!quote || !mtf) return null;

        const currentPrice = quote.price;

        // ============ LEVELS ANALYSIS ============
        const pdh = keyLevels.find(l => l.type === 'pdh')?.price || null;
        const pdl = keyLevels.find(l => l.type === 'pdl')?.price || null;
        const vwap = keyLevels.find(l => l.type === 'vwap')?.price || quote.vwap || null;
        const orbHigh = keyLevels.find(l => l.type === 'orb_high')?.price || null;
        const orbLow = keyLevels.find(l => l.type === 'orb_low')?.price || null;
        const ema9 = keyLevels.find(l => l.type === 'ema9')?.price || null;
        const ema21 = keyLevels.find(l => l.type === 'ema21')?.price || null;
        const sma200 = keyLevels.find(l => l.type === 'sma200')?.price || null;
        const pmh = keyLevels.find(l => l.type === 'pmh')?.price || null;
        const pml = keyLevels.find(l => l.type === 'pml')?.price || null;

        // Price position relative to SMA200 (major trend indicator)
        const threshold200 = currentPrice * 0.002; // 0.2% threshold
        const priceVsSma200: 'above' | 'below' | 'at' | null = sma200 === null ? null :
          currentPrice > sma200 + threshold200 ? 'above' :
          currentPrice < sma200 - threshold200 ? 'below' : 'at';

        // Price position relative to VWAP
        const pricePosition: 'above_vwap' | 'below_vwap' | 'at_vwap' =
          vwap === null ? 'at_vwap' :
          currentPrice > vwap * 1.001 ? 'above_vwap' :
          currentPrice < vwap * 0.999 ? 'below_vwap' : 'at_vwap';

        // Find nearest levels
        const nearest = keyLevels.slice(0, 4);

        // Level proximity score (are we at a tradeable level?)
        const nearestDistance = Math.min(...keyLevels.map(l => Math.abs(l.distance || 100)));
        const levelProximity: 'at_level' | 'near_level' | 'between_levels' =
          nearestDistance < 0.3 ? 'at_level' :
          nearestDistance < 0.8 ? 'near_level' : 'between_levels';

        // Level score (higher if we're at a strong level)
        let levelScore = 50; // Base score
        if (levelProximity === 'at_level') {
          const nearestLevel = keyLevels[0];
          levelScore = nearestLevel ? Math.min(95, nearestLevel.strength + 10) : 70;
        } else if (levelProximity === 'near_level') {
          levelScore = 65;
        }

        // ============ TREND ANALYSIS ============
        const dailyTrend = mtf.timeframes.find(t => t.timeframe === 'daily')?.trend || 'neutral';
        const intradayTrend = mtf.overallBias;
        const trendAlignment: 'aligned' | 'conflicting' =
          dailyTrend === intradayTrend || dailyTrend === 'neutral' || intradayTrend === 'neutral'
            ? 'aligned' : 'conflicting';

        // Trend score based on MTF alignment
        let trendScore = mtf.alignmentScore;
        if (trendAlignment === 'aligned' && dailyTrend !== 'neutral') {
          trendScore = Math.min(100, trendScore + 10);
        } else if (trendAlignment === 'conflicting') {
          trendScore = Math.max(30, trendScore - 20);
        }

        // ============ PATIENCE CANDLE ANALYSIS ============
        const candle5m = bars5m.length >= 3 ? this.detectPatienceCandle(bars5m) : null;
        const candle15m = bars15m.length >= 3 ? this.detectPatienceCandle(bars15m) : null;
        const candle1h = bars1h.length >= 3 ? this.detectPatienceCandle(bars1h) : null;

        // Patience score
        let patienceScore = 40; // Base score
        if (candle5m?.confirmed) patienceScore += 20;
        else if (candle5m?.forming) patienceScore += 10;
        if (candle15m?.confirmed) patienceScore += 25;
        else if (candle15m?.forming) patienceScore += 12;
        if (candle1h?.confirmed) patienceScore += 15;
        else if (candle1h?.forming) patienceScore += 8;
        patienceScore = Math.min(100, patienceScore);

        // ============ OVERALL LTP GRADE ============
        const confluenceScore = Math.round(
          (levelScore * 0.35) + (trendScore * 0.40) + (patienceScore * 0.25)
        );

        const grade: LTPAnalysis['grade'] =
          confluenceScore >= 90 ? 'A+' :
          confluenceScore >= 80 ? 'A' :
          confluenceScore >= 70 ? 'B' :
          confluenceScore >= 60 ? 'C' :
          confluenceScore >= 50 ? 'D' : 'F';

        const setupQuality: LTPAnalysis['setupQuality'] =
          grade === 'A+' || grade === 'A' ? 'Strong' :
          grade === 'B' || grade === 'C' ? 'Moderate' :
          grade === 'D' ? 'Weak' : 'No Setup';

        // Generate recommendation
        let recommendation = '';
        if (setupQuality === 'Strong') {
          recommendation = `${intradayTrend.toUpperCase()} setup at ${levelProximity === 'at_level' ? 'key level' : 'level zone'}. MTF aligned. ${candle15m?.confirmed ? 'Patience confirmed.' : candle5m?.forming ? 'Watch for patience confirmation.' : 'Wait for patience candle.'}`;
        } else if (setupQuality === 'Moderate') {
          recommendation = `Potential ${intradayTrend} setup forming. ${trendAlignment === 'conflicting' ? 'Caution: MTF conflict. ' : ''}${levelProximity === 'between_levels' ? 'Not at a key level yet.' : ''} Wait for better confluence.`;
        } else if (setupQuality === 'Weak') {
          recommendation = `Weak setup conditions. ${trendAlignment === 'conflicting' ? 'Timeframes conflicting. ' : ''}${levelProximity === 'between_levels' ? 'Price between levels. ' : ''}No trade recommended.`;
        } else {
          recommendation = 'No clear setup. Wait for price to reach a key level with trend alignment.';
        }

        return {
          symbol,
          timestamp: new Date().toISOString(),
          levels: {
            nearest,
            pdh,
            pdl,
            vwap,
            orbHigh,
            orbLow,
            ema9,
            ema21,
            sma200,
            pmh,
            pml,
            priceVsSma200,
            pricePosition,
            levelProximity,
            levelScore,
          },
          trend: {
            mtf,
            dailyTrend,
            intradayTrend,
            trendAlignment,
            trendScore,
          },
          patience: {
            candle5m,
            candle15m,
            candle1h,
            patienceScore,
          },
          confluenceScore,
          grade,
          setupQuality,
          recommendation,
        };
      }
    );

    return result;
  }

  // ============================================
  // Economic Calendar & Earnings Methods
  // ============================================

  /**
   * Get upcoming high-impact economic events
   * Note: This uses a combination of hardcoded major events and API data when available
   */
  async getUpcomingEconomicEvents(daysAhead: number = 7): Promise<EconomicEvent[]> {
    const cacheKey = `econ:upcoming:${daysAhead}`;

    const result = await this.getCached<EconomicEvent[]>(
      cacheKey,
      CACHE_TTL.levels, // Cache for 5 minutes
      async () => {
        const events: EconomicEvent[] = [];
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + daysAhead);

        // Major recurring economic events (approximate schedules)
        // FOMC meetings are typically every 6 weeks
        // CPI is released around the 10th-13th of each month
        // NFP is first Friday of each month
        // Retail Sales is around 15th of each month

        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // Check for CPI (usually 2nd week of month)
        const cpiDate = new Date(currentYear, currentMonth, 12);
        if (cpiDate >= today && cpiDate <= endDate) {
          events.push({
            date: cpiDate.toISOString().split('T')[0],
            time: '08:30 ET',
            event: 'CPI (Consumer Price Index)',
            impact: 'high',
          });
        }

        // Check for NFP (first Friday)
        const firstDay = new Date(currentYear, currentMonth, 1);
        const firstFriday = new Date(currentYear, currentMonth, 1 + ((5 - firstDay.getDay() + 7) % 7));
        if (firstFriday >= today && firstFriday <= endDate) {
          events.push({
            date: firstFriday.toISOString().split('T')[0],
            time: '08:30 ET',
            event: 'Non-Farm Payrolls (NFP)',
            impact: 'high',
          });
        }

        // Check for Retail Sales (mid-month)
        const retailDate = new Date(currentYear, currentMonth, 15);
        if (retailDate >= today && retailDate <= endDate) {
          events.push({
            date: retailDate.toISOString().split('T')[0],
            time: '08:30 ET',
            event: 'Retail Sales',
            impact: 'medium',
          });
        }

        // FOMC dates for 2024-2025 (known schedule)
        const fomcDates = [
          '2024-01-31', '2024-03-20', '2024-05-01', '2024-06-12',
          '2024-07-31', '2024-09-18', '2024-11-07', '2024-12-18',
          '2025-01-29', '2025-03-19', '2025-05-07', '2025-06-18',
          '2025-07-30', '2025-09-17', '2025-11-05', '2025-12-17',
          '2026-01-28', '2026-03-18',
        ];

        for (const fomcDate of fomcDates) {
          const fomc = new Date(fomcDate);
          if (fomc >= today && fomc <= endDate) {
            events.push({
              date: fomcDate,
              time: '14:00 ET',
              event: 'FOMC Rate Decision',
              impact: 'high',
            });
          }
        }

        // Sort by date
        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return events;
      }
    );

    return result || [];
  }

  /**
   * Get earnings calendar for major stocks (SPY components, etc.)
   * Uses Polygon's ticker details endpoint for earnings dates
   */
  async getUpcomingEarnings(tickers: string[], daysAhead: number = 7): Promise<EarningsEvent[]> {
    const cacheKey = `earnings:${tickers.join(',')}:${daysAhead}`;

    const result = await this.getCached<EarningsEvent[]>(
      cacheKey,
      CACHE_TTL.levels,
      async () => {
        const earnings: EarningsEvent[] = [];
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + daysAhead);

        // Fetch ticker details in parallel to get earnings dates
        const promises = tickers.map(async (ticker) => {
          interface TickerDetails {
            results?: {
              ticker?: string;
              next_earnings_date?: string;
            };
          }

          const data = await this.fetch<TickerDetails>(`/v3/reference/tickers/${ticker.toUpperCase()}`);

          if (data?.results?.next_earnings_date) {
            const earningsDate = new Date(data.results.next_earnings_date);
            if (earningsDate >= today && earningsDate <= endDate) {
              earnings.push({
                symbol: ticker.toUpperCase(),
                date: data.results.next_earnings_date,
                time: 'unknown',
              });
            }
          }
        });

        await Promise.all(promises);

        // Sort by date
        earnings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return earnings;
      }
    );

    return result || [];
  }

  /**
   * Check if there are high-impact events today
   */
  async hasHighImpactEventToday(): Promise<{ hasEvent: boolean; events: EconomicEvent[] }> {
    const events = await this.getUpcomingEconomicEvents(1);
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter(e => e.date === today && e.impact === 'high');

    return {
      hasEvent: todayEvents.length > 0,
      events: todayEvents,
    };
  }

  /**
   * Get market context summary including economic events
   */
  async getMarketContext(): Promise<{
    marketStatus: MarketStatus;
    vix: number;
    volatilityLevel: 'low' | 'normal' | 'high' | 'extreme';
    upcomingEvents: EconomicEvent[];
    highImpactToday: boolean;
  }> {
    const [marketStatus, vix, events, todayCheck] = await Promise.all([
      this.getMarketStatus(),
      this.getVIX(),
      this.getUpcomingEconomicEvents(7),
      this.hasHighImpactEventToday(),
    ]);

    const volatilityLevel =
      vix < 15 ? 'low' :
      vix < 20 ? 'normal' :
      vix < 30 ? 'high' : 'extreme';

    return {
      marketStatus,
      vix,
      volatilityLevel,
      upcomingEvents: events,
      highImpactToday: todayCheck.hasEvent,
    };
  }

  // ============================================
  // Proactive Coaching Hot Context Methods
  // ============================================

  /**
   * Get market breadth data from Redis (populated by market-worker)
   * Returns real-time ADD, VOLD, TICK data for proactive coaching
   */
  async getMarketBreadth(): Promise<MarketBreadth | null> {
    return getCacheValue<MarketBreadth>('context:breadth');
  }

  /**
   * Get the full hot context from Redis
   * Contains breadth, calendar, warnings - everything for proactive coaching
   */
  async getHotContext(): Promise<MarketHotContext | null> {
    return getCacheValue<MarketHotContext>('context:hot');
  }

  /**
   * Get active proactive warnings
   * These are time-sensitive alerts that need immediate attention
   */
  async getActiveWarnings(): Promise<ProactiveWarning[]> {
    const hotContext = await this.getHotContext();
    return hotContext?.activeWarnings || [];
  }

  /**
   * Get enhanced economic calendar with time-to-event calculations
   */
  async getEnhancedCalendar(): Promise<EnhancedEconomicEvent[]> {
    const cached = await getCacheValue<EnhancedEconomicEvent[]>('context:calendar');
    return cached || [];
  }

  /**
   * Check if there's an imminent high-impact event
   * Used by the intervention engine to block/warn trades
   */
  async checkImminentEvent(): Promise<{
    isImminent: boolean;
    event: EnhancedEconomicEvent | null;
    minutesAway: number;
  }> {
    const hotContext = await this.getHotContext();

    if (!hotContext?.calendar?.isEventImminent || !hotContext.calendar.imminentEvent) {
      return { isImminent: false, event: null, minutesAway: -1 };
    }

    return {
      isImminent: true,
      event: hotContext.calendar.imminentEvent,
      minutesAway: hotContext.calendar.imminentEvent.minutesUntilEvent,
    };
  }

  /**
   * Get current trading conditions based on breadth + calendar
   * Returns green/yellow/red status for the intervention engine
   */
  async getTradingConditions(): Promise<{
    status: 'green' | 'yellow' | 'red';
    message: string;
    restrictions: string[];
    breadthBias: MarketBreadth['tradingBias'] | null;
  }> {
    const hotContext = await this.getHotContext();

    if (!hotContext) {
      return {
        status: 'green',
        message: 'Market data unavailable. Trade with normal caution.',
        restrictions: [],
        breadthBias: null,
      };
    }

    return {
      status: hotContext.tradingConditions.status,
      message: hotContext.tradingConditions.message,
      restrictions: hotContext.tradingConditions.restrictions,
      breadthBias: hotContext.breadth?.tradingBias || null,
    };
  }

  /**
   * Should the user avoid going long based on market breadth?
   * Used by intervention engine for "Don't fight the river" logic
   */
  async shouldAvoidLongs(): Promise<{
    avoid: boolean;
    reason: string | null;
    severity: 'high' | 'medium' | 'low';
  }> {
    const breadth = await this.getMarketBreadth();

    if (!breadth) {
      return { avoid: false, reason: null, severity: 'low' };
    }

    // Strong bearish breadth = avoid longs
    if (breadth.add.trend === 'strong_bearish') {
      return {
        avoid: true,
        reason: `ADD is ${breadth.add.value}. The river is flowing DOWN hard. Don't swim upstream.`,
        severity: 'high',
      };
    }

    if (breadth.add.trend === 'bearish' && breadth.vold.trend === 'selling_pressure') {
      return {
        avoid: true,
        reason: 'Bearish breadth with selling pressure. Favor shorts or stay flat.',
        severity: 'medium',
      };
    }

    if (breadth.tradingBias === 'favor_shorts') {
      return {
        avoid: true,
        reason: breadth.coachingMessage || 'Market breadth favoring shorts.',
        severity: 'medium',
      };
    }

    return { avoid: false, reason: null, severity: 'low' };
  }

  /**
   * Should the user avoid going short based on market breadth?
   */
  async shouldAvoidShorts(): Promise<{
    avoid: boolean;
    reason: string | null;
    severity: 'high' | 'medium' | 'low';
  }> {
    const breadth = await this.getMarketBreadth();

    if (!breadth) {
      return { avoid: false, reason: null, severity: 'low' };
    }

    // Strong bullish breadth = avoid shorts
    if (breadth.add.trend === 'strong_bullish') {
      return {
        avoid: true,
        reason: `ADD is +${breadth.add.value}. Bulls are RIPPING. Don't fight it.`,
        severity: 'high',
      };
    }

    if (breadth.add.trend === 'bullish' && breadth.vold.trend === 'buying_pressure') {
      return {
        avoid: true,
        reason: 'Bullish breadth with buying pressure. Favor longs or stay flat.',
        severity: 'medium',
      };
    }

    if (breadth.tradingBias === 'favor_longs') {
      return {
        avoid: true,
        reason: breadth.coachingMessage || 'Market breadth favoring longs.',
        severity: 'medium',
      };
    }

    return { avoid: false, reason: null, severity: 'low' };
  }
}

// Singleton instance
export const marketDataService = new MarketDataService();

// Export convenience functions
export async function getQuote(ticker: string): Promise<Quote | null> {
  return marketDataService.getQuote(ticker);
}

export async function getQuotes(tickers: string[]): Promise<Map<string, Quote>> {
  return marketDataService.getQuotes(tickers);
}

export async function getAggregates(
  ticker: string,
  timespan?: string,
  limit?: number
): Promise<Bar[]> {
  return marketDataService.getAggregates(ticker, timespan, limit);
}

export async function getMarketStatus(): Promise<MarketStatus> {
  return marketDataService.getMarketStatus();
}

export async function isMarketOpen(): Promise<boolean> {
  return marketDataService.isMarketOpen();
}

export async function getIndexQuote(index: string): Promise<IndexQuote | null> {
  return marketDataService.getIndexQuote(index);
}

export async function getVIX(): Promise<number> {
  return marketDataService.getVIX();
}

export async function getSMA(ticker: string, period?: number, timespan?: string, limit?: number): Promise<SMAResult | null> {
  return marketDataService.getSMA(ticker, period, timespan, limit);
}

export async function getEMA(ticker: string, period?: number, timespan?: string, limit?: number): Promise<EMAResult | null> {
  return marketDataService.getEMA(ticker, period, timespan, limit);
}

export async function getMACD(ticker: string, timespan?: string): Promise<MACDResult | null> {
  return marketDataService.getMACD(ticker, timespan);
}

export async function getRSI(ticker: string, period?: number, timespan?: string): Promise<RSIResult | null> {
  return marketDataService.getRSI(ticker, period, timespan);
}

export async function getOptionsChain(ticker: string, expirationDate?: string): Promise<OptionsChain | null> {
  return marketDataService.getOptionsChain(ticker, expirationDate);
}

export async function getHistoricalBars(
  ticker: string,
  fromDate: string,
  toDate: string,
  timespan?: string,
  multiplier?: number
): Promise<Bar[]> {
  return marketDataService.getHistoricalBars(ticker, fromDate, toDate, timespan, multiplier);
}

export async function getEventBars(
  ticker: string,
  eventDate: string,
  daysBefore?: number,
  daysAfter?: number
): Promise<Bar[]> {
  return marketDataService.getEventBars(ticker, eventDate, daysBefore, daysAfter);
}

export async function getKeyLevels(ticker: string): Promise<KeyLevel[]> {
  return marketDataService.getKeyLevels(ticker);
}

export async function getMarketSnapshot(ticker: string): Promise<MarketSnapshot | null> {
  return marketDataService.getMarketSnapshot(ticker);
}

export async function getMarketSnapshots(tickers: string[]): Promise<Map<string, MarketSnapshot>> {
  return marketDataService.getMarketSnapshots(tickers);
}

export async function getMTFAnalysis(ticker: string): Promise<MTFAnalysis | null> {
  return marketDataService.getMTFAnalysis(ticker);
}

export async function getLTPAnalysis(ticker: string): Promise<LTPAnalysis | null> {
  return marketDataService.getLTPAnalysis(ticker);
}

export async function getUpcomingEconomicEvents(daysAhead?: number): Promise<EconomicEvent[]> {
  return marketDataService.getUpcomingEconomicEvents(daysAhead);
}

export async function getUpcomingEarnings(tickers: string[], daysAhead?: number): Promise<EarningsEvent[]> {
  return marketDataService.getUpcomingEarnings(tickers, daysAhead);
}

export async function getMarketContext() {
  return marketDataService.getMarketContext();
}

// Proactive Coaching Hot Context Exports
export async function getMarketBreadth(): Promise<MarketBreadth | null> {
  return marketDataService.getMarketBreadth();
}

export async function getHotContext(): Promise<MarketHotContext | null> {
  return marketDataService.getHotContext();
}

export async function getActiveWarnings(): Promise<ProactiveWarning[]> {
  return marketDataService.getActiveWarnings();
}

export async function getEnhancedCalendar(): Promise<EnhancedEconomicEvent[]> {
  return marketDataService.getEnhancedCalendar();
}

export async function checkImminentEvent() {
  return marketDataService.checkImminentEvent();
}

export async function getTradingConditions() {
  return marketDataService.getTradingConditions();
}

export async function shouldAvoidLongs() {
  return marketDataService.shouldAvoidLongs();
}

export async function shouldAvoidShorts() {
  return marketDataService.shouldAvoidShorts();
}

export default marketDataService;
