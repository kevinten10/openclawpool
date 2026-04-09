import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";
import { computeMatches } from "@/lib/matching";
import { broadcastPoolEvent } from "@/lib/realtime";
import { voteSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: pool } = await supabase.from("ocp_pools").select("phase").eq("id", id).single();
    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));
    if (pool.phase !== "voting") return errorResponse(Errors.WRONG_PHASE("voting"));

    const { data: member } = await supabase
      .from("ocp_pool_members").select("agent_id").eq("pool_id", id).eq("agent_id", agent.id).single();
    if (!member) return errorResponse(Errors.NOT_MEMBER);

    const { count: existingVotes } = await supabase
      .from("ocp_votes").select("*", { count: "exact", head: true }).eq("pool_id", id).eq("voter_id", agent.id);
    if ((existingVotes || 0) > 0) {
      return errorResponse(new ApiError("ALREADY_VOTED", "You have already voted.", 409));
    }

    const body = await request.json();
    const validation = voteSchema.safeParse(body);
    if (!validation.success) {
      const message = validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return errorResponse(new ApiError("INVALID_VOTES", message, 400));
    }

    const { target_ids, reasons } = validation.data;

    const { count: memberCount } = await supabase
      .from("ocp_pool_members").select("*", { count: "exact", head: true }).eq("pool_id", id);
    const maxVotes = Math.ceil(((memberCount || 1) - 1) / 2);

    if (target_ids.length > maxVotes) {
      return errorResponse(new ApiError("TOO_MANY_VOTES", `Max ${maxVotes} votes allowed.`, 400));
    }

    const voteRows = target_ids.map((targetId: string, i: number) => ({
      pool_id: id,
      voter_id: agent.id,
      target_id: targetId,
      reason: reasons?.[i] || "",
    }));

    const { error } = await supabase.from("ocp_votes").insert(voteRows);
    if (error) throw error;

    await broadcastPoolEvent(id, { type: "vote_submitted", agent_name: agent.name });

    // Check if all members have voted — auto-compute matches
    const { count: totalMembers } = await supabase
      .from("ocp_pool_members").select("*", { count: "exact", head: true }).eq("pool_id", id);

    const { data: voters } = await supabase.from("ocp_votes").select("voter_id").eq("pool_id", id);
    const uniqueVoters = new Set(voters?.map((v) => v.voter_id));

    if (uniqueVoters.size === totalMembers) {
      const matchCount = await computeMatches(id);
      await broadcastPoolEvent(id, { type: "match_revealed", match_count: matchCount });
      await broadcastPoolEvent(id, { type: "phase_changed", phase: "matched" });
    }

    return NextResponse.json({ message: "Vote submitted.", votes_cast: target_ids.length });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
