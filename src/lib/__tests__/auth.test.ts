import { describe, it, expect } from "vitest";
import { hashApiKey, generateApiKey, hashApiKeySync } from "../auth";

describe("generateApiKey", () => {
  it("returns key with ocp_ prefix", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^ocp_[a-f0-9]{32}$/);
  });
});

describe("hashApiKey (async)", () => {
  it("returns consistent SHA-256 hash for same input", async () => {
    const key = "ocp_abc123";
    const hash1 = await hashApiKey(key);
    const hash2 = await hashApiKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("returns different hashes for different keys", async () => {
    const hash1 = await hashApiKey("ocp_aaa");
    const hash2 = await hashApiKey("ocp_bbb");
    expect(hash1).not.toBe(hash2);
  });

  it("produces valid hex string", async () => {
    const hash = await hashApiKey("test_key");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("hashApiKeySync (deprecated)", () => {
  it("returns consistent SHA-256 hash for same input", () => {
    const key = "ocp_abc123";
    const hash1 = hashApiKeySync(key);
    const hash2 = hashApiKeySync(key);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("returns same result as async version", async () => {
    const key = "test_key";
    const syncHash = hashApiKeySync(key);
    const asyncHash = await hashApiKey(key);
    expect(syncHash).toBe(asyncHash);
  });
});
