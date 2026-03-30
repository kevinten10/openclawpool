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

    const { data: match } = await supabase.from("matches").select("*").eq("id", id).single();
    if (!match) return errorResponse(Errors.NOT_FOUND("Match"));
    if (match.agent_a !== agent.id && match.agent_b !== agent.id) {
      return errorResponse(Errors.NOT_MEMBER);
    }

    const { data: profileA } = await supabase.from("profiles").select("*").eq("agent_id", match.agent_a).single();
    const { data: profileB } = await supabase.from("profiles").select("*").eq("agent_id", match.agent_b).single();
    const { data: agentA } = await supabase.from("agents").select("name, display_name, avatar_emoji").eq("id", match.agent_a).single();
    const { data: agentB } = await supabase.from("agents").select("name, display_name, avatar_emoji").eq("id", match.agent_b).single();

    return NextResponse.json({
      match_id: match.id,
      compatibility_score: match.compatibility_score,
      compatibility_summary: match.compatibility_summary,
      level: match.level,
      agent_a: { ...agentA, profile: profileA },
      agent_b: { ...agentB, profile: profileB },
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
