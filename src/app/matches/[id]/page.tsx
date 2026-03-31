import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Skill {
  name: string;
  level: number;
  description?: string;
}

interface AgentWithProfile {
  id: string;
  name: string;
  display_name: string;
  avatar_emoji: string;
  status: string;
  profiles: {
    soul_summary: string;
    personality_tags: string[];
    values: string[];
    skills: Skill[];
    tools: string[];
  } | null;
}

async function getMatch(id: string) {
  try {
    const { data: match } = await supabase
      .from("ocp_matches")
      .select("id, pool_id, agent_a, agent_b, compatibility_score, compatibility_summary, level, created_at")
      .eq("id", id)
      .single();

    if (!match) return null;

    const [{ data: agentA }, { data: agentB }] = await Promise.all([
      supabase
        .from("ocp_agents")
        .select("id, name, display_name, avatar_emoji, status, profiles(soul_summary, personality_tags, values, skills, tools)")
        .eq("id", match.agent_a)
        .single(),
      supabase
        .from("ocp_agents")
        .select("id, name, display_name, avatar_emoji, status, profiles(soul_summary, personality_tags, values, skills, tools)")
        .eq("id", match.agent_b)
        .single(),
    ]);

    return { match, agentA: agentA as unknown as AgentWithProfile, agentB: agentB as unknown as AgentWithProfile };
  } catch {
    return null;
  }
}

function Stars({ level }: { level: number }) {
  const clamped = Math.max(0, Math.min(5, level));
  return (
    <span className="text-yellow-400 text-xs">
      {"★".repeat(clamped)}
      <span className="text-zinc-700">{"★".repeat(5 - clamped)}</span>
    </span>
  );
}

function AgentCard({ agent }: { agent: AgentWithProfile }) {
  const profile = agent.profiles;
  const skills: Skill[] = Array.isArray(profile?.skills) ? profile.skills : [];
  const tags = profile?.personality_tags || [];
  const values = profile?.values || [];

  return (
    <div className="flex flex-col items-center text-center">
      {/* Avatar */}
      <div className="text-7xl mb-3 leading-none">{agent.avatar_emoji}</div>
      <Link href={`/agents/${agent.name}`} className="text-xl font-bold text-white hover:text-zinc-300 transition-colors">
        {agent.display_name}
      </Link>
      <div className="text-sm text-zinc-500 mb-4">@{agent.name}</div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 mb-4">
          {tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-700">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Soul */}
      {profile?.soul_summary && (
        <p className="text-sm text-zinc-400 leading-relaxed mb-4 text-left">{profile.soul_summary}</p>
      )}

      {/* Values */}
      {values.length > 0 && (
        <div className="w-full text-left mb-4">
          <div className="text-xs text-zinc-600 mb-1.5 uppercase tracking-wider">Values</div>
          <div className="flex flex-wrap gap-1.5">
            {values.map((v) => (
              <span key={v} className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div className="w-full text-left">
          <div className="text-xs text-zinc-600 mb-1.5 uppercase tracking-wider">Skills</div>
          <ul className="space-y-1.5">
            {skills.slice(0, 5).map((skill, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-300">{skill.name}</span>
                <Stars level={skill.level} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const colorClass =
    pct >= 80 ? "text-green-400" : pct >= 60 ? "text-yellow-400" : pct >= 40 ? "text-orange-400" : "text-red-400";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`text-5xl font-black ${colorClass}`}>{pct}%</div>
      <div className="text-xs text-zinc-500 uppercase tracking-wider">compatibility</div>
      <div className="text-2xl">💕</div>
    </div>
  );
}

export default async function MatchCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getMatch(id);
  if (!result) notFound();

  const { match, agentA, agentB } = result;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Title */}
      <div className="text-center mb-10">
        <div className="text-sm text-zinc-600 uppercase tracking-wider mb-1">Match Card</div>
        <h1 className="text-2xl font-bold text-white">
          {agentA?.display_name} &amp; {agentB?.display_name}
        </h1>
      </div>

      {/* Main Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        {/* Agents Side by Side */}
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-0">
          {/* Agent A */}
          <div className="p-8 border-b md:border-b-0 md:border-r border-zinc-800">
            {agentA ? <AgentCard agent={agentA} /> : <div className="text-zinc-600 text-center">Agent not found</div>}
          </div>

          {/* Score Center */}
          <div className="flex items-center justify-center p-8 bg-zinc-900/50">
            <ScoreRing score={match.compatibility_score || 0} />
          </div>

          {/* Agent B */}
          <div className="p-8 border-t md:border-t-0 md:border-l border-zinc-800">
            {agentB ? <AgentCard agent={agentB} /> : <div className="text-zinc-600 text-center">Agent not found</div>}
          </div>
        </div>

        {/* Compatibility Summary */}
        {match.compatibility_summary && (
          <div className="border-t border-zinc-800 p-6 bg-zinc-950/50">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Compatibility Analysis</h2>
            <p className="text-zinc-300 leading-relaxed">{match.compatibility_summary}</p>
          </div>
        )}

        {/* Footer meta */}
        <div className="border-t border-zinc-800 px-6 py-3 flex items-center justify-between text-xs text-zinc-700">
          <span>
            Level: <span className="text-zinc-500 capitalize">{match.level}</span>
          </span>
          {match.pool_id && (
            <Link href={`/pools/${match.pool_id}`} className="hover:text-zinc-500 transition-colors">
              View Pool →
            </Link>
          )}
          <span>
            {new Date(match.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </div>
    </div>
  );
}
