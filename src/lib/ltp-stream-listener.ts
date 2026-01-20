/**
 * LTP Stream Listener
 *
 * Event-driven analysis service that listens to the MarketRedistributor stream
 * and triggers LTP analysis when bar events (candle closes) occur.
 *
 * Architecture:
 * - Subscribes to Redis Pub/Sub via MarketRedistributor
 * - Listens for 'bar' events which indicate candle closes
 * - Triggers LTP detector analysis for each symbol
 * - Broadcasts detected setups to connected users via broadcast.ts
 *
 * This replaces the polling-based detection with event-driven analysis,
 * providing faster response times when setups form.
 */

import { getMarketRedistributor, StreamMessage, MarketRedistributor } from './market-redistributor';
import { analyzeOnDemand } from './ltp-detector';
import {
  broadcastSetupForming,
  broadcastSetupReady,
  type SetupEvent,
} from './broadcast';

// Configuration
const CONFIG = {
  // Minimum confluence score to broadcast
  minConfluenceScore: 50,

  // Score threshold for "ready" status
  readyThreshold: 70,

  // Debounce period for analysis per symbol (ms)
  // Prevents analyzing the same symbol too frequently
  analysisDebounceMs: 5000,

  // Maximum concurrent analyses
  maxConcurrentAnalyses: 5,

  // Default watchlist (can be overridden)
  defaultWatchlist: ['SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'AMD', 'META', 'GOOGL', 'AMZN', 'MSFT'],
};

// Listener state
interface ListenerState {
  redistributor: MarketRedistributor | null;
  unsubscribe: (() => void) | null;
  isRunning: boolean;
  watchlist: Set<string>;
  lastAnalysis: Map<string, number>; // symbol -> timestamp
  pendingAnalyses: Set<string>; // symbols currently being analyzed
  barCount: number;
  analysisCount: number;
  setupCount: number;
}

const state: ListenerState = {
  redistributor: null,
  unsubscribe: null,
  isRunning: false,
  watchlist: new Set(CONFIG.defaultWatchlist),
  lastAnalysis: new Map(),
  pendingAnalyses: new Set(),
  barCount: 0,
  analysisCount: 0,
  setupCount: 0,
};

/**
 * Start the LTP stream listener
 */
export async function startListener(symbols?: string[]): Promise<void> {
  if (state.isRunning) {
    console.log('[LTPStreamListener] Already running');
    return;
  }

  console.log('[LTPStreamListener] Starting event-driven analysis...');

  // Update watchlist if provided
  if (symbols && symbols.length > 0) {
    state.watchlist = new Set(symbols.map(s => s.toUpperCase()));
  }

  // Get or create redistributor
  state.redistributor = getMarketRedistributor();

  // Subscribe to all watchlist symbols
  const watchlistArray = Array.from(state.watchlist);
  state.unsubscribe = await state.redistributor.subscribeToUpdates(
    watchlistArray,
    handleMessage
  );

  state.isRunning = true;
  console.log(`[LTPStreamListener] Listening to ${watchlistArray.length} symbols: ${watchlistArray.join(', ')}`);
}

/**
 * Stop the LTP stream listener
 */
export function stopListener(): void {
  if (!state.isRunning) {
    console.log('[LTPStreamListener] Not running');
    return;
  }

  console.log('[LTPStreamListener] Stopping...');

  if (state.unsubscribe) {
    state.unsubscribe();
    state.unsubscribe = null;
  }

  state.redistributor = null;
  state.isRunning = false;
  state.lastAnalysis.clear();
  state.pendingAnalyses.clear();

  console.log('[LTPStreamListener] Stopped');
  console.log(`[LTPStreamListener] Stats: bars=${state.barCount}, analyses=${state.analysisCount}, setups=${state.setupCount}`);
}

/**
 * Check if listener is running
 */
export function isListenerRunning(): boolean {
  return state.isRunning;
}

/**
 * Add symbols to watchlist
 */
export async function addSymbols(symbols: string[]): Promise<void> {
  const newSymbols = symbols
    .map(s => s.toUpperCase())
    .filter(s => !state.watchlist.has(s));

  if (newSymbols.length === 0) return;

  for (const symbol of newSymbols) {
    state.watchlist.add(symbol);
  }

  // If running, re-subscribe to include new symbols
  if (state.isRunning && state.redistributor) {
    if (state.unsubscribe) {
      state.unsubscribe();
    }
    const watchlistArray = Array.from(state.watchlist);
    state.unsubscribe = await state.redistributor.subscribeToUpdates(
      watchlistArray,
      handleMessage
    );
    console.log(`[LTPStreamListener] Added symbols: ${newSymbols.join(', ')}`);
  }
}

/**
 * Remove symbols from watchlist
 */
export function removeSymbols(symbols: string[]): void {
  for (const symbol of symbols) {
    state.watchlist.delete(symbol.toUpperCase());
    state.lastAnalysis.delete(symbol.toUpperCase());
  }
  console.log(`[LTPStreamListener] Removed symbols: ${symbols.join(', ')}`);
}

/**
 * Get current watchlist
 */
export function getWatchlist(): string[] {
  return Array.from(state.watchlist);
}

/**
 * Get listener statistics
 */
export function getStats(): {
  isRunning: boolean;
  watchlistSize: number;
  barCount: number;
  analysisCount: number;
  setupCount: number;
  pendingAnalyses: number;
} {
  return {
    isRunning: state.isRunning,
    watchlistSize: state.watchlist.size,
    barCount: state.barCount,
    analysisCount: state.analysisCount,
    setupCount: state.setupCount,
    pendingAnalyses: state.pendingAnalyses.size,
  };
}

/**
 * Handle incoming market message
 */
function handleMessage(symbol: string, message: StreamMessage): void {
  // Only process bar events (candle closes)
  if (message.type !== 'bar') {
    return;
  }

  state.barCount++;

  // Check if symbol is in watchlist
  if (!state.watchlist.has(symbol)) {
    return;
  }

  // Debounce - don't analyze same symbol too frequently
  const lastTime = state.lastAnalysis.get(symbol) || 0;
  if (Date.now() - lastTime < CONFIG.analysisDebounceMs) {
    return;
  }

  // Check concurrent analysis limit
  if (state.pendingAnalyses.size >= CONFIG.maxConcurrentAnalyses) {
    return;
  }

  // Trigger analysis
  triggerAnalysis(symbol);
}

/**
 * Trigger LTP analysis for a symbol
 */
async function triggerAnalysis(symbol: string): Promise<void> {
  // Mark as pending
  state.pendingAnalyses.add(symbol);
  state.lastAnalysis.set(symbol, Date.now());
  state.analysisCount++;

  try {
    // Run LTP analysis
    const analysis = await analyzeOnDemand(symbol);

    if (!analysis) {
      return;
    }

    // Check if confluence score meets threshold
    if (analysis.confluence_score < CONFIG.minConfluenceScore) {
      return;
    }

    state.setupCount++;

    // Convert to SetupEvent format
    const setupEvent: SetupEvent = {
      id: `${symbol}-${Date.now()}`,
      symbol: analysis.symbol,
      direction: analysis.direction,
      confluenceScore: analysis.confluence_score,
      levelScore: analysis.level_score,
      trendScore: analysis.trend_score,
      patienceScore: analysis.patience_score,
      mtfScore: analysis.mtf_score,
      coachNote: analysis.coach_note,
      suggestedEntry: analysis.suggested_entry || undefined,
      suggestedStop: analysis.suggested_stop || undefined,
      target1: analysis.target_1 || undefined,
      target2: analysis.target_2 || undefined,
      target3: analysis.target_3 || undefined,
      riskReward: analysis.risk_reward || undefined,
    };

    // Broadcast based on setup stage
    if (analysis.confluence_score >= CONFIG.readyThreshold) {
      console.log(`[LTPStreamListener] Setup READY: ${symbol} (score: ${analysis.confluence_score})`);
      await broadcastSetupReady(setupEvent);
    } else {
      console.log(`[LTPStreamListener] Setup forming: ${symbol} (score: ${analysis.confluence_score})`);
      await broadcastSetupForming(setupEvent);
    }
  } catch (error) {
    console.error(`[LTPStreamListener] Analysis error for ${symbol}:`, error);
  } finally {
    // Remove from pending
    state.pendingAnalyses.delete(symbol);
  }
}

/**
 * Manually trigger analysis for a symbol (for testing/API use)
 */
export async function analyzeNow(symbol: string): Promise<void> {
  const upperSymbol = symbol.toUpperCase();
  console.log(`[LTPStreamListener] Manual analysis triggered for ${upperSymbol}`);
  await triggerAnalysis(upperSymbol);
}

export default {
  start: startListener,
  stop: stopListener,
  isRunning: isListenerRunning,
  addSymbols,
  removeSymbols,
  getWatchlist,
  getStats,
  analyzeNow,
};
