/**
 * Structured Logger Utility for ADP-to-Intacct Payroll Automation
 *
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - Console output with colors
 * - JSON format file logging to /logs/{date}_payroll-sync.log
 * - Timestamps on all entries
 * - Context-aware logging with module prefixes
 */

import fs from 'fs';
import path from 'path';

// ==================== TYPES ====================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Include timestamps in console output */
  includeTimestamp: boolean;
  /** Include module name in console output */
  includeModule: boolean;
  /** Enable file logging */
  enableFileLogging: boolean;
  /** Base directory for log files */
  logDir: string;
  /** Use JSON format for console (vs. human-readable) */
  jsonConsole: boolean;
}

// ==================== CONSTANTS ====================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ANSI color codes for console output
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
} as const;

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.dim,
  info: COLORS.blue,
  warn: COLORS.yellow,
  error: COLORS.red,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: 'info',
  includeTimestamp: true,
  includeModule: true,
  enableFileLogging: true,
  logDir: path.join(process.cwd(), 'logs'),
  jsonConsole: false,
};

// ==================== LOGGER CLASS ====================

class Logger {
  private config: LoggerConfig;
  private module: string;
  private logFileHandle: fs.WriteStream | null = null;
  private currentLogDate: string | null = null;

  constructor(module: string, config: Partial<LoggerConfig> = {}) {
    this.module = module;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Allow environment variable to override log level
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
      this.config.minLevel = envLevel;
    }

    // Allow environment variable to control file logging
    if (process.env.LOG_TO_FILE === 'false') {
      this.config.enableFileLogging = false;
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
    this.log('debug', message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorObj = error instanceof Error ? error : undefined;
    const errorData = error && !(error instanceof Error) ? { errorValue: error } : {};
    this.log('error', message, { ...data, ...errorData }, errorObj);
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
          .catch((err) => {
            const duration = Date.now() - startTime;
            this.error(`Failed: ${operation}`, err, { durationMs: duration });
            throw err;
          });
      }

      const duration = Date.now() - startTime;
      this.info(`Completed: ${operation}`, { durationMs: duration });
      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      this.error(`Failed: ${operation}`, err, { durationMs: duration });
      throw err;
    }
  }

  /**
   * Log a separator line for visual grouping
   */
  separator(title?: string): void {
    const line = '='.repeat(60);
    if (title) {
      this.info(`${line}\n  ${title}\n${line}`);
    } else {
      this.info(line);
    }
  }

  /**
   * Log a summary block
   */
  summary(title: string, items: Record<string, unknown>): void {
    this.info(`--- ${title} ---`);
    for (const [key, value] of Object.entries(items)) {
      this.info(`  ${key}: ${JSON.stringify(value)}`);
    }
    this.info(`--- End ${title} ---`);
  }

  /**
   * Close the log file handle
   */
  close(): void {
    if (this.logFileHandle) {
      this.logFileHandle.end();
      this.logFileHandle = null;
    }
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
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.minLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      timestamp,
      level,
      module: this.module,
      message,
      ...(data && Object.keys(data).length > 0 && { data }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    // Output to console
    if (this.config.jsonConsole) {
      this.outputJsonConsole(entry);
    } else {
      this.outputColorConsole(entry);
    }

    // Output to file
    if (this.config.enableFileLogging) {
      this.outputToFile(entry);
    }
  }

  /**
   * Output log entry as colored console output
   */
  private outputColorConsole(entry: LogEntry): void {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      const time = entry.timestamp.split('T')[1].replace('Z', '');
      parts.push(`${COLORS.dim}[${time}]${COLORS.reset}`);
    }

    const levelColor = LEVEL_COLORS[entry.level];
    parts.push(`${levelColor}${LEVEL_LABELS[entry.level]}${COLORS.reset}`);

    if (this.config.includeModule) {
      parts.push(`${COLORS.cyan}[${entry.module}]${COLORS.reset}`);
    }

    parts.push(entry.message);

    const method = entry.level === 'error' ? console.error : console.log;
    method(parts.join(' '));

    if (entry.data && Object.keys(entry.data).length > 0) {
      console.log(`       ${COLORS.dim}Data:${COLORS.reset}`, entry.data);
    }

    if (entry.error) {
      console.error(`       ${COLORS.red}Error:${COLORS.reset}`, entry.error.message);
      if (entry.error.stack) {
        const stackLines = entry.error.stack.split('\n').slice(1, 4);
        for (const line of stackLines) {
          console.error(`       ${COLORS.dim}${line}${COLORS.reset}`);
        }
      }
    }
  }

  /**
   * Output log entry as JSON to console
   */
  private outputJsonConsole(entry: LogEntry): void {
    const method = entry.level === 'error' ? console.error : console.log;
    method(JSON.stringify(entry));
  }

  /**
   * Output log entry to file in JSON format
   */
  private outputToFile(entry: LogEntry): void {
    try {
      const dateStr = entry.timestamp.split('T')[0];
      const logFileName = `${dateStr}_payroll-sync.log`;
      const logFilePath = path.join(this.config.logDir, logFileName);

      // Ensure log directory exists
      if (!fs.existsSync(this.config.logDir)) {
        fs.mkdirSync(this.config.logDir, { recursive: true });
      }

      // Rotate file handle if date changed
      if (this.currentLogDate !== dateStr) {
        if (this.logFileHandle) {
          this.logFileHandle.end();
        }
        this.logFileHandle = fs.createWriteStream(logFilePath, { flags: 'a' });
        this.currentLogDate = dateStr;
      }

      // Write JSON line
      if (this.logFileHandle) {
        this.logFileHandle.write(JSON.stringify(entry) + '\n');
      }
    } catch (err) {
      // Fallback: don't crash if file logging fails
      console.error('Failed to write to log file:', err);
    }
  }
}

// ==================== FACTORY FUNCTIONS ====================

/**
 * Create a logger instance for a specific module
 */
export function createLogger(module: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger(module, config);
}

/**
 * Default logger instance for general use
 */
export const logger = createLogger('payroll-sync');

export default logger;
