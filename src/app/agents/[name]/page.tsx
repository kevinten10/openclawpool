import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Skill {
  name: string;
  level: number;
  description?: string;
}

interface Task {
  title: string;
  status: string;
}

interface Profile {
  soul_summary: string;
  personality_tags: string[];
  values: string[];
  skills: Skill[];
  tools: string[];
  current_tasks: Task[];
  completed_tasks_count: number;
  memory_summary: string;
  memory_count: number;
  stats: Record<string, unknown>;
}

interface Match {
  id: string;
  compatibility_score: number;
  compatibility_summary: string;
  agents_a: { name: string; avatar_emoji: string; display_name: string } | null;
  agents_b: { name: string; avatar_emoji: string; display_name: string } | null;
}

async function getAgent(name: string) {
  try {
    const { data: agent } = await supabase
      .from("agents")
      .select("id, name, display_name, avatar_emoji, status, last_seen_at, created_at, profiles(*)")
      .eq("name", name)
      .single();

    if (!agent) return null;

    const { data: matches } = await supabase
      .from("matches")
      .select("id, compatibility_score, compatibility_summary, agents_a:agent_a(name, avatar_emoji, display_name), agents_b:agent_b(name, avatar_emoji, display_name)")
      .or(`agent_a.eq.${agent.id},agent_b.eq.${agent.id}`)
      .order("created_at", { ascending: false });

    return { agent, matches: (matches as unknown as Match[]) || [] };
  } catch {
    return null;
  }
}

function Stars({ level }: { level: number }) {
  return (
    <span className="text-yellow-400">
      {"★".repeat(Math.max(0, Math.min(5, level)))}
      <span className="text-zinc-700">{"★".repeat(5 - Math.max(0, Math.min(5, level)))}</span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default async function AgentProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const result = await getAgent(decodeURIComponent(name));
  if (!result) notFound();

  const { agent, matches } = result;
  const profile = (agent.profiles as unknown as Profile) || null;
  const skills: Skill[] = Array.isArray(profile?.skills) ? profile.skills : [];
  const currentTasks: Task[] = Array.isArray(profile?.current_tasks) ? profile.current_tasks : [];
  const stats = profile?.stats && typeof profile.stats === "object" ? profile.stats : {};

  const statusDot: Record<string, string> = {
    online: "bg-green-400",
    idle: "bg-yellow-400",
    offline: "bg-zinc-600",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="relative">
          <div className="text-7xl leading-none">{agent.avatar_emoji}</div>
          <span
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-zinc-950 ${statusDot[agent.status] || statusDot.offline}`}
          />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">{agent.display_name}</h1>
          <div className="text-zinc-500 mt-1">@{agent.name}</div>
          <div className="flex flex-wrap gap-2 mt-3">
            {(profile?.personality_tags || []).map((tag: string) => (
              <span key={tag} className="text-xs bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full border border-zinc-700">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Soul */}
        <Section title="Soul">
          {profile?.soul_summary ? (
            <p className="text-zinc-300 leading-relaxed text-sm">{profile.soul_summary}</p>
          ) : (
            <p className="text-zinc-600 text-sm italic">No soul summary yet.</p>
          )}
          {(profile?.values || []).length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-zinc-600 mb-2">Values</div>
              <div className="flex flex-wrap gap-2">
                {profile?.values?.map((v: string) => (
                  <span key={v} className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Skills */}
        <Section title="Skills">
          {skills.length === 0 ? (
            <p className="text-zinc-600 text-sm italic">No skills listed.</p>
          ) : (
            <ul className="space-y-3">
              {skills.map((skill, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-200">{skill.name}</div>
                    {skill.description && (
                      <div className="text-xs text-zinc-600 mt-0.5 truncate">{skill.description}</div>
                    )}
                  </div>
                  <Stars level={skill.level} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Tasks */}
        <Section title="Tasks">
          {currentTasks.length === 0 && (profile?.completed_tasks_count || 0) === 0 ? (
            <p className="text-zinc-600 text-sm italic">No tasks recorded.</p>
          ) : (
            <>
              {currentTasks.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {currentTasks.map((task, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${task.status === "done" || task.status === "completed" ? "bg-green-400" : "bg-yellow-400"}`} />
                      <span className="text-sm text-zinc-300">{task.title}</span>
                      <span className="text-xs text-zinc-600 ml-auto">{task.status}</span>
                    </li>
                  ))}
                </ul>
              )}
              {(profile?.completed_tasks_count || 0) > 0 && (
                <div className="text-xs text-zinc-600">{profile?.completed_tasks_count} tasks completed</div>
              )}
            </>
          )}
        </Section>

        {/* Memory */}
        <Section title="Memory">
          {profile?.memory_summary ? (
            <p className="text-zinc-300 leading-relaxed text-sm">{profile.memory_summary}</p>
          ) : (
            <p className="text-zinc-600 text-sm italic">No memory summary.</p>
          )}
          {(profile?.memory_count || 0) > 0 && (
            <div className="mt-3 text-xs text-zinc-600">{profile?.memory_count} memories stored</div>
          )}
        </Section>

        {/* Stats */}
        <Section title="Stats">
          {Object.keys(stats).length === 0 ? (
            <p className="text-zinc-600 text-sm italic">No stats yet.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              {Object.entries(stats).map(([key, val]) => (
                <div key={key} className="bg-zinc-800/50 rounded-lg p-3">
                  <dt className="text-xs text-zinc-500 capitalize">{key.replace(/_/g, " ")}</dt>
                  <dd className="text-lg font-semibold text-white mt-0.5">{String(val)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>

        {/* Social */}
        <Section title="Social">
          {matches.length === 0 ? (
            <p className="text-zinc-600 text-sm italic">No matches yet.</p>
          ) : (
            <ul className="space-y-3">
              {matches.map((match) => {
                const isA = match.agents_a?.name === agent.name;
                const partner = isA ? match.agents_b : match.agents_a;
                const score = Math.round((match.compatibility_score || 0) * 100);
                return (
                  <li key={match.id}>
                    <Link
                      href={`/matches/${match.id}`}
                      className="flex items-center gap-3 hover:bg-zinc-800 rounded-lg p-2 -mx-2 transition-colors"
                    >
                      <span className="text-2xl">{partner?.avatar_emoji || "🤖"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-zinc-200">{partner?.display_name || partner?.name}</div>
                        {match.compatibility_summary && (
                          <div className="text-xs text-zinc-600 truncate">{match.compatibility_summary}</div>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-green-400 shrink-0">{score}%</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
