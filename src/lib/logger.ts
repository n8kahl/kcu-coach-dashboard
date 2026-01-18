/**
 * Structured logging service for production readiness
 * Replaces scattered console.log calls with proper log levels and formatting
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type AuthEvent = 'login' | 'logout' | 'session_refresh' | 'session_expired' | 'unauthorized';

interface LogContext {
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Logger interface definition (defined before implementation to avoid circular reference)
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, contextOrError?: LogContext | Error): void;
  error(message: string, contextOrError?: LogContext | Error, error?: Error): void;
  request(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void;
  auth(event: AuthEvent, userId?: string, context?: LogContext): void;
  security(event: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

// Log level priorities (higher = more severe)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get minimum log level from environment
function getMinLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return envLevel;
  }
  // Default: debug in development, info in production
  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
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
  const color = levelColors[entry.level];

  let output = `${entry.timestamp} ${color}[${entry.level.toUpperCase()}]${reset} ${entry.message}`;

  if (entry.context && Object.keys(entry.context).length > 0) {
    output += ` ${JSON.stringify(entry.context)}`;
  }

  if (entry.error) {
    output += `\n  Error: ${entry.error.message}`;
    if (entry.error.stack && process.env.NODE_ENV === 'development') {
      output += `\n  Stack: ${entry.error.stack}`;
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

  // TODO: Send to external logging service (e.g., Sentry, DataDog)
  // if (process.env.NODE_ENV === 'production' && entry.level === 'error') {
  //   sendToErrorTracking(entry);
  // }
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
    };
  } else if (contextOrError) {
    entry.context = contextOrError;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
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
      outputLog(createLogEntry(level, `${method} ${path} ${statusCode}`, {
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
   * Create a child logger with preset context
   */
  child(context: LogContext): Logger {
    return createChildLogger(context);
  },
};

export default logger;
