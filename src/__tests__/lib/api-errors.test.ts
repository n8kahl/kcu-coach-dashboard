import { NextResponse } from 'next/server';
import {
  ErrorCode,
  createErrorResponse,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  rateLimitExceeded,
  internalError,
  fromZodError,
  successResponse,
  paginatedResponse,
} from '@/lib/api-errors';
import { ZodError, z } from 'zod';

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      data,
      status: init?.status || 200,
      headers: new Map(),
    })),
  },
}));

describe('API Error Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createErrorResponse', () => {
    it('should create an error response with correct structure', () => {
      const response = createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Test error message',
        400,
        { field: 'test' }
      );

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Test error message',
            details: { field: 'test' },
            timestamp: expect.any(String),
          }),
        }),
        { status: 400 }
      );
    });

    it('should include timestamp in ISO format', () => {
      const response = createErrorResponse(
        ErrorCode.NOT_FOUND,
        'Not found',
        404
      );

      const call = (NextResponse.json as jest.Mock).mock.calls[0];
      const timestamp = call[0].error.timestamp;
      expect(() => new Date(timestamp)).not.toThrow();
    });
  });

  describe('Convenience functions', () => {
    it('badRequest should return 400 status', () => {
      badRequest('Invalid input', { field: 'email' });
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.any(Object),
        { status: 400 }
      );
    });

    it('unauthorized should return 401 status', () => {
      unauthorized('Login required');
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.any(Object),
        { status: 401 }
      );
    });

    it('forbidden should return 403 status', () => {
      forbidden('Access denied');
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.any(Object),
        { status: 403 }
      );
    });

    it('notFound should return 404 status', () => {
      notFound('User not found');
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.any(Object),
        { status: 404 }
      );
    });

    it('conflict should return 409 status', () => {
      conflict('Email already exists');
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.any(Object),
        { status: 409 }
      );
    });

    it('rateLimitExceeded should return 429 status', () => {
      rateLimitExceeded(60);
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.any(Object),
        { status: 429 }
      );
    });

    it('internalError should return 500 status', () => {
      internalError('Server error');
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.any(Object),
        { status: 500 }
      );
    });
  });

  describe('fromZodError', () => {
    it('should convert Zod errors to API error response', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(0),
      });

      try {
        schema.parse({ email: 'invalid', age: -5 });
      } catch (error) {
        if (error instanceof ZodError) {
          fromZodError(error);

          const call = (NextResponse.json as jest.Mock).mock.calls[0];
          expect(call[1].status).toBe(400);
          expect(call[0].error.code).toBe(ErrorCode.VALIDATION_ERROR);
          expect(call[0].error.details).toBeInstanceOf(Array);
        }
      }
    });
  });

  describe('successResponse', () => {
    it('should create success response with data', () => {
      const data = { id: 1, name: 'Test' };
      successResponse(data);

      expect(NextResponse.json).toHaveBeenCalledWith({
        data,
      });
    });

    it('should include meta when provided', () => {
      const data = [1, 2, 3];
      const meta = { total: 100, page: 1, limit: 20 };
      successResponse(data, meta);

      expect(NextResponse.json).toHaveBeenCalledWith({
        data,
        meta,
      });
    });
  });

  describe('paginatedResponse', () => {
    it('should create paginated response', () => {
      const items = [{ id: 1 }, { id: 2 }];
      paginatedResponse(items, 100, 1, 20);

      expect(NextResponse.json).toHaveBeenCalledWith({
        data: items,
        meta: {
          total: 100,
          page: 1,
          limit: 20,
          hasMore: true, // 1 * 20 < 100
        },
      });
    });

    it('should set hasMore to false when on last page', () => {
      const items = [{ id: 1 }];
      paginatedResponse(items, 21, 2, 20);

      const call = (NextResponse.json as jest.Mock).mock.calls[0];
      expect(call[0].meta.hasMore).toBe(false); // 2 * 20 >= 21
    });
  });
});
