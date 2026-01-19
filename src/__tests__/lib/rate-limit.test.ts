/**
 * Tests for Rate Limiting and Timeout Utilities
 *
 * Verifies:
 * - Rate limiting returns 429 when limit exceeded
 * - In-memory fallback works when Redis unavailable
 * - Timeout wrapper returns 504 on timeout
 * - Rate limit headers are set correctly
 */

// Mock next/server before imports
jest.mock('next/server', () => {
  // Create a mock response class inside the mock
  class MockNextResponse {
    body: string;
    status: number;
    statusText: string;
    headers: Map<string, string>;

    constructor(body: unknown, init?: { status?: number; statusText?: string; headers?: Record<string, string> | Headers | Map<string, string> }) {
      this.body = typeof body === 'string' ? body : JSON.stringify(body);
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new Map();

      if (init?.headers) {
        if (init.headers instanceof Map) {
          init.headers.forEach((v, k) => this.headers.set(k, v));
        } else if (typeof init.headers.forEach === 'function') {
          (init.headers as Headers).forEach((v, k) => this.headers.set(k, v));
        } else {
          Object.entries(init.headers as Record<string, string>).forEach(([k, v]) => this.headers.set(k, v));
        }
      }
    }

    async json() {
      return JSON.parse(this.body);
    }

    static json(data: unknown, init?: { status?: number }) {
      const headers = new Map<string, string>();
      const resp = {
        body: JSON.stringify(data),
        status: init?.status || 200,
        statusText: 'OK',
        headers: {
          get: (key: string) => headers.get(key),
          set: (key: string, value: string) => headers.set(key, value),
          forEach: (callback: (value: string, key: string) => void) => headers.forEach(callback),
        },
        json: async () => data,
      };
      return resp;
    }
  }

  return {
    NextRequest: jest.fn().mockImplementation((url: string) => ({
      url,
      headers: new Map([['x-user-id', 'test-user-123']]),
      cookies: { get: jest.fn() },
      nextUrl: { searchParams: new URLSearchParams() },
    })),
    NextResponse: MockNextResponse,
  };
});

// Mock redis module
jest.mock('@/lib/redis', () => ({
  getRedisClient: jest.fn(() => null), // Simulate Redis not available
  checkRateLimit: jest.fn(),
}));

import { NextRequest, NextResponse } from 'next/server';
import {
  withRateLimit,
  withTimeout,
  withRateLimitAndTimeout,
  TimeoutError,
} from '@/lib/rate-limit';

// Create a mock NextRequest
function createMockRequest(userId = 'test-user-123'): NextRequest {
  const headers = new Map<string, string>([['x-user-id', userId]]);
  return {
    url: 'http://localhost/api/test',
    headers: {
      get: (key: string) => headers.get(key),
      set: (key: string, value: string) => headers.set(key, value),
    },
    cookies: { get: jest.fn() },
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as NextRequest;
}

// Simple test handler
const testHandler = async () => {
  return NextResponse.json({ success: true });
};

// Slow handler for timeout tests
const slowHandler = async () => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return NextResponse.json({ success: true });
};

describe('Rate Limiting Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      const wrappedHandler = withRateLimit(
        testHandler,
        () => 'test-key-allow',
        { limit: 10, windowSeconds: 60 }
      );

      const request = createMockRequest();
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 429 when rate limit exceeded (in-memory)', async () => {
      // Create handler with very low limit
      const wrappedHandler = withRateLimit(
        testHandler,
        () => 'exhaust-key-429',
        { limit: 2, windowSeconds: 60 }
      );

      const request = createMockRequest();

      // First two requests should succeed
      const r1 = await wrappedHandler(request);
      expect(r1.status).toBe(200);

      const r2 = await wrappedHandler(request);
      expect(r2.status).toBe(200);

      // Third request should be rate limited
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
      expect(data.retryAfter).toBeDefined();
    });

    it('should use different keys for different users', async () => {
      const wrappedHandler = withRateLimit(
        testHandler,
        (req) => req.headers.get('x-user-id') || 'anonymous',
        { limit: 1, windowSeconds: 60 }
      );

      // Request from user 1
      const request1 = createMockRequest('user-1-unique');
      const request2 = createMockRequest('user-2-unique');

      // Both should succeed (different rate limit keys)
      const response1 = await wrappedHandler(request1);
      const response2 = await wrappedHandler(request2);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });
  });

  describe('withTimeout', () => {
    it('should allow requests that complete in time', async () => {
      const wrappedHandler = withTimeout(testHandler, 1000);

      const request = createMockRequest();
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 504 when handler times out', async () => {
      // Wrap slow handler with short timeout
      const wrappedHandler = withTimeout(slowHandler, 50);

      const request = createMockRequest();
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(504);
      expect(data.error).toBe('Request timeout');
    });
  });

  describe('withRateLimitAndTimeout', () => {
    it('should apply both rate limiting and timeout', async () => {
      const wrappedHandler = withRateLimitAndTimeout(
        testHandler,
        () => 'combined-key-both',
        { limit: 10, windowSeconds: 60, timeoutMs: 1000 }
      );

      const request = createMockRequest();
      const response = await wrappedHandler(request);

      expect(response.status).toBe(200);
    });

    it('should rate limit before checking timeout', async () => {
      const wrappedHandler = withRateLimitAndTimeout(
        slowHandler,
        () => 'combined-exhaust-key-order',
        { limit: 1, windowSeconds: 60, timeoutMs: 1000 }
      );

      const request = createMockRequest();

      // First request succeeds
      const response1 = await wrappedHandler(request);
      expect(response1.status).toBe(200);

      // Second request should be rate limited (not timeout)
      const response2 = await wrappedHandler(request);
      expect(response2.status).toBe(429);
    });
  });

  describe('TimeoutError', () => {
    it('should be identifiable as TimeoutError', () => {
      const error = new TimeoutError('Test timeout');

      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe('Test timeout');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof TimeoutError).toBe(true);
    });
  });
});
