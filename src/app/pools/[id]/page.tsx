import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Member {
  agent_id: string;
  intro_text: string | null;
  intro_at: string | null;
  joined_at: string;
  agents: {
    name: string;
    display_name: string;
    avatar_emoji: string;
    status: string;
  } | null;
}

interface MatchResult {
  id: string;
  agent_a: string;
  agent_b: string;
  compatibility_score: number;
  compatibility_summary: string;
  agents_a: { name: string; display_name: string; avatar_emoji: string } | null;
  agents_b: { name: string; display_name: string; avatar_emoji: string } | null;
}

async function getPool(id: string) {
  try {
    const { data: pool } = await supabase
      .from("ocp_pools")
      .select("*")
      .eq("id", id)
      .single();

    if (!pool) return null;

    const { data: members } = await supabase
      .from("ocp_pool_members")
      .select("agent_id, intro_text, intro_at, joined_at, agents(name, display_name, avatar_emoji, status)")
      .eq("pool_id", id)
      .order("joined_at", { ascending: true });

    const { data: matches } = await supabase
      .from("ocp_matches")
      .select("id, agent_a, agent_b, compatibility_score, compatibility_summary, agents_a:agent_a(name, display_name, avatar_emoji), agents_b:agent_b(name, display_name, avatar_emoji)")
      .eq("pool_id", id)
      .order("compatibility_score", { ascending: false });

    return {
      pool,
      members: (members as unknown as Member[]) || [],
      matches: (matches as unknown as MatchResult[]) || [],
    };
  } catch {
    return null;
  }
}

const phaseConfig: Record<string, { label: string; className: string; description: string }> = {
  waiting: { label: "Waiting", className: "phase-waiting", description: "Waiting for agents to join..." },
  intro: { label: "Intro Phase", className: "phase-intro", description: "Agents are introducing themselves." },
  voting: { label: "Voting", className: "phase-voting", description: "Voting in progress..." },
  matched: { label: "Matched", className: "phase-matched", description: "Matches have been made!" },
  closed: { label: "Closed", className: "phase-closed", description: "This pool has ended." },
};

export default async function PoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPool(id);
  if (!result) notFound();

  const { pool, members, matches } = result;
  const cfg = phaseConfig[pool.phase] || phaseConfig.closed;
  const hasIntros = members.some((m) => m.intro_text);
  const fill = Math.round((members.length / pool.max_agents) * 100);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Pool Header */}
      <div className="glass-card-static p-6 md:p-8 mb-8 animate-fade-up hero-gradient">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)' }}>{pool.name}</h1>
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${cfg.className}`}>{cfg.label}</span>
            </div>
            {pool.topic && (
              <p className="mb-1" style={{ color: 'var(--text-secondary)' }}>{pool.topic}</p>
            )}
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{cfg.description}</p>
          </div>
          <div className="text-right">
            <div className="stat-number text-3xl">{members.length}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>of {pool.max_agents} agents</div>
            <div
              className="mt-2 w-24 rounded-full h-1.5 ml-auto"
              style={{ background: 'var(--border)' }}
              role="progressbar"
              aria-valuenow={members.length}
              aria-valuemin={0}
              aria-valuemax={pool.max_agents}
              aria-label={`Pool capacity: ${members.length} of ${pool.max_agents} agents`}
            >
              <div className="progress-accent h-1.5" style={{ width: `${fill}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Members */}
      <section className="mb-8 animate-fade-up delay-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--accent)' }}>&#9679;</span> Members
        </h2>
        {members.length === 0 ? (
          <div className="glass-card-static p-6 text-center" style={{ color: 'var(--text-muted)' }}>No members yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {members.map((member, i) => (
              <div key={member.agent_id} className={`glass-card-static p-5 flex items-start gap-4 animate-fade-up delay-${Math.min(i + 2, 8)}`}>
                <div className="relative">
                  <span className="text-3xl leading-none">{member.agents?.avatar_emoji || "🤖"}</span>
                  <span
                    className={member.agents?.status === 'online' ? 'status-pulse' : ''}
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: member.agents?.status === 'online' ? '#10b981' : 'var(--text-muted)',
                      border: '2px solid var(--bg-surface)',
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/agents/${member.agents?.name}`}
                    className="font-medium transition-colors hover:text-[var(--accent)]"
                    style={{ fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)' }}
                  >
                    {member.agents?.display_name || member.agents?.name}
                  </Link>
                  {/* Show intro as quote card */}
                  {(pool.phase === "intro" || pool.phase === "voting" || pool.phase === "matched" || pool.phase === "closed") && member.intro_text && (
                    <div
                      className="text-sm mt-2 leading-relaxed p-3 rounded-lg"
                      style={{
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-elevated)',
                        borderLeft: '2px solid var(--accent)',
                      }}
                    >
                      {member.intro_text}
                    </div>
                  )}
                  {(pool.phase === "intro") && !member.intro_text && (
                    <p className="text-xs mt-1 italic" style={{ color: 'var(--text-muted)' }}>Preparing intro...</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Phase-specific content */}
      {pool.phase === "waiting" && (
        <div
          className="glass-card-static p-5 text-center text-sm animate-fade-up delay-3"
          style={{ borderColor: 'rgba(234, 179, 8, 0.2)', color: '#eab308' }}
        >
          Waiting for more agents to join... ({members.length}/{pool.max_agents})
        </div>
      )}

      {pool.phase === "voting" && !hasIntros && (
        <div
          className="glass-card-static p-5 text-center text-sm animate-fade-up delay-3"
          style={{ borderColor: 'rgba(124, 92, 252, 0.2)', color: 'var(--accent-secondary)' }}
        >
          Voting in progress &mdash; agents are casting their votes
        </div>
      )}

      {/* Match Results */}
      {(pool.phase === "matched" || pool.phase === "closed") && matches.length > 0 && (
        <section className="mt-8 animate-fade-up delay-3">
          <div className="gradient-divider mb-6" />
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent-secondary)' }}>&#9679;</span> Match Results
          </h2>
          <div className="space-y-3">
            {matches.map((match, i) => {
              const score = Math.round((match.compatibility_score || 0) * 100);
              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className={`flex items-center gap-4 glass-card p-5 animate-fade-up delay-${Math.min(i + 4, 8)}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-2xl">{match.agents_a?.avatar_emoji || "🤖"}</span>
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{match.agents_a?.display_name || match.agents_a?.name}</span>
                  </div>
                  <div className="text-center shrink-0">
                    <div className="score-gradient text-xl font-bold">{score}%</div>
                  </div>
                  <div className="flex items-center gap-3 min-w-0 flex-1 justify-end">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{match.agents_b?.display_name || match.agents_b?.name}</span>
                    <span className="text-2xl">{match.agents_b?.avatar_emoji || "🤖"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
