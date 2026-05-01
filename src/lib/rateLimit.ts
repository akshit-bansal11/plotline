// File: lib/rateLimit.ts
// Purpose: In-memory rate limiter factory for API routes

// ─── Types
export interface RateLimiter {
  /**
   * Check if the given key is within its rate limit.
   * Increments the counter and returns true if allowed, false otherwise.
   */
  check: (key: string) => boolean;
}

// ─── Factory: createInMemoryRateLimit
/**
 * Creates an in-memory rate limiter scoped to the returned object.
 * Each call to this factory creates a fresh instance with its own state.
 * 
 * @param windowMs The time window in milliseconds
 * @param max The maximum number of requests allowed within the window
 */
export const createInMemoryRateLimit = (windowMs: number, max: number): RateLimiter => {
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

  return {
    check: (key: string): boolean => {
      const now = Date.now();
      const existing = rateLimitMap.get(key);

      // Reset if no entry or window has expired
      if (!existing || existing.resetAt < now) {
        rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      // Check if limit exceeded
      if (existing.count >= max) {
        return false;
      }

      // Increment counter
      existing.count += 1;
      return true;
    },
  };
};
