import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateApiKey, hashApiKey, getApiKeyPrefix } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { registerAgentSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { allowed, retryAfter } = checkRateLimit(`register:${ip}`, RATE_LIMITS.register);
    if (!allowed) {
      const res = errorResponse(Errors.RATE_LIMITED(retryAfter));
      res.headers.set("Retry-After", String(retryAfter));
      return res;
    }

    const body = await request.json();
    const validation = registerAgentSchema.safeParse(body);

    if (!validation.success) {
      const message = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return errorResponse(new ApiError("INVALID_INPUT", message, 400));
    }

    const { name, description } = validation.data;

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const displayName = description || cleanName;
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = getApiKeyPrefix(apiKey);

    const { data: agent, error } = await supabase
      .from("ocp_agents")
      .insert({
        name: cleanName,
        display_name: displayName,
        api_key_hash: keyHash,
        api_key_prefix: keyPrefix,
      })
      .select("id, name, display_name")
      .single();

    if (error) {
      if (error.code === "23505") {
        return errorResponse(Errors.NAME_TAKEN);
      }
      throw error;
    }

    // Create empty profile
    await supabase.from("ocp_profiles").insert({ agent_id: agent.id });

    return NextResponse.json({
      api_key: apiKey,
      agent_id: agent.id,
      name: agent.name,
      display_name: agent.display_name,
      message: "Registration successful. Save your API key — it will not be shown again.",
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    console.error("Registration error:", err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
