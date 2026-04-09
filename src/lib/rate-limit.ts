import { supabase } from "./supabase";

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

interface RateLimitRecord {
  id?: string;
  key: string;
  count: number;
  window_start: string;
  created_at?: string;
}

/**
 * Check rate limit using Supabase for distributed state
 * Implements sliding window algorithm
 * 
 * @param key - Unique identifier (e.g., "register:192.168.1.1" or "write:agent_123")
 * @param config - Rate limit configuration
 * @returns Object with allowed status and retryAfter seconds
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; retryAfter: number; remaining: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  try {
    // Clean up old records first (best effort)
    await supabase
      .from("ocp_rate_limits")
      .delete()
      .lt("window_start", windowStart.toISOString());

    // Get or create rate limit record for this key
    const { data: existing } = await supabase
      .from("ocp_rate_limits")
      .select("id, key, count, window_start")
      .eq("key", key)
      .gte("window_start", windowStart.toISOString())
      .single();

    if (!existing) {
      // Create new window
      const { error: insertError } = await supabase
        .from("ocp_rate_limits")
        .insert({
          key,
          count: 1,
          window_start: now.toISOString(),
        });

      if (insertError) {
        console.error("Rate limit insert error:", insertError);
        // Fail open if database error
        return { allowed: true, retryAfter: 0, remaining: config.maxRequests - 1 };
      }

      return {
        allowed: true,
        retryAfter: 0,
        remaining: config.maxRequests - 1,
      };
    }

    // Check if limit exceeded
    if (existing.count >= config.maxRequests) {
      const windowStartTime = new Date(existing.window_start).getTime();
      const retryAfter = Math.ceil((windowStartTime + config.windowMs - now.getTime()) / 1000);

      return {
        allowed: false,
        retryAfter: Math.max(1, retryAfter),
        remaining: 0,
      };
    }

    // Increment count
    const { error: updateError } = await supabase
      .from("ocp_rate_limits")
      .update({ count: existing.count + 1 })
      .eq("id", existing.id);

    if (updateError) {
      console.error("Rate limit update error:", updateError);
      // Fail open
      return { allowed: true, retryAfter: 0, remaining: config.maxRequests - existing.count };
    }

    return {
      allowed: true,
      retryAfter: 0,
      remaining: config.maxRequests - existing.count - 1,
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    // Fail open on any error to prevent blocking legitimate requests
    return { allowed: true, retryAfter: 0, remaining: config.maxRequests };
  }
}

/**
 * Get current rate limit status for a key
 * Useful for returning RateLimit headers
 */
export async function getRateLimitStatus(
  key: string,
  config: RateLimitConfig
): Promise<{
  limit: number;
  remaining: number;
  reset: number;
}> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  try {
    const { data: existing } = await supabase
      .from("ocp_rate_limits")
      .select("count, window_start")
      .eq("key", key)
      .gte("window_start", windowStart.toISOString())
      .single();

    if (!existing) {
      return {
        limit: config.maxRequests,
        remaining: config.maxRequests,
        reset: Math.ceil((now.getTime() + config.windowMs) / 1000),
      };
    }

    const windowStartTime = new Date(existing.window_start).getTime();
    return {
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - existing.count),
      reset: Math.ceil((windowStartTime + config.windowMs) / 1000),
    };
  } catch {
    return {
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: Math.ceil((now.getTime() + config.windowMs) / 1000),
    };
  }
}
