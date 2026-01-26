/**
 * Market Data Cache Utilities
 *
 * Handles Redis and in-memory caching for market data.
 * Redis is dynamically imported to avoid bundling issues in edge runtime.
 */

import type { CacheOptions, CachedQuote } from './types';

// Redis is imported dynamically to avoid bundling issues in edge runtime
interface RedisModule {
  getCache: <T>(key: string, prefix?: string) => Promise<T | null>;
  setCache: <T>(key: string, value: T, options?: CacheOptions) => Promise<boolean>;
  getRedisClient: () => import('ioredis').Redis | null;
}

let redisModule: RedisModule | null = null;

// Hot cache freshness threshold (5 seconds)
export const HOT_CACHE_FRESHNESS_MS = 5000;

// In-memory cache fallback
export const memoryCache = new Map<string, { data: unknown; timestamp: number }>();

/**
 * Dynamically import Redis module (server-side only)
 */
export async function getRedis(): Promise<RedisModule | null> {
  if (!redisModule && typeof window === 'undefined') {
    try {
      // Use webpackIgnore to prevent bundling ioredis in edge runtime
      redisModule = await import(/* webpackIgnore: true */ '../redis');
    } catch {
      // Redis not available
    }
  }
  return redisModule;
}

/**
 * Get quote from Redis hot cache (populated by market-worker)
 * Returns null if not found or stale (> 5 seconds old)
 */
export async function getHotCachedQuote(symbol: string): Promise<CachedQuote | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const client = redis.getRedisClient();
  if (!client) return null;

  try {
    const cacheKey = `quote:${symbol.toUpperCase()}`;
    const data = await client.get(cacheKey);
    if (!data) return null;

    const cached = JSON.parse(data) as CachedQuote;

    // Check freshness (must be < 5 seconds old)
    const age = Date.now() - cached.timestamp;
    if (age > HOT_CACHE_FRESHNESS_MS) {
      return null; // Stale cache, will fallback to REST API
    }

    return cached;
  } catch {
    return null;
  }
}

/**
 * Get cached value from Redis
 */
export async function getCacheValue<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  if (redis) {
    return redis.getCache<T>(key, 'market');
  }
  return null;
}

/**
 * Set cached value in Redis
 */
export async function setCacheValue<T>(key: string, value: T, ttl?: number): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.setCache(key, value, { ttl, prefix: 'market' });
  }
}

/**
 * Get cached data with Redis fallback to memory
 */
export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T | null>
): Promise<T | null> {
  // Try Redis cache first (dynamic import)
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
 * Clear cache for a symbol or all cache
 */
export function clearCache(symbol?: string): void {
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
