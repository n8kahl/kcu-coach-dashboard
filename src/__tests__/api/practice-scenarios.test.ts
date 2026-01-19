/**
 * Tests for Practice Scenario API Security
 *
 * Verifies:
 * - Non-admin cannot see outcome with includeOutcome=true
 * - Admin can see outcome with includeOutcome=true
 * - User can see outcome after attempting the scenario
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

// Mock session - will be configured per test
const mockSession = {
  userId: 'user-123',
  isAdmin: false,
};

jest.mock('@/lib/auth', () => ({
  getSession: jest.fn(() => Promise.resolve(mockSession)),
}));

// Mock scenario data
const mockScenario = {
  id: 'scenario-123',
  title: 'Test Scenario',
  description: 'A test trading scenario',
  symbol: 'AAPL',
  scenario_type: 'entry',
  difficulty: 'intermediate',
  chart_data: { candles: [] },
  key_levels: [150, 155],
  decision_point: { price: 152 },
  tags: ['trend'],
  is_active: true,
  correct_action: 'buy', // This should be hidden from non-admins
  outcome_data: { result: 'profit' }, // This should be hidden from non-admins
  ltp_analysis: { level: 80 }, // This should be hidden from non-admins
  explanation: 'This was a good entry', // This should be hidden from non-admins
};

// Mock attempt data
const mockAttempt = {
  id: 'attempt-123',
  decision: 'buy',
  is_correct: true,
  feedback: 'Good job!',
  created_at: '2024-01-15T12:00:00Z',
};

// Mock Supabase
const mockSupabaseSingle = jest.fn();
const mockSupabaseLimit = jest.fn(() => ({ single: mockSupabaseSingle }));
const mockSupabaseOrder = jest.fn(() => ({ limit: mockSupabaseLimit }));
const mockSupabaseEq = jest.fn();
const mockSupabaseSelect = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => {
      if (table === 'practice_scenarios') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: () => Promise.resolve({ data: mockScenario, error: null }),
              })),
            })),
          })),
        };
      }
      if (table === 'practice_attempts') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    single: mockSupabaseSingle,
                  })),
                })),
              })),
            })),
          })),
        };
      }
      return {};
    }),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Practice Scenario API - includeOutcome Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to non-admin user with no attempt
    mockSession.userId = 'user-123';
    mockSession.isAdmin = false;
    mockSupabaseSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
  });

  describe('GET /api/practice/scenarios/[id]', () => {
    it('should NOT include outcome for non-admin with includeOutcome=true', async () => {
      mockSession.isAdmin = false;

      const { GET } = await import('@/app/api/practice/scenarios/[id]/route');

      const request = {
        url: 'http://localhost:3000/api/practice/scenarios/scenario-123?includeOutcome=true',
      } as unknown as Request;

      const response = await GET(request, { params: Promise.resolve({ id: 'scenario-123' }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      // Should NOT have outcome data for non-admin
      expect(body.correctAction).toBeUndefined();
      expect(body.outcomeData).toBeUndefined();
      expect(body.ltpAnalysis).toBeUndefined();
      expect(body.explanation).toBeUndefined();
      // Should have basic scenario data
      expect(body.id).toBe('scenario-123');
      expect(body.title).toBe('Test Scenario');
    });

    it('should include outcome for admin with includeOutcome=true', async () => {
      mockSession.isAdmin = true;

      jest.resetModules();

      // Re-mock with admin session
      jest.doMock('@/lib/auth', () => ({
        getSession: jest.fn(() => Promise.resolve({ userId: 'admin-123', isAdmin: true })),
      }));

      const { GET } = await import('@/app/api/practice/scenarios/[id]/route');

      const request = {
        url: 'http://localhost:3000/api/practice/scenarios/scenario-123?includeOutcome=true',
      } as unknown as Request;

      const response = await GET(request, { params: Promise.resolve({ id: 'scenario-123' }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      // Should have outcome data for admin
      expect(body.correctAction).toBe('buy');
      expect(body.outcomeData).toEqual({ result: 'profit' });
      expect(body.ltpAnalysis).toEqual({ level: 80 });
      expect(body.explanation).toBe('This was a good entry');
    });

    it('should NOT include outcome for admin without includeOutcome param', async () => {
      mockSession.isAdmin = true;

      jest.resetModules();

      jest.doMock('@/lib/auth', () => ({
        getSession: jest.fn(() => Promise.resolve({ userId: 'admin-123', isAdmin: true })),
      }));

      const { GET } = await import('@/app/api/practice/scenarios/[id]/route');

      const request = {
        url: 'http://localhost:3000/api/practice/scenarios/scenario-123', // No includeOutcome
      } as unknown as Request;

      const response = await GET(request, { params: Promise.resolve({ id: 'scenario-123' }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      // Should NOT have outcome data even for admin if not requested
      expect(body.correctAction).toBeUndefined();
      expect(body.outcomeData).toBeUndefined();
    });

    it('should include outcome for non-admin who has attempted the scenario', async () => {
      mockSession.isAdmin = false;
      // User has an attempt
      mockSupabaseSingle.mockResolvedValue({ data: mockAttempt, error: null });

      jest.resetModules();

      jest.doMock('@/lib/auth', () => ({
        getSession: jest.fn(() => Promise.resolve({ userId: 'user-123', isAdmin: false })),
      }));

      const { GET } = await import('@/app/api/practice/scenarios/[id]/route');

      const request = {
        url: 'http://localhost:3000/api/practice/scenarios/scenario-123',
      } as unknown as Request;

      const response = await GET(request, { params: Promise.resolve({ id: 'scenario-123' }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      // Should have outcome data because user already attempted
      expect(body.correctAction).toBe('buy');
      expect(body.outcomeData).toEqual({ result: 'profit' });
      expect(body.hasAttempted).toBe(true);
      expect(body.lastAttempt).toBeDefined();
      expect(body.lastAttempt.isCorrect).toBe(true);
    });

    it('should return 401 for unauthenticated user', async () => {
      jest.resetModules();

      jest.doMock('@/lib/auth', () => ({
        getSession: jest.fn(() => Promise.resolve({ userId: null })),
      }));

      const { GET } = await import('@/app/api/practice/scenarios/[id]/route');

      const request = {
        url: 'http://localhost:3000/api/practice/scenarios/scenario-123?includeOutcome=true',
      } as unknown as Request;

      const response = await GET(request, { params: Promise.resolve({ id: 'scenario-123' }) });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });
  });
});
