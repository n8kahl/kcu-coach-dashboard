/**
 * Rate Limiting and Timeout Utilities
 *
 * Provides reusable wrappers for API routes to prevent cost blowups and hanging requests.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRedisClient } from './redis';

// ============================================
// Types
// ============================================

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

export type KeyFunction = (request: NextRequest) => string | Promise<string>;

export type RouteHandler = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

// ============================================
// In-Memory Rate Limiter (fallback)
// ============================================

interface InMemoryEntry {
  count: number;
  resetAt: number;
}

const inMemoryStore = new Map<string, InMemoryEntry>();
let inMemoryWarningShown = false;

function cleanupInMemoryStore(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  inMemoryStore.forEach((entry, key) => {
    if (entry.resetAt < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => inMemoryStore.delete(key));
}

// Cleanup every minute
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupInMemoryStore, 60000);
}

function checkInMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  if (!inMemoryWarningShown) {
    console.warn('[RateLimit] Redis not available, using in-memory fallback. Not suitable for production with multiple instances.');
    inMemoryWarningShown = true;
  }

  const now = Date.now();
  const entry = inMemoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count < limit) {
    entry.count++;
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
  }

  return { allowed: false, remaining: 0, resetAt: entry.resetAt };
}

// ============================================
// Rate Limit Wrapper
// ============================================

/**
 * Wraps a route handler with rate limiting
 *
 * @param handler - The route handler to wrap
 * @param keyFn - Function to extract rate limit key from request (e.g., user ID, IP)
 * @param options - Rate limit configuration
 * @returns Wrapped handler that enforces rate limits
 *
 * @example
 * const handler = async (req: NextRequest) => {
 *   return NextResponse.json({ data: 'ok' });
 * };
 *
 * export const POST = withRateLimit(
 *   handler,
 *   (req) => req.headers.get('x-user-id') || 'anonymous',
 *   { limit: 10, windowSeconds: 60 }
 * );
 */
export function withRateLimit(
  handler: RouteHandler,
  keyFn: KeyFunction,
  options: RateLimitOptions
): RouteHandler {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    const key = await keyFn(request);
    const windowMs = options.windowSeconds * 1000;

    // Check if Redis is available
    const redisClient = getRedisClient();
    let result: { allowed: boolean; remaining: number; resetAt: number };

    if (redisClient) {
      result = await checkRateLimit(key, options.limit, windowMs);
    } else {
      result = checkInMemoryRateLimit(key, options.limit, windowMs);
    }

    // Add rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', options.limit.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      headers.set('Retry-After', retryAfter.toString());

      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(headers),
          },
        }
      );
    }

    // Call the original handler
    const response = await handler(request, context);

    // Add rate limit headers to successful response
    const newHeaders = new Headers(response.headers);
    headers.forEach((value, key) => newHeaders.set(key, value));

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

// ============================================
// Timeout Wrapper for Fetch
// ============================================

/**
 * Wraps a fetch call with a timeout
 *
 * @param fetchFn - Function that returns a fetch promise
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that rejects on timeout
 *
 * @example
 * const data = await withTimeout(
 *   () => fetch('https://api.example.com/data'),
 *   5000
 * );
 */
export async function withFetchTimeout<T>(
  fetchFn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      fetchFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new TimeoutError(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Custom timeout error class
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a route handler with a timeout
 *
 * @param handler - The route handler to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @returns Wrapped handler that times out
 *
 * @example
 * export const POST = withTimeout(
 *   myHandler,
 *   30000 // 30 seconds
 * );
 */
export function withTimeout(
  handler: RouteHandler,
  timeoutMs: number
): RouteHandler {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    const timeoutPromise = new Promise<NextResponse>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError(`Handler timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    );

    try {
      const result = await Promise.race([
        handler(request, context),
        timeoutPromise,
      ]);
      return result;
    } catch (error) {
      if (error instanceof TimeoutError) {
        return NextResponse.json(
          {
            error: 'Request timeout',
            message: `The request took too long to process. Please try again.`,
          },
          { status: 504 }
        );
      }
      throw error;
    }
  };
}

// ============================================
// Combined Wrapper
// ============================================

/**
 * Combines rate limiting and timeout into a single wrapper
 *
 * @param handler - The route handler to wrap
 * @param keyFn - Function to extract rate limit key
 * @param options - Configuration options
 * @returns Wrapped handler with both rate limiting and timeout
 */
export function withRateLimitAndTimeout(
  handler: RouteHandler,
  keyFn: KeyFunction,
  options: RateLimitOptions & { timeoutMs: number }
): RouteHandler {
  const { timeoutMs, ...rateLimitOptions } = options;
  return withRateLimit(withTimeout(handler, timeoutMs), keyFn, rateLimitOptions);
}

// ============================================
// Utility Key Functions
// ============================================

/**
 * Extract user ID from session for rate limiting
 */
export function getUserIdKey(prefix: string) {
  return async (request: NextRequest): Promise<string> => {
    // Try to get user ID from common auth headers/cookies
    const userId =
      request.headers.get('x-user-id') ||
      request.cookies.get('kcu_session')?.value?.split('.')[0] ||
      'anonymous';
    return `${prefix}:${userId}`;
  };
}

/**
 * Extract IP address for rate limiting
 */
export function getIpKey(prefix: string) {
  return (request: NextRequest): string => {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `${prefix}:${ip}`;
  };
}

/**
 * Combine user ID and endpoint for rate limiting
 */
export function getEndpointUserKey(endpoint: string) {
  return async (request: NextRequest): Promise<string> => {
    const userId =
      request.headers.get('x-user-id') ||
      request.cookies.get('kcu_session')?.value?.split('.')[0] ||
      'anonymous';
    return `${endpoint}:${userId}`;
  };
}
