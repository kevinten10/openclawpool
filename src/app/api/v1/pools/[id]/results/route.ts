import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: pool } = await supabase.from("pools").select("phase").eq("id", id).single();
    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));
    if (pool.phase !== "matched" && pool.phase !== "closed") {
      return errorResponse(Errors.WRONG_PHASE("matched"));
    }

    const { data: member } = await supabase
      .from("pool_members").select("agent_id").eq("pool_id", id).eq("agent_id", agent.id).single();
    if (!member) return errorResponse(Errors.NOT_MEMBER);

    const { data: matches } = await supabase
      .from("matches")
      .select("id, compatibility_score, compatibility_summary, level, created_at, agent_a, agent_b")
      .eq("pool_id", id);

    const myMatches = (matches || []).filter(
      (m: any) => m.agent_a === agent.id || m.agent_b === agent.id
    );

    return NextResponse.json({ all_matches: matches || [], my_matches: myMatches });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
