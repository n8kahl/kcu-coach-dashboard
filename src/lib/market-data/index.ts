/**
 * Market Data Module
 *
 * Re-exports all market data functionality from modular files.
 * This file maintains the same public API as the original market-data.ts.
 *
 * Module Structure:
 * - types.ts: All TypeScript type definitions (~350 lines)
 * - cache.ts: Redis and in-memory caching utilities (~120 lines)
 * - service.ts: MarketDataService class and singleton (~1400 lines)
 */

// Re-export all types
export type {
  Quote,
  Bar,
  MarketStatus,
  IndexQuote,
  TechnicalIndicator,
  SMAResult,
  EMAResult,
  MACDResult,
  RSIResult,
  KeyLevel,
  OptionContract,
  OptionsChain,
  OptionsFlow,
  MarketSnapshot,
  TimeframeTrend,
  MTFAnalysis,
  EconomicEvent,
  EarningsEvent,
  MarketBreadth,
  OrderFlow,
  EnhancedEconomicEvent,
  MarketHotContext,
  ProactiveWarning,
  LTPAnalysis,
  CacheOptions,
  CachedQuote,
} from './types';

export { CACHE_TTL } from './types';

// Re-export the service class and singleton
export { MarketDataService, marketDataService } from './service';

// Import for convenience function exports
import { marketDataService } from './service';
import type {
  Quote,
  Bar,
  MarketStatus,
  IndexQuote,
  SMAResult,
  EMAResult,
  MACDResult,
  RSIResult,
  KeyLevel,
  OptionsChain,
  MarketSnapshot,
  MTFAnalysis,
  LTPAnalysis,
  EconomicEvent,
  EarningsEvent,
  MarketBreadth,
  MarketHotContext,
  ProactiveWarning,
  EnhancedEconomicEvent,
} from './types';

// ============================================
// Convenience Function Exports
// ============================================

// Quote functions
export async function getQuote(ticker: string): Promise<Quote | null> {
  return marketDataService.getQuote(ticker);
}

export async function getQuotes(tickers: string[]): Promise<Map<string, Quote>> {
  return marketDataService.getQuotes(tickers);
}

// Aggregates functions
export async function getAggregates(
  ticker: string,
  timespan?: string,
  limit?: number
): Promise<Bar[]> {
  return marketDataService.getAggregates(ticker, timespan, limit);
}

// Market status functions
export async function getMarketStatus(): Promise<MarketStatus> {
  return marketDataService.getMarketStatus();
}

export async function isMarketOpen(): Promise<boolean> {
  return marketDataService.isMarketOpen();
}

// Index functions
export async function getIndexQuote(index: string): Promise<IndexQuote | null> {
  return marketDataService.getIndexQuote(index);
}

export async function getVIX(): Promise<number> {
  return marketDataService.getVIX();
}

// Technical indicator functions
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

// Options functions
export async function getOptionsChain(ticker: string, expirationDate?: string): Promise<OptionsChain | null> {
  return marketDataService.getOptionsChain(ticker, expirationDate);
}

// Historical data functions
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

// Key levels functions
export async function getKeyLevels(ticker: string): Promise<KeyLevel[]> {
  return marketDataService.getKeyLevels(ticker);
}

// Snapshot functions
export async function getMarketSnapshot(ticker: string): Promise<MarketSnapshot | null> {
  return marketDataService.getMarketSnapshot(ticker);
}

export async function getMarketSnapshots(tickers: string[]): Promise<Map<string, MarketSnapshot>> {
  return marketDataService.getMarketSnapshots(tickers);
}

// MTF Analysis functions
export async function getMTFAnalysis(ticker: string): Promise<MTFAnalysis | null> {
  return marketDataService.getMTFAnalysis(ticker);
}

// LTP Analysis functions
export async function getLTPAnalysis(ticker: string): Promise<LTPAnalysis | null> {
  return marketDataService.getLTPAnalysis(ticker);
}

// Economic calendar functions
export async function getUpcomingEconomicEvents(daysAhead?: number): Promise<EconomicEvent[]> {
  return marketDataService.getUpcomingEconomicEvents(daysAhead);
}

export async function getUpcomingEarnings(tickers: string[], daysAhead?: number): Promise<EarningsEvent[]> {
  return marketDataService.getUpcomingEarnings(tickers, daysAhead);
}

export async function getMarketContext() {
  return marketDataService.getMarketContext();
}

// Proactive Coaching Hot Context functions
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

// Default export
export default marketDataService;
