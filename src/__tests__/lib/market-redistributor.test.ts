/**
 * Market Redistributor Tests
 *
 * Tests for the Redis Pub/Sub market data distribution layer.
 */

import Redis from 'ioredis';
import {
  MarketRedistributor,
  StreamMessage,
  CachedQuote,
  getMarketRedistributor,
  createMarketRedistributor,
} from '@/lib/market-redistributor';

// Mock ioredis
jest.mock('ioredis');

// Mock the redis module
jest.mock('@/lib/redis', () => ({
  getRedisClient: jest.fn(),
  getRedisPublisher: jest.fn(),
  isRedisAvailable: jest.fn(),
}));

import { getRedisClient, getRedisPublisher, isRedisAvailable } from '@/lib/redis';

const mockGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;
const mockGetRedisPublisher = getRedisPublisher as jest.MockedFunction<typeof getRedisPublisher>;
const mockIsRedisAvailable = isRedisAvailable as jest.MockedFunction<typeof isRedisAvailable>;

describe('MarketRedistributor', () => {
  let redistributor: MarketRedistributor;
  let mockPublisher: jest.Mocked<Partial<Redis>>;
  let mockClient: jest.Mocked<Partial<Redis>>;
  let mockSubscriberInstance: jest.Mocked<Partial<Redis>>;
  let eventCallbacks: Map<string, ((...args: unknown[]) => void)[]>;

  beforeEach(() => {
    jest.clearAllMocks();
    eventCallbacks = new Map();

    // Setup mock Redis publisher
    mockPublisher = {
      publish: jest.fn().mockResolvedValue(1),
    };

    // Setup mock Redis client (for cache operations)
    mockClient = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
    };

    // Setup mock Redis subscriber with event emitter behavior
    mockSubscriberInstance = {
      subscribe: jest.fn().mockResolvedValue(1),
      unsubscribe: jest.fn().mockResolvedValue(1),
      on: jest.fn().mockImplementation((event, callback) => {
        if (!eventCallbacks.has(event)) {
          eventCallbacks.set(event, []);
        }
        eventCallbacks.get(event)!.push(callback);
        return mockSubscriberInstance;
      }),
      once: jest.fn().mockImplementation((event, callback) => {
        // For 'ready' event, call immediately
        if (event === 'ready') {
          process.nextTick(() => callback());
        }
        return mockSubscriberInstance;
      }),
      quit: jest.fn().mockResolvedValue('OK'),
      status: 'ready',
    };

    // Configure mocks
    mockGetRedisPublisher.mockReturnValue(mockPublisher as unknown as Redis);
    mockGetRedisClient.mockReturnValue(mockClient as unknown as Redis);
    mockIsRedisAvailable.mockResolvedValue(true);

    // Set REDIS_URL for tests
    process.env.REDIS_URL = 'redis://localhost:6379';

    // Mock Redis constructor for subscriber
    (Redis as unknown as jest.Mock).mockImplementation(() => mockSubscriberInstance);

    // Create redistributor instance
    redistributor = new MarketRedistributor();
  });

  afterEach(async () => {
    await redistributor.close();
    delete process.env.REDIS_URL;
  });

  // Helper to emit events on the mock subscriber
  function emitEvent(event: string, ...args: unknown[]): void {
    const callbacks = eventCallbacks.get(event) || [];
    for (const callback of callbacks) {
      callback(...args);
    }
  }

  describe('publishUpdate', () => {
    it('should publish market update to Redis channel', async () => {
      const symbol = 'SPY';
      const message: StreamMessage = {
        type: 'trade',
        symbol: 'SPY',
        data: {
          price: 450.50,
          size: 100,
          timestamp: Date.now(),
        },
      };

      const result = await redistributor.publishUpdate(symbol, message);

      expect(result).toBe(true);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'market:stream:SPY',
        JSON.stringify(message)
      );
    });

    it('should normalize symbol to uppercase', async () => {
      const message: StreamMessage = {
        type: 'quote',
        symbol: 'spy',
        data: { price: 450.50 },
      };

      await redistributor.publishUpdate('spy', message);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'market:stream:SPY',
        expect.any(String)
      );
    });

    it('should update quote cache for trade updates', async () => {
      const message: StreamMessage = {
        type: 'trade',
        symbol: 'AAPL',
        data: {
          price: 175.25,
          timestamp: 1704067200000,
        },
      };

      await redistributor.publishUpdate('AAPL', message);

      expect(mockClient.setex).toHaveBeenCalledWith(
        'quote:AAPL',
        10, // TTL in seconds
        expect.any(String)
      );

      // Verify cached data structure
      const cachedData = JSON.parse(
        (mockClient.setex as jest.Mock).mock.calls[0][2]
      ) as CachedQuote;
      expect(cachedData.symbol).toBe('AAPL');
      expect(cachedData.price).toBe(175.25);
      expect(cachedData.timestamp).toBe(1704067200000);
    });

    it('should update quote cache for bar updates', async () => {
      const message: StreamMessage = {
        type: 'bar',
        symbol: 'NVDA',
        data: {
          open: 500.00,
          high: 510.50,
          low: 498.00,
          close: 508.25,
          volume: 50000000,
          timestamp: 1704067200000,
        },
      };

      await redistributor.publishUpdate('NVDA', message);

      expect(mockClient.setex).toHaveBeenCalled();

      // For bar updates, price should be the close
      const cachedData = JSON.parse(
        (mockClient.setex as jest.Mock).mock.calls[0][2]
      ) as CachedQuote;
      expect(cachedData.price).toBe(508.25);
    });

    it('should not update cache for non-price updates', async () => {
      const message: StreamMessage = {
        type: 'connected',
        message: 'Connected to stream',
      };

      await redistributor.publishUpdate('SPY', message);

      expect(mockPublisher.publish).toHaveBeenCalled();
      expect(mockClient.setex).not.toHaveBeenCalled();
    });

    it('should return false when Redis is not available', async () => {
      mockGetRedisPublisher.mockReturnValue(null);

      const message: StreamMessage = {
        type: 'trade',
        symbol: 'SPY',
        data: { price: 450.50 },
      };

      const result = await redistributor.publishUpdate('SPY', message);

      expect(result).toBe(false);
    });

    it('should handle publish errors gracefully', async () => {
      mockPublisher.publish = jest.fn().mockRejectedValue(new Error('Redis error'));

      const message: StreamMessage = {
        type: 'trade',
        symbol: 'SPY',
        data: { price: 450.50 },
      };

      const result = await redistributor.publishUpdate('SPY', message);

      expect(result).toBe(false);
    });
  });

  describe('getCachedQuote', () => {
    it('should return cached quote data', async () => {
      const cachedQuote: CachedQuote = {
        symbol: 'SPY',
        price: 450.50,
        timestamp: Date.now(),
        data: { price: 450.50, volume: 1000000 },
      };

      mockClient.get = jest.fn().mockResolvedValue(JSON.stringify(cachedQuote));

      const result = await redistributor.getCachedQuote('SPY');

      expect(result).toEqual(cachedQuote);
      expect(mockClient.get).toHaveBeenCalledWith('quote:SPY');
    });

    it('should normalize symbol to uppercase', async () => {
      mockClient.get = jest.fn().mockResolvedValue(null);

      await redistributor.getCachedQuote('spy');

      expect(mockClient.get).toHaveBeenCalledWith('quote:SPY');
    });

    it('should return null when cache miss', async () => {
      mockClient.get = jest.fn().mockResolvedValue(null);

      const result = await redistributor.getCachedQuote('XYZ');

      expect(result).toBeNull();
    });

    it('should return null when Redis is not available', async () => {
      mockGetRedisClient.mockReturnValue(null);

      const result = await redistributor.getCachedQuote('SPY');

      expect(result).toBeNull();
    });

    it('should handle get errors gracefully', async () => {
      mockClient.get = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await redistributor.getCachedQuote('SPY');

      expect(result).toBeNull();
    });
  });

  describe('subscribeToUpdates', () => {
    it('should subscribe to Redis channels for symbols', async () => {
      const handler = jest.fn();

      await redistributor.subscribeToUpdates(['SPY', 'QQQ'], handler);

      // Wait for async connection
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockSubscriberInstance.subscribe).toHaveBeenCalledWith(
        'market:stream:SPY',
        'market:stream:QQQ'
      );
    });

    it('should normalize symbols to uppercase', async () => {
      const handler = jest.fn();

      await redistributor.subscribeToUpdates(['spy', 'aapl'], handler);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockSubscriberInstance.subscribe).toHaveBeenCalledWith(
        'market:stream:SPY',
        'market:stream:AAPL'
      );
    });

    it('should return unsubscribe function', async () => {
      const handler = jest.fn();

      const unsubscribe = await redistributor.subscribeToUpdates(['SPY'], handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should not re-subscribe to already subscribed channels', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      await redistributor.subscribeToUpdates(['SPY'], handler1);
      await new Promise(resolve => setTimeout(resolve, 10));

      await redistributor.subscribeToUpdates(['SPY', 'QQQ'], handler2);
      await new Promise(resolve => setTimeout(resolve, 10));

      // First call subscribes to SPY, second call should only subscribe to QQQ
      expect(mockSubscriberInstance.subscribe).toHaveBeenCalledTimes(2);
      expect(mockSubscriberInstance.subscribe).toHaveBeenNthCalledWith(1, 'market:stream:SPY');
      expect(mockSubscriberInstance.subscribe).toHaveBeenNthCalledWith(2, 'market:stream:QQQ');
    });

    it('should return no-op when Redis is not available', async () => {
      mockIsRedisAvailable.mockResolvedValue(false);
      const handler = jest.fn();

      const unsubscribe = await redistributor.subscribeToUpdates(['SPY'], handler);

      expect(mockSubscriberInstance.subscribe).not.toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('message handling', () => {
    it('should invoke handler on message', async () => {
      const handler = jest.fn();
      await redistributor.subscribeToUpdates(['SPY'], handler);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate receiving a message
      const message: StreamMessage = {
        type: 'trade',
        symbol: 'SPY',
        data: { price: 450.50 },
      };

      // Emit message event
      emitEvent('message', 'market:stream:SPY', JSON.stringify(message));

      expect(handler).toHaveBeenCalledWith('SPY', message);
    });

    it('should invoke all handlers for a symbol', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      await redistributor.subscribeToUpdates(['SPY'], handler1);
      await redistributor.subscribeToUpdates(['SPY'], handler2);
      await new Promise(resolve => setTimeout(resolve, 10));

      const message: StreamMessage = {
        type: 'trade',
        symbol: 'SPY',
        data: { price: 450.50 },
      };

      emitEvent('message', 'market:stream:SPY', JSON.stringify(message));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should only invoke handlers for the correct symbol', async () => {
      const spyHandler = jest.fn();
      const qqqHandler = jest.fn();

      await redistributor.subscribeToUpdates(['SPY'], spyHandler);
      await redistributor.subscribeToUpdates(['QQQ'], qqqHandler);
      await new Promise(resolve => setTimeout(resolve, 10));

      const message: StreamMessage = {
        type: 'trade',
        symbol: 'SPY',
        data: { price: 450.50 },
      };

      emitEvent('message', 'market:stream:SPY', JSON.stringify(message));

      expect(spyHandler).toHaveBeenCalled();
      expect(qqqHandler).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', async () => {
      const handler = jest.fn();
      await redistributor.subscribeToUpdates(['SPY'], handler);
      await new Promise(resolve => setTimeout(resolve, 10));

      // This should not throw
      expect(() => {
        emitEvent('message', 'market:stream:SPY', 'invalid json');
      }).not.toThrow();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('global handlers', () => {
    it('should invoke global handlers for all messages', async () => {
      const globalHandler = jest.fn();
      const symbolHandler = jest.fn();

      redistributor.addGlobalHandler(globalHandler);
      await redistributor.subscribeToUpdates(['SPY'], symbolHandler);
      await new Promise(resolve => setTimeout(resolve, 10));

      const message: StreamMessage = {
        type: 'trade',
        symbol: 'SPY',
        data: { price: 450.50 },
      };

      emitEvent('message', 'market:stream:SPY', JSON.stringify(message));

      expect(globalHandler).toHaveBeenCalledWith('SPY', message);
      expect(symbolHandler).toHaveBeenCalledWith('SPY', message);
    });

    it('should return unsubscribe function for global handler', () => {
      const handler = jest.fn();

      const unsubscribe = redistributor.addGlobalHandler(handler);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('utility methods', () => {
    it('should return subscription count', async () => {
      const handler = jest.fn();

      expect(redistributor.getSubscriptionCount()).toBe(0);

      await redistributor.subscribeToUpdates(['SPY', 'QQQ'], handler);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(redistributor.getSubscriptionCount()).toBe(2);
    });

    it('should return subscribed symbols', async () => {
      const handler = jest.fn();

      await redistributor.subscribeToUpdates(['SPY', 'AAPL'], handler);
      await new Promise(resolve => setTimeout(resolve, 10));

      const symbols = redistributor.getSubscribedSymbols();

      expect(symbols).toContain('SPY');
      expect(symbols).toContain('AAPL');
    });
  });

  describe('close', () => {
    it('should clean up subscriber connection', async () => {
      const handler = jest.fn();
      await redistributor.subscribeToUpdates(['SPY'], handler);
      await new Promise(resolve => setTimeout(resolve, 10));

      await redistributor.close();

      expect(mockSubscriberInstance.quit).toHaveBeenCalled();
      expect(redistributor.getSubscriptionCount()).toBe(0);
    });
  });
});

describe('Factory functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton for factory function tests
    jest.resetModules();
  });

  it('getMarketRedistributor should return singleton instance', async () => {
    // Re-import to get fresh module with reset singleton
    const module = await import('@/lib/market-redistributor');

    const instance1 = module.getMarketRedistributor();
    const instance2 = module.getMarketRedistributor();

    expect(instance1).toBe(instance2);
  });

  it('createMarketRedistributor should return new instance', async () => {
    const module = await import('@/lib/market-redistributor');

    const instance1 = module.createMarketRedistributor();
    const instance2 = module.createMarketRedistributor();

    expect(instance1).not.toBe(instance2);
  });
});
