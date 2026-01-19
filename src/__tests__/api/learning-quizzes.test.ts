/**
 * Tests for Learning Quizzes API v2
 *
 * Verifies:
 * - GET /api/learning/v2/quizzes/[id] returns quiz without answers
 * - POST /api/learning/v2/quizzes/[id] grades quiz correctly
 * - Quiz results are persisted
 * - Best scores are tracked
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

// Capture inserted data
let insertedAttempt: Record<string, unknown> | null = null;
let upsertedModuleProgress: Record<string, unknown> | null = null;

// Create chainable mock functions
const createChainableMock = (finalData: unknown = null, finalError: unknown = null) => {
  const chainable = {
    select: jest.fn(() => chainable),
    insert: jest.fn((data: Record<string, unknown>) => {
      insertedAttempt = data;
      return chainable;
    }),
    upsert: jest.fn((data: Record<string, unknown>) => {
      upsertedModuleProgress = data;
      return Promise.resolve({ error: null });
    }),
    eq: jest.fn(() => chainable),
    single: jest.fn(() => Promise.resolve({ data: finalData, error: finalError })),
    order: jest.fn(() => Promise.resolve({ data: [], error: null })),
  };
  return chainable;
};

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => {
      if (table === 'quiz_attempts') {
        const chain = createChainableMock({ id: 'attempt-123' });
        chain.insert = jest.fn((data: Record<string, unknown>) => {
          insertedAttempt = data;
          return chain;
        });
        return chain;
      }
      if (table === 'user_module_progress') {
        const chain = createChainableMock(null);
        chain.upsert = jest.fn((data: Record<string, unknown>) => {
          upsertedModuleProgress = data;
          return Promise.resolve({ error: null });
        });
        return chain;
      }
      if (table === 'quizzes') {
        // For database quiz lookup - return null to fall through to local data
        return createChainableMock(null, { message: 'Not found' });
      }
      return createChainableMock();
    }),
  },
}));

// Mock quizzes data - this is what the route will use
jest.mock('@/data/quizzes', () => ({
  getQuizById: jest.fn((id: string) => {
    if (id === 'quiz-ltp-framework') {
      return {
        id: 'quiz-ltp-framework',
        moduleId: 'ltp-framework',
        moduleSlug: 'ltp-framework',
        title: 'LTP Framework Quiz',
        description: 'Test your understanding of the LTP Framework',
        passingScore: 70,
        questions: [
          {
            id: 'q1',
            question: 'What does LTP stand for?',
            options: [
              { id: 'a', text: 'Level, Trend, Patience' },
              { id: 'b', text: 'Long Term Profit' },
              { id: 'c', text: 'Less Than Price' },
              { id: 'd', text: 'Low Target Point' },
            ],
            correctOptionId: 'a',
            explanation: 'LTP stands for Level, Trend, Patience - the core framework.',
          },
          {
            id: 'q2',
            question: 'What is a patience candle?',
            options: [
              { id: 'a', text: 'A candle that takes long to form' },
              { id: 'b', text: 'A confirmation candle at a level' },
              { id: 'c', text: 'Any green candle' },
              { id: 'd', text: 'A doji candle' },
            ],
            correctOptionId: 'b',
            explanation: 'A patience candle is a confirmation candle at a key level.',
          },
        ],
      };
    }
    return null;
  }),
  getQuizByModuleSlug: jest.fn(() => null),
}));

describe('Learning Quizzes API v2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insertedAttempt = null;
    upsertedModuleProgress = null;
  });

  describe('GET /api/learning/v2/quizzes/[id]', () => {
    it('should return quiz without correct answers', async () => {
      const { GET } = await import('@/app/api/learning/v2/quizzes/[id]/route');

      const request = {} as Request;
      const context = { params: Promise.resolve({ id: 'quiz-ltp-framework' }) };

      const response = await GET(request as never, context);
      const data = await response.json();

      expect(data.id).toBe('quiz-ltp-framework');
      expect(data.title).toBe('LTP Framework Quiz');

      // Verify questions don't include correct answers
      data.questions.forEach((q: { id: string; correctOptionId?: string; explanation?: string }) => {
        expect(q).not.toHaveProperty('correctOptionId');
        expect(q).not.toHaveProperty('explanation');
      });
    });

    it('should return 404 for non-existent quiz', async () => {
      const { GET } = await import('@/app/api/learning/v2/quizzes/[id]/route');

      const request = {} as Request;
      const context = { params: Promise.resolve({ id: 'non-existent-quiz' }) };

      const response = await GET(request as never, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Quiz not found');
    });
  });

  describe('POST /api/learning/v2/quizzes/[id]', () => {
    it('should grade quiz correctly with all correct answers', async () => {
      const { POST } = await import('@/app/api/learning/v2/quizzes/[id]/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          answers: [
            { questionId: 'q1', selectedOptionId: 'a' }, // correct
            { questionId: 'q2', selectedOptionId: 'b' }, // correct
          ],
        }),
      } as unknown as Request;

      const context = { params: Promise.resolve({ id: 'quiz-ltp-framework' }) };

      const response = await POST(request as never, context);
      const data = await response.json();

      expect(data.score).toBe(2);
      expect(data.totalQuestions).toBe(2);
      expect(data.percentage).toBe(100);
      expect(data.passed).toBe(true);
    });

    it('should grade quiz correctly with some wrong answers', async () => {
      const { POST } = await import('@/app/api/learning/v2/quizzes/[id]/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          answers: [
            { questionId: 'q1', selectedOptionId: 'a' }, // correct
            { questionId: 'q2', selectedOptionId: 'c' }, // wrong
          ],
        }),
      } as unknown as Request;

      const context = { params: Promise.resolve({ id: 'quiz-ltp-framework' }) };

      const response = await POST(request as never, context);
      const data = await response.json();

      expect(data.score).toBe(1);
      expect(data.percentage).toBe(50);
      expect(data.passed).toBe(false); // 50% < 70% passing
    });

    it('should return explanations for each question', async () => {
      const { POST } = await import('@/app/api/learning/v2/quizzes/[id]/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          answers: [
            { questionId: 'q1', selectedOptionId: 'b' },
            { questionId: 'q2', selectedOptionId: 'b' },
          ],
        }),
      } as unknown as Request;

      const context = { params: Promise.resolve({ id: 'quiz-ltp-framework' }) };

      const response = await POST(request as never, context);
      const data = await response.json();

      expect(data.answers).toBeDefined();
      expect(data.answers.length).toBe(2);

      data.answers.forEach((a: { explanation: string; isCorrect: boolean }) => {
        expect(a).toHaveProperty('explanation');
        expect(a).toHaveProperty('isCorrect');
      });
    });

    it('should persist quiz attempt', async () => {
      const { POST } = await import('@/app/api/learning/v2/quizzes/[id]/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          answers: [
            { questionId: 'q1', selectedOptionId: 'a' },
            { questionId: 'q2', selectedOptionId: 'b' },
          ],
        }),
      } as unknown as Request;

      const context = { params: Promise.resolve({ id: 'quiz-ltp-framework' }) };

      await POST(request as never, context);

      expect(insertedAttempt).toBeDefined();
      expect(insertedAttempt!.user_id).toBe(mockUserId);
      expect(insertedAttempt!.quiz_id).toBe('quiz-ltp-framework');
      expect(insertedAttempt!.score).toBe(2);
      expect(insertedAttempt!.percentage).toBe(100);
    });

    it('should return 400 for invalid answers format', async () => {
      const { POST } = await import('@/app/api/learning/v2/quizzes/[id]/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          // Missing answers array
          score: 100,
        }),
      } as unknown as Request;

      const context = { params: Promise.resolve({ id: 'quiz-ltp-framework' }) };

      const response = await POST(request as never, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request body');
    });

    it('should return 404 for non-existent quiz', async () => {
      const { POST } = await import('@/app/api/learning/v2/quizzes/[id]/route');

      const request = {
        json: jest.fn().mockResolvedValue({
          answers: [{ questionId: 'q1', selectedOptionId: 'a' }],
        }),
      } as unknown as Request;

      const context = { params: Promise.resolve({ id: 'non-existent-quiz' }) };

      const response = await POST(request as never, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Quiz not found');
    });
  });
});
