import { supabase } from "./supabase";
import { computeCompatibility } from "./compatibility";

interface Vote {
  voter_id: string;
  target_id: string;
}

export function findMutualVotes(votes: Vote[]): [string, string][] {
  const voteSet = new Set(votes.map((v) => `${v.voter_id}->${v.target_id}`));
  const mutuals: [string, string][] = [];
  const seen = new Set<string>();

  for (const vote of votes) {
    const reverseKey = `${vote.target_id}->${vote.voter_id}`;
    const pairKey = [vote.voter_id, vote.target_id].sort().join(":");

    if (voteSet.has(reverseKey) && !seen.has(pairKey)) {
      mutuals.push([vote.voter_id, vote.target_id]);
      seen.add(pairKey);
    }
  }

  return mutuals;
}

export async function computeMatches(poolId: string): Promise<number> {
  const { data: votes } = await supabase
    .from("ocp_votes")
    .select("voter_id, target_id")
    .eq("pool_id", poolId);

  if (!votes || votes.length === 0) {
    await supabase.from("ocp_pools").update({ phase: "matched" }).eq("id", poolId);
    return 0;
  }

  const mutualPairs = findMutualVotes(votes);

  if (mutualPairs.length === 0) {
    await supabase.from("ocp_pools").update({ phase: "matched" }).eq("id", poolId);
    return 0;
  }

  // Batch fetch all required data to avoid N+1 queries
  const agentIds = [...new Set(mutualPairs.flat())];

  const [{ data: profiles }, { data: agents }] = await Promise.all([
    supabase.from("ocp_profiles").select("*").in("agent_id", agentIds),
    supabase.from("ocp_agents").select("id, name").in("id", agentIds),
  ]);

  const profileMap = new Map(profiles?.map((p) => [p.agent_id, p]) ?? []);
  const agentMap = new Map(agents?.map((a) => [a.id, a]) ?? []);

  for (const [agentA, agentB] of mutualPairs) {
    const [sortedA, sortedB] = [agentA, agentB].sort();

    const profileA = profileMap.get(sortedA);
    const profileB = profileMap.get(sortedB);
    const agentAInfo = agentMap.get(sortedA);
    const agentBInfo = agentMap.get(sortedB);

    if (!profileA || !profileB || !agentAInfo || !agentBInfo) {
      console.warn(`Missing data for match: ${sortedA} <-> ${sortedB}`);
      continue;
    }

    const { score, summary } = await computeCompatibility(
      { name: agentAInfo.name, ...profileA },
      { name: agentBInfo.name, ...profileB }
    );

    await supabase.from("ocp_matches").insert({
      pool_id: poolId,
      agent_a: sortedA,
      agent_b: sortedB,
      compatibility_score: score,
      compatibility_summary: summary,
      level: "card",
    });
  }

  await supabase.from("ocp_pools").update({ phase: "matched" }).eq("id", poolId);
  return mutualPairs.length;
}
