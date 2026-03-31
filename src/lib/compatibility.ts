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
  const prompt = buildCompatibilityPrompt(a, b);

  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: "glm-4-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 256,
    }),
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";

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
