/**
 * Centralized Logger Utility
 *
 * Provides structured logging with support for:
 * - Multiple log levels (debug, info, warn, error)
 * - Context-aware logging with module prefixes
 * - Timestamps and structured data output
 * - Environment-aware verbosity (respects LOG_LEVEL env var)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get the configured minimum log level from environment
 */
function getMinLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  return LOG_LEVELS[envLevel] !== undefined ? envLevel : 'info';
}

/**
 * Format a log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}]`;
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  return `${prefix} ${entry.message}${dataStr}`;
}

/**
 * Create a logger instance for a specific module
 */
export function createLogger(moduleName: string) {
  const minLevel = getMinLogLevel();
  const minLevelValue = LOG_LEVELS[minLevel];

  function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    // Check if this log level should be output
    if (LOG_LEVELS[level] < minLevelValue) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: moduleName,
      message,
      data,
    };

    const formattedMessage = formatLogEntry(entry);

    switch (level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }
  }

  return {
    /**
     * Log debug-level messages (verbose, for development)
     */
    debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),

    /**
     * Log info-level messages (general operational info)
     */
    info: (message: string, data?: Record<string, unknown>) => log('info', message, data),

    /**
     * Log warning-level messages (potential issues)
     */
    warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),

    /**
     * Log error-level messages (errors and failures)
     */
    error: (message: string, data?: Record<string, unknown>) => log('error', message, data),

    /**
     * Create a child logger with an extended module name
     */
    child: (subModule: string) => createLogger(`${moduleName}:${subModule}`),
  };
}

// Default logger for general use
export const logger = createLogger('app');

export default logger;
