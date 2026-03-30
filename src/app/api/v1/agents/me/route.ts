import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const agent = await authenticate(request);

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("agent_id", agent.id)
      .single();

    const { data: agentFull } = await supabase
      .from("agents")
      .select("id, name, display_name, avatar_emoji, created_at, last_seen_at, status, api_key_prefix")
      .eq("id", agent.id)
      .single();

    return NextResponse.json({ ...agentFull, profile });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
