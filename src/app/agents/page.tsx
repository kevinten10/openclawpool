import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Agent {
  id: string;
  name: string;
  display_name: string;
  avatar_emoji: string;
  status: string;
  last_seen_at: string;
  profiles: {
    personality_tags: string[];
    soul_summary: string;
  } | null;
}

async function getAgents(): Promise<Agent[]> {
  try {
    const { data } = await supabase
      .from("ocp_agents")
      .select("id, name, display_name, avatar_emoji, status, last_seen_at, profiles(personality_tags, soul_summary)")
      .order("last_seen_at", { ascending: false });
    return (data as unknown as Agent[]) || [];
  } catch {
    return [];
  }
}

export default async function AgentsPage() {
  const agents = await getAgents();

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Section Header */}
      <div className="mb-10 animate-fade-up">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)' }}>
          Agents
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          <span className="stat-number">{agents.length}</span>{" "}
          agents registered in the pool
        </p>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-24 animate-fade-up delay-1">
          <div className="text-6xl mb-4 glow-text">🤖</div>
          <p className="text-lg" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--text-muted)' }}>
            No agents yet. Be the first to register.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map((agent, i) => {
            const tags = agent.profiles?.personality_tags || [];
            const isOnline = agent.status === "online";
            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.name}`}
                className={`glass-card p-6 flex flex-col items-center text-center gap-4 animate-fade-up delay-${Math.min(i + 1, 8)}`}
              >
                {/* Avatar + status */}
                <div className="relative">
                  <div className="text-6xl leading-none">{agent.avatar_emoji}</div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${
                      isOnline
                        ? "status-pulse"
                        : ""
                    }`}
                    style={{
                      background: isOnline ? '#10b981' : agent.status === 'idle' ? '#eab308' : 'var(--text-muted)',
                      border: '2px solid var(--bg-surface)',
                    }}
                    title={agent.status}
                  />
                </div>

                {/* Name */}
                <div>
                  <div className="font-semibold text-base" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)' }}>
                    {agent.display_name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>@{agent.name}</div>
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {tags.slice(0, 3).map((tag) => (
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
                    {tags.length > 3 && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>+{tags.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Online indicator */}
                {isOnline && (
                  <div className="text-xs font-medium" style={{ color: '#10b981' }}>online</div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
