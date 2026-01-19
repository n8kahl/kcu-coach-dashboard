/**
 * Tests for Learning Progress API v2
 *
 * Verifies:
 * - GET /api/learning/v2/progress returns correct shape
 * - POST /api/learning/v2/progress updates lesson progress
 * - Module progress is calculated correctly from lessons
 * - Streak tracking works correctly
 */

// Mock next/server
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url) => ({
    url,
    json: jest.fn(),
    nextUrl: { searchParams: new URLSearchParams() },
  })),
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
  getSession: jest.fn(() =>
    Promise.resolve({
      user: { id: mockUserId },
      userId: mockUserId,
    })
  ),
}));

// Capture upserted data
let upsertedLessonData: Record<string, unknown> | null = null;
let upsertedStreakData: Record<string, unknown> | null = null;

// Create chainable mock
const createChainableMock = (finalData: unknown = null, finalError: unknown = null) => {
  const chainable: Record<string, jest.Mock> = {
    select: jest.fn(() => chainable),
    eq: jest.fn(() => chainable),
    single: jest.fn(() => Promise.resolve({ data: finalData, error: finalError })),
    order: jest.fn(() => Promise.resolve({ data: [], error: null })),
    upsert: jest.fn((data: Record<string, unknown>) => {
      upsertedLessonData = data;
      return {
        select: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: { id: 'progress-123', ...data },
              error: null,
            })
          ),
        })),
      };
    }),
    insert: jest.fn(() => Promise.resolve({ error: null })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    })),
  };
  return chainable;
};

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => {
      if (table === 'user_lesson_progress') {
        const chain = createChainableMock();
        chain.upsert = jest.fn((data: Record<string, unknown>) => {
          upsertedLessonData = data;
          return {
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: {
                    id: 'progress-123',
                    completed: data.completed,
                    watch_time: data.watch_time,
                    progress_percent: data.progress_percent,
                    ...data,
                  },
                  error: null,
                })
              ),
            })),
          };
        });
        return chain;
      }
      if (table === 'user_module_progress') {
        return createChainableMock([]);
      }
      if (table === 'user_learning_streaks') {
        const chain = createChainableMock({
          current_streak: 5,
          longest_streak: 10,
          streak_start_date: '2024-01-01',
          last_activity_date: '2024-01-15',
        });
        chain.insert = jest.fn((data: Record<string, unknown>) => {
          upsertedStreakData = data;
          return Promise.resolve({ error: null });
        });
        chain.update = jest.fn((data: Record<string, unknown>) => {
          upsertedStreakData = data;
          return {
            eq: jest.fn(() => Promise.resolve({ error: null })),
          };
        });
        return chain;
      }
      return createChainableMock();
    }),
  },
}));

describe('Learning Progress API v2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    upsertedLessonData = null;
    upsertedStreakData = null;
  });

  describe('GET /api/learning/v2/progress', () => {
    it('should return progress overview with correct shape', async () => {
      const { GET } = await import('@/app/api/learning/v2/progress/route');

      const response = await GET();
      const data = await response.json();

      // Verify response shape
      expect(data).toHaveProperty('overall');
      expect(data.overall).toHaveProperty('completedLessons');
      expect(data.overall).toHaveProperty('totalLessons');
      expect(data.overall).toHaveProperty('progressPercent');

      expect(data).toHaveProperty('streak');
      expect(data.streak).toHaveProperty('current');
      expect(data.streak).toHaveProperty('longest');

      expect(data).toHaveProperty('modules');
      expect(typeof data.modules).toBe('object');
    });

    it('should return correct streak data', async () => {
      const { GET } = await import('@/app/api/learning/v2/progress/route');

      const response = await GET();
      const data = await response.json();

      expect(data.streak.current).toBe(5);
      expect(data.streak.longest).toBe(10);
    });

    it('should include all curriculum modules', async () => {
      const { GET } = await import('@/app/api/learning/v2/progress/route');

      const response = await GET();
      const data = await response.json();

      // Check that modules exist for curriculum
      expect(Object.keys(data.modules).length).toBeGreaterThan(0);

      // Each module should have completed and total
      Object.values(data.modules).forEach((mod) => {
        const module = mod as { completed: number; total: number };
        expect(module).toHaveProperty('completed');
        expect(module).toHaveProperty('total');
        expect(module.completed).toBeGreaterThanOrEqual(0);
        expect(module.total).toBeGreaterThan(0);
      });
    });
  });

  describe('POST /api/learning/v2/progress', () => {
    it('should update lesson progress with lessonId', async () => {
      const { POST } = await import('@/app/api/learning/v2/progress/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          lessonId: 'lesson-123',
          completed: true,
          progressPercent: 100,
        }),
      } as unknown as Request;

      const response = await POST(request as never);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(upsertedLessonData).not.toBeNull();
      expect(upsertedLessonData!.lesson_id).toBe('lesson-123');
      expect(upsertedLessonData!.completed).toBe(true);
    });

    it('should return success response with progress data', async () => {
      const { POST } = await import('@/app/api/learning/v2/progress/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          lessonId: 'lesson-456',
          watchTime: 300,
        }),
      } as unknown as Request;

      const response = await POST(request as never);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.progress).toBeDefined();
    });
  });
});
