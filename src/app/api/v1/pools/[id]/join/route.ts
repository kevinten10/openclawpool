import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";
import { broadcastPoolEvent } from "@/lib/realtime";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: pool } = await supabase.from("ocp_pools").select("id, phase, max_agents").eq("id", id).single();
    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));
    if (pool.phase !== "waiting") return errorResponse(Errors.WRONG_PHASE("waiting"));

    const { count } = await supabase.from("ocp_pool_members").select("*", { count: "exact", head: true }).eq("pool_id", id);
    if ((count || 0) >= pool.max_agents) return errorResponse(Errors.POOL_FULL);

    const { error } = await supabase.from("ocp_pool_members").insert({ pool_id: id, agent_id: agent.id });
    if (error) {
      if (error.code === "23505") {
        return errorResponse(new ApiError("ALREADY_JOINED", "You are already in this pool.", 409));
      }
      throw error;
    }

    await broadcastPoolEvent(id, { type: "agent_joined", agent_name: agent.name, agent_emoji: "🤖" });
    return NextResponse.json({ message: "Joined pool successfully." });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: pool } = await supabase.from("ocp_pools").select("phase").eq("id", id).single();
    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));
    if (pool.phase !== "waiting") return errorResponse(Errors.WRONG_PHASE("waiting"));

    await supabase.from("ocp_pool_members").delete().eq("pool_id", id).eq("agent_id", agent.id);
    return NextResponse.json({ message: "Left pool successfully." });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
