interface AgentProfile {
  name: string;
  soul_summary: string;
  personality_tags: string[];
  values: string[];
  skills: Array<{ name: string; level: number; description?: string }>;
}

// Ark Agent Plan responses can be slower than the previous provider; keep this configurable.
const DEFAULT_AI_API_TIMEOUT_MS = 30000;
const configuredTimeoutMs = Number(process.env.ARK_API_TIMEOUT_MS);
const AI_API_TIMEOUT_MS =
  Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
    ? configuredTimeoutMs
    : DEFAULT_AI_API_TIMEOUT_MS;
const DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/plan/v3";
const DEFAULT_ARK_MODEL = "doubao-seed-2-0-code-preview-260215";
const DEFAULT_COMPATIBILITY = {
  score: 50,
  summary: "Compatible agents with potential for collaboration.",
};

export function buildCompatibilityPrompt(
  a: AgentProfile,
  b: AgentProfile
): string {
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

function getArkChatCompletionsUrl() {
  const baseUrl = process.env.ARK_BASE_URL ?? DEFAULT_ARK_BASE_URL;
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function normalizeCompatibilityResult(result: {
  score?: unknown;
  summary?: unknown;
}): {
  score: number;
  summary: string;
} {
  const score = Number(result.score);

  return {
    score: Number.isFinite(score)
      ? Math.max(0, Math.min(100, score))
      : DEFAULT_COMPATIBILITY.score,
    summary: String(result.summary || DEFAULT_COMPATIBILITY.summary),
  };
}

export function parseCompatibilityJson(text: string): {
  score: number;
  summary: string;
} {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    const result = JSON.parse(normalized);
    return normalizeCompatibilityResult(result);
  } catch {
    const match = normalized.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Compatibility response did not include JSON");
    }

    const result = JSON.parse(match[0]);
    return normalizeCompatibilityResult(result);
  }
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
  const apiKey = process.env.ARK_API_KEY;

  if (!apiKey) {
    console.warn(
      "ARK_API_KEY is not set. Falling back to default compatibility."
    );
    return DEFAULT_COMPATIBILITY;
  }

  try {
    const response = await fetchWithTimeout(
      getArkChatCompletionsUrl(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.ARK_CHAT_MODEL ?? DEFAULT_ARK_MODEL,
          messages: [
            {
              role: "system",
              content:
                "You score AI-agent collaboration compatibility. Return only valid JSON without markdown.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 256,
        }),
      },
      AI_API_TIMEOUT_MS
    );

    if (!response.ok) {
      throw new Error(`Ark API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return parseCompatibilityJson(text);
  } catch (error) {
    // Handle timeout or network errors gracefully
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("AI API call timed out after", AI_API_TIMEOUT_MS, "ms");
    } else {
      console.warn("AI API call failed:", error);
    }
    // Return default compatibility on error
    return DEFAULT_COMPATIBILITY;
  }
}
