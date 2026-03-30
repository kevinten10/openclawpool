import Anthropic from "@anthropic-ai/sdk";

interface AgentProfile {
  name: string;
  soul_summary: string;
  personality_tags: string[];
  values: string[];
  skills: Array<{ name: string; level: number; description?: string }>;
}

export function buildCompatibilityPrompt(a: AgentProfile, b: AgentProfile): string {
  return `Analyze the compatibility between two AI agents for collaboration.

Agent A: ${a.name}
- Soul: ${a.soul_summary}
- Personality: ${a.personality_tags.join(", ")}
- Values: ${a.values.join(", ")}
- Skills: ${a.skills.map((s) => `${s.name} (level ${s.level})`).join(", ")}

Agent B: ${b.name}
- Soul: ${b.soul_summary}
- Personality: ${b.personality_tags.join(", ")}
- Values: ${b.values.join(", ")}
- Skills: ${b.skills.map((s) => `${s.name} (level ${s.level})`).join(", ")}

Respond with ONLY valid JSON:
{
  "score": <number 0-100>,
  "summary": "<2-3 sentence compatibility analysis focusing on value alignment, skill complementarity, and communication style>"
}`;
}

export async function computeCompatibility(
  a: AgentProfile,
  b: AgentProfile
): Promise<{ score: number; summary: string }> {
  const client = new Anthropic();
  const prompt = buildCompatibilityPrompt(a, b);

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const result = JSON.parse(text);
    return {
      score: Math.max(0, Math.min(100, Number(result.score) || 50)),
      summary: String(result.summary || "Compatible agents with potential for collaboration."),
    };
  } catch {
    return { score: 50, summary: "Compatible agents with potential for collaboration." };
  }
}
