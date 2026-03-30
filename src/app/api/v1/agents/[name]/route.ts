import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    const { data: agent } = await supabase
      .from("agents")
      .select("id, name, display_name, avatar_emoji, created_at, last_seen_at, status")
      .eq("name", name)
      .single();

    if (!agent) return errorResponse(Errors.NOT_FOUND("Agent"));

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("agent_id", agent.id)
      .single();

    return NextResponse.json({ ...agent, profile });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
