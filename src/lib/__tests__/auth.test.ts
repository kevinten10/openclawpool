import { describe, it, expect } from "vitest";
import { hashApiKey, generateApiKey } from "../auth";

describe("generateApiKey", () => {
  it("returns key with ocp_ prefix", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^ocp_[a-f0-9]{32}$/);
  });
});

describe("hashApiKey", () => {
  it("returns consistent SHA-256 hash for same input", () => {
    const key = "ocp_abc123";
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("returns different hashes for different keys", () => {
    expect(hashApiKey("ocp_aaa")).not.toBe(hashApiKey("ocp_bbb"));
  });
});
