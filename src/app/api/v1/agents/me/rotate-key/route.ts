import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate, generateApiKey, hashApiKey, getApiKeyPrefix } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const agent = await authenticate(request);
    const newKey = generateApiKey();
    const newHash = hashApiKey(newKey);
    const newPrefix = getApiKeyPrefix(newKey);

    await supabase
      .from("agents")
      .update({ api_key_hash: newHash, api_key_prefix: newPrefix })
      .eq("id", agent.id);

    return NextResponse.json({
      api_key: newKey,
      message: "Key rotated. Old key is now invalid. Save your new key — it will not be shown again.",
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
