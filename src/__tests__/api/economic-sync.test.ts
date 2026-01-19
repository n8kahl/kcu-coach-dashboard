/**
 * Tests for Economic Calendar Sync API Security
 *
 * Verifies:
 * - POST requires valid cron token (401 without)
 * - Invalid token returns 401
 * - Valid token allows access
 */

// Mock next/server
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      headers: init?.headers || {},
    })),
  },
}));

// Mock next/headers
const mockHeadersGet = jest.fn();
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: (name: string) => mockHeadersGet(name),
  }),
}));

// Mock economic-calendar lib
jest.mock('@/lib/economic-calendar', () => ({
  syncEconomicEvents: jest.fn().mockResolvedValue({ success: true, count: 10 }),
  getUpcomingHighImpactEvents: jest.fn().mockResolvedValue([]),
  getTodayEvents: jest.fn().mockResolvedValue([]),
}));

// Mock redis rate limiting
jest.mock('@/lib/redis', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 9,
    resetAt: Date.now() + 3600000,
  }),
}));

// Store original env
const originalEnv = process.env;

// Type helper for setting NODE_ENV in tests
type MutableEnv = { -readonly [K in keyof NodeJS.ProcessEnv]: NodeJS.ProcessEnv[K] };

describe('Economic Sync API Security', () => {
  const CRON_SECRET = 'test-cron-secret-12345';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('POST /api/economic/sync (requires cron token)', () => {
    describe('Production environment', () => {
      beforeEach(() => {
        (process.env as MutableEnv).NODE_ENV = 'production';
      });

      it('should return 401 when Authorization header is missing', async () => {
        process.env.CRON_SECRET = CRON_SECRET;
        mockHeadersGet.mockImplementation((name: string) => {
          if (name === 'authorization') return null;
          if (name === 'x-forwarded-for') return '127.0.0.1';
          return null;
        });

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

        const { POST } = await import('@/app/api/economic/sync/route');

        const request = {
          url: 'http://localhost:3000/api/economic/sync',
        } as unknown as Request;

        const response = await POST(request as any);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
      });

      it('should return 401 when CRON_SECRET is not configured', async () => {
        delete process.env.CRON_SECRET;
        mockHeadersGet.mockImplementation((name: string) => {
          if (name === 'authorization') return 'Bearer some-token';
          if (name === 'x-forwarded-for') return '127.0.0.1';
          return null;
        });

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

        const { POST } = await import('@/app/api/economic/sync/route');

        const request = {
          url: 'http://localhost:3000/api/economic/sync',
        } as unknown as Request;

        const response = await POST(request as any);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
      });

      it('should return 401 when token is invalid', async () => {
        process.env.CRON_SECRET = CRON_SECRET;
        mockHeadersGet.mockImplementation((name: string) => {
          if (name === 'authorization') return 'Bearer wrong-token';
          if (name === 'x-forwarded-for') return '127.0.0.1';
          return null;
        });

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

        const { POST } = await import('@/app/api/economic/sync/route');

        const request = {
          url: 'http://localhost:3000/api/economic/sync',
        } as unknown as Request;

        const response = await POST(request as any);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
      });

      it('should return 401 when Authorization header has wrong format', async () => {
        process.env.CRON_SECRET = CRON_SECRET;
        mockHeadersGet.mockImplementation((name: string) => {
          if (name === 'authorization') return 'Basic some-token'; // Wrong scheme
          if (name === 'x-forwarded-for') return '127.0.0.1';
          return null;
        });

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

        const { POST } = await import('@/app/api/economic/sync/route');

        const request = {
          url: 'http://localhost:3000/api/economic/sync',
        } as unknown as Request;

        const response = await POST(request as any);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
      });

      it('should return 200 when token is valid', async () => {
        process.env.CRON_SECRET = CRON_SECRET;
        mockHeadersGet.mockImplementation((name: string) => {
          if (name === 'authorization') return `Bearer ${CRON_SECRET}`;
          if (name === 'x-forwarded-for') return '127.0.0.1';
          return null;
        });

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

        const { POST } = await import('@/app/api/economic/sync/route');

        const request = {
          url: 'http://localhost:3000/api/economic/sync',
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

      it('should allow requests without token when CRON_SECRET is not set (dev only)', async () => {
        delete process.env.CRON_SECRET;
        mockHeadersGet.mockImplementation((name: string) => {
          if (name === 'authorization') return null;
          if (name === 'x-forwarded-for') return '127.0.0.1';
          return null;
        });

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

        const { POST } = await import('@/app/api/economic/sync/route');

        const request = {
          url: 'http://localhost:3000/api/economic/sync',
        } as unknown as Request;

        const response = await POST(request as any);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('CRON_SECRET not set')
        );

        consoleSpy.mockRestore();
      });
    });
  });

  describe('Rate limiting', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      (process.env as MutableEnv).NODE_ENV = 'production';
      process.env.CRON_SECRET = CRON_SECRET;
      mockHeadersGet.mockImplementation((name: string) => {
        if (name === 'authorization') return `Bearer ${CRON_SECRET}`;
        if (name === 'x-forwarded-for') return '127.0.0.1';
        return null;
      });

      jest.resetModules();

      // Mock rate limit exceeded
      jest.doMock('@/lib/redis', () => ({
        checkRateLimit: jest.fn().mockResolvedValue({
          allowed: false,
          remaining: 0,
          resetAt: Date.now() + 3600000,
        }),
      }));

      jest.doMock('next/server', () => ({
        NextRequest: jest.fn(),
        NextResponse: {
          json: jest.fn((data, init) => ({
            json: async () => data,
            status: init?.status || 200,
            headers: init?.headers || {},
          })),
        },
      }));

      const { POST } = await import('@/app/api/economic/sync/route');

      const request = {
        url: 'http://localhost:3000/api/economic/sync',
      } as unknown as Request;

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.error).toBe('Rate limit exceeded');
      expect(body.retryAfter).toBeDefined();
    });
  });
});
