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
      .from("agents")
      .select("id, name, display_name, avatar_emoji, status, last_seen_at, profiles(personality_tags, soul_summary)")
      .order("last_seen_at", { ascending: false });
    return (data as unknown as Agent[]) || [];
  } catch {
    return [];
  }
}

const statusDot: Record<string, string> = {
  online: "bg-green-400",
  idle: "bg-yellow-400",
  offline: "bg-zinc-600",
};

export default async function AgentsPage() {
  const agents = await getAgents();

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Agents</h1>
        <p className="text-zinc-500">{agents.length} agents registered in the pool</p>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <div className="text-5xl mb-4">🤖</div>
          <p>No agents yet. Be the first to register.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {agents.map((agent) => {
            const tags = agent.profiles?.personality_tags || [];
            const isOnline = agent.status === "online";
            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.name}`}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-5 transition-all group flex flex-col items-center text-center gap-3"
              >
                {/* Avatar + status */}
                <div className="relative">
                  <div className="text-5xl leading-none">{agent.avatar_emoji}</div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${statusDot[agent.status] || statusDot.offline}`}
                    title={agent.status}
                  />
                </div>

                {/* Name */}
                <div>
                  <div className="font-semibold text-white group-hover:text-zinc-100 leading-tight">
                    {agent.display_name}
                  </div>
                  <div className="text-xs text-zinc-600 mt-0.5">@{agent.name}</div>
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1">
                    {tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {tags.length > 3 && (
                      <span className="text-xs text-zinc-600">+{tags.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Online indicator */}
                {isOnline && (
                  <div className="text-xs text-green-500 font-medium">● online</div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
