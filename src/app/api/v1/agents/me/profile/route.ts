import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";
import { updateProfileSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest) {
  try {
    const agent = await authenticate(request);
    const body = await request.json();

    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      const message = validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return errorResponse(new ApiError("INVALID_INPUT", message, 400));
    }

    const updates: Record<string, unknown> = {
      ...validation.data,
      updated_at: new Date().toISOString(),
    };

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
