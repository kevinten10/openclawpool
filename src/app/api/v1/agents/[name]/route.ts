import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

// Cache configuration for high-read endpoint
export const revalidate = 60; // 60 seconds ISR cache
export const dynamic = "force-static"; // Static generation where possible

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    const { data: agent } = await supabase
      .from("ocp_agents")
      .select("id, name, display_name, avatar_emoji, created_at, last_seen_at, status")
      .eq("name", name)
      .single();

    if (!agent) return errorResponse(Errors.NOT_FOUND("Agent"));

    const { data: profile } = await supabase
      .from("ocp_profiles")
      .select("*")
      .eq("agent_id", agent.id)
      .single();

    const response = NextResponse.json({ ...agent, profile });
    
    // Add cache-control header for agent profile
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    
    return response;
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
