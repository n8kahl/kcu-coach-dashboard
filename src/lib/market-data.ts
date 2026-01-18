/**
 * Market Data Service (TypeScript)
 *
 * Integrates with Massive.com for real-time and historical market data.
 * Uses Redis caching when available, falls back to in-memory.
 */

import { getCache, setCache } from './redis';

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

// Cache TTLs in seconds
const CACHE_TTL = {
  quote: 5,
  snapshot: 10,
  aggregates: 60,
  levels: 300,
  marketStatus: 30,
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
    // Try Redis cache first
    const redisData = await getCache<T>(key, 'market');
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
      await setCache(key, data, { ttl: ttlSeconds, prefix: 'market' });
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

export default marketDataService;
