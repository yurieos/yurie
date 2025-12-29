/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by temporarily stopping requests to failing services.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Requests are blocked, returns fallback or throws
 * - HALF_OPEN: Testing if service recovered with limited requests
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms to wait before testing if service recovered (default: 30000) */
  resetTimeout?: number;
  /** Number of successful calls in half-open to close circuit (default: 2) */
  successThreshold?: number;
  /** Optional fallback function when circuit is open */
  fallback?: <T>() => T;
  /** Callback when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly successThreshold: number;
  private readonly fallback?: <T>() => T;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30000;
    this.successThreshold = options.successThreshold ?? 2;
    this.fallback = options.fallback;
    this.onStateChange = options.onStateChange;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Check if circuit allows requests
   */
  isAllowed(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.transitionTo('half-open');
        return true;
      }
      return false;
    }

    // half-open state allows requests
    return true;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if request is allowed
    if (!this.isAllowed()) {
      if (this.fallback) {
        return this.fallback<T>();
      }
      throw new CircuitOpenError(
        `Circuit breaker is open. Last failure: ${this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : 'unknown'}`
      );
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a successful operation
   */
  private recordSuccess(): void {
    this.totalSuccesses++;

    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.transitionTo('closed');
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  /**
   * Record a failed operation
   */
  private recordFailure(): void {
    this.totalFailures++;
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Immediate open on failure in half-open state
      this.transitionTo('open');
    } else if (this.state === 'closed' && this.failures >= this.failureThreshold) {
      this.transitionTo('open');
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;

    // Reset counters on state change
    if (newState === 'closed') {
      this.failures = 0;
      this.successes = 0;
    } else if (newState === 'half-open') {
      this.successes = 0;
    }

    this.onStateChange?.(oldState, newState);
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo('closed');
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
  }

  /**
   * Manually open the circuit
   */
  trip(): void {
    this.lastFailureTime = Date.now();
    this.transitionTo('open');
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Create a circuit breaker wrapped function
 */
export function withCircuitBreaker<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: CircuitBreakerOptions = {}
): {
  execute: (...args: TArgs) => Promise<TResult>;
  breaker: CircuitBreaker;
} {
  const breaker = new CircuitBreaker(options);
  
  return {
    execute: (...args: TArgs) => breaker.execute(() => fn(...args)),
    breaker,
  };
}

/**
 * Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  private defaultOptions: CircuitBreakerOptions;

  constructor(defaultOptions: CircuitBreakerOptions = {}) {
    this.defaultOptions = defaultOptions;
  }

  /**
   * Get or create a circuit breaker for a service
   */
  get(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let breaker = this.breakers.get(name);
    
    if (!breaker) {
      breaker = new CircuitBreaker({ ...this.defaultOptions, ...options });
      this.breakers.set(name, breaker);
    }
    
    return breaker;
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Global registry for provider circuit breakers
export const providerCircuitBreakers = new CircuitBreakerRegistry({
  failureThreshold: 3,
  resetTimeout: 60000, // 1 minute
  successThreshold: 2,
});

