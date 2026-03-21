/**
 * Circuit Breaker Pattern for API resilience
 *
 * Prevents cascading failures by stopping calls to a failing service
 * and allowing it time to recover.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are blocked immediately
 * - HALF_OPEN: Testing if service has recovered
 */

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in ms to wait before attempting recovery */
  resetTimeout: number;
  /** Number of successful requests in half-open state to close circuit */
  successThreshold: number;
  /** Optional name for logging */
  name?: string;
}

interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  nextAttemptTime: number | null;
}

type Operation<T> = () => Promise<T>;

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private nextAttemptTime: number | null = null;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly successThreshold: number;
  private readonly name: string;

  constructor(config: CircuitBreakerConfig) {
    this.failureThreshold = config.failureThreshold;
    this.resetTimeout = config.resetTimeout;
    this.successThreshold = config.successThreshold;
    this.name = config.name ?? "circuit";
  }

  /**
   * Get current circuit breaker stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Check if the circuit is open (blocking requests)
   */
  isOpen(): boolean {
    if (this.state === CircuitState.OPEN) {
      // Check if reset timeout has passed
      if (this.nextAttemptTime !== null && Date.now() >= this.nextAttemptTime) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        console.log(`[CircuitBreaker:${this.name}] Entering HALF_OPEN state`);
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(
    operation: Operation<T>,
    fallback?: Operation<T>,
  ): Promise<T> {
    // Check if circuit is open
    if (this.isOpen()) {
      console.log(
        `[CircuitBreaker:${this.name}] Circuit is OPEN, blocking request`,
      );

      if (fallback) {
        console.log(`[CircuitBreaker:${this.name}] Using fallback`);
        return fallback();
      }

      throw new Error(`Circuit breaker is open for ${this.name}`);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();

      if (fallback) {
        console.log(
          `[CircuitBreaker:${this.name}] Operation failed, using fallback`,
        );
        return fallback();
      }

      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
        console.log(`[CircuitBreaker:${this.name}] Circuit CLOSED (recovered)`);
      }
    } else {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in half-open state immediately opens circuit
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      console.log(
        `[CircuitBreaker:${this.name}] Circuit OPEN (failed in HALF_OPEN), next attempt: ${new Date(this.nextAttemptTime).toISOString()}`,
      );
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      console.log(
        `[CircuitBreaker:${this.name}] Circuit OPEN (threshold reached), next attempt: ${new Date(this.nextAttemptTime).toISOString()}`,
      );
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    console.log(`[CircuitBreaker:${this.name}] Circuit manually reset`);
  }
}

// ============================================
// Pre-configured circuit breakers
// ============================================

/** Circuit breaker for Venice AI API */
export const veniceCircuitBreaker = new CircuitBreaker({
  name: "venice-ai",
  failureThreshold: 5, // Open after 5 failures
  resetTimeout: 30000, // Wait 30s before retry
  successThreshold: 2, // Need 2 successes to close
});

/** Circuit breaker for Gemini Live API */
export const geminiCircuitBreaker = new CircuitBreaker({
  name: "gemini-live",
  failureThreshold: 3, // Open after 3 failures
  resetTimeout: 60000, // Wait 60s before retry
  successThreshold: 1, // 1 success to close
});

/** Circuit breaker for Celo RPC */
export const celoCircuitBreaker = new CircuitBreaker({
  name: "celo-rpc",
  failureThreshold: 5,
  resetTimeout: 15000, // 15s for blockchain
  successThreshold: 2,
});
