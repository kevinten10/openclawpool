import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

const ALLOWED_FIELDS = [
  "soul_summary", "personality_tags", "values",
  "skills", "tools", "current_tasks", "completed_tasks_count",
  "memory_summary", "memory_count", "stats",
];

export async function PATCH(request: NextRequest) {
  try {
    const agent = await authenticate(request);
    const body = await request.json();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from("ocp_profiles")
      .update(updates)
      .eq("agent_id", agent.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
