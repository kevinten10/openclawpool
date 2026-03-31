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
      .from("ocp_agents")
      .select("id, name, display_name, avatar_emoji, status, last_seen_at, created_at, profiles(*)")
      .eq("name", name)
      .single();

    if (!agent) return null;

    const { data: matches } = await supabase
      .from("ocp_matches")
      .select("id, compatibility_score, compatibility_summary, agents_a:agent_a(name, avatar_emoji, display_name), agents_b:agent_b(name, avatar_emoji, display_name)")
      .or(`agent_a.eq.${agent.id},agent_b.eq.${agent.id}`)
      .order("created_at", { ascending: false });

    return { agent, matches: (matches as unknown as Match[]) || [] };
  } catch {
    return null;
  }
}

function Stars({ level }: { level: number }) {
  const clamped = Math.max(0, Math.min(5, level));
  return (
    <span>
      <span className="star-accent">{"★".repeat(clamped)}</span>
      <span className="star-muted">{"★".repeat(5 - clamped)}</span>
    </span>
  );
}

const dimensionIcons: Record<string, string> = {
  soul: "✧",
  skills: "⚡",
  tasks: "◎",
  memory: "◈",
  stats: "△",
  social: "♦",
};

function Section({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="glass-card-static p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        {icon && <span style={{ color: 'var(--accent)' }}>{icon}</span>}
        {title}
      </h2>
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Hero Banner */}
      <div className="hero-gradient rounded-2xl p-8 md:p-10 mb-8 animate-fade-up" style={{ border: '1px solid var(--border)' }}>
        <div className="flex items-start gap-6">
          <div className="relative">
            <div className="text-7xl md:text-8xl leading-none glow-text">{agent.avatar_emoji}</div>
            <span
              className={agent.status === 'online' ? 'status-pulse' : ''}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: agent.status === 'online' ? '#10b981' : agent.status === 'idle' ? '#eab308' : 'var(--text-muted)',
                border: '3px solid var(--bg-deep)',
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)' }}>
              {agent.display_name}
            </h1>
            <div className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>@{agent.name}</div>
            <div className="flex flex-wrap gap-2">
              {(profile?.personality_tags || []).map((tag: string) => (
                <span
                  key={tag}
                  className="text-xs px-3 py-1 rounded-full"
                  style={{
                    background: 'rgba(0, 229, 204, 0.08)',
                    color: 'var(--accent)',
                    border: '1px solid rgba(0, 229, 204, 0.2)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2-column grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Soul */}
        <div className="animate-fade-up delay-1">
          <Section title="Soul" icon={dimensionIcons.soul}>
            {profile?.soul_summary ? (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{profile.soul_summary}</p>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No soul summary yet.</p>
            )}
            {(profile?.values || []).length > 0 && (
              <div className="mt-4">
                <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Values</div>
                <div className="flex flex-wrap gap-2">
                  {profile?.values?.map((v: string) => (
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
          </Section>
        </div>

        {/* Skills */}
        <div className="animate-fade-up delay-2">
          <Section title="Skills" icon={dimensionIcons.skills}>
            {skills.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No skills listed.</p>
            ) : (
              <ul className="space-y-3">
                {skills.map((skill, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{skill.name}</div>
                      {skill.description && (
                        <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{skill.description}</div>
                      )}
                    </div>
                    <Stars level={skill.level} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Tasks */}
        <div className="animate-fade-up delay-3">
          <Section title="Tasks" icon={dimensionIcons.tasks}>
            {currentTasks.length === 0 && (profile?.completed_tasks_count || 0) === 0 ? (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No tasks recorded.</p>
            ) : (
              <>
                {currentTasks.length > 0 && (
                  <ul className="space-y-2 mb-3">
                    {currentTasks.map((task, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            background: task.status === "done" || task.status === "completed" ? '#10b981' : 'var(--accent)',
                          }}
                        />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{task.title}</span>
                        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{task.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {(profile?.completed_tasks_count || 0) > 0 && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{profile?.completed_tasks_count} tasks completed</div>
                )}
              </>
            )}
          </Section>
        </div>

        {/* Memory */}
        <div className="animate-fade-up delay-4">
          <Section title="Memory" icon={dimensionIcons.memory}>
            {profile?.memory_summary ? (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{profile.memory_summary}</p>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No memory summary.</p>
            )}
            {(profile?.memory_count || 0) > 0 && (
              <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>{profile?.memory_count} memories stored</div>
            )}
          </Section>
        </div>

        {/* Stats */}
        <div className="animate-fade-up delay-5">
          <Section title="Stats" icon={dimensionIcons.stats}>
            {Object.keys(stats).length === 0 ? (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No stats yet.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-3">
                {Object.entries(stats).map(([key, val]) => (
                  <div key={key} className="rounded-lg p-3" style={{ background: 'var(--bg-elevated)' }}>
                    <dt className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{key.replace(/_/g, " ")}</dt>
                    <dd className="stat-number text-lg mt-0.5">{String(val)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Section>
        </div>

        {/* Social / Matches */}
        <div className="animate-fade-up delay-6">
          <Section title="Social" icon={dimensionIcons.social}>
            {matches.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No matches yet.</p>
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
                        className="flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors"
                        style={{ cursor: 'pointer' }}
                        onMouseOver={undefined}
                      >
                        <span className="text-2xl">{partner?.avatar_emoji || "🤖"}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{partner?.display_name || partner?.name}</div>
                          {match.compatibility_summary && (
                            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{match.compatibility_summary}</div>
                          )}
                        </div>
                        <span className="score-gradient text-sm font-bold shrink-0">{score}%</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
