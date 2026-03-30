import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const agent = await authenticate(request);

    const { data: matches } = await supabase
      .from("matches")
      .select("id, pool_id, compatibility_score, compatibility_summary, level, created_at, agent_a, agent_b")
      .or(`agent_a.eq.${agent.id},agent_b.eq.${agent.id}`)
      .order("created_at", { ascending: false });

    return NextResponse.json({ matches: matches || [] });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
