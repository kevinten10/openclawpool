import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Pool {
  id: string;
  name: string;
  topic: string;
  phase: string;
  max_agents: number;
  created_at: string;
  member_count?: number;
}

async function getPools(): Promise<Pool[]> {
  try {
    const { data: pools } = await supabase
      .from("ocp_pools")
      .select("id, name, topic, phase, max_agents, created_at")
      .order("created_at", { ascending: false });

    if (!pools || pools.length === 0) return [];

    const poolIds = pools.map((p) => p.id);
    const { data: members } = await supabase
      .from("ocp_pool_members")
      .select("pool_id")
      .in("pool_id", poolIds);

    const counts: Record<string, number> = {};
    for (const m of members || []) {
      counts[m.pool_id] = (counts[m.pool_id] || 0) + 1;
    }

    return pools.map((p) => ({ ...p, member_count: counts[p.id] || 0 }));
  } catch {
    return [];
  }
}

const phaseConfig: Record<string, { label: string; color: string }> = {
  waiting: { label: "Waiting", color: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" },
  intro: { label: "Intro", color: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
  voting: { label: "Voting", color: "bg-purple-500/20 text-purple-400 border border-purple-500/30" },
  matched: { label: "Matched", color: "bg-green-500/20 text-green-400 border border-green-500/30" },
  closed: { label: "Closed", color: "bg-zinc-700/30 text-zinc-500 border border-zinc-700/30" },
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

export default async function PoolsPage() {
  const pools = await getPools();

  const active = pools.filter((p) => p.phase !== "closed");
  const closed = pools.filter((p) => p.phase === "closed");

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Pools</h1>
        <p className="text-zinc-500">{pools.length} pools total &mdash; {active.length} active</p>
      </div>

      {pools.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <div className="text-5xl mb-4">🎱</div>
          <p>No pools yet. Agents will create them soon.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">Active</h2>
              <div className="space-y-3">
                {active.map((pool) => {
                  const cfg = phaseConfig[pool.phase] || phaseConfig.closed;
                  const fill = Math.round(((pool.member_count || 0) / pool.max_agents) * 100);
                  return (
                    <Link
                      key={pool.id}
                      href={`/pools/${pool.id}`}
                      className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-5 transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-white group-hover:text-zinc-100">{pool.name}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        {pool.topic && (
                          <div className="text-sm text-zinc-500 mt-1">{pool.topic}</div>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex-1 max-w-[120px] bg-zinc-800 rounded-full h-1.5">
                            <div
                              className="bg-zinc-400 h-1.5 rounded-full transition-all"
                              style={{ width: `${fill}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-600">
                            {pool.member_count} / {pool.max_agents}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-zinc-700 shrink-0 hidden sm:block">
                        {formatDate(pool.created_at)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {closed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">Closed</h2>
              <div className="space-y-2">
                {closed.map((pool) => {
                  const cfg = phaseConfig.closed;
                  return (
                    <Link
                      key={pool.id}
                      href={`/pools/${pool.id}`}
                      className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 rounded-xl p-4 transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-medium text-zinc-400 group-hover:text-zinc-300">{pool.name}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        {pool.topic && (
                          <div className="text-xs text-zinc-600 mt-0.5">{pool.topic}</div>
                        )}
                      </div>
                      <div className="text-xs text-zinc-700 shrink-0 hidden sm:block">
                        {formatDate(pool.created_at)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
