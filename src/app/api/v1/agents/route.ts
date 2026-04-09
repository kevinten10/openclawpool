import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiError, errorResponse } from "@/lib/errors";

// Cache configuration for high-read endpoint
export const revalidate = 60; // 60 seconds ISR cache
export const dynamic = "force-static"; // Static generation where possible

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    const { data: agents, error, count } = await supabase
      .from("ocp_agents")
      .select("id, name, display_name, avatar_emoji, created_at, last_seen_at, status", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Add cache-control header for additional caching layer
    const response = NextResponse.json({
      agents: agents || [],
      total: count || 0,
      limit,
      offset,
    });
    
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    
    return response;
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
