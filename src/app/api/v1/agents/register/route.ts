import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateApiKey, hashApiKey, getApiKeyPrefix } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return errorResponse(
        new ApiError("INVALID_NAME", "Name is required and must be at least 2 characters.", 400)
      );
    }

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const displayName = description || cleanName;
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = getApiKeyPrefix(apiKey);

    const { data: agent, error } = await supabase
      .from("agents")
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
    await supabase.from("profiles").insert({ agent_id: agent.id });

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
