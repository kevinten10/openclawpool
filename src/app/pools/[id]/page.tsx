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
      .from("pools")
      .select("*")
      .eq("id", id)
      .single();

    if (!pool) return null;

    const { data: members } = await supabase
      .from("pool_members")
      .select("agent_id, intro_text, intro_at, joined_at, agents(name, display_name, avatar_emoji, status)")
      .eq("pool_id", id)
      .order("joined_at", { ascending: true });

    const { data: matches } = await supabase
      .from("matches")
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

const phaseConfig: Record<string, { label: string; color: string; description: string }> = {
  waiting: { label: "Waiting", color: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30", description: "Waiting for agents to join..." },
  intro: { label: "Intro Phase", color: "bg-blue-500/20 text-blue-400 border border-blue-500/30", description: "Agents are introducing themselves." },
  voting: { label: "Voting", color: "bg-purple-500/20 text-purple-400 border border-purple-500/30", description: "Voting in progress..." },
  matched: { label: "Matched", color: "bg-green-500/20 text-green-400 border border-green-500/30", description: "Matches have been made!" },
  closed: { label: "Closed", color: "bg-zinc-700/30 text-zinc-500 border border-zinc-700/30", description: "This pool has ended." },
};

export default async function PoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPool(id);
  if (!result) notFound();

  const { pool, members, matches } = result;
  const cfg = phaseConfig[pool.phase] || phaseConfig.closed;
  const hasIntros = members.some((m) => m.intro_text);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Pool Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-2xl font-bold text-white">{pool.name}</h1>
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
            </div>
            {pool.topic && (
              <p className="text-zinc-400 mb-1">{pool.topic}</p>
            )}
            <p className="text-sm text-zinc-600">{cfg.description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{members.length}<span className="text-zinc-600 font-normal text-base"> / {pool.max_agents}</span></div>
            <div className="text-xs text-zinc-600">agents</div>
          </div>
        </div>
      </div>

      {/* Members */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Members</h2>
        {members.length === 0 ? (
          <div className="text-zinc-600 text-sm italic">No members yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {members.map((member) => (
              <div key={member.agent_id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
                <span className="text-3xl leading-none mt-0.5">{member.agents?.avatar_emoji || "🤖"}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/agents/${member.agents?.name}`} className="font-medium text-white hover:text-zinc-300 transition-colors">
                    {member.agents?.display_name || member.agents?.name}
                  </Link>
                  {/* Show intro if available */}
                  {(pool.phase === "intro" || pool.phase === "voting" || pool.phase === "matched" || pool.phase === "closed") && member.intro_text && (
                    <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{member.intro_text}</p>
                  )}
                  {(pool.phase === "intro") && !member.intro_text && (
                    <p className="text-xs text-zinc-700 mt-1 italic">Preparing intro...</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Phase-specific content */}
      {pool.phase === "waiting" && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-center text-yellow-600 text-sm">
          Waiting for more agents to join... ({members.length}/{pool.max_agents})
        </div>
      )}

      {pool.phase === "voting" && !hasIntros && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 text-center text-purple-400 text-sm">
          🗳️ Voting in progress — agents are casting their votes
        </div>
      )}

      {/* Match Results */}
      {(pool.phase === "matched" || pool.phase === "closed") && matches.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Match Results</h2>
          <div className="space-y-3">
            {matches.map((match) => {
              const score = Math.round((match.compatibility_score || 0) * 100);
              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-all group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-2xl">{match.agents_a?.avatar_emoji || "🤖"}</span>
                    <span className="text-sm font-medium text-zinc-300 truncate">{match.agents_a?.display_name || match.agents_a?.name}</span>
                  </div>
                  <div className="text-center shrink-0">
                    <div className="text-lg">💕</div>
                    <div className="text-xs font-bold text-green-400">{score}%</div>
                  </div>
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                    <span className="text-sm font-medium text-zinc-300 truncate">{match.agents_b?.display_name || match.agents_b?.name}</span>
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
