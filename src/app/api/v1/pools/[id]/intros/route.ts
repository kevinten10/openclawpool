import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

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

    return NextResponse.json({ intros: members || [], phase: pool.phase });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
