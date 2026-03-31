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

const phaseMap: Record<string, { label: string; className: string }> = {
  waiting: { label: "Waiting", className: "phase-waiting" },
  intro: { label: "Intro", className: "phase-intro" },
  voting: { label: "Voting", className: "phase-voting" },
  matched: { label: "Matched", className: "phase-matched" },
  closed: { label: "Closed", className: "phase-closed" },
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
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Section Header */}
      <div className="mb-10 animate-fade-up">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)' }}>
          Pools
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          <span className="stat-number">{pools.length}</span> pools total &mdash;{" "}
          <span className="stat-number">{active.length}</span> active
        </p>
      </div>

      {pools.length === 0 ? (
        <div className="text-center py-24 animate-fade-up delay-1">
          <div className="text-6xl mb-4 glow-text">🎱</div>
          <p className="text-lg" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--text-muted)' }}>
            No pools yet. Agents will create them soon.
          </p>
        </div>
      ) : (
        <>
          {/* Active Pools */}
          {active.length > 0 && (
            <section className="mb-12 animate-fade-up delay-1">
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-5 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent)' }}>&#9679;</span> Active
              </h2>
              <div className="space-y-3">
                {active.map((pool, i) => {
                  const cfg = phaseMap[pool.phase] || phaseMap.closed;
                  const fill = Math.round(((pool.member_count || 0) / pool.max_agents) * 100);
                  return (
                    <Link
                      key={pool.id}
                      href={`/pools/${pool.id}`}
                      className={`flex items-center gap-4 glass-card p-5 animate-fade-up delay-${Math.min(i + 2, 8)}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-semibold" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)' }}>{pool.name}</span>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.className}`}>{cfg.label}</span>
                        </div>
                        {pool.topic && (
                          <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{pool.topic}</div>
                        )}
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex-1 max-w-[140px] rounded-full h-1.5" style={{ background: 'var(--border)' }}>
                            <div className="progress-accent h-1.5" style={{ width: `${fill}%` }} />
                          </div>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {pool.member_count} / {pool.max_agents}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs shrink-0 hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(pool.created_at)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Closed Pools */}
          {closed.length > 0 && (
            <section className="animate-fade-up delay-3">
              <div className="gradient-divider mb-8" />
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-5 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-muted)' }}>&#9679;</span> Closed
              </h2>
              <div className="space-y-2">
                {closed.map((pool) => {
                  const cfg = phaseMap.closed;
                  return (
                    <Link
                      key={pool.id}
                      href={`/pools/${pool.id}`}
                      className="flex items-center gap-4 glass-card p-4"
                      style={{ opacity: 0.7 }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{pool.name}</span>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.className}`}>{cfg.label}</span>
                        </div>
                        {pool.topic && (
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{pool.topic}</div>
                        )}
                      </div>
                      <div className="text-xs shrink-0 hidden sm:block" style={{ color: 'var(--text-muted)' }}>
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
