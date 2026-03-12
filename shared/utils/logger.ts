// Centralized logging utility with correlation ID support
export interface LogContext {
  correlationId?: string;
  service?: string;
  userId?: string;
  orderId?: string;
  [key: string]: any;
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

export class Logger {
  constructor(private serviceName: string) {}

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: {
        service: this.serviceName,
        ...context,
      },
      error,
    };

    // In production, you'd send this to a logging service like ELK stack
    const logOutput = {
      '@timestamp': logEntry.timestamp.toISOString(),
      level: logEntry.level,
      message: logEntry.message,
      service: this.serviceName,
      ...logEntry.context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    console.log(JSON.stringify(logOutput));
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // Convenience methods for common logging patterns
  logEvent(eventType: string, context?: LogContext): void {
    this.info(`Event: ${eventType}`, context);
  }

  logApiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API Request: ${method} ${path}`, context);
  }

  logApiResponse(method: string, path: string, statusCode: number, context?: LogContext): void {
    this.info(`API Response: ${method} ${path} - ${statusCode}`, context);
  }

  logServiceCall(serviceName: string, operation: string, context?: LogContext): void {
    this.info(`Service Call: ${serviceName}.${operation}`, context);
  }
}

// Factory function to create service-specific loggers
export function createLogger(serviceName: string): Logger {
  return new Logger(serviceName);
}