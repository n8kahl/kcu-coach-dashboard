/**
 * Market Data Service
 *
 * Integrates with Massive.com (formerly Polygon.io) for real-time
 * and historical market data including stocks, indices, and options.
 *
 * API Documentation: https://massive.com/docs
 */

class MarketDataService {
  constructor() {
    this.apiKey = process.env.MASSIVE_API_KEY;
    this.baseUrl = 'https://api.massive.com';

    // Cache TTLs (in milliseconds)
    this.cacheTTL = {
      quote: 5000,        // 5 seconds for real-time quotes
      snapshot: 10000,    // 10 seconds for snapshots
      aggregates: 60000,  // 1 minute for historical bars
      levels: 300000,     // 5 minutes for calculated levels
    };

    // In-memory cache
    this.cache = new Map();
  }

  /**
   * Make authenticated request to Massive API
   */
  async fetch(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set('apikey', this.apiKey);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    }

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        const error = await response.text();
        console.error(`Massive API error: ${response.status} - ${error}`);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Massive API fetch error:', error);
      return null;
    }
  }

  /**
   * Get cached data or fetch fresh
   */
  async getCached(key, ttl, fetchFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    const data = await fetchFn();
    if (data) {
      this.cache.set(key, { data, timestamp: Date.now() });
    }
    return data;
  }

  /**
   * Get current quote/snapshot for a ticker
   */
  async getQuote(ticker) {
    const symbol = ticker.toUpperCase();

    return this.getCached(
      `quote:${symbol}`,
      this.cacheTTL.quote,
      async () => {
        const data = await this.fetch(`/v1/snapshot/stocks/tickers/${symbol}`);

        if (!data?.ticker) return null;

        const t = data.ticker;
        return {
          symbol: t.ticker,
          last: t.lastTrade?.p || t.prevDay?.c,
          price: t.lastTrade?.p || t.prevDay?.c,
          change: t.todaysChange,
          changePercent: t.todaysChangePerc,
          open: t.day?.o,
          high: t.day?.h,
          low: t.day?.l,
          close: t.prevDay?.c,
          volume: t.day?.v,
          vwap: t.day?.vw,
          prevClose: t.prevDay?.c,
          prevHigh: t.prevDay?.h,
          prevLow: t.prevDay?.l,
          timestamp: new Date().toISOString(),
        };
      }
    );
  }

  /**
   * Get OHLCV bars/aggregates
   * @param {string} ticker - Stock symbol
   * @param {string} timespan - 'minute', 'hour', 'day', 'week', or multiplier like '5' for 5min
   * @param {number} limit - Number of bars to fetch
   */
  async getAggregates(ticker, timespan = 'day', limit = 50) {
    const symbol = ticker.toUpperCase();

    // Parse timespan - support both formats
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
      // Numeric timespan like '5', '15', '2' for minutes
      actualTimespan = 'minute';
      multiplier = parseInt(timespan);
    } else {
      actualTimespan = timespan;
    }

    // Calculate date range
    const to = this.getDateString(0);
    const daysBack = actualTimespan === 'week' ? limit * 7 :
                     actualTimespan === 'day' ? limit :
                     actualTimespan === 'hour' ? Math.ceil(limit / 7) :
                     Math.ceil(limit / 78); // ~78 5-min bars per day
    const from = this.getDateString(-daysBack);

    const cacheKey = `aggs:${symbol}:${actualTimespan}:${multiplier}:${limit}`;

    return this.getCached(
      cacheKey,
      this.cacheTTL.aggregates,
      async () => {
        const data = await this.fetch(
          `/v2/aggs/ticker/${symbol}/range/${multiplier}/${actualTimespan}/${from}/${to}`,
          { limit, sort: 'asc' }
        );

        if (!data?.results) return [];

        return data.results.map(bar => ({
          t: bar.t,           // timestamp
          timestamp: bar.t,
          date: new Date(bar.t).toISOString(),
          o: bar.o,           // open
          h: bar.h,           // high
          l: bar.l,           // low
          c: bar.c,           // close
          v: bar.v,           // volume
          vw: bar.vw,         // vwap
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v,
          vwap: bar.vw,
        }));
      }
    );
  }

  /**
   * Get intraday bars for today
   */
  async getIntradayBars(ticker, timespan = 'minute', multiplier = 5) {
    const today = this.getDateString(0);
    return this.getAggregates(ticker, String(multiplier), 500);
  }

  /**
   * Get options chain for a ticker
   */
  async getOptionsChain(ticker, expirationDate = null) {
    const symbol = ticker.toUpperCase();

    const params = {};
    if (expirationDate) {
      params.expiration_date = expirationDate;
    }

    const data = await this.fetch(
      `/v3/snapshot/options/${symbol}`,
      params
    );

    if (!data?.results) return [];

    return data.results.map(option => ({
      ticker: option.details?.ticker,
      underlying: option.underlying_asset?.ticker,
      type: option.details?.contract_type,
      strike: option.details?.strike_price,
      expiration: option.details?.expiration_date,
      bid: option.last_quote?.bid,
      ask: option.last_quote?.ask,
      last: option.last_trade?.price,
      volume: option.day?.volume,
      openInterest: option.open_interest,
      impliedVolatility: option.implied_volatility,
      delta: option.greeks?.delta,
      gamma: option.greeks?.gamma,
      theta: option.greeks?.theta,
      vega: option.greeks?.vega,
    }));
  }

  /**
   * Get market status
   */
  async getMarketStatus() {
    const data = await this.fetch('/v1/marketstatus/now');

    if (!data) {
      return { market: 'unknown', afterHours: false, earlyHours: false };
    }

    return {
      market: data.market,
      afterHours: data.afterHours,
      earlyHours: data.earlyHours,
      serverTime: data.serverTime,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  getDateString(daysOffset) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
  }

  /**
   * Format price for display
   */
  formatPrice(price) {
    if (!price) return 'N/A';
    return '$' + price.toFixed(2);
  }

  /**
   * Clear cache for a specific symbol or all cache
   */
  clearCache(symbol = null) {
    if (symbol) {
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.includes(symbol.toUpperCase())) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }
}

module.exports = MarketDataService;
