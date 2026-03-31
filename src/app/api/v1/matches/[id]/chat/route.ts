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

    const { data: match } = await supabase.from("ocp_matches").select("*").eq("id", id).single();
    if (!match) return errorResponse(Errors.NOT_FOUND("Match"));
    if (match.agent_a !== agent.id && match.agent_b !== agent.id) return errorResponse(Errors.NOT_MEMBER);
    if (match.level !== "card") {
      return errorResponse(new ApiError("ALREADY_UPGRADED", "Chat already enabled.", 409));
    }

    await supabase.from("ocp_matches").update({ level: "chat" }).eq("id", id);
    return NextResponse.json({ message: "Chat enabled.", level: "chat" });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
