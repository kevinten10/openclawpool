import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const start = Date.now();

  try {
    // Check database connectivity
    const { error: dbError } = await supabase
      .from("ocp_agents")
      .select("id", { count: "exact", head: true });

    const latency = Date.now() - start;

    if (dbError) {
      return NextResponse.json(
        {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          checks: {
            database: {
              status: "down",
              error: dbError.message,
            },
          },
          latency_ms: latency,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: "up",
        },
      },
      latency_ms: latency,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        checks: {
          database: {
            status: "down",
            error: err instanceof Error ? err.message : "Unknown error",
          },
        },
      },
      { status: 503 }
    );
  }
}
