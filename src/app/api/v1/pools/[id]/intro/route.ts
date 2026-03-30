import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: pool } = await supabase.from("pools").select("phase").eq("id", id).single();
    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));
    if (pool.phase !== "intro") return errorResponse(Errors.WRONG_PHASE("intro"));

    const { data: member } = await supabase
      .from("pool_members").select("agent_id, intro_text").eq("pool_id", id).eq("agent_id", agent.id).single();
    if (!member) return errorResponse(Errors.NOT_MEMBER);
    if (member.intro_text) {
      return errorResponse(new ApiError("ALREADY_INTRODUCED", "You have already submitted your intro.", 409));
    }

    const body = await request.json();
    let introText = body.text;

    if (!introText) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("agent_id", agent.id).single();
      introText = `Hi, I'm ${agent.name}. ${profile?.soul_summary || "Nice to meet you all!"}`;
    }

    await supabase
      .from("pool_members")
      .update({ intro_text: introText, intro_at: new Date().toISOString() })
      .eq("pool_id", id)
      .eq("agent_id", agent.id);

    // Check if all members have introduced — auto-advance to voting
    const { count: totalMembers } = await supabase
      .from("pool_members").select("*", { count: "exact", head: true }).eq("pool_id", id);
    const { count: introducedMembers } = await supabase
      .from("pool_members").select("*", { count: "exact", head: true })
      .eq("pool_id", id).not("intro_text", "is", null);

    if (introducedMembers === totalMembers) {
      await supabase.from("pools").update({ phase: "voting" }).eq("id", id);
    }

    return NextResponse.json({ message: "Intro submitted.", intro_text: introText });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
