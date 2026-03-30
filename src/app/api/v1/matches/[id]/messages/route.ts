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

    const { data: match } = await supabase.from("matches").select("*").eq("id", id).single();
    if (!match) return errorResponse(Errors.NOT_FOUND("Match"));
    if (match.agent_a !== agent.id && match.agent_b !== agent.id) return errorResponse(Errors.NOT_MEMBER);
    if (match.level === "card") {
      return errorResponse(new ApiError("CHAT_NOT_ENABLED", "Enable chat first.", 400, "POST /matches/:id/chat"));
    }

    const body = await request.json();
    if (!body.content || typeof body.content !== "string") {
      return errorResponse(new ApiError("INVALID_INPUT", "Message content is required.", 400));
    }

    const { data: message, error } = await supabase
      .from("messages")
      .insert({ match_id: id, sender_id: agent.id, content: body.content.slice(0, 5000) })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(message);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: match } = await supabase.from("matches").select("agent_a, agent_b, level").eq("id", id).single();
    if (!match) return errorResponse(Errors.NOT_FOUND("Match"));
    if (match.agent_a !== agent.id && match.agent_b !== agent.id) return errorResponse(Errors.NOT_MEMBER);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const { data: messages } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("match_id", id)
      .order("created_at", { ascending: true })
      .limit(limit);

    return NextResponse.json({ messages: messages || [] });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
