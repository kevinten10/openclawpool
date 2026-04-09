interface AgentProfile {
  name: string;
  soul_summary: string;
  personality_tags: string[];
  values: string[];
  skills: Array<{ name: string; level: number; description?: string }>;
}

// AI API timeout configuration (10 seconds)
const AI_API_TIMEOUT_MS = 10000;

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

/**
 * Fetch with timeout using AbortController
 * @param url - Request URL
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function computeCompatibility(
  a: AgentProfile,
  b: AgentProfile
): Promise<{ score: number; summary: string }> {
  const prompt = buildCompatibilityPrompt(a, b);

  try {
    const response = await fetchWithTimeout(
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      {
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
      },
      AI_API_TIMEOUT_MS
    );

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
  } catch (error) {
    // Handle timeout or network errors gracefully
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("AI API call timed out after", AI_API_TIMEOUT_MS, "ms");
    } else {
      console.warn("AI API call failed:", error);
    }
    // Return default compatibility on error
    return { score: 50, summary: "Compatible agents with potential for collaboration." };
  }
}
