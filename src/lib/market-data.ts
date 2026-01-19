/**
 * Market Data Service (TypeScript)
 *
 * Integrates with Massive.com for real-time and historical market data.
 * Uses Redis caching when available, falls back to in-memory.
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
}
let redisModule: RedisModule | null = null;

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
  type: 'support' | 'resistance' | 'pdh' | 'pdl' | 'vwap' | 'orb_high' | 'orb_low' | 'ema9' | 'ema21' | 'sma200';
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
    this.baseUrl = 'https://api.polygon.io'; // Polygon.io API (Massive.com uses same API)
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
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[MarketData] API error: ${response.status} - ${error}`);
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
   */
  async getQuote(ticker: string): Promise<Quote | null> {
    const symbol = ticker.toUpperCase();

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

        return data.results.map((bar) => ({
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
   */
  async getIndexQuote(index: string): Promise<IndexQuote | null> {
    const symbol = index.toUpperCase();

    // Map common index names to tickers
    const indexMap: Record<string, string> = {
      'VIX': 'I:VIX',
      'SPX': 'I:SPX',
      'NDX': 'I:NDX',
      'DJI': 'I:DJI',
      'RUT': 'I:RUT',
    };

    const ticker = indexMap[symbol] || `I:${symbol}`;

    return this.getCached<IndexQuote>(
      `index:${symbol}`,
      CACHE_TTL.index,
      async () => {
        interface IndexResponse {
          results?: {
            T?: string;
            v?: number;
            o?: number;
            c?: number;
            h?: number;
            l?: number;
          };
        }

        // Use previous day bar for index values
        const yesterday = this.getDateString(-1);
        const data = await this.fetch<IndexResponse>(
          `/v1/open-close/${ticker}/${yesterday}`
        );

        if (!data?.results) {
          // Try snapshot endpoint as fallback
          const snapshotData = await this.fetch<{ ticker?: { day?: { c: number; o: number } } }>(
            `/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`
          );

          if (snapshotData?.ticker?.day) {
            const d = snapshotData.ticker.day;
            return {
              symbol,
              value: d.c || 0,
              change: (d.c || 0) - (d.o || 0),
              changePercent: d.o ? (((d.c || 0) - d.o) / d.o) * 100 : 0,
              timestamp: new Date().toISOString(),
            };
          }
          return null;
        }

        const r = data.results;
        return {
          symbol,
          value: r.c || 0,
          change: (r.c || 0) - (r.o || 0),
          changePercent: r.o ? (((r.c || 0) - r.o) / r.o) * 100 : 0,
          timestamp: new Date().toISOString(),
        };
      }
    );
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
        interface OptionsResponse {
          results?: Array<{
            ticker: string;
            underlying_ticker: string;
            contract_type: 'call' | 'put';
            strike_price: number;
            expiration_date: string;
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
              last_updated: number;
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

        if (!data?.results) return null;

        const calls: OptionContract[] = [];
        const puts: OptionContract[] = [];

        for (const opt of data.results) {
          const contract: OptionContract = {
            ticker: opt.ticker,
            underlying: opt.underlying_ticker,
            type: opt.contract_type,
            strike: opt.strike_price,
            expiration: opt.expiration_date,
            bid: opt.last_quote?.bid || 0,
            ask: opt.last_quote?.ask || 0,
            last: opt.day?.close || 0,
            volume: opt.day?.volume || 0,
            openInterest: opt.open_interest || 0,
            impliedVolatility: opt.implied_volatility || 0,
            delta: opt.greeks?.delta || 0,
            gamma: opt.greeks?.gamma || 0,
            theta: opt.greeks?.theta || 0,
            vega: opt.greeks?.vega || 0,
          };

          if (opt.contract_type === 'call') {
            calls.push(contract);
          } else {
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

        return data.results.map((bar) => ({
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

        // PDH/PDL from quote
        if (quote.prevHigh) {
          levels.push({
            type: 'pdh',
            price: quote.prevHigh,
            strength: 85,
            distance: ((currentPrice - quote.prevHigh) / currentPrice) * 100,
          });
        }
        if (quote.prevLow) {
          levels.push({
            type: 'pdl',
            price: quote.prevLow,
            strength: 85,
            distance: ((currentPrice - quote.prevLow) / currentPrice) * 100,
          });
        }

        // VWAP from quote
        if (quote.vwap) {
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

        if (ema9?.values?.[0]) {
          levels.push({
            type: 'ema9',
            price: ema9.values[0].value,
            strength: 70,
            distance: ((currentPrice - ema9.values[0].value) / currentPrice) * 100,
          });
        }
        if (ema21?.values?.[0]) {
          levels.push({
            type: 'ema21',
            price: ema21.values[0].value,
            strength: 75,
            distance: ((currentPrice - ema21.values[0].value) / currentPrice) * 100,
          });
        }

        // Get SMA 200 for major support/resistance
        const sma200 = await this.getSMA(symbol, 200, 'day', 1);
        if (sma200?.values?.[0]) {
          levels.push({
            type: 'sma200',
            price: sma200.values[0].value,
            strength: 95,
            distance: ((currentPrice - sma200.values[0].value) / currentPrice) * 100,
          });
        }

        // Get ORB levels from intraday data
        const intradayBars = await this.getIntradayBars(symbol, 1);
        if (intradayBars.length > 0) {
          // First 15 minutes (15 one-minute bars)
          const orbBars = intradayBars.slice(0, 15);
          if (orbBars.length > 0) {
            const orbHigh = Math.max(...orbBars.map((b) => b.high));
            const orbLow = Math.min(...orbBars.map((b) => b.low));

            levels.push({
              type: 'orb_high',
              price: orbHigh,
              strength: 80,
              distance: ((currentPrice - orbHigh) / currentPrice) * 100,
            });
            levels.push({
              type: 'orb_low',
              price: orbLow,
              strength: 80,
              distance: ((currentPrice - orbLow) / currentPrice) * 100,
            });
          }
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

export default marketDataService;
