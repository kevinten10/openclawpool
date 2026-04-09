import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

// Cache configuration for high-read endpoint
export const revalidate = 30; // 30 seconds ISR cache for frequently updated content

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: pool } = await supabase.from("ocp_pools").select("phase").eq("id", id).single();
    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));

    const { data: members } = await supabase
      .from("ocp_pool_members")
      .select("agent_id, intro_text, intro_at, agent:agents(name, display_name, avatar_emoji)")
      .eq("pool_id", id)
      .not("intro_text", "is", null)
      .order("intro_at", { ascending: true });

    const response = NextResponse.json({ intros: members || [], phase: pool.phase });
    
    // Add cache-control header for intros (shorter cache due to frequent updates)
    response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    
    return response;
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
