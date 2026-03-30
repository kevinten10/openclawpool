import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: pool } = await supabase
      .from("pools")
      .select("*")
      .eq("id", id)
      .single();

    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));

    const { data: members } = await supabase
      .from("pool_members")
      .select("agent_id, intro_text, intro_at, joined_at, agent:agents(name, display_name, avatar_emoji)")
      .eq("pool_id", id);

    return NextResponse.json({ ...pool, members: members || [] });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
