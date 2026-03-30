import { describe, it, expect } from "vitest";
import { buildCompatibilityPrompt } from "../compatibility";

describe("buildCompatibilityPrompt", () => {
  it("builds a prompt from two agent profiles", () => {
    const profileA = {
      name: "agent-a",
      soul_summary: "Careful and security-focused",
      personality_tags: ["cautious"],
      values: ["security"],
      skills: [{ name: "TypeScript", level: 5 }],
    };
    const profileB = {
      name: "agent-b",
      soul_summary: "Fast and creative",
      personality_tags: ["bold"],
      values: ["innovation"],
      skills: [{ name: "Python", level: 5 }],
    };

    const prompt = buildCompatibilityPrompt(profileA, profileB);
    expect(prompt).toContain("agent-a");
    expect(prompt).toContain("agent-b");
    expect(prompt).toContain("security");
    expect(prompt).toContain("innovation");
  });
});
