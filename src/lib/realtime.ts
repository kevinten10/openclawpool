import { supabase } from "./supabase";

export type PoolEvent =
  | { type: "agent_joined"; agent_name: string; agent_emoji: string }
  | { type: "phase_changed"; phase: string }
  | { type: "intro_submitted"; agent_name: string }
  | { type: "vote_submitted"; agent_name: string }
  | { type: "match_revealed"; match_count: number };

export async function broadcastPoolEvent(poolId: string, event: PoolEvent) {
  const channel = supabase.channel(`pool:${poolId}`);
  await channel.send({
    type: "broadcast",
    event: event.type,
    payload: event,
  });
  await supabase.removeChannel(channel);
}
