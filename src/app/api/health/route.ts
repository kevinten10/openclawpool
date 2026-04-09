import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Health check configuration
const HEALTH_CHECK_TIMEOUT_MS = 5000;

interface HealthCheckResult {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  latency_ms: number;
  checks: {
    database: {
      status: "up" | "down";
      error?: string;
      latency_ms?: number;
    };
    memory?: {
      status: "up" | "down";
      used_mb: number;
      total_mb: number;
      usage_percent: number;
      warning?: string;
    };
  };
}

/**
 * Get memory usage metrics
 */
function getMemoryMetrics(): { used_mb: number; total_mb: number; usage_percent: number } | null {
  if (typeof process === "undefined" || !process.memoryUsage) {
    return null;
  }

  const usage = process.memoryUsage();
  const used_mb = Math.round(usage.heapUsed / 1024 / 1024);
  const total_mb = Math.round(usage.heapTotal / 1024 / 1024);
  const usage_percent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  return { used_mb, total_mb, usage_percent };
}

/**
 * Check if memory usage is within acceptable limits
 */
function checkMemoryHealth(): { status: "up" | "down"; metrics: NonNullable<ReturnType<typeof getMemoryMetrics>>; warning?: string } {
  const metrics = getMemoryMetrics();
  
  if (!metrics) {
    return { 
      status: "down", 
      metrics: { used_mb: 0, total_mb: 0, usage_percent: 0 },
      warning: "Unable to retrieve memory metrics"
    };
  }

  // Warning threshold at 85%, critical at 95%
  if (metrics.usage_percent > 95) {
    return { 
      status: "down", 
      metrics,
      warning: `Critical memory usage: ${metrics.usage_percent}%`
    };
  }
  
  if (metrics.usage_percent > 85) {
    return { 
      status: "up", 
      metrics,
      warning: `High memory usage: ${metrics.usage_percent}%`
    };
  }

  return { status: "up", metrics };
}

export async function GET() {
  const start = Date.now();
  const checks: HealthCheckResult["checks"] = {
    database: { status: "down" },
  };

  try {
    // Check database connectivity with timeout
    const dbCheckPromise = supabase
      .from("ocp_agents")
      .select("id", { count: "exact", head: true });

    const dbTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Database check timeout")), HEALTH_CHECK_TIMEOUT_MS);
    });

    const dbStart = Date.now();
    const { error: dbError } = await Promise.race([dbCheckPromise, dbTimeoutPromise]);
    const dbLatency = Date.now() - dbStart;

    if (dbError) {
      checks.database = {
        status: "down",
        error: dbError.message,
        latency_ms: dbLatency,
      };
    } else {
      checks.database = {
        status: "up",
        latency_ms: dbLatency,
      };
    }
  } catch (err) {
    checks.database = {
      status: "down",
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }

  // Check memory usage
  const memoryCheck = checkMemoryHealth();
  checks.memory = {
    status: memoryCheck.status,
    used_mb: memoryCheck.metrics.used_mb,
    total_mb: memoryCheck.metrics.total_mb,
    usage_percent: memoryCheck.metrics.usage_percent,
    ...(memoryCheck.warning && { warning: memoryCheck.warning }),
  };

  const totalLatency = Date.now() - start;

  // Determine overall health status
  const isDatabaseHealthy = checks.database.status === "up";
  const isMemoryHealthy = checks.memory.status === "up";
  
  let status: HealthCheckResult["status"] = "healthy";
  if (!isDatabaseHealthy) {
    status = "unhealthy";
  } else if (!isMemoryHealthy || checks.memory.warning) {
    status = "degraded";
  }

  const response: HealthCheckResult = {
    status,
    timestamp: new Date().toISOString(),
    latency_ms: totalLatency,
    checks,
  };

  const httpStatus = status === "healthy" ? 200 : status === "degraded" ? 200 : 503;
  
  // Add cache-control to prevent health check caching
  const nextResponse = NextResponse.json(response, { status: httpStatus });
  nextResponse.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  
  return nextResponse;
}
