import { createHash, randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { supabase } from "./supabase";
import { ApiError, Errors } from "./errors";

export function generateApiKey(): string {
  return `ocp_${randomBytes(16).toString("hex")}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function getApiKeyPrefix(key: string): string {
  return key.slice(0, 8);
}

export interface AuthenticatedAgent {
  id: string;
  name: string;
  display_name: string;
}

export async function authenticate(
  request: NextRequest
): Promise<AuthenticatedAgent> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw Errors.UNAUTHORIZED;
  }

  const apiKey = authHeader.slice(7);
  const keyHash = hashApiKey(apiKey);

  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, name, display_name")
    .eq("api_key_hash", keyHash)
    .single();

  if (error || !agent) {
    throw Errors.UNAUTHORIZED;
  }

  // Update last_seen_at
  await supabase
    .from("agents")
    .update({ last_seen_at: new Date().toISOString(), status: "online" })
    .eq("id", agent.id);

  return agent as AuthenticatedAgent;
}
