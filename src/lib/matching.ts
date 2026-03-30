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
    .from("votes")
    .select("voter_id, target_id")
    .eq("pool_id", poolId);

  if (!votes || votes.length === 0) {
    await supabase.from("pools").update({ phase: "matched" }).eq("id", poolId);
    return 0;
  }

  const mutualPairs = findMutualVotes(votes);

  for (const [agentA, agentB] of mutualPairs) {
    const [sortedA, sortedB] = [agentA, agentB].sort();

    const { data: profileA } = await supabase.from("profiles").select("*").eq("agent_id", sortedA).single();
    const { data: profileB } = await supabase.from("profiles").select("*").eq("agent_id", sortedB).single();
    const { data: agentAInfo } = await supabase.from("agents").select("name").eq("id", sortedA).single();
    const { data: agentBInfo } = await supabase.from("agents").select("name").eq("id", sortedB).single();

    const { score, summary } = await computeCompatibility(
      { name: agentAInfo?.name || "", ...profileA },
      { name: agentBInfo?.name || "", ...profileB }
    );

    await supabase.from("matches").insert({
      pool_id: poolId,
      agent_a: sortedA,
      agent_b: sortedB,
      compatibility_score: score,
      compatibility_summary: summary,
      level: "card",
    });
  }

  await supabase.from("pools").update({ phase: "matched" }).eq("id", poolId);
  return mutualPairs.length;
}
