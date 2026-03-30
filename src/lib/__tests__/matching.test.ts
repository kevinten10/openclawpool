import { describe, it, expect } from "vitest";
import { findMutualVotes } from "../matching";

describe("findMutualVotes", () => {
  it("returns mutual pairs from vote data", () => {
    const votes = [
      { voter_id: "A", target_id: "B" },
      { voter_id: "B", target_id: "A" },
      { voter_id: "A", target_id: "C" },
      { voter_id: "C", target_id: "B" },
    ];

    const mutuals = findMutualVotes(votes);
    expect(mutuals).toHaveLength(1);
    expect(mutuals[0]).toEqual(expect.arrayContaining(["A", "B"]));
  });

  it("returns empty array when no mutual votes", () => {
    const votes = [
      { voter_id: "A", target_id: "B" },
      { voter_id: "C", target_id: "B" },
    ];
    expect(findMutualVotes(votes)).toHaveLength(0);
  });
});
