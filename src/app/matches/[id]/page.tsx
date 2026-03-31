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
    <span className="text-xs">
      <span className="star-accent">{"★".repeat(clamped)}</span>
      <span className="star-muted">{"★".repeat(5 - clamped)}</span>
    </span>
  );
}

const levelConfig: Record<string, { label: string; icon: string; color: string }> = {
  card: { label: "Card", icon: "🃏", color: 'var(--text-muted)' },
  chat: { label: "Chat", icon: "💬", color: 'var(--accent)' },
  connected: { label: "Connected", icon: "🔗", color: '#10b981' },
};

function AgentCard({ agent }: { agent: AgentWithProfile }) {
  const profile = agent.profiles;
  const skills: Skill[] = Array.isArray(profile?.skills) ? profile.skills : [];
  const tags = profile?.personality_tags || [];
  const values = profile?.values || [];

  return (
    <div className="glass-card-static p-6 md:p-8 flex flex-col items-center text-center">
      {/* Avatar */}
      <div className="text-7xl mb-4 leading-none glow-text">{agent.avatar_emoji}</div>
      <Link
        href={`/agents/${agent.name}`}
        className="text-xl font-bold transition-colors hover:text-[var(--accent)]"
        style={{ fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)' }}
      >
        {agent.display_name}
      </Link>
      <div className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>@{agent.name}</div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 mb-5">
          {tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-0.5 rounded-full"
              style={{
                background: 'rgba(0, 229, 204, 0.06)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Soul */}
      {profile?.soul_summary && (
        <p className="text-sm leading-relaxed mb-5 text-left" style={{ color: 'var(--text-secondary)' }}>{profile.soul_summary}</p>
      )}

      {/* Values */}
      {values.length > 0 && (
        <div className="w-full text-left mb-5">
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Values</div>
          <div className="flex flex-wrap gap-1.5">
            {values.map((v) => (
              <span
                key={v}
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: 'var(--accent-secondary-glow)',
                  color: 'var(--accent-secondary)',
                  border: '1px solid rgba(124, 92, 252, 0.2)',
                }}
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div className="w-full text-left">
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Skills</div>
          <ul className="space-y-1.5">
            {skills.slice(0, 5).map((skill, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{skill.name}</span>
                <Stars level={skill.level} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default async function MatchCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getMatch(id);
  if (!result) notFound();

  const { match, agentA, agentB } = result;
  const score = Math.round((match.compatibility_score || 0) * 100);
  const lvl = levelConfig[match.level] || levelConfig.card;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Title */}
      <div className="text-center mb-10 animate-fade-up">
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Match Card</div>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)' }}>
          {agentA?.display_name} &amp; {agentB?.display_name}
        </h1>
      </div>

      {/* Score Center - dramatic display */}
      <div className="text-center mb-10 animate-fade-up delay-1">
        <div className="score-gradient text-6xl md:text-8xl font-extrabold glow-text" style={{ fontFamily: "'Sora', sans-serif" }}>
          {score}%
        </div>
        <div className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>compatibility score</div>
        {/* Connection level */}
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <span>{lvl.icon}</span>
          <span className="text-sm font-medium" style={{ color: lvl.color }}>{lvl.label}</span>
        </div>
      </div>

      {/* Agents Side by Side */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="animate-fade-up delay-2">
          {agentA ? <AgentCard agent={agentA} /> : <div className="glass-card-static p-8 text-center" style={{ color: 'var(--text-muted)' }}>Agent not found</div>}
        </div>
        <div className="animate-fade-up delay-3">
          {agentB ? <AgentCard agent={agentB} /> : <div className="glass-card-static p-8 text-center" style={{ color: 'var(--text-muted)' }}>Agent not found</div>}
        </div>
      </div>

      {/* Compatibility Summary */}
      {match.compatibility_summary && (
        <div className="glass-card-static p-6 md:p-8 mb-6 animate-fade-up delay-4" style={{ background: 'var(--bg-elevated)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent)' }}>&#10023;</span> Compatibility Analysis
          </h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-primary)' }}>{match.compatibility_summary}</p>
        </div>
      )}

      {/* Footer meta */}
      <div className="gradient-divider mb-4 animate-fade-up delay-5" />
      <div className="flex items-center justify-between text-xs animate-fade-up delay-5" style={{ color: 'var(--text-muted)' }}>
        <span>
          Level: <span style={{ color: 'var(--text-secondary)' }} className="capitalize">{match.level}</span>
        </span>
        {match.pool_id && (
          <Link href={`/pools/${match.pool_id}`} className="transition-colors hover:text-[var(--accent)]">
            View Pool &rarr;
          </Link>
        )}
        <span>
          {new Date(match.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}
