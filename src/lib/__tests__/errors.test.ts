import { describe, it, expect } from "vitest";
import { ApiError, errorResponse } from "../errors";

describe("ApiError", () => {
  it("creates error with code, message, hint, and status", () => {
    const err = new ApiError("POOL_FULL", "Pool is full.", 409, "Join another pool.");
    expect(err.code).toBe("POOL_FULL");
    expect(err.message).toBe("Pool is full.");
    expect(err.status).toBe(409);
    expect(err.hint).toBe("Join another pool.");
  });
});

describe("errorResponse", () => {
  it("returns NextResponse with correct JSON body and status", () => {
    const err = new ApiError("UNAUTHORIZED", "Invalid API key.", 401);
    const res = errorResponse(err);
    expect(res.status).toBe(401);
  });
});
