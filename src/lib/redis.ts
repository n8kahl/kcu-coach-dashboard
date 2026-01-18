/**
 * Redis Client Library
 *
 * Provides Redis connectivity for:
 * - Session storage
 * - Rate limiting
 * - Pub/Sub for real-time broadcasts
 * - Caching
 */

import { Redis } from 'ioredis';

// Types
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

// Redis connection singleton
let redisClient: Redis | null = null;
let redisPub: Redis | null = null;
let redisSub: Redis | null = null;

/**
 * Get or create the main Redis client
 */
export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    console.warn('[Redis] REDIS_URL not configured, using in-memory fallback');
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[Redis] Max retries reached, giving up');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected to Redis');
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redisClient.on('close', () => {
      console.log('[Redis] Connection closed');
    });
  }

  return redisClient;
}

/**
 * Get Redis client for publishing
 */
export function getRedisPublisher(): Redis | null {
  if (!process.env.REDIS_URL) return null;

  if (!redisPub) {
    redisPub = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  return redisPub;
}

/**
 * Get Redis client for subscribing
 */
export function getRedisSubscriber(): Redis | null {
  if (!process.env.REDIS_URL) return null;

  if (!redisSub) {
    redisSub = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  return redisSub;
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Rate Limiting
// ============================================

/**
 * Check rate limit for a key using sliding window
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const client = getRedisClient();

  if (!client) {
    // Fallback: allow all requests when Redis is unavailable
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
  }

  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `ratelimit:${key}`;

  try {
    // Use a Lua script for atomic operations
    const script = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local windowMs = tonumber(ARGV[4])

      -- Remove old entries
      redis.call('ZREMRANGEBYSCORE', key, '-inf', window)

      -- Count current entries
      local count = redis.call('ZCARD', key)

      if count < limit then
        -- Add new entry
        redis.call('ZADD', key, now, now .. '-' .. math.random())
        redis.call('PEXPIRE', key, windowMs)
        return {1, limit - count - 1, now + windowMs}
      else
        -- Get oldest entry for reset time
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local resetAt = oldest[2] and (tonumber(oldest[2]) + windowMs) or (now + windowMs)
        return {0, 0, resetAt}
      end
    `;

    const result = await client.eval(
      script,
      1,
      redisKey,
      now.toString(),
      windowStart.toString(),
      limit.toString(),
      windowMs.toString()
    ) as [number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      resetAt: result[2],
    };
  } catch (error) {
    console.error('[Redis] Rate limit error:', error);
    // Fail open on errors
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
  }
}

// ============================================
// Caching
// ============================================

/**
 * Get cached value
 */
export async function getCache<T>(key: string, prefix = 'cache'): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const value = await client.get(`${prefix}:${key}`);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('[Redis] Cache get error:', error);
    return null;
  }
}

/**
 * Set cached value
 */
export async function setCache<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  const { ttl = 300, prefix = 'cache' } = options;
  const redisKey = `${prefix}:${key}`;

  try {
    const serialized = JSON.stringify(value);
    if (ttl > 0) {
      await client.setex(redisKey, ttl, serialized);
    } else {
      await client.set(redisKey, serialized);
    }
    return true;
  } catch (error) {
    console.error('[Redis] Cache set error:', error);
    return false;
  }
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string, prefix = 'cache'): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.del(`${prefix}:${key}`);
    return true;
  } catch (error) {
    console.error('[Redis] Cache delete error:', error);
    return false;
  }
}

/**
 * Clear cache by pattern
 */
export async function clearCachePattern(pattern: string, prefix = 'cache'): Promise<number> {
  const client = getRedisClient();
  if (!client) return 0;

  try {
    const keys = await client.keys(`${prefix}:${pattern}`);
    if (keys.length === 0) return 0;
    return await client.del(...keys);
  } catch (error) {
    console.error('[Redis] Cache clear error:', error);
    return 0;
  }
}

// ============================================
// Pub/Sub for Real-time
// ============================================

export type MessageHandler = (channel: string, message: string) => void;

/**
 * Publish a message to a channel
 */
export async function publish(channel: string, message: unknown): Promise<boolean> {
  const pub = getRedisPublisher();
  if (!pub) return false;

  try {
    const serialized = typeof message === 'string' ? message : JSON.stringify(message);
    await pub.publish(channel, serialized);
    return true;
  } catch (error) {
    console.error('[Redis] Publish error:', error);
    return false;
  }
}

/**
 * Subscribe to a channel
 */
export async function subscribe(channel: string, handler: MessageHandler): Promise<boolean> {
  const sub = getRedisSubscriber();
  if (!sub) return false;

  try {
    await sub.subscribe(channel);
    sub.on('message', handler);
    return true;
  } catch (error) {
    console.error('[Redis] Subscribe error:', error);
    return false;
  }
}

/**
 * Unsubscribe from a channel
 */
export async function unsubscribe(channel: string): Promise<boolean> {
  const sub = getRedisSubscriber();
  if (!sub) return false;

  try {
    await sub.unsubscribe(channel);
    return true;
  } catch (error) {
    console.error('[Redis] Unsubscribe error:', error);
    return false;
  }
}

// ============================================
// Session Storage
// ============================================

/**
 * Store session data
 */
export async function setSession(
  sessionId: string,
  data: Record<string, unknown>,
  ttlSeconds = 86400 // 24 hours
): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('[Redis] Session set error:', error);
    return false;
  }
}

/**
 * Get session data
 */
export async function getSession(sessionId: string): Promise<Record<string, unknown> | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const data = await client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[Redis] Session get error:', error);
    return null;
  }
}

/**
 * Delete session
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.del(`session:${sessionId}`);
    return true;
  } catch (error) {
    console.error('[Redis] Session delete error:', error);
    return false;
  }
}

/**
 * Extend session TTL
 */
export async function extendSession(sessionId: string, ttlSeconds = 86400): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.expire(`session:${sessionId}`, ttlSeconds);
    return true;
  } catch (error) {
    console.error('[Redis] Session extend error:', error);
    return false;
  }
}

// ============================================
// Cleanup
// ============================================

/**
 * Close all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  if (redisClient) {
    closePromises.push(
      redisClient.quit().then(() => {
        redisClient = null;
      })
    );
  }

  if (redisPub) {
    closePromises.push(
      redisPub.quit().then(() => {
        redisPub = null;
      })
    );
  }

  if (redisSub) {
    closePromises.push(
      redisSub.quit().then(() => {
        redisSub = null;
      })
    );
  }

  await Promise.all(closePromises);
  console.log('[Redis] All connections closed');
}
