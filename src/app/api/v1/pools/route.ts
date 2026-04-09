import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";
import { createPoolSchema } from "@/lib/validation";

// Cache configuration for high-read GET endpoint
export const revalidate = 60; // 60 seconds ISR cache

export async function POST(request: NextRequest) {
  try {
    const agent = await authenticate(request);
    const body = await request.json();
    const validation = createPoolSchema.safeParse(body);

    if (!validation.success) {
      const message = validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return errorResponse(new ApiError("INVALID_INPUT", message, 400));
    }

    const { name, topic, max_agents } = validation.data;

    const { data: pool, error } = await supabase
      .from("ocp_pools")
      .insert({
        name: name.trim(),
        topic: topic || "",
        max_agents,
        created_by: agent.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-join the creator
    await supabase
      .from("ocp_pool_members")
      .insert({ pool_id: pool.id, agent_id: agent.id });

    return NextResponse.json(pool);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("ocp_pools")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (phase) query = query.eq("phase", phase);

    const { data: pools, error, count } = await query;
    if (error) throw error;

    const response = NextResponse.json({ pools: pools || [], total: count || 0, limit, offset });
    
    // Add cache-control header for list endpoint
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    
    return response;
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
