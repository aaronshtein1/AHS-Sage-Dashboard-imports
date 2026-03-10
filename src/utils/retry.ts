/**
 * Retry Logic Utility for ADP-to-Intacct Payroll Automation
 *
 * Features:
 * - Configurable retry attempts
 * - Exponential backoff with jitter
 * - Generic wrapper for async functions
 * - Conditional retry based on error type
 * - Timeout support
 */

import { createLogger } from './logger';

const logger = createLogger('retry');

// ==================== TYPES ====================

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to delay (default: true) */
  jitter?: boolean;
  /** Jitter factor (0-1, default: 0.2) */
  jitterFactor?: number;
  /** Timeout for each attempt in milliseconds (default: undefined = no timeout) */
  timeout?: number;
  /** Function to determine if error is retryable (default: all errors) */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback called before each retry */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  /** Name/description of the operation (for logging) */
  operationName?: string;
}

export interface RetryResult<T> {
  /** Whether the operation ultimately succeeded */
  success: boolean;
  /** The result if successful */
  result?: T;
  /** The last error if failed */
  error?: Error;
  /** Total number of attempts made */
  attempts: number;
  /** Total time spent in milliseconds */
  totalTimeMs: number;
  /** Individual attempt durations */
  attemptDurations: number[];
}

// ==================== DEFAULT CONFIG ====================

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'timeout' | 'shouldRetry' | 'onRetry' | 'operationName'>> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  jitterFactor: 0.2,
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate delay for a given attempt with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
  jitter: boolean,
  jitterFactor: number
): number {
  // Exponential backoff: baseDelay * (multiplier ^ attempt)
  let delay = baseDelay * Math.pow(backoffMultiplier, attempt);

  // Cap at max delay
  delay = Math.min(delay, maxDelay);

  // Add jitter
  if (jitter) {
    const jitterRange = delay * jitterFactor;
    const randomJitter = Math.random() * jitterRange * 2 - jitterRange;
    delay = Math.max(0, delay + randomJitter);
  }

  return Math.round(delay);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a timeout promise
 */
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });
}

// ==================== MAIN RETRY FUNCTION ====================

/**
 * Execute an async function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const startTime = Date.now();
  const attemptDurations: number[] = [];
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    const attemptStartTime = Date.now();

    try {
      // Execute with optional timeout
      let result: T;
      if (config.timeout) {
        result = await Promise.race([fn(), createTimeout(config.timeout)]);
      } else {
        result = await fn();
      }

      attemptDurations.push(Date.now() - attemptStartTime);

      logger.debug(`Operation succeeded`, {
        operation: config.operationName,
        attempt: attempt + 1,
        totalAttempts: attempt + 1,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        result,
        attempts: attempt + 1,
        totalTimeMs: Date.now() - startTime,
        attemptDurations,
      };
    } catch (error) {
      attemptDurations.push(Date.now() - attemptStartTime);
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry = config.shouldRetry
        ? config.shouldRetry(lastError, attempt)
        : true;

      const isLastAttempt = attempt >= config.maxAttempts - 1;

      if (!shouldRetry || isLastAttempt) {
        logger.error(
          `Operation failed after ${attempt + 1} attempt(s)`,
          lastError,
          {
            operation: config.operationName,
            totalTimeMs: Date.now() - startTime,
          }
        );

        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalTimeMs: Date.now() - startTime,
          attemptDurations,
        };
      }

      // Calculate delay before retry
      const delay = calculateDelay(
        attempt,
        config.baseDelay,
        config.maxDelay,
        config.backoffMultiplier,
        config.jitter,
        config.jitterFactor
      );

      logger.warn(`Operation failed, retrying in ${delay}ms...`, {
        operation: config.operationName,
        attempt: attempt + 1,
        maxAttempts: config.maxAttempts,
        error: lastError.message,
        nextRetryDelay: delay,
      });

      // Call onRetry callback
      if (config.onRetry) {
        config.onRetry(lastError, attempt + 1, delay);
      }

      // Wait before retry
      await sleep(delay);
    }
  }

  // Should not reach here, but TypeScript needs this
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: config.maxAttempts,
    totalTimeMs: Date.now() - startTime,
    attemptDurations,
  };
}

// ==================== DECORATOR-STYLE WRAPPER ====================

/**
 * Create a retryable version of an async function
 */
export function retryable<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<RetryResult<TReturn>> {
  return async (...args: TArgs) => {
    return withRetry(() => fn(...args), options);
  };
}

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * Retry with simple configuration
 */
export async function retrySimple<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  const result = await withRetry(fn, {
    maxAttempts,
    baseDelay: delayMs,
    backoffMultiplier: 1, // Linear delay
    jitter: false,
  });

  if (result.success && result.result !== undefined) {
    return result.result;
  }

  throw result.error || new Error('Operation failed');
}

/**
 * Retry with exponential backoff
 */
export async function retryExponential<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  const result = await withRetry(fn, {
    maxAttempts,
    baseDelay: baseDelayMs,
  });

  if (result.success && result.result !== undefined) {
    return result.result;
  }

  throw result.error || new Error('Operation failed');
}

// ==================== ERROR TYPE HELPERS ====================

/**
 * Common retryable error types
 */
export const RetryableErrors = {
  /** Network-related errors */
  isNetworkError: (error: Error): boolean => {
    const networkMessages = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'network',
      'timeout',
      'socket',
    ];
    return networkMessages.some((msg) =>
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  },

  /** Rate limiting errors */
  isRateLimitError: (error: Error): boolean => {
    const rateLimitMessages = ['rate limit', '429', 'too many requests'];
    return rateLimitMessages.some((msg) =>
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  },

  /** Temporary/transient errors */
  isTransientError: (error: Error): boolean => {
    const transientMessages = ['temporary', 'unavailable', '503', '502', '504'];
    return transientMessages.some((msg) =>
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  },

  /** Session/auth errors that might be resolved by re-login */
  isSessionError: (error: Error): boolean => {
    const sessionMessages = ['session', 'expired', 'unauthorized', '401'];
    return sessionMessages.some((msg) =>
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  },
};

/**
 * Create a shouldRetry function that retries on common transient errors
 */
export function createDefaultShouldRetry(): (error: Error, attempt: number) => boolean {
  return (error: Error) => {
    return (
      RetryableErrors.isNetworkError(error) ||
      RetryableErrors.isRateLimitError(error) ||
      RetryableErrors.isTransientError(error)
    );
  };
}

export default withRetry;
