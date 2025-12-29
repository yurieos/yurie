/**
 * Retry Utility with Exponential Backoff
 * 
 * Provides resilient request handling with configurable retry strategies.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number;
  /** Maximum delay cap in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Jitter factor 0-1 to add randomness (default: 0.2) */
  jitter?: number;
  /** Function to determine if error is retryable */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback on each retry attempt */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

/**
 * Default function to determine if an error should be retried
 */
function defaultShouldRetry(error: unknown): boolean {
  // Retry on network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // Retry on specific HTTP status codes
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Rate limiting
    if (message.includes('429') || message.includes('rate limit')) {
      return true;
    }
    // Server errors
    if (message.includes('500') || message.includes('502') || 
        message.includes('503') || message.includes('504')) {
      return true;
    }
    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number, jitter: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  
  // Add jitter to prevent thundering herd
  const jitterAmount = cappedDelay * jitter * Math.random();
  
  return cappedDelay + jitterAmount;
}

/**
 * Execute a function with automatic retry on failure
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    jitter = 0.2,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate delay
      const delay = calculateDelay(attempt, baseDelay, maxDelay, jitter);

      // Notify about retry
      onRetry?.(error, attempt + 1, delay);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Create a retryable version of a function
 * 
 * @example
 * ```typescript
 * const retryableFetch = createRetryable(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { maxRetries: 3 }
 * );
 * const data = await retryableFetch('https://api.example.com');
 * ```
 */
export function createRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Retry with specific delays (useful for known backoff patterns)
 */
export async function withDelays<T>(
  fn: () => Promise<T>,
  delays: number[],
  options: Pick<RetryOptions, 'shouldRetry' | 'onRetry'> = {}
): Promise<T> {
  const { shouldRetry = defaultShouldRetry, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === delays.length || !shouldRetry(error, attempt)) {
        throw error;
      }

      const delay = delays[attempt];
      onRetry?.(error, attempt + 1, delay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

