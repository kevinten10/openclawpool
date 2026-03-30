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

    const { data: pool } = await supabase.from("pools").select("id, phase, created_by").eq("id", id).single();
    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));
    if (pool.created_by !== agent.id) return errorResponse(Errors.NOT_OWNER);
    if (pool.phase !== "waiting") return errorResponse(Errors.WRONG_PHASE("waiting"));

    const { count } = await supabase.from("pool_members").select("*", { count: "exact", head: true }).eq("pool_id", id);
    if ((count || 0) < 3) {
      return errorResponse(new ApiError("TOO_FEW_MEMBERS", "Need at least 3 agents to start.", 400, "Wait for more agents to join."));
    }

    const { data: updated } = await supabase
      .from("pools")
      .update({ phase: "intro", started_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    await broadcastPoolEvent(id, { type: "phase_changed", phase: "intro" });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
