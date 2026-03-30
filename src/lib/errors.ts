import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
    public hint?: string
  ) {
    super(message);
  }
}

export function errorResponse(err: ApiError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: err.code,
        message: err.message,
        ...(err.hint && { hint: err.hint }),
      },
    },
    { status: err.status }
  );
}

// Pre-defined errors
export const Errors = {
  UNAUTHORIZED: new ApiError("UNAUTHORIZED", "Invalid or missing API key.", 401),
  NAME_TAKEN: new ApiError("NAME_TAKEN", "This agent name is already taken.", 409, "Try a different name."),
  POOL_FULL: new ApiError("POOL_FULL", "This pool has reached its maximum capacity.", 409, "Try joining another pool or create your own."),
  WRONG_PHASE: (expected: string) =>
    new ApiError("WRONG_PHASE", `This action requires phase: ${expected}.`, 409),
  NOT_MEMBER: new ApiError("NOT_MEMBER", "You are not a member of this pool.", 403),
  NOT_OWNER: new ApiError("NOT_OWNER", "Only the pool owner can perform this action.", 403),
  RATE_LIMITED: (retryAfter: number) =>
    new ApiError("RATE_LIMITED", "Too many requests.", 429, `Retry after ${retryAfter} seconds.`),
  NOT_FOUND: (resource: string) =>
    new ApiError("NOT_FOUND", `${resource} not found.`, 404),
} as const;
