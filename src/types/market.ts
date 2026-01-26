/**
 * Canonical Market Data Types
 *
 * SINGLE SOURCE OF TRUTH for all market data interfaces.
 * All other files should import from here, not define their own.
 *
 * This ensures consistency between mock data, real API data,
 * and all components that consume market data.
 */

// =============================================================================
// QUOTE (Real-time price data)
// =============================================================================

/**
 * Real-time quote data for a symbol.
 * Used for current price display, bid/ask spreads, and intraday stats.
 */
export interface Quote {
  /** Ticker symbol (e.g., "SPY", "QQQ") */
  symbol: string;

  /** Current/last trade price */
  price: number;

  /** Best bid price */
  bid: number;

  /** Best ask price */
  ask: number;

  /** Size at best bid */
  bidSize: number;

  /** Size at best ask */
  askSize: number;

  /** Dollar change from previous close */
  change: number;

  /** Percent change from previous close */
  changePercent: number;

  /** Today's cumulative volume */
  volume: number;

  /** Volume-weighted average price */
  vwap: number;

  /** Today's high */
  high: number;

  /** Today's low */
  low: number;

  /** Today's open */
  open: number;

  /** Most recent close (may be today's close or previous close) */
  close: number;

  /** Yesterday's close */
  previousClose: number;

  /** Unix timestamp in milliseconds */
  timestamp: number;
}

// =============================================================================
// BAR / CANDLE (OHLCV data)
// =============================================================================

/**
 * OHLCV bar data for charting and analysis.
 * This is the canonical representation used throughout the app.
 */
export interface Bar {
  /** Unix timestamp in milliseconds */
  time: number;

  /** Opening price */
  open: number;

  /** High price */
  high: number;

  /** Low price */
  low: number;

  /** Closing price */
  close: number;

  /** Volume traded */
  volume: number;

  /** Volume-weighted average price (optional) */
  vwap?: number;
}

/**
 * Alias for Bar - some code uses "Candle" terminology.
 * Both refer to the same underlying OHLCV structure.
 */
export type Candle = Bar;

// =============================================================================
// ADAPTER UTILITIES
// =============================================================================

/**
 * Convert legacy Bar format (with short field names) to canonical Bar.
 * Used when receiving data from APIs that use o/h/l/c/v/t format.
 */
export interface LegacyBar {
  t: number; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  vw?: number; // vwap
}

/**
 * Convert a legacy bar format to canonical Bar.
 */
export function toLegacyBar(bar: Bar): LegacyBar {
  return {
    t: bar.time,
    o: bar.open,
    h: bar.high,
    l: bar.low,
    c: bar.close,
    v: bar.volume,
    vw: bar.vwap,
  };
}

/**
 * Convert legacy bar format to canonical Bar.
 */
export function fromLegacyBar(legacy: LegacyBar): Bar {
  return {
    time: legacy.t,
    open: legacy.o,
    high: legacy.h,
    low: legacy.l,
    close: legacy.c,
    volume: legacy.v,
    vwap: legacy.vw,
  };
}

// =============================================================================
// MARKET STATE
// =============================================================================

/**
 * Market session state.
 */
export type MarketSession = 'pre' | 'regular' | 'post' | 'closed';

/**
 * Trend direction used across the app.
 */
export type TrendDirection = 'bullish' | 'bearish' | 'neutral';

/**
 * Gamma regime from options flow analysis.
 */
export type GammaRegime = 'positive' | 'negative' | 'neutral';
