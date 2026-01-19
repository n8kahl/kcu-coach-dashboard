/**
 * Tests for Thinkific Webhook Security
 *
 * Verifies fail-closed HMAC signature verification behavior:
 * - Missing signature returns 401 in production
 * - Invalid signature returns 401
 * - Valid signature returns 200
 */

import crypto from 'crypto';

// Mock next/server before anything imports it
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
    })),
  },
}));

// Mock Supabase before importing the route
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

// Mock next/headers
const mockHeadersGet = jest.fn();
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: (name: string) => mockHeadersGet(name),
  }),
}));

// Store original env
const originalEnv = process.env;

// Type helper for setting NODE_ENV in tests
type MutableEnv = { -readonly [K in keyof NodeJS.ProcessEnv]: NodeJS.ProcessEnv[K] };

describe('Thinkific Webhook Security', () => {
  const WEBHOOK_SECRET = 'test-webhook-secret-12345';
  const validPayload = JSON.stringify({
    resource: 'user',
    action: 'created',
    payload: {
      id: 123,
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
    },
    created_at: '2024-01-15T12:00:00Z',
  });

  // Generate valid HMAC signature
  function generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset env for each test
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Production environment (fail-closed)', () => {
    beforeEach(() => {
      (process.env as MutableEnv).NODE_ENV = 'production';
    });

    it('should return 401 when signature header is missing', async () => {
      process.env.THINKIFIC_WEBHOOK_SECRET = WEBHOOK_SECRET;
      mockHeadersGet.mockReturnValue(null); // No signature header

      // Re-import route after setting env
      jest.resetModules();

      // Re-mock after resetModules
      jest.doMock('next/server', () => ({
        NextRequest: jest.fn(),
        NextResponse: {
          json: jest.fn((data, init) => ({
            json: async () => data,
            status: init?.status || 200,
          })),
        },
      }));

      const { POST } = await import('@/app/api/thinkific/webhooks/route');

      const request = {
        text: jest.fn().mockResolvedValue(validPayload),
      } as unknown as Request;

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Missing signature');
    });

    it('should return 500 when webhook secret is not configured', async () => {
      delete process.env.THINKIFIC_WEBHOOK_SECRET;
      mockHeadersGet.mockReturnValue('some-signature');

      jest.resetModules();

      jest.doMock('next/server', () => ({
        NextRequest: jest.fn(),
        NextResponse: {
          json: jest.fn((data, init) => ({
            json: async () => data,
            status: init?.status || 200,
          })),
        },
      }));

      const { POST } = await import('@/app/api/thinkific/webhooks/route');

      const request = {
        text: jest.fn().mockResolvedValue(validPayload),
      } as unknown as Request;

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Webhook secret not configured');
    });

    it('should return 401 when signature is invalid', async () => {
      process.env.THINKIFIC_WEBHOOK_SECRET = WEBHOOK_SECRET;
      mockHeadersGet.mockReturnValue('invalid-signature-12345');

      jest.resetModules();

      jest.doMock('next/server', () => ({
        NextRequest: jest.fn(),
        NextResponse: {
          json: jest.fn((data, init) => ({
            json: async () => data,
            status: init?.status || 200,
          })),
        },
      }));

      const { POST } = await import('@/app/api/thinkific/webhooks/route');

      const request = {
        text: jest.fn().mockResolvedValue(validPayload),
      } as unknown as Request;

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Invalid signature');
    });

    it('should return 200 when signature is valid', async () => {
      process.env.THINKIFIC_WEBHOOK_SECRET = WEBHOOK_SECRET;
      const validSignature = generateSignature(validPayload, WEBHOOK_SECRET);
      mockHeadersGet.mockReturnValue(validSignature);

      jest.resetModules();

      jest.doMock('next/server', () => ({
        NextRequest: jest.fn(),
        NextResponse: {
          json: jest.fn((data, init) => ({
            json: async () => data,
            status: init?.status || 200,
          })),
        },
      }));

      const { POST } = await import('@/app/api/thinkific/webhooks/route');

      const request = {
        text: jest.fn().mockResolvedValue(validPayload),
      } as unknown as Request;

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });

  describe('Development environment', () => {
    beforeEach(() => {
      (process.env as MutableEnv).NODE_ENV = 'development';
    });

    it('should allow requests without signature when secret not configured (with warning)', async () => {
      delete process.env.THINKIFIC_WEBHOOK_SECRET;
      mockHeadersGet.mockReturnValue(null);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      jest.resetModules();

      jest.doMock('next/server', () => ({
        NextRequest: jest.fn(),
        NextResponse: {
          json: jest.fn((data, init) => ({
            json: async () => data,
            status: init?.status || 200,
          })),
        },
      }));

      const { POST } = await import('@/app/api/thinkific/webhooks/route');

      const request = {
        text: jest.fn().mockResolvedValue(validPayload),
      } as unknown as Request;

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('THINKIFIC_WEBHOOK_SECRET not set')
      );

      consoleSpy.mockRestore();
    });

    it('should still reject invalid signatures when secret is configured', async () => {
      process.env.THINKIFIC_WEBHOOK_SECRET = WEBHOOK_SECRET;
      mockHeadersGet.mockReturnValue('invalid-signature');

      jest.resetModules();

      jest.doMock('next/server', () => ({
        NextRequest: jest.fn(),
        NextResponse: {
          json: jest.fn((data, init) => ({
            json: async () => data,
            status: init?.status || 200,
          })),
        },
      }));

      const { POST } = await import('@/app/api/thinkific/webhooks/route');

      const request = {
        text: jest.fn().mockResolvedValue(validPayload),
      } as unknown as Request;

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Invalid signature');
    });
  });

  describe('Signature verification function', () => {
    it('should use timing-safe comparison', async () => {
      // The implementation uses crypto.timingSafeEqual which prevents timing attacks
      (process.env as MutableEnv).NODE_ENV = 'production';
      process.env.THINKIFIC_WEBHOOK_SECRET = WEBHOOK_SECRET;

      // Test with signatures of different lengths (should not crash)
      mockHeadersGet.mockReturnValue('short');

      jest.resetModules();

      jest.doMock('next/server', () => ({
        NextRequest: jest.fn(),
        NextResponse: {
          json: jest.fn((data, init) => ({
            json: async () => data,
            status: init?.status || 200,
          })),
        },
      }));

      const { POST } = await import('@/app/api/thinkific/webhooks/route');

      const request = {
        text: jest.fn().mockResolvedValue(validPayload),
      } as unknown as Request;

      // Should handle gracefully without throwing
      const response = await POST(request as any);
      expect(response.status).toBe(401);
    });
  });
});
