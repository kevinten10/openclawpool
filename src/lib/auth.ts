import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { supabase } from "./supabase";
import { ApiError, Errors } from "./errors";

/**
 * Generate a new API key
 * Format: ocp_<32 hex chars>
 */
export function generateApiKey(): string {
  return `ocp_${randomBytes(16).toString("hex")}`;
}

/**
 * Hash API key using Web Crypto API (async)
 * Compatible with both Node.js and Edge Runtime
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Synchronous hash for backward compatibility (deprecated)
 * @deprecated Use hashApiKey instead
 */
export function hashApiKeySync(key: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  // Use Node.js crypto for sync operations as fallback
  // This is only for backward compatibility during migration
  const { createHash } = require("crypto");
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Get API key prefix for display purposes
 */
export function getApiKeyPrefix(key: string): string {
  return key.slice(0, 8);
}

export interface AuthenticatedAgent {
  id: string;
  name: string;
  display_name: string;
}

export interface ApiKeyMetadata {
  created_at: string;
  expires_at: string | null;
}

/**
 * Check if API key has expired
 */
function isKeyExpired(metadata: ApiKeyMetadata | null): boolean {
  if (!metadata?.expires_at) return false;
  return new Date(metadata.expires_at) < new Date();
}

/**
 * Authenticate request using API key
 * Checks for valid key, expiration, and updates last_seen_at
 */
export async function authenticate(
  request: NextRequest
): Promise<AuthenticatedAgent> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw Errors.UNAUTHORIZED;
  }

  const apiKey = authHeader.slice(7);
  const keyHash = await hashApiKey(apiKey);

  const { data: agent, error } = await supabase
    .from("ocp_agents")
    .select("id, name, display_name, created_at, expires_at")
    .eq("api_key_hash", keyHash)
    .single();

  if (error || !agent) {
    throw Errors.UNAUTHORIZED;
  }

  // Check key expiration
  if (isKeyExpired(agent as ApiKeyMetadata)) {
    throw new ApiError(
      "KEY_EXPIRED",
      "API key has expired. Please rotate your key.",
      401,
      "Use POST /api/v1/agents/me/rotate-key to generate a new key."
    );
  }

  // Update last_seen_at
  await supabase
    .from("ocp_agents")
    .update({ last_seen_at: new Date().toISOString(), status: "online" })
    .eq("id", agent.id);

  return {
    id: agent.id,
    name: agent.name,
    display_name: agent.display_name,
  } as AuthenticatedAgent;
}

/**
 * Verify API key without updating last_seen_at
 * Useful for middleware or lightweight checks
 */
export async function verifyApiKey(
  apiKey: string
): Promise<AuthenticatedAgent | null> {
  const keyHash = await hashApiKey(apiKey);

  const { data: agent, error } = await supabase
    .from("ocp_agents")
    .select("id, name, display_name, created_at, expires_at")
    .eq("api_key_hash", keyHash)
    .single();

  if (error || !agent) {
    return null;
  }

  // Check key expiration
  if (isKeyExpired(agent as ApiKeyMetadata)) {
    return null;
  }

  return {
    id: agent.id,
    name: agent.name,
    display_name: agent.display_name,
  } as AuthenticatedAgent;
}
