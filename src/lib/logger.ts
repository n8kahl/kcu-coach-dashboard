/**
 * Production Logger with Sentry Integration
 *
 * Features:
 * - Structured JSON logging in production
 * - Colored console output in development
 * - Request correlation IDs for tracing
 * - Sentry integration for error tracking
 * - Log levels: debug, info, warn, error
 */

import * as Sentry from '@sentry/nextjs';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type AuthEvent = 'login' | 'logout' | 'session_refresh' | 'session_expired' | 'unauthorized';

export interface LogContext {
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

// Logger interface definition
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, contextOrError?: LogContext | Error): void;
  error(message: string, contextOrError?: LogContext | Error, error?: Error): void;
  request(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void;
  auth(event: AuthEvent, userId?: string, context?: LogContext): void;
  security(event: string, context?: LogContext): void;
  ai(operation: string, model: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

// Log level priorities (higher = more severe)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Sentry severity mapping
const SENTRY_LEVELS: Record<LogLevel, Sentry.SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
};

// Get minimum log level from environment
function getMinLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return envLevel;
  }
  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
}

// Check if Sentry is configured
function isSentryEnabled(): boolean {
  return !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN;
}

// Format log entry for output
function formatLogEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (easier to parse by log aggregators)
    return JSON.stringify(entry);
  }

  // Human-readable format for development
  const levelColors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
  };
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';
  const color = levelColors[entry.level];

  let output = `${dim}${entry.timestamp}${reset} ${color}[${entry.level.toUpperCase()}]${reset}`;

  if (entry.requestId) {
    output += ` ${dim}[${entry.requestId.slice(0, 8)}]${reset}`;
  }

  output += ` ${entry.message}`;

  if (entry.context && Object.keys(entry.context).length > 0) {
    // Filter out requestId from context since it's already shown
    const { requestId, ...rest } = entry.context;
    if (Object.keys(rest).length > 0) {
      output += ` ${dim}${JSON.stringify(rest)}${reset}`;
    }
  }

  if (entry.error) {
    output += `\n  ${color}Error: ${entry.error.message}${reset}`;
    if (entry.error.stack && process.env.NODE_ENV === 'development') {
      output += `\n  ${dim}Stack: ${entry.error.stack.split('\n').slice(1, 4).join('\n  ')}${reset}`;
    }
  }

  return output;
}

// Output log entry to appropriate destination
function outputLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  switch (entry.level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }

  // Send to Sentry if enabled
  if (isSentryEnabled()) {
    sendToSentry(entry);
  }
}

// Send log entry to Sentry
function sendToSentry(entry: LogEntry): void {
  // Set context for all Sentry events
  if (entry.context) {
    Sentry.setContext('log', {
      requestId: entry.requestId || entry.context.requestId,
      ...entry.context,
    });
  }

  if (entry.requestId) {
    Sentry.setTag('request_id', entry.requestId);
  }

  // Handle errors
  if (entry.error) {
    const error = new Error(entry.error.message);
    error.name = entry.error.name;
    if (entry.error.stack) {
      error.stack = entry.error.stack;
    }

    Sentry.captureException(error, {
      level: SENTRY_LEVELS[entry.level],
      tags: {
        request_id: entry.requestId,
        log_level: entry.level,
      },
      extra: entry.context,
    });
  } else if (entry.level === 'error' || entry.level === 'warn') {
    // Capture warnings and errors as breadcrumbs or messages
    Sentry.addBreadcrumb({
      category: 'log',
      message: entry.message,
      level: SENTRY_LEVELS[entry.level],
      data: entry.context,
    });

    // Only capture error-level as actual Sentry events
    if (entry.level === 'error') {
      Sentry.captureMessage(entry.message, {
        level: 'error',
        tags: { request_id: entry.requestId },
        extra: entry.context,
      });
    }
  }
}

// Check if we should log at this level
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getMinLogLevel()];
}

// Create a log entry
function createLogEntry(
  level: LogLevel,
  message: string,
  contextOrError?: LogContext | Error,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  // Handle overloaded arguments
  if (contextOrError instanceof Error) {
    entry.error = {
      name: contextOrError.name,
      message: contextOrError.message,
      stack: contextOrError.stack,
      code: (contextOrError as NodeJS.ErrnoException).code,
    };
  } else if (contextOrError) {
    entry.context = contextOrError;
    if (contextOrError.requestId) {
      entry.requestId = contextOrError.requestId;
    }
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as NodeJS.ErrnoException).code,
    };
  }

  return entry;
}

// Create a child logger with preset context
function createChildLogger(parentContext: LogContext): Logger {
  return {
    debug(message: string, context?: LogContext): void {
      logger.debug(message, { ...parentContext, ...context });
    },
    info(message: string, context?: LogContext): void {
      logger.info(message, { ...parentContext, ...context });
    },
    warn(message: string, contextOrError?: LogContext | Error): void {
      if (contextOrError instanceof Error) {
        logger.warn(message, contextOrError);
      } else {
        logger.warn(message, { ...parentContext, ...contextOrError });
      }
    },
    error(message: string, contextOrError?: LogContext | Error, error?: Error): void {
      if (contextOrError instanceof Error) {
        logger.error(message, contextOrError, error);
      } else {
        logger.error(message, { ...parentContext, ...contextOrError }, error);
      }
    },
    request(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
      logger.request(method, path, statusCode, duration, { ...parentContext, ...context });
    },
    auth(event: AuthEvent, userId?: string, context?: LogContext): void {
      logger.auth(event, userId, { ...parentContext, ...context });
    },
    security(event: string, context?: LogContext): void {
      logger.security(event, { ...parentContext, ...context });
    },
    ai(operation: string, model: string, context?: LogContext): void {
      logger.ai(operation, model, { ...parentContext, ...context });
    },
    child(context: LogContext): Logger {
      return createChildLogger({ ...parentContext, ...context });
    },
  };
}

/**
 * Logger implementation
 */
export const logger: Logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
      outputLog(createLogEntry('debug', message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
      outputLog(createLogEntry('info', message, context));
    }
  },

  warn(message: string, contextOrError?: LogContext | Error): void {
    if (shouldLog('warn')) {
      outputLog(createLogEntry('warn', message, contextOrError));
    }
  },

  error(message: string, contextOrError?: LogContext | Error, error?: Error): void {
    if (shouldLog('error')) {
      outputLog(createLogEntry('error', message, contextOrError, error));
    }
  },

  /**
   * Log an API request/response
   */
  request(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    if (shouldLog(level)) {
      outputLog(createLogEntry(level, `${method} ${path} ${statusCode} ${duration}ms`, {
        ...context,
        method,
        path,
        statusCode,
        duration,
      }));
    }
  },

  /**
   * Log authentication events
   */
  auth(event: AuthEvent, userId?: string, context?: LogContext): void {
    if (shouldLog('info')) {
      outputLog(createLogEntry('info', `Auth: ${event}`, { ...context, userId, event }));
    }
  },

  /**
   * Log security events (always logged at warn or higher)
   */
  security(event: string, context?: LogContext): void {
    outputLog(createLogEntry('warn', `Security: ${event}`, context));
  },

  /**
   * Log AI operations (useful for debugging AI failures)
   */
  ai(operation: string, model: string, context?: LogContext): void {
    if (shouldLog('info')) {
      outputLog(createLogEntry('info', `AI: ${operation}`, { ...context, model, operation }));
    }
  },

  /**
   * Create a child logger with preset context
   */
  child(context: LogContext): Logger {
    return createChildLogger(context);
  },
};

export default logger;

// ============================================
// Request Correlation ID Utilities
// ============================================

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Extract request ID from headers or generate new one
 */
export function getRequestId(headers: Headers): string {
  // Check for existing correlation ID from upstream
  const existingId = headers.get('x-request-id') ||
                     headers.get('x-correlation-id') ||
                     headers.get('x-trace-id');

  return existingId || generateRequestId();
}

// ============================================
// Sentry Utilities
// ============================================

/**
 * Wrap an async function with Sentry error tracking
 */
export function withSentrySpan<T>(
  name: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!isSentryEnabled()) {
    return fn();
  }

  return Sentry.startSpan(
    { name, op: operation },
    async () => {
      try {
        return await fn();
      } catch (error) {
        Sentry.captureException(error);
        throw error;
      }
    }
  );
}

/**
 * Set user context for Sentry
 */
export function setSentryUser(user: { id: string; username?: string; email?: string }): void {
  if (isSentryEnabled()) {
    Sentry.setUser(user);
  }
}

/**
 * Clear user context from Sentry (on logout)
 */
export function clearSentryUser(): void {
  if (isSentryEnabled()) {
    Sentry.setUser(null);
  }
}
