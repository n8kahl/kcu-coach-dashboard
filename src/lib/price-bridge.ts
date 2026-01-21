/**
 * Price Bridge Service
 *
 * Bridges the gap between the market-worker WebSocket data (via Redis)
 * and the Companion Mode SSE stream. Enables real-time price updates
 * instead of 15-second polling.
 *
 * Architecture:
 * [Massive.com WebSocket] -> [market-worker] -> [Redis market:stream:{symbol}]
 *                                                        |
 *                                              [Price Bridge Service]
 *                                                        |
 *                                              [broadcastPriceUpdate()]
 *                                                        |
 *                                         [Companion SSE] -> [UI]
 */

import { broadcastPriceUpdate, PriceUpdateEvent } from './broadcast';
import { getMarketRedistributor, StreamMessage, MarketMessageHandler } from './market-redistributor';
import { isRedisAvailable } from './redis';
import logger from './logger';
import { coachingEngine } from './real-time-coaching-engine';

// Configuration
const CONFIG = {
  // Aggregate ticks over this window before broadcasting
  THROTTLE_MS: 150,

  // Price moves larger than this trigger immediate broadcast (bypass throttle)
  SIGNIFICANT_MOVE_PERCENT: 0.5,

  // Fallback polling interval when Redis is unavailable
  FALLBACK_POLL_MS: 1000,

  // Minimum time between broadcasts for same symbol to same user
  MIN_BROADCAST_INTERVAL_MS: 100,
};

/**
 * Price Bridge Class
 *
 * Manages subscriptions and broadcasts price updates to Companion Mode users.
 */
class PriceBridge {
  // symbol -> Set<userId> - which users are watching each symbol
  private symbolSubscribers: Map<string, Set<string>> = new Map();

  // userId -> Set<symbol> - which symbols each user is watching
  private userSymbols: Map<string, Set<string>> = new Map();

  // symbol -> latest price update (buffer for throttling)
  private tickBuffer: Map<string, PriceUpdateEvent> = new Map();

  // symbol -> last broadcast timestamp
  private lastBroadcast: Map<string, number> = new Map();

  // symbol -> previous price (for change calculation and significant move detection)
  private previousPrices: Map<string, number> = new Map();

  // Redis subscription cleanup functions
  private redisUnsubscribes: Map<string, () => void> = new Map();

  // Flush interval timer
  private flushInterval: NodeJS.Timeout | null = null;

  // Fallback polling timer (when Redis unavailable)
  private fallbackInterval: NodeJS.Timeout | null = null;

  // Whether we're using Redis or fallback polling
  private useRedis = false;
  private initialized = false;

  /**
   * Start the price bridge service
   */
  async start(): Promise<void> {
    if (this.initialized) return;

    this.useRedis = await isRedisAvailable();

    if (this.useRedis) {
      logger.info('[PriceBridge] Using Redis pub/sub for real-time price updates');

      // Start the tick buffer flush interval
      this.flushInterval = setInterval(() => this.flushUpdates(), CONFIG.THROTTLE_MS);
    } else {
      logger.info('[PriceBridge] Redis unavailable, using polling fallback');
      this.startPollingFallback();
    }

    this.initialized = true;
  }

  /**
   * Register a user and their watchlist symbols
   */
  async registerUser(userId: string, symbols: string[]): Promise<void> {
    if (!this.initialized) {
      await this.start();
    }

    const normalizedSymbols = symbols.map(s => s.toUpperCase());

    // Store user's symbols
    this.userSymbols.set(userId, new Set(normalizedSymbols));

    // Register user as subscriber for each symbol
    for (const symbol of normalizedSymbols) {
      if (!this.symbolSubscribers.has(symbol)) {
        this.symbolSubscribers.set(symbol, new Set());

        // Subscribe to Redis channel for this symbol (if using Redis)
        if (this.useRedis) {
          await this.subscribeToSymbol(symbol);
        }
      }
      this.symbolSubscribers.get(symbol)!.add(userId);
    }

    logger.debug(`[PriceBridge] User ${userId} registered for ${normalizedSymbols.length} symbols`);
  }

  /**
   * Unregister a user (cleanup on disconnect)
   */
  unregisterUser(userId: string): void {
    const symbols = this.userSymbols.get(userId);
    if (!symbols) return;

    // Remove user from each symbol's subscriber list
    for (const symbol of Array.from(symbols)) {
      const subscribers = this.symbolSubscribers.get(symbol);
      if (subscribers) {
        subscribers.delete(userId);

        // If no more subscribers for this symbol, unsubscribe from Redis
        if (subscribers.size === 0) {
          this.symbolSubscribers.delete(symbol);
          this.unsubscribeFromSymbol(symbol);
        }
      }
    }

    // Remove user's symbol list
    this.userSymbols.delete(userId);

    // Clean up coaching context
    coachingEngine.removeUser(userId);

    logger.debug(`[PriceBridge] User ${userId} unregistered`);
  }

  /**
   * Set coaching context for a user (for real-time coaching guidance)
   * Should be called when symbol is selected with relevant level data
   */
  setUserCoachingContext(
    userId: string,
    symbol: string,
    levels: {
      vwap: number;
      putWall: number;
      callWall: number;
      zeroGamma: number;
      pdh?: number;
      pdl?: number;
      orbHigh?: number;
      orbLow?: number;
    },
    currentPrice: number
  ): void {
    coachingEngine.setUserContext(userId, {
      symbol,
      levels,
      lastPrice: currentPrice,
      wasAboveVwap: currentPrice > levels.vwap,
      wasPositiveGamma: currentPrice > levels.zeroGamma,
    });
    logger.debug(`[PriceBridge] Set coaching context for user ${userId} on ${symbol}`);
  }

  /**
   * Set active trade for coaching R-multiple tracking
   */
  setUserActiveTrade(
    userId: string,
    trade: {
      direction: 'long' | 'short';
      entryPrice: number;
      stopLoss: number;
    } | undefined
  ): void {
    if (trade) {
      coachingEngine.setActiveTrade(userId, {
        ...trade,
        lastRMultiple: 0,
      });
    } else {
      coachingEngine.setActiveTrade(userId, undefined);
    }
  }

  /**
   * Update a user's symbol subscriptions (when watchlist changes)
   */
  async updateUserSymbols(userId: string, newSymbols: string[]): Promise<void> {
    const normalizedNew = newSymbols.map(s => s.toUpperCase());
    const currentSymbols = this.userSymbols.get(userId) || new Set();

    // Find symbols to add and remove
    const toAdd = normalizedNew.filter(s => !currentSymbols.has(s));
    const toRemove = Array.from(currentSymbols).filter(s => !normalizedNew.includes(s));

    // Remove old symbols
    for (const symbol of toRemove) {
      const subscribers = this.symbolSubscribers.get(symbol);
      if (subscribers) {
        subscribers.delete(userId);
        if (subscribers.size === 0) {
          this.symbolSubscribers.delete(symbol);
          this.unsubscribeFromSymbol(symbol);
        }
      }
    }

    // Add new symbols
    for (const symbol of toAdd) {
      if (!this.symbolSubscribers.has(symbol)) {
        this.symbolSubscribers.set(symbol, new Set());
        if (this.useRedis) {
          await this.subscribeToSymbol(symbol);
        }
      }
      this.symbolSubscribers.get(symbol)!.add(userId);
    }

    // Update user's symbol list
    this.userSymbols.set(userId, new Set(normalizedNew));

    logger.debug(`[PriceBridge] User ${userId} symbols updated: +${toAdd.length}, -${toRemove.length}`);
  }

  /**
   * Subscribe to Redis channel for a symbol
   */
  private async subscribeToSymbol(symbol: string): Promise<void> {
    try {
      const redistributor = getMarketRedistributor();

      const handler: MarketMessageHandler = (sym, message) => {
        this.handleMarketData(sym, message);
      };

      const unsubscribe = await redistributor.subscribeToUpdates([symbol], handler);
      this.redisUnsubscribes.set(symbol, unsubscribe);

      logger.debug(`[PriceBridge] Subscribed to Redis channel for ${symbol}`);
    } catch (error) {
      logger.error(`[PriceBridge] Failed to subscribe to ${symbol}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Unsubscribe from Redis channel for a symbol
   */
  private unsubscribeFromSymbol(symbol: string): void {
    const unsubscribe = this.redisUnsubscribes.get(symbol);
    if (unsubscribe) {
      unsubscribe();
      this.redisUnsubscribes.delete(symbol);
      logger.debug(`[PriceBridge] Unsubscribed from Redis channel for ${symbol}`);
    }

    // Clean up tracking data
    this.tickBuffer.delete(symbol);
    this.lastBroadcast.delete(symbol);
    this.previousPrices.delete(symbol);
  }

  /**
   * Handle incoming market data from Redis
   */
  private handleMarketData(symbol: string, message: StreamMessage): void {
    // Only process trade and bar messages
    if (message.type !== 'trade' && message.type !== 'bar') return;

    const price = message.data?.price || message.data?.close;
    if (!price || price <= 0) return;

    const previousPrice = this.previousPrices.get(symbol) || price;
    const changePercent = previousPrice > 0
      ? Math.abs((price - previousPrice) / previousPrice) * 100
      : 0;

    // Build the price update event
    const update: PriceUpdateEvent = {
      symbol,
      price,
      change: message.data?.close && message.data?.open
        ? message.data.close - message.data.open
        : 0,
      changePercent: changePercent,
      volume: message.data?.volume || 0,
      vwap: message.data?.vwap,
    };

    // Significant move = immediate broadcast (bypass throttle)
    if (changePercent >= CONFIG.SIGNIFICANT_MOVE_PERCENT) {
      logger.debug(`[PriceBridge] Significant move detected for ${symbol}: ${changePercent.toFixed(2)}%`);
      this.broadcastToSubscribers(symbol, update);
      this.previousPrices.set(symbol, price);
      return;
    }

    // Buffer for aggregation (will be flushed at interval)
    this.tickBuffer.set(symbol, update);
    this.previousPrices.set(symbol, price);
  }

  /**
   * Flush buffered updates to subscribers
   */
  private flushUpdates(): void {
    const now = Date.now();

    for (const [symbol, update] of Array.from(this.tickBuffer)) {
      const lastTime = this.lastBroadcast.get(symbol) || 0;

      // Check minimum interval since last broadcast
      if (now - lastTime >= CONFIG.MIN_BROADCAST_INTERVAL_MS) {
        this.broadcastToSubscribers(symbol, update);
        this.lastBroadcast.set(symbol, now);
      }
    }

    // Clear the buffer
    this.tickBuffer.clear();
  }

  /**
   * Broadcast a price update to all users watching a symbol
   * Also triggers real-time coaching engine to check for coaching events
   */
  private async broadcastToSubscribers(symbol: string, update: PriceUpdateEvent): Promise<void> {
    const subscribers = this.symbolSubscribers.get(symbol);
    if (!subscribers || subscribers.size === 0) return;

    const subscriberArray = Array.from(subscribers);
    let successCount = 0;

    for (const userId of subscriberArray) {
      try {
        // Broadcast the price update
        const success = await broadcastPriceUpdate(userId, update);
        if (success) successCount++;

        // Process the price through the coaching engine for real-time guidance
        // This checks for level approaches, VWAP crosses, gamma flips, etc.
        await coachingEngine.processPrice(userId, symbol, update.price);
      } catch (error) {
        logger.error(`[PriceBridge] Failed to broadcast to user ${userId}`, error instanceof Error ? error : undefined);
      }
    }

    if (successCount > 0) {
      logger.debug(
        `[PriceBridge] Broadcast ${symbol} @ $${update.price.toFixed(2)} to ${successCount}/${subscriberArray.length} users`
      );
    }
  }

  /**
   * Fallback polling when Redis is unavailable
   */
  private startPollingFallback(): void {
    this.fallbackInterval = setInterval(async () => {
      const symbols = Array.from(this.symbolSubscribers.keys());
      if (symbols.length === 0) return;

      try {
        // Fetch quotes from market API
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/market/quotes?symbols=${symbols.join(',')}`
        );

        if (!response.ok) {
          logger.warn('[PriceBridge] Fallback poll failed', { status: response.status });
          return;
        }

        const quotes = await response.json();

        // Broadcast each quote to subscribers
        for (const quote of quotes) {
          if (quote.symbol && quote.price) {
            const update: PriceUpdateEvent = {
              symbol: quote.symbol,
              price: quote.price,
              change: quote.change || 0,
              changePercent: quote.changePercent || 0,
              volume: quote.volume || 0,
              vwap: quote.vwap,
            };
            this.broadcastToSubscribers(quote.symbol, update);
          }
        }
      } catch (error) {
        logger.error('[PriceBridge] Fallback poll error', error instanceof Error ? error : undefined);
      }
    }, CONFIG.FALLBACK_POLL_MS);
  }

  /**
   * Stop the price bridge service
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }

    // Unsubscribe from all Redis channels
    for (const unsubscribe of Array.from(this.redisUnsubscribes.values())) {
      unsubscribe();
    }
    this.redisUnsubscribes.clear();

    // Clear all tracking data
    this.symbolSubscribers.clear();
    this.userSymbols.clear();
    this.tickBuffer.clear();
    this.lastBroadcast.clear();
    this.previousPrices.clear();

    this.initialized = false;

    logger.info('[PriceBridge] Stopped');
  }

  /**
   * Get stats for debugging/monitoring
   */
  getStats(): {
    totalUsers: number;
    totalSymbols: number;
    useRedis: boolean;
    symbolDetails: Array<{ symbol: string; subscriberCount: number }>;
  } {
    return {
      totalUsers: this.userSymbols.size,
      totalSymbols: this.symbolSubscribers.size,
      useRedis: this.useRedis,
      symbolDetails: Array.from(this.symbolSubscribers.entries()).map(([symbol, subs]) => ({
        symbol,
        subscriberCount: subs.size,
      })),
    };
  }
}

// Singleton instance
export const priceBridge = new PriceBridge();

export default priceBridge;
