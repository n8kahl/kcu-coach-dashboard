/**
 * Market Data Service
 *
 * Integrates with Massive.com for real-time and historical market data.
 * Uses Redis caching when available, falls back to in-memory.
 *
 * Data Consistency Strategy:
 * - First checks Redis hot cache (from MarketRedistributor) for real-time data
 * - Falls back to Massive.com REST API if cache miss or stale
 * - This ensures REST API and WebSocket users see the same price data
 */

import {
  type Quote,
  type Bar,
  type MarketStatus,
  type IndexQuote,
  type SMAResult,
  type EMAResult,
  type MACDResult,
  type RSIResult,
  type KeyLevel,
  type OptionsChain,
  type OptionContract,
  type MarketSnapshot,
  type TimeframeTrend,
  type MTFAnalysis,
  type LTPAnalysis,
  type EconomicEvent,
  type EarningsEvent,
  type MarketBreadth,
  type MarketHotContext,
  type ProactiveWarning,
  type EnhancedEconomicEvent,
  CACHE_TTL,
} from './types';

import {
  getHotCachedQuote,
  getCached,
  getCacheValue,
  clearCache as clearMemoryCache,
  getRedis,
  HOT_CACHE_FRESHNESS_MS,
} from './cache';

import {
  detectSwingPoints,
  filterNearbyLevels,
  mergeMTFLevels,
  type SwingPoint,
  type Bar as SwingBar,
} from '../swing-point-detector';

/**
 * Market Data Service Class
 */
export class MarketDataService {
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
    return getCached(key, ttlSeconds, fetchFn);
  }

  // ============================================
  // Quote Methods
  // ============================================

  /**
   * Get current quote for a ticker
   */
  async getQuote(ticker: string): Promise<Quote | null> {
    const symbol = ticker.toUpperCase();

    // First, check the Redis hot cache from market-worker
    const hotCached = await getHotCachedQuote(symbol);
    if (hotCached) {
      return {
        symbol: hotCached.symbol,
        last: hotCached.price,
        price: hotCached.price,
        change: 0,
        changePercent: 0,
        open: hotCached.data?.open || 0,
        high: hotCached.data?.high || 0,
        low: hotCached.data?.low || 0,
        close: hotCached.data?.close || 0,
        volume: hotCached.data?.volume || 0,
        vwap: hotCached.data?.vwap || 0,
        prevClose: 0,
        prevHigh: 0,
        prevLow: 0,
        timestamp: new Date(hotCached.timestamp).toISOString(),
      };
    }

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

    const promises = tickers.map(async (ticker) => {
      const quote = await this.getQuote(ticker);
      if (quote) {
        results.set(ticker.toUpperCase(), quote);
      }
    });

    await Promise.all(promises);
    return results;
  }

  // ============================================
  // Aggregates/Bar Methods
  // ============================================

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
   */
  async getPremarketBars(ticker: string): Promise<Bar[]> {
    const symbol = ticker.toUpperCase();
    const today = this.getDateString(0);
    const cacheKey = `premarket:${symbol}:${today}`;

    const bars = await this.getCached<Bar[]>(
      cacheKey,
      CACHE_TTL.aggregates,
      async () => {
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

        const data = await this.fetch<AggregatesResponse>(
          `/v2/aggs/ticker/${symbol}/range/1/minute/${today}/${today}`,
          { limit: 500, sort: 'asc' }
        );

        if (!data?.results) return [];

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
   * Get historical bars for a specific date range
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
      CACHE_TTL.aggregates * 10,
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
   * Get bars around a specific event date
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
  // Market Status Methods
  // ============================================

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

  // ============================================
  // Index Data Methods
  // ============================================

  /**
   * Get index quote (VIX, SPX, NDX, DJI, etc.)
   */
  async getIndexQuote(index: string): Promise<IndexQuote | null> {
    const symbol = index.toUpperCase();

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

    const hotCached = await this.getHotCachedIndex(ticker);
    if (hotCached) {
      return hotCached;
    }

    return this.getCached<IndexQuote>(
      `index:${symbol}`,
      CACHE_TTL.index,
      async () => {
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
   * Get hot cached index value from Redis
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

  /**
   * Calculate EMA from bars (internal helper)
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
   */
  async getOptionsContract(contractTicker: string): Promise<OptionContract | null> {
    const ticker = contractTicker.toUpperCase();

    return this.getCached<OptionContract>(
      `option:${ticker}`,
      CACHE_TTL.options,
      async () => {
        const match = ticker.match(/^O?:?([A-Z]+)(\d{6})([CP])(\d+)$/);
        if (!match) {
          console.warn(`[MarketData] Invalid options contract ticker: ${ticker}`);
          return null;
        }

        const underlying = match[1];
        const dateStr = match[2];
        const contractType = match[3] === 'C' ? 'call' : 'put';
        const strikeRaw = parseInt(match[4], 10);
        const strike = strikeRaw / 1000;

        const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        const expiration = `${year}-${month}-${day}`;

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
   */
  async getOptionsNearMoney(
    ticker: string,
    expirationDate?: string,
    strikeRange: number = 5
  ): Promise<OptionContract[]> {
    const symbol = ticker.toUpperCase();
    const expDate = expirationDate || this.getNextFridayDate();

    const quote = await this.getQuote(symbol);
    if (!quote) return [];

    const currentPrice = quote.price;
    const chain = await this.getOptionsChain(symbol, expDate);
    if (!chain) return [];

    const nearMoney: OptionContract[] = [];
    const minStrike = currentPrice * (1 - strikeRange / 100);
    const maxStrike = currentPrice * (1 + strikeRange / 100);

    for (const contract of [...chain.calls, ...chain.puts]) {
      if (contract.strike >= minStrike && contract.strike <= maxStrike) {
        nearMoney.push(contract);
      }
    }

    nearMoney.sort((a, b) =>
      Math.abs(a.strike - currentPrice) - Math.abs(b.strike - currentPrice)
    );

    return nearMoney;
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

        // VWAP from quote
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

        // Get ORB and PMH/PML levels from intraday data
        // Uses most recent trading day (handles market closed scenarios)
        const intradayBars = await this.getIntradayBars(symbol, 1);
        if (intradayBars.length > 0) {
          // Find the most recent trading day from the bars
          const mostRecentBar = intradayBars[intradayBars.length - 1];
          const mostRecentDateET = new Date(mostRecentBar.t).toLocaleDateString('en-US', { timeZone: 'America/New_York' });

          // Helper to parse ET time from bar
          const parseBarTimeET = (bar: Bar) => {
            const barTime = new Date(bar.t);
            const barDateET = barTime.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
            const etTime = barTime.toLocaleTimeString('en-US', {
              timeZone: 'America/New_York',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            const [hours, minutes] = etTime.split(':').map(Number);
            return { barDateET, hours, minutes };
          };

          // ORB Levels (Opening Range: 9:30-10:00 ET)
          const orbBars = intradayBars.filter(bar => {
            const { barDateET, hours, minutes } = parseBarTimeET(bar);
            if (barDateET !== mostRecentDateET) return false;
            return (hours === 9 && minutes >= 30) || (hours === 10 && minutes === 0);
          });

          if (orbBars.length > 0) {
            const orbHigh = Math.max(...orbBars.map((b) => b.high));
            const orbLow = Math.min(...orbBars.map((b) => b.low));

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

          // PMH/PML (Premarket High/Low: 4:00-9:30 AM ET)
          const pmBars = intradayBars.filter(bar => {
            const { barDateET, hours, minutes } = parseBarTimeET(bar);
            if (barDateET !== mostRecentDateET) return false;
            return (hours >= 4 && hours < 9) || (hours === 9 && minutes < 30);
          });

          if (pmBars.length > 0) {
            const pmh = Math.max(...pmBars.map(b => b.high));
            const pml = Math.min(...pmBars.map(b => b.low));

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
        }

        // Get Swing High/Low levels from 4H and 1H MTF charts
        try {
          const [bars4h, bars1h] = await Promise.all([
            this.getAggregates(symbol, '240', 50),  // 4-hour bars
            this.getAggregates(symbol, '60', 50),   // 1-hour bars
          ]);

          // Convert to swing detector bar format
          const convertBars = (bars: Bar[]): SwingBar[] =>
            bars.map(b => ({
              time: b.t,
              open: b.open,
              high: b.high,
              low: b.low,
              close: b.close,
              volume: b.volume,
            }));

          // Detect swing points
          const swings4h = detectSwingPoints(convertBars(bars4h), '4H');
          const swings1h = detectSwingPoints(convertBars(bars1h), '1H');

          // Merge MTF levels (4H takes priority, 1H adds confluence)
          const mergedSwings = mergeMTFLevels(swings4h, swings1h);

          // Filter to only levels near current price (within 5%)
          const nearbySwings = filterNearbyLevels(mergedSwings, currentPrice, 5);

          // Add top swing levels (limit to 4 to avoid cluttering chart)
          for (const swing of nearbySwings.slice(0, 4)) {
            levels.push({
              type: swing.type === 'high'
                ? (swing.timeframe === '4H' ? 'swing_high_4h' : 'swing_high_1h')
                : (swing.timeframe === '4H' ? 'swing_low_4h' : 'swing_low_1h'),
              price: swing.price,
              strength: swing.strength,
              distance: ((currentPrice - swing.price) / currentPrice) * 100,
              touchCount: swing.touchCount,
              timeframe: swing.timeframe,
            });
          }
        } catch (err) {
          console.warn(`[Market Data] Failed to detect swing levels for ${symbol}:`, err);
        }

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

    const avgBodySize = recentBars.reduce((sum, b) => sum + Math.abs(b.close - b.open), 0) / 3;
    const currentBodySize = Math.abs(bar3.close - bar3.open);
    const avgVolume = recentBars.reduce((sum, b) => sum + b.volume, 0) / 3;

    const isSmallBody = currentBodySize < avgBodySize * 0.5;
    const isLowVolume = bar3.volume < avgVolume * 0.7;
    const forming = isSmallBody && isLowVolume;

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
   * Get trend analysis for a specific timeframe
   */
  async getTimeframeTrend(ticker: string, timeframe: string): Promise<TimeframeTrend | null> {
    const symbol = ticker.toUpperCase();

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

    const threshold = currentPrice * 0.001;
    const priceVsEma9: 'above' | 'below' | 'at' =
      currentPrice > ema9 + threshold ? 'above' :
      currentPrice < ema9 - threshold ? 'below' : 'at';
    const priceVsEma21: 'above' | 'below' | 'at' =
      currentPrice > ema21 + threshold ? 'above' :
      currentPrice < ema21 - threshold ? 'below' : 'at';

    const emaAlignment: 'bullish' | 'bearish' | 'mixed' =
      ema9 > ema21 ? 'bullish' :
      ema9 < ema21 ? 'bearish' : 'mixed';

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

        const timeframePromises = ['5m', '15m', '1h', 'daily'].map(tf =>
          this.getTimeframeTrend(symbol, tf)
        );
        const timeframeResults = await Promise.all(timeframePromises);
        const timeframes = timeframeResults.filter((t): t is TimeframeTrend => t !== null);

        if (timeframes.length === 0) return null;

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
   */
  async getLTPAnalysis(ticker: string): Promise<LTPAnalysis | null> {
    const symbol = ticker.toUpperCase();
    const cacheKey = `ltp:${symbol}`;

    try {
      const result = await this.getCached<LTPAnalysis>(
        cacheKey,
        CACHE_TTL.snapshot,
        async () => {
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

        // LEVELS ANALYSIS
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

        const threshold200 = currentPrice * 0.002;
        const priceVsSma200: 'above' | 'below' | 'at' | null = sma200 === null ? null :
          currentPrice > sma200 + threshold200 ? 'above' :
          currentPrice < sma200 - threshold200 ? 'below' : 'at';

        const pricePosition: 'above_vwap' | 'below_vwap' | 'at_vwap' =
          vwap === null ? 'at_vwap' :
          currentPrice > vwap * 1.001 ? 'above_vwap' :
          currentPrice < vwap * 0.999 ? 'below_vwap' : 'at_vwap';

        const nearest = keyLevels.slice(0, 4);

        const nearestDistance = Math.min(...keyLevels.map(l => Math.abs(l.distance || 100)));
        const levelProximity: 'at_level' | 'near_level' | 'between_levels' =
          nearestDistance < 0.3 ? 'at_level' :
          nearestDistance < 0.8 ? 'near_level' : 'between_levels';

        let levelScore = 50;
        if (levelProximity === 'at_level') {
          const nearestLevel = keyLevels[0];
          levelScore = nearestLevel ? Math.min(95, nearestLevel.strength + 10) : 70;
        } else if (levelProximity === 'near_level') {
          levelScore = 65;
        }

        // TREND ANALYSIS
        const dailyTrend = mtf.timeframes.find(t => t.timeframe === 'daily')?.trend || 'neutral';
        const intradayTrend = mtf.overallBias;
        const trendAlignment: 'aligned' | 'conflicting' =
          dailyTrend === intradayTrend || dailyTrend === 'neutral' || intradayTrend === 'neutral'
            ? 'aligned' : 'conflicting';

        let trendScore = mtf.alignmentScore;
        if (trendAlignment === 'aligned' && dailyTrend !== 'neutral') {
          trendScore = Math.min(100, trendScore + 10);
        } else if (trendAlignment === 'conflicting') {
          trendScore = Math.max(30, trendScore - 20);
        }

        // PATIENCE CANDLE ANALYSIS
        const candle5m = bars5m.length >= 3 ? this.detectPatienceCandle(bars5m) : null;
        const candle15m = bars15m.length >= 3 ? this.detectPatienceCandle(bars15m) : null;
        const candle1h = bars1h.length >= 3 ? this.detectPatienceCandle(bars1h) : null;

        let patienceScore = 40;
        if (candle5m?.confirmed) patienceScore += 20;
        else if (candle5m?.forming) patienceScore += 10;
        if (candle15m?.confirmed) patienceScore += 25;
        else if (candle15m?.forming) patienceScore += 12;
        if (candle1h?.confirmed) patienceScore += 15;
        else if (candle1h?.forming) patienceScore += 8;
        patienceScore = Math.min(100, patienceScore);

        // OVERALL LTP GRADE
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
    } catch (error) {
      console.error(`[MarketData] LTP analysis error for ${symbol}:`, error);
      return null;
    }
  }

  // ============================================
  // Economic Calendar & Earnings Methods
  // ============================================

  /**
   * Get upcoming high-impact economic events
   */
  async getUpcomingEconomicEvents(daysAhead: number = 7): Promise<EconomicEvent[]> {
    const cacheKey = `econ:upcoming:${daysAhead}`;

    const result = await this.getCached<EconomicEvent[]>(
      cacheKey,
      CACHE_TTL.levels,
      async () => {
        const events: EconomicEvent[] = [];
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + daysAhead);

        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // CPI (usually 2nd week of month)
        const cpiDate = new Date(currentYear, currentMonth, 12);
        if (cpiDate >= today && cpiDate <= endDate) {
          events.push({
            date: cpiDate.toISOString().split('T')[0],
            time: '08:30 ET',
            event: 'CPI (Consumer Price Index)',
            impact: 'high',
          });
        }

        // NFP (first Friday)
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

        // Retail Sales (mid-month)
        const retailDate = new Date(currentYear, currentMonth, 15);
        if (retailDate >= today && retailDate <= endDate) {
          events.push({
            date: retailDate.toISOString().split('T')[0],
            time: '08:30 ET',
            event: 'Retail Sales',
            impact: 'medium',
          });
        }

        // FOMC dates for 2024-2026
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

        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return events;
      }
    );

    return result || [];
  }

  /**
   * Get earnings calendar for major stocks
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
   * Get market breadth data from Redis
   */
  async getMarketBreadth(): Promise<MarketBreadth | null> {
    return getCacheValue<MarketBreadth>('context:breadth');
  }

  /**
   * Get the full hot context from Redis
   */
  async getHotContext(): Promise<MarketHotContext | null> {
    return getCacheValue<MarketHotContext>('context:hot');
  }

  /**
   * Get active proactive warnings
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

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get date string for API calls
   */
  private getDateString(daysOffset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
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

  /**
   * Clear cache for a symbol or all cache
   */
  clearCache(symbol?: string): void {
    clearMemoryCache(symbol);
  }
}

// Singleton instance
export const marketDataService = new MarketDataService();
