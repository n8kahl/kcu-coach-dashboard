/**
 * Market Redistributor Service
 *
 * Provides Redis Pub/Sub-based market data distribution for scalable,
 * multi-instance deployments. Implements the "Single Ingestion, Infinite Distribution" pattern.
 *
 * Features:
 * - Publish market updates to Redis channels (market:stream:{symbol})
 * - Hot cache for latest quotes (quote:{symbol}) with TTL
 * - Subscribe to market updates with callback pattern
 * - Graceful fallback when Redis is unavailable
 */

import Redis from 'ioredis';
import {
  getRedisClient,
  getRedisPublisher,
  isRedisAvailable,
} from './redis';

// Stream message types (matching existing stream/route.ts format)
export interface StreamMessage {
  type: 'connected' | 'subscribed' | 'quote' | 'trade' | 'bar' | 'error' | 'heartbeat';
  symbol?: string;
  data?: {
    price?: number;
    size?: number;
    volume?: number;
    vwap?: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    timestamp?: number;
  };
  symbols?: string[];
  message?: string;
}

// Quote cache data structure
export interface CachedQuote {
  symbol: string;
  price: number;
  timestamp: number;
  data: StreamMessage['data'];
}

// Configuration
const CONFIG = {
  // Channel prefix for market streams
  channelPrefix: 'market:stream:',

  // Key prefix for quote cache
  cachePrefix: 'quote:',

  // Quote cache TTL in seconds
  cacheTTL: 10,

  // Reconnect settings for subscriber
  maxReconnectAttempts: 10,
  baseReconnectDelay: 1000,
  maxReconnectDelay: 30000,
};

// Subscriber message handler type
export type MarketMessageHandler = (symbol: string, message: StreamMessage) => void;

/**
 * Market Redistributor Class
 *
 * Manages Redis Pub/Sub for market data distribution.
 * Each instance maintains its own subscriber connection for isolation.
 */
export class MarketRedistributor {
  private subscriber: Redis | null = null;
  private subscribedChannels: Set<string> = new Set();
  private messageHandlers: Map<string, Set<MarketMessageHandler>> = new Map();
  private globalHandlers: Set<MarketMessageHandler> = new Set();
  private isConnecting = false;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Subscriber will be created lazily when first subscription is made
  }

  /**
   * Publish a market update to Redis
   *
   * @param symbol - The ticker symbol (e.g., 'SPY', 'AAPL')
   * @param data - The market data message to publish
   * @returns Promise<boolean> - True if published successfully
   */
  async publishUpdate(symbol: string, data: StreamMessage): Promise<boolean> {
    const normalizedSymbol = symbol.toUpperCase();
    const channel = `${CONFIG.channelPrefix}${normalizedSymbol}`;

    try {
      const publisher = getRedisPublisher();
      if (!publisher) {
        console.warn('[MarketRedistributor] Redis not available, skipping publish');
        return false;
      }

      // Serialize the message
      const serialized = JSON.stringify(data);

      // Publish to the symbol's channel
      await publisher.publish(channel, serialized);

      // Update the hot cache if this is a quote or trade update
      if (data.type === 'quote' || data.type === 'trade' || data.type === 'bar') {
        await this.updateQuoteCache(normalizedSymbol, data);
      }

      return true;
    } catch (error) {
      console.error(`[MarketRedistributor] Publish error for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Update the hot cache for a symbol's quote
   *
   * @param symbol - The ticker symbol
   * @param data - The stream message containing price data
   */
  private async updateQuoteCache(symbol: string, data: StreamMessage): Promise<void> {
    const client = getRedisClient();
    if (!client) return;

    const cacheKey = `${CONFIG.cachePrefix}${symbol}`;
    const cachedQuote: CachedQuote = {
      symbol,
      price: data.data?.price || data.data?.close || 0,
      timestamp: data.data?.timestamp || Date.now(),
      data: data.data,
    };

    try {
      await client.setex(cacheKey, CONFIG.cacheTTL, JSON.stringify(cachedQuote));
    } catch (error) {
      console.error(`[MarketRedistributor] Cache update error for ${symbol}:`, error);
    }
  }

  /**
   * Get the cached quote for a symbol
   *
   * @param symbol - The ticker symbol
   * @returns Promise<CachedQuote | null> - The cached quote or null if not found/expired
   */
  async getCachedQuote(symbol: string): Promise<CachedQuote | null> {
    const client = getRedisClient();
    if (!client) return null;

    const cacheKey = `${CONFIG.cachePrefix}${symbol.toUpperCase()}`;

    try {
      const data = await client.get(cacheKey);
      if (!data) return null;

      const cached = JSON.parse(data) as CachedQuote;
      return cached;
    } catch (error) {
      console.error(`[MarketRedistributor] Cache read error for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Subscribe to market updates for specific symbols
   *
   * @param symbols - Array of ticker symbols to subscribe to
   * @param handler - Callback function invoked on each message
   * @returns Promise<() => void> - Unsubscribe function
   */
  async subscribeToUpdates(
    symbols: string[],
    handler: MarketMessageHandler
  ): Promise<() => void> {
    // Check Redis availability
    const available = await isRedisAvailable();
    if (!available) {
      console.warn('[MarketRedistributor] Redis not available, subscription will be no-op');
      return () => {};
    }

    // Ensure subscriber connection exists
    await this.ensureSubscriber();

    const normalizedSymbols = symbols.map(s => s.toUpperCase());
    const channels = normalizedSymbols.map(s => `${CONFIG.channelPrefix}${s}`);

    // Register handler for each symbol
    for (const symbol of normalizedSymbols) {
      if (!this.messageHandlers.has(symbol)) {
        this.messageHandlers.set(symbol, new Set());
      }
      this.messageHandlers.get(symbol)!.add(handler);
    }

    // Subscribe to channels that aren't already subscribed
    const newChannels = channels.filter(ch => !this.subscribedChannels.has(ch));
    if (newChannels.length > 0 && this.subscriber) {
      try {
        await this.subscriber.subscribe(...newChannels);
        for (const ch of newChannels) {
          this.subscribedChannels.add(ch);
        }
        console.log(`[MarketRedistributor] Subscribed to ${newChannels.length} new channels`);
      } catch (error) {
        console.error('[MarketRedistributor] Subscribe error:', error);
      }
    }

    // Return unsubscribe function
    return () => {
      for (const symbol of normalizedSymbols) {
        const handlers = this.messageHandlers.get(symbol);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            this.messageHandlers.delete(symbol);
            // Optionally unsubscribe from channel if no handlers left
            const channel = `${CONFIG.channelPrefix}${symbol}`;
            this.unsubscribeFromChannel(channel);
          }
        }
      }
    };
  }

  /**
   * Subscribe to all market updates (global handler)
   *
   * @param handler - Callback function invoked on each message
   * @returns () => void - Unsubscribe function
   */
  addGlobalHandler(handler: MarketMessageHandler): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /**
   * Ensure the subscriber Redis client exists and is connected
   */
  private async ensureSubscriber(): Promise<void> {
    if (this.subscriber || this.isConnecting) return;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn('[MarketRedistributor] REDIS_URL not configured');
      return;
    }

    this.isConnecting = true;

    try {
      this.subscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: null, // Required for subscriber mode
        enableReadyCheck: false,
        retryStrategy: (times) => {
          if (times > CONFIG.maxReconnectAttempts) {
            console.error('[MarketRedistributor] Max reconnect attempts reached');
            return null;
          }
          const delay = Math.min(
            CONFIG.baseReconnectDelay * Math.pow(2, times - 1),
            CONFIG.maxReconnectDelay
          );
          console.log(`[MarketRedistributor] Reconnecting in ${delay}ms (attempt ${times})`);
          return delay;
        },
      });

      // Set up message handler
      this.subscriber.on('message', (channel: string, message: string) => {
        this.handleMessage(channel, message);
      });

      this.subscriber.on('connect', () => {
        console.log('[MarketRedistributor] Subscriber connected');
        this.reconnectAttempts = 0;
      });

      this.subscriber.on('error', (error) => {
        console.error('[MarketRedistributor] Subscriber error:', error);
      });

      this.subscriber.on('close', () => {
        console.log('[MarketRedistributor] Subscriber connection closed');
        this.scheduleReconnect();
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.subscriber!.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.subscriber!.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      console.log('[MarketRedistributor] Subscriber ready');
    } catch (error) {
      console.error('[MarketRedistributor] Failed to create subscriber:', error);
      this.subscriber = null;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Handle incoming Redis message
   */
  private handleMessage(channel: string, message: string): void {
    try {
      // Extract symbol from channel
      const symbol = channel.replace(CONFIG.channelPrefix, '');
      const data = JSON.parse(message) as StreamMessage;

      // Invoke symbol-specific handlers
      const handlers = this.messageHandlers.get(symbol);
      if (handlers) {
        const handlersArray = Array.from(handlers);
        for (const handler of handlersArray) {
          try {
            handler(symbol, data);
          } catch (handlerError) {
            console.error(`[MarketRedistributor] Handler error for ${symbol}:`, handlerError);
          }
        }
      }

      // Invoke global handlers
      const globalHandlersArray = Array.from(this.globalHandlers);
      for (const handler of globalHandlersArray) {
        try {
          handler(symbol, data);
        } catch (handlerError) {
          console.error('[MarketRedistributor] Global handler error:', handlerError);
        }
      }
    } catch (error) {
      console.error('[MarketRedistributor] Message parse error:', error);
    }
  }

  /**
   * Unsubscribe from a specific channel
   */
  private async unsubscribeFromChannel(channel: string): Promise<void> {
    if (!this.subscriber || !this.subscribedChannels.has(channel)) return;

    try {
      await this.subscriber.unsubscribe(channel);
      this.subscribedChannels.delete(channel);
      console.log(`[MarketRedistributor] Unsubscribed from ${channel}`);
    } catch (error) {
      console.error(`[MarketRedistributor] Unsubscribe error for ${channel}:`, error);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout || this.reconnectAttempts >= CONFIG.maxReconnectAttempts) {
      return;
    }

    const delay = Math.min(
      CONFIG.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      CONFIG.maxReconnectDelay
    );
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      this.subscriber = null;

      // Re-subscribe to all channels after reconnect
      const channelsToResubscribe = Array.from(this.subscribedChannels);
      this.subscribedChannels.clear();

      await this.ensureSubscriber();

      // After ensureSubscriber, get a fresh reference to subscriber
      // This is needed because TypeScript control flow can't track async side effects
      const sub = this.subscriber as Redis | null;
      if (sub && channelsToResubscribe.length > 0) {
        try {
          await sub.subscribe(...channelsToResubscribe);
          for (const ch of channelsToResubscribe) {
            this.subscribedChannels.add(ch);
          }
          console.log(`[MarketRedistributor] Resubscribed to ${channelsToResubscribe.length} channels`);
        } catch (error) {
          console.error('[MarketRedistributor] Resubscribe error:', error);
        }
      }
    }, delay);
  }

  /**
   * Get the number of active subscriptions
   */
  getSubscriptionCount(): number {
    return this.subscribedChannels.size;
  }

  /**
   * Get list of subscribed symbols
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedChannels).map(ch =>
      ch.replace(CONFIG.channelPrefix, '')
    );
  }

  /**
   * Check if connected and ready
   */
  isReady(): boolean {
    return this.subscriber?.status === 'ready';
  }

  /**
   * Clean up and close connections
   */
  async close(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.subscriber) {
      try {
        await this.subscriber.quit();
      } catch (error) {
        console.error('[MarketRedistributor] Error closing subscriber:', error);
      }
      this.subscriber = null;
    }

    this.subscribedChannels.clear();
    this.messageHandlers.clear();
    this.globalHandlers.clear();

    console.log('[MarketRedistributor] Closed');
  }
}

// Singleton instance for shared use
let sharedInstance: MarketRedistributor | null = null;

/**
 * Get the shared MarketRedistributor instance
 */
export function getMarketRedistributor(): MarketRedistributor {
  if (!sharedInstance) {
    sharedInstance = new MarketRedistributor();
  }
  return sharedInstance;
}

/**
 * Create a new MarketRedistributor instance (for isolated use)
 */
export function createMarketRedistributor(): MarketRedistributor {
  return new MarketRedistributor();
}

export default MarketRedistributor;
