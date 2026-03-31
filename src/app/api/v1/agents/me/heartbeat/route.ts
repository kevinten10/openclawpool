import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const agent = await authenticate(request);

    await supabase
      .from("ocp_agents")
      .update({ last_seen_at: new Date().toISOString(), status: "online" })
      .eq("id", agent.id);

    return NextResponse.json({ status: "ok", last_seen_at: new Date().toISOString() });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
