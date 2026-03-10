/**
 * Logger Utility for Browser Automation
 *
 * Provides structured logging with timestamps, log levels, and context.
 * Supports both console output and optional file logging.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  includeTimestamp: boolean;
  includeModule: boolean;
  jsonFormat: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: LogLevel.INFO,
  includeTimestamp: true,
  includeModule: true,
  jsonFormat: false,
};

// Color codes for console output
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
} as const;

const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: COLORS.dim,
  [LogLevel.INFO]: COLORS.blue,
  [LogLevel.WARN]: COLORS.yellow,
  [LogLevel.ERROR]: COLORS.red,
};

class Logger {
  private config: LoggerConfig;
  private module: string;
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 1000;

  constructor(module: string, config: Partial<LoggerConfig> = {}) {
    this.module = module;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Allow environment variable to override log level
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && envLevel in LogLevel) {
      this.config.minLevel = LogLevel[envLevel as keyof typeof LogLevel];
    }
  }

  /**
   * Create a child logger with a sub-module name
   */
  child(subModule: string): Logger {
    return new Logger(`${this.module}:${subModule}`, this.config);
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorObj = error instanceof Error ? error : undefined;
    const errorData = error && !(error instanceof Error) ? { errorValue: error } : {};
    this.log(LogLevel.ERROR, message, { ...data, ...errorData }, errorObj);
  }

  /**
   * Log a message with timing information
   */
  timed<T>(operation: string, fn: () => T): T;
  timed<T>(operation: string, fn: () => Promise<T>): Promise<T>;
  timed<T>(operation: string, fn: () => T | Promise<T>): T | Promise<T> {
    const startTime = Date.now();
    this.debug(`Starting: ${operation}`);

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result
          .then((value) => {
            const duration = Date.now() - startTime;
            this.info(`Completed: ${operation}`, { durationMs: duration });
            return value;
          })
          .catch((error) => {
            const duration = Date.now() - startTime;
            this.error(`Failed: ${operation}`, error, { durationMs: duration });
            throw error;
          });
      }

      const duration = Date.now() - startTime;
      this.info(`Completed: ${operation}`, { durationMs: duration });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`Failed: ${operation}`, error, { durationMs: duration });
      throw error;
    }
  }

  /**
   * Get the log history
   */
  getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  /**
   * Clear the log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    if (level < this.config.minLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      module: this.module,
      message,
      data,
      error,
    };

    // Store in history
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    // Output to console
    if (this.config.jsonFormat) {
      this.outputJson(entry);
    } else {
      this.outputConsole(entry);
    }
  }

  /**
   * Output log entry as JSON
   */
  private outputJson(entry: LogEntry): void {
    const output = {
      timestamp: entry.timestamp.toISOString(),
      level: LEVEL_LABELS[entry.level],
      module: entry.module,
      message: entry.message,
      ...(entry.data && { data: entry.data }),
      ...(entry.error && {
        error: {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack,
        },
      }),
    };

    const method = entry.level === LogLevel.ERROR ? console.error : console.log;
    method(JSON.stringify(output));
  }

  /**
   * Output log entry to console with formatting
   */
  private outputConsole(entry: LogEntry): void {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      const time = entry.timestamp.toISOString().split('T')[1].replace('Z', '');
      parts.push(`${COLORS.dim}[${time}]${COLORS.reset}`);
    }

    const levelColor = LEVEL_COLORS[entry.level];
    parts.push(`${levelColor}${LEVEL_LABELS[entry.level].padEnd(5)}${COLORS.reset}`);

    if (this.config.includeModule) {
      parts.push(`${COLORS.cyan}[${entry.module}]${COLORS.reset}`);
    }

    parts.push(entry.message);

    const method = entry.level === LogLevel.ERROR ? console.error : console.log;
    method(parts.join(' '));

    if (entry.data && Object.keys(entry.data).length > 0) {
      console.log(`       ${COLORS.dim}Data:${COLORS.reset}`, entry.data);
    }

    if (entry.error) {
      console.error(`       ${COLORS.red}Error:${COLORS.reset}`, entry.error.message);
      if (entry.error.stack) {
        console.error(`       ${COLORS.dim}${entry.error.stack}${COLORS.reset}`);
      }
    }
  }
}

/**
 * Create a logger instance for a module
 */
export function createLogger(module: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger(module, config);
}

/**
 * Default logger instance for general use
 */
export const logger = createLogger('intacct-automation');

export default logger;
