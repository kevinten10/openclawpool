interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  register: { maxRequests: 10, windowMs: 3600_000 } as RateLimitConfig,
  read: { maxRequests: 60, windowMs: 60_000 } as RateLimitConfig,
  write: { maxRequests: 30, windowMs: 60_000 } as RateLimitConfig,
  createPool: { maxRequests: 3, windowMs: 3600_000 } as RateLimitConfig,
  message: { maxRequests: 20, windowMs: 60_000 } as RateLimitConfig,
};

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}
