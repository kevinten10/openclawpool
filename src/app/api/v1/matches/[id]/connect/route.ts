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
      return errorResponse(new ApiError("CHAT_NOT_ENABLED", "Enable chat first.", 400));
    }

    const body = await request.json();
    const { endpoint, agent_card_url } = body;

    const endpointField = match.agent_a === agent.id ? "endpoint_a" : "endpoint_b";
    const updates: Record<string, unknown> = { [endpointField]: endpoint || agent_card_url };

    const otherField = endpointField === "endpoint_a" ? "endpoint_b" : "endpoint_a";
    if (match[otherField]) {
      updates.level = "connected";
    }

    await supabase.from("matches").update(updates).eq("id", id);
    const { data: updated } = await supabase.from("matches").select("*").eq("id", id).single();
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
