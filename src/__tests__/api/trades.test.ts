/**
 * Tests for Trade Journal API
 *
 * Verifies:
 * - Creating a trade with quantity alias results in shares stored correctly
 * - LTP checklist impacts grade (A/B/C/D/F) deterministically
 * - Field aliases work correctly (is_options/isOptions)
 */

// Mock next/server
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
    })),
  },
}));

// Mock auth
const mockUserId = 'test-user-123';
jest.mock('@/lib/auth', () => ({
  getAuthenticatedUserId: jest.fn(() => Promise.resolve(mockUserId)),
}));

// Capture inserted trade data
let insertedTradeData: Record<string, unknown> | null = null;

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      insert: jest.fn((data: Record<string, unknown>) => {
        insertedTradeData = data;
        return {
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { id: 'trade-123', ...data },
                error: null,
              })
            ),
          })),
        };
      }),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            range: jest.fn(() =>
              Promise.resolve({ data: [], error: null, count: 0 })
            ),
          })),
        })),
      })),
    })),
  },
}));

describe('Trade Journal API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insertedTradeData = null;
  });

  describe('POST /api/trades - Field Aliases', () => {
    it('should accept quantity alias and store as shares', async () => {
      const { POST } = await import('@/app/api/trades/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          symbol: 'AAPL',
          direction: 'long',
          entry_price: 150,
          exit_price: 155,
          quantity: 10, // UI sends 'quantity'
          entry_time: '2024-01-15T10:00:00Z',
          exit_time: '2024-01-15T14:00:00Z',
          pnl: 50,
          pnl_percent: 3.33,
          setup_type: 'breakout',
        }),
      } as unknown as Request;

      await POST(request);

      // Verify shares is stored (not quantity)
      expect(insertedTradeData).toBeDefined();
      expect(insertedTradeData!.shares).toBe(10);
      expect(insertedTradeData!.quantity).toBeUndefined();
    });

    it('should prefer shares over quantity when both provided', async () => {
      const { POST } = await import('@/app/api/trades/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          symbol: 'SPY',
          direction: 'short',
          entry_price: 450,
          exit_price: 445,
          shares: 5,
          quantity: 10, // Should be ignored
          entry_time: '2024-01-15T10:00:00Z',
          exit_time: '2024-01-15T14:00:00Z',
        }),
      } as unknown as Request;

      await POST(request);

      expect(insertedTradeData!.shares).toBe(5); // shares takes priority
    });

    it('should accept isOptions alias and store as is_options', async () => {
      const { POST } = await import('@/app/api/trades/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          symbol: 'QQQ',
          direction: 'long',
          entry_price: 2.5,
          exit_price: 3.0,
          quantity: 1,
          isOptions: true, // camelCase alias
          entry_time: '2024-01-15T10:00:00Z',
          exit_time: '2024-01-15T14:00:00Z',
        }),
      } as unknown as Request;

      await POST(request);

      expect(insertedTradeData!.is_options).toBe(true);
    });

    it('should default shares to 1 when not provided', async () => {
      const { POST } = await import('@/app/api/trades/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          symbol: 'TSLA',
          direction: 'long',
          entry_price: 200,
          exit_price: 210,
          entry_time: '2024-01-15T10:00:00Z',
          exit_time: '2024-01-15T14:00:00Z',
        }),
      } as unknown as Request;

      await POST(request);

      expect(insertedTradeData!.shares).toBe(1);
    });
  });

  describe('POST /api/trades - LTP Grade Computation', () => {
    it('should compute grade A when all 4 checklist items are true (score 100)', async () => {
      const { POST } = await import('@/app/api/trades/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          symbol: 'SPY',
          direction: 'long',
          entry_price: 450,
          exit_price: 455,
          entry_time: '2024-01-15T10:00:00Z',
          exit_time: '2024-01-15T14:00:00Z',
          had_level: true,
          had_trend: true,
          had_patience_candle: true,
          followed_rules: true,
        }),
      } as unknown as Request;

      await POST(request);

      const ltpGrade = insertedTradeData!.ltp_grade as { score: number; grade: string; feedback: string[] };
      expect(ltpGrade.score).toBe(100);
      expect(ltpGrade.grade).toBe('A');
      expect(ltpGrade.feedback).toHaveLength(0); // No improvement suggestions
    });

    it('should compute grade B when 3 checklist items are true (score 75)', async () => {
      const { POST } = await import('@/app/api/trades/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          symbol: 'SPY',
          direction: 'long',
          entry_price: 450,
          exit_price: 455,
          entry_time: '2024-01-15T10:00:00Z',
          exit_time: '2024-01-15T14:00:00Z',
          had_level: true,
          had_trend: true,
          had_patience_candle: true,
          followed_rules: false, // Missing one
        }),
      } as unknown as Request;

      await POST(request);

      const ltpGrade = insertedTradeData!.ltp_grade as { score: number; grade: string; feedback: string[] };
      expect(ltpGrade.score).toBe(75);
      expect(ltpGrade.grade).toBe('B');
      expect(ltpGrade.feedback).toHaveLength(1);
      expect(ltpGrade.feedback[0]).toContain('trading rules');
    });

    it('should compute grade C when 2 checklist items are true (score 50)', async () => {
      const { POST } = await import('@/app/api/trades/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          symbol: 'SPY',
          direction: 'long',
          entry_price: 450,
          exit_price: 455,
          entry_time: '2024-01-15T10:00:00Z',
          exit_time: '2024-01-15T14:00:00Z',
          had_level: true,
          had_trend: true,
          had_patience_candle: false,
          followed_rules: false,
        }),
      } as unknown as Request;

      await POST(request);

      const ltpGrade = insertedTradeData!.ltp_grade as { score: number; grade: string; feedback: string[] };
      expect(ltpGrade.score).toBe(50);
      expect(ltpGrade.grade).toBe('C');
      expect(ltpGrade.feedback).toHaveLength(2);
    });

    it('should compute grade D when 1 checklist item is true (score 25)', async () => {
      const { POST } = await import('@/app/api/trades/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          symbol: 'SPY',
          direction: 'long',
          entry_price: 450,
          exit_price: 455,
          entry_time: '2024-01-15T10:00:00Z',
          exit_time: '2024-01-15T14:00:00Z',
          had_level: false,
          had_trend: false,
          had_patience_candle: false,
          followed_rules: true, // Only one
        }),
      } as unknown as Request;

      await POST(request);

      const ltpGrade = insertedTradeData!.ltp_grade as { score: number; grade: string; feedback: string[] };
      expect(ltpGrade.score).toBe(25);
      expect(ltpGrade.grade).toBe('D');
      expect(ltpGrade.feedback).toHaveLength(3);
    });

    it('should compute grade F when no checklist items are true (score 0)', async () => {
      const { POST } = await import('@/app/api/trades/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          symbol: 'SPY',
          direction: 'long',
          entry_price: 450,
          exit_price: 455,
          entry_time: '2024-01-15T10:00:00Z',
          exit_time: '2024-01-15T14:00:00Z',
          had_level: false,
          had_trend: false,
          had_patience_candle: false,
          followed_rules: false,
        }),
      } as unknown as Request;

      await POST(request);

      const ltpGrade = insertedTradeData!.ltp_grade as { score: number; grade: string; feedback: string[] };
      expect(ltpGrade.score).toBe(0);
      expect(ltpGrade.grade).toBe('F');
      expect(ltpGrade.feedback).toHaveLength(4); // All suggestions
    });

    it('should default LTP checklist to false when not provided', async () => {
      const { POST } = await import('@/app/api/trades/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          symbol: 'SPY',
          direction: 'long',
          entry_price: 450,
          exit_price: 455,
          entry_time: '2024-01-15T10:00:00Z',
          exit_time: '2024-01-15T14:00:00Z',
          // No LTP fields provided
        }),
      } as unknown as Request;

      await POST(request);

      const ltpGrade = insertedTradeData!.ltp_grade as { score: number; grade: string; feedback: string[] };
      expect(ltpGrade.score).toBe(0);
      expect(ltpGrade.grade).toBe('F');
      expect(insertedTradeData!.had_level).toBe(false);
      expect(insertedTradeData!.had_trend).toBe(false);
      expect(insertedTradeData!.had_patience_candle).toBe(false);
      expect(insertedTradeData!.followed_rules).toBe(false);
    });
  });

  describe('POST /api/trades - Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      // Re-mock with null userId
      jest.resetModules();

      jest.doMock('@/lib/auth', () => ({
        getAuthenticatedUserId: jest.fn(() => Promise.resolve(null)),
      }));

      const { POST } = await import('@/app/api/trades/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          symbol: 'SPY',
          direction: 'long',
        }),
      } as unknown as Request;

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });
  });
});
