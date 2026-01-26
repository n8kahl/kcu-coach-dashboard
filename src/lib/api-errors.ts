/**
 * API Error Utilities
 *
 * Standardized error handling for API routes.
 * Uses structured logging and Sentry integration.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger, getRequestId } from './logger';

// Error codes enum
export enum ErrorCode {
  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Conflict errors (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
}

// Error interface
export interface APIError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  timestamp: string;
  requestId?: string;
}

// Error response interface
export interface APIErrorResponse {
  error: APIError;
}

/**
 * Create a standardized API error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown,
  requestId?: string
): NextResponse<APIErrorResponse> {
  const error: APIError = {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    requestId,
  };

  // Log errors using structured logger
  if (status >= 500) {
    logger.error(`API Error: ${code}`, { code, message, status, details, requestId });
  } else if (status >= 400) {
    logger.warn(`API Warning: ${code}`, { code, message, status, details, requestId });
  }

  const response = NextResponse.json({ error }, { status });

  // Add request ID header for correlation
  if (requestId) {
    response.headers.set('X-Request-ID', requestId);
  }

  return response;
}

// ============================================
// Convenience Functions
// ============================================

/**
 * 400 Bad Request - Validation error
 */
export function badRequest(message = 'Invalid request', details?: unknown): NextResponse<APIErrorResponse> {
  return createErrorResponse(ErrorCode.VALIDATION_ERROR, message, 400, details);
}

/**
 * 401 Unauthorized - Authentication required
 */
export function unauthorized(message = 'Authentication required'): NextResponse<APIErrorResponse> {
  return createErrorResponse(ErrorCode.UNAUTHORIZED, message, 401);
}

/**
 * 403 Forbidden - Insufficient permissions
 */
export function forbidden(message = 'You do not have permission to access this resource'): NextResponse<APIErrorResponse> {
  return createErrorResponse(ErrorCode.FORBIDDEN, message, 403);
}

/**
 * 404 Not Found
 */
export function notFound(message = 'Resource not found'): NextResponse<APIErrorResponse> {
  return createErrorResponse(ErrorCode.NOT_FOUND, message, 404);
}

/**
 * 409 Conflict - Duplicate or conflicting data
 */
export function conflict(message = 'Resource already exists', details?: unknown): NextResponse<APIErrorResponse> {
  return createErrorResponse(ErrorCode.CONFLICT, message, 409, details);
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export function rateLimitExceeded(
  retryAfter?: number
): NextResponse<APIErrorResponse> {
  const response = createErrorResponse(
    ErrorCode.RATE_LIMIT_EXCEEDED,
    'Too many requests. Please try again later.',
    429
  );

  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString());
  }

  return response;
}

/**
 * 500 Internal Server Error
 */
export function internalError(message = 'An unexpected error occurred'): NextResponse<APIErrorResponse> {
  return createErrorResponse(ErrorCode.INTERNAL_ERROR, message, 500);
}

/**
 * Handle Zod validation errors
 */
export function fromZodError(error: ZodError): NextResponse<APIErrorResponse> {
  const details = error.errors.map((e) => ({
    path: e.path.join('.'),
    message: e.message,
  }));

  return createErrorResponse(
    ErrorCode.VALIDATION_ERROR,
    'Validation failed',
    400,
    details
  );
}

// ============================================
// Error Handler Wrapper
// ============================================

type RouteHandler = (request: Request, context?: unknown) => Promise<NextResponse>;

/**
 * Wrap an API route handler with error handling
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request: Request, context?: unknown): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof ZodError) {
        return fromZodError(error);
      }

      // Handle known error types
      if (error instanceof Error) {
        // Check for specific error messages
        if (error.message.includes('not found')) {
          return notFound(error.message);
        }

        if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
          return unauthorized(error.message);
        }

        if (error.message.includes('forbidden') || error.message.includes('permission')) {
          return forbidden(error.message);
        }

        // Log and return internal error
        logger.error('Unhandled API error', { error: error.message, stack: error.stack });
        return internalError(
          process.env.NODE_ENV === 'development' ? error.message : undefined
        );
      }

      // Unknown error type
      logger.error('Unknown error type in API handler', { error: String(error) });
      return internalError();
    }
  };
}

// ============================================
// Success Response Helper
// ============================================

export interface APISuccessResponse<T = unknown> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data: T,
  meta?: APISuccessResponse<T>['meta']
): NextResponse<APISuccessResponse<T>> {
  const response: APISuccessResponse<T> = { data };

  if (meta) {
    response.meta = meta;
  }

  return NextResponse.json(response);
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): NextResponse<APISuccessResponse<T[]>> {
  return successResponse(items, {
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
}
