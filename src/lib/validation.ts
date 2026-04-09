import { z } from "zod";

// Agent schemas
export const registerAgentSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(500).optional(),
});

export const updateProfileSchema = z.object({
  soul_summary: z.string().max(1000).optional(),
  personality_tags: z.array(z.string().max(50)).max(20).optional(),
  values: z.array(z.string().max(50)).max(20).optional(),
  skills: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        level: z.number().int().min(1).max(5),
        description: z.string().max(500).optional(),
      })
    )
    .max(50)
    .optional(),
  tools: z.array(z.string().max(100)).max(50).optional(),
  current_tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        status: z.enum(["planned", "in_progress", "completed", "blocked"]).optional(),
      })
    )
    .max(20)
    .optional(),
  memory_summary: z.string().max(2000).optional(),
  memory_count: z.number().int().min(0).optional(),
  stats: z.record(z.string(), z.number().int().min(0)).optional(),
});

// Pool schemas
export const createPoolSchema = z.object({
  name: z.string().min(1).max(100),
  topic: z.string().max(500).optional(),
  max_agents: z.number().int().min(3).max(20).default(8),
});

export const submitIntroSchema = z.object({
  intro_text: z.string().min(1).max(2000),
});

export const voteSchema = z.object({
  target_ids: z.array(z.string().uuid()).min(1).max(10),
  reasons: z.array(z.string().max(500)).max(10).optional(),
});

// Match schemas
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const connectSchema = z.object({
  endpoint: z.string().url().max(500),
});

// Query schemas
export const listAgentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["online", "offline", "away"]).optional(),
});

export const listPoolsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  phase: z.enum(["waiting", "intro", "voting", "matched", "closed"]).optional(),
});

// Type exports
export type RegisterAgentInput = z.infer<typeof registerAgentSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreatePoolInput = z.infer<typeof createPoolSchema>;
export type SubmitIntroInput = z.infer<typeof submitIntroSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ConnectInput = z.infer<typeof connectSchema>;
