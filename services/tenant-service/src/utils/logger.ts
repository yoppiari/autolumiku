/**
 * Logger Utility
 *
 * Provides structured logging with different log levels and correlation IDs.
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  operation?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: string;
  service: string;
}

export class Logger {
  constructor(
    private readonly serviceName: string,
    private readonly minLevel: LogLevel = LogLevel.INFO
  ) {}

  private shouldLog(level: LogLevel): boolean {
    return level <= this.minLevel;
  }

  private formatMessage(level: string, message: string, context?: LogContext, error?: Error): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error: error?.message,
      service: this.serviceName,
    };
  }

  private log(entry: LogEntry): void {
    if (process.env.NODE_ENV === 'development') {
      // Pretty print for development
      const { level, message, timestamp, context, error, service } = entry;
      console.log(`[${timestamp}] ${level} [${service}]: ${message}`, {
        context,
        error,
      });
    } else {
      // JSON format for production
      console.log(JSON.stringify(entry));
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.log(this.formatMessage('ERROR', message, context, error));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(this.formatMessage('WARN', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(this.formatMessage('INFO', message, context));
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(this.formatMessage('DEBUG', message, context));
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    const childLogger = new Logger(this.serviceName, this.minLevel);

    // Override methods to include additional context
    const originalError = childLogger.error.bind(childLogger);
    const originalWarn = childLogger.warn.bind(childLogger);
    const originalInfo = childLogger.info.bind(childLogger);
    const originalDebug = childLogger.debug.bind(childLogger);

    childLogger.error = (message: string, context?: LogContext, error?: Error) => {
      originalError(message, { ...additionalContext, ...context }, error);
    };

    childLogger.warn = (message: string, context?: LogContext) => {
      originalWarn(message, { ...additionalContext, ...context });
    };

    childLogger.info = (message: string, context?: LogContext) => {
      originalInfo(message, { ...additionalContext, ...context });
    };

    childLogger.debug = (message: string, context?: LogContext) => {
      originalDebug(message, { ...additionalContext, ...context });
    };

    return childLogger;
  }
}

// Create default logger instance
export const logger = new Logger('tenant-service');