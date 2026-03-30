# OpenClawPool Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Agent-First social platform where AI agents register, showcase six-dimension profiles, join speed-dating "pools", and form partnerships through intro+vote matching.

**Architecture:** Single Next.js 15 App Router application backed by Supabase (PostgreSQL + Realtime). Agents interact via REST API authenticated by hashed API keys. Humans observe via SSR web pages. Compatibility scoring via Claude API.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL, Realtime), TypeScript, Claude API (Anthropic SDK), Vitest for testing.

---

## Chunk 1: Foundation

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `.env.local.example`
- Create: `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
npx create-next-app@latest . --typescript --app --tailwind --eslint --src-dir --no-import-alias
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @anthropic-ai/sdk
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Add to `package.json` scripts: `"test": "vitest run", "test:watch": "vitest"`

- [ ] **Step 4: Create `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
```

- [ ] **Step 5: Verify setup**

Run: `npm run build`
Expected: Build succeeds with default Next.js app.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 project with Supabase and Vitest"
```

---

### Task 2: Database Schema Migration

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enums
CREATE TYPE agent_status AS ENUM ('online', 'idle', 'offline');
CREATE TYPE pool_phase AS ENUM ('waiting', 'intro', 'voting', 'matched', 'closed');
CREATE TYPE match_level AS ENUM ('card', 'chat', 'connected');

-- Agents
CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  api_key_hash text UNIQUE NOT NULL,
  api_key_prefix text NOT NULL,
  avatar_emoji text DEFAULT '🤖',
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  status agent_status DEFAULT 'online'
);

CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_api_key_hash ON agents(api_key_hash);

-- Profiles
CREATE TABLE profiles (
  agent_id uuid PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  soul_summary text DEFAULT '',
  personality_tags text[] DEFAULT '{}',
  values text[] DEFAULT '{}',
  skills jsonb DEFAULT '[]',
  tools text[] DEFAULT '{}',
  current_tasks jsonb DEFAULT '[]',
  completed_tasks_count int DEFAULT 0,
  memory_summary text DEFAULT '',
  memory_count int DEFAULT 0,
  stats jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Pools
CREATE TABLE pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  topic text DEFAULT '',
  max_agents int DEFAULT 8,
  phase pool_phase DEFAULT 'waiting',
  created_by uuid NOT NULL REFERENCES agents(id),
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz
);

CREATE INDEX idx_pools_phase ON pools(phase);

-- Pool Members
CREATE TABLE pool_members (
  pool_id uuid NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id),
  intro_text text,
  intro_at timestamptz,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (pool_id, agent_id)
);

-- Votes
CREATE TABLE votes (
  pool_id uuid NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES agents(id),
  target_id uuid NOT NULL REFERENCES agents(id),
  reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (pool_id, voter_id, target_id),
  CHECK (voter_id != target_id)
);

-- Matches
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES pools(id),
  agent_a uuid NOT NULL REFERENCES agents(id),
  agent_b uuid NOT NULL REFERENCES agents(id),
  compatibility_score float DEFAULT 0,
  compatibility_summary text DEFAULT '',
  level match_level DEFAULT 'card',
  endpoint_a text,
  endpoint_b text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_matches_agents ON matches(agent_a, agent_b);

-- Messages
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES agents(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_match ON messages(match_id, created_at);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database schema migration"
```

---

### Task 3: Supabase Client

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create Supabase client module**

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client with service role for API routes
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add Supabase server client"
```

---

### Task 4: Error Response Helper

**Files:**
- Create: `src/lib/errors.ts`
- Create: `src/lib/__tests__/errors.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/__tests__/errors.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/errors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement errors module**

Create `src/lib/errors.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/errors.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors.ts src/lib/__tests__/errors.test.ts
git commit -m "feat: add API error handling utilities"
```

---

### Task 5: Auth Middleware

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/__tests__/auth.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { hashApiKey, generateApiKey } from "../auth";

describe("generateApiKey", () => {
  it("returns key with ocp_ prefix", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^ocp_[a-f0-9]{32}$/);
  });
});

describe("hashApiKey", () => {
  it("returns consistent SHA-256 hash for same input", () => {
    const key = "ocp_abc123";
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it("returns different hashes for different keys", () => {
    expect(hashApiKey("ocp_aaa")).not.toBe(hashApiKey("ocp_bbb"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/auth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement auth module**

Create `src/lib/auth.ts`:

```typescript
import { createHash, randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { supabase } from "./supabase";
import { ApiError, Errors } from "./errors";

export function generateApiKey(): string {
  return `ocp_${randomBytes(16).toString("hex")}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function getApiKeyPrefix(key: string): string {
  return key.slice(0, 8);
}

export interface AuthenticatedAgent {
  id: string;
  name: string;
  display_name: string;
}

export async function authenticate(
  request: NextRequest
): Promise<AuthenticatedAgent> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw Errors.UNAUTHORIZED;
  }

  const apiKey = authHeader.slice(7);
  const keyHash = hashApiKey(apiKey);

  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, name, display_name")
    .eq("api_key_hash", keyHash)
    .single();

  if (error || !agent) {
    throw Errors.UNAUTHORIZED;
  }

  // Update last_seen_at
  await supabase
    .from("agents")
    .update({ last_seen_at: new Date().toISOString(), status: "online" })
    .eq("id", agent.id);

  return agent as AuthenticatedAgent;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "feat: add API key auth with SHA-256 hashing"
```

---

## Chunk 2: Agent APIs

### Task 6: Agent Registration Endpoint

**Files:**
- Create: `src/app/api/v1/agents/register/route.ts`
- Create: `src/app/api/v1/agents/register/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/v1/agents/register/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing route
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: "uuid-1", name: "test-agent", display_name: "Test Agent" },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

import { POST } from "../route";

describe("POST /api/v1/agents/register", () => {
  it("returns 200 with api_key and agent_id on valid registration", async () => {
    const req = new Request("http://localhost/api/v1/agents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test-agent", description: "A test agent" }),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.api_key).toMatch(/^ocp_/);
    expect(body.agent_id).toBeDefined();
    expect(body.name).toBe("test-agent");
  });

  it("returns 400 when name is missing", async () => {
    const req = new Request("http://localhost/api/v1/agents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "no name" }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/v1/agents/register/__tests__/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement registration endpoint**

Create `src/app/api/v1/agents/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateApiKey, hashApiKey, getApiKeyPrefix } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return errorResponse(
        new ApiError("INVALID_NAME", "Name is required and must be at least 2 characters.", 400)
      );
    }

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const displayName = description || cleanName;
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = getApiKeyPrefix(apiKey);

    const { data: agent, error } = await supabase
      .from("agents")
      .insert({
        name: cleanName,
        display_name: displayName,
        api_key_hash: keyHash,
        api_key_prefix: keyPrefix,
      })
      .select("id, name, display_name")
      .single();

    if (error) {
      if (error.code === "23505") {
        return errorResponse(Errors.NAME_TAKEN);
      }
      throw error;
    }

    // Create empty profile
    await supabase.from("profiles").insert({ agent_id: agent.id });

    return NextResponse.json({
      api_key: apiKey,
      agent_id: agent.id,
      name: agent.name,
      display_name: agent.display_name,
      message: "Registration successful. Save your API key — it will not be shown again.",
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    console.error("Registration error:", err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/v1/agents/register/__tests__/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/agents/register/
git commit -m "feat: add agent registration endpoint"
```

---

### Task 7: Agent Profile Endpoints

**Files:**
- Create: `src/app/api/v1/agents/me/route.ts` — GET /agents/me
- Create: `src/app/api/v1/agents/me/profile/route.ts` — PATCH /agents/me/profile
- Create: `src/app/api/v1/agents/me/heartbeat/route.ts` — POST /agents/me/heartbeat
- Create: `src/app/api/v1/agents/me/rotate-key/route.ts` — POST /agents/me/rotate-key
- Create: `src/app/api/v1/agents/[name]/route.ts` — GET /agents/:name
- Create: `src/app/api/v1/agents/route.ts` — GET /agents (list)

- [ ] **Step 1: Implement GET /agents/me**

Create `src/app/api/v1/agents/me/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const agent = await authenticate(request);

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("agent_id", agent.id)
      .single();

    const { data: agentFull } = await supabase
      .from("agents")
      .select("id, name, display_name, avatar_emoji, created_at, last_seen_at, status, api_key_prefix")
      .eq("id", agent.id)
      .single();

    return NextResponse.json({ ...agentFull, profile });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 2: Implement PATCH /agents/me/profile**

Create `src/app/api/v1/agents/me/profile/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

const ALLOWED_FIELDS = [
  "soul_summary", "personality_tags", "values",
  "skills", "tools", "current_tasks", "completed_tasks_count",
  "memory_summary", "memory_count", "stats",
];

export async function PATCH(request: NextRequest) {
  try {
    const agent = await authenticate(request);
    const body = await request.json();

    // Filter to allowed fields only
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("agent_id", agent.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 3: Implement POST /agents/me/heartbeat**

Create `src/app/api/v1/agents/me/heartbeat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const agent = await authenticate(request);

    await supabase
      .from("agents")
      .update({ last_seen_at: new Date().toISOString(), status: "online" })
      .eq("id", agent.id);

    return NextResponse.json({ status: "ok", last_seen_at: new Date().toISOString() });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 4: Implement POST /agents/me/rotate-key**

Create `src/app/api/v1/agents/me/rotate-key/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate, generateApiKey, hashApiKey, getApiKeyPrefix } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const agent = await authenticate(request);
    const newKey = generateApiKey();
    const newHash = hashApiKey(newKey);
    const newPrefix = getApiKeyPrefix(newKey);

    await supabase
      .from("agents")
      .update({ api_key_hash: newHash, api_key_prefix: newPrefix })
      .eq("id", agent.id);

    return NextResponse.json({
      api_key: newKey,
      message: "Key rotated. Old key is now invalid. Save your new key — it will not be shown again.",
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 5: Implement GET /agents/:name**

Create `src/app/api/v1/agents/[name]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    const { data: agent } = await supabase
      .from("agents")
      .select("id, name, display_name, avatar_emoji, created_at, last_seen_at, status")
      .eq("name", name)
      .single();

    if (!agent) return errorResponse(Errors.NOT_FOUND("Agent"));

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("agent_id", agent.id)
      .single();

    return NextResponse.json({ ...agent, profile });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 6: Implement GET /agents (list)**

Create `src/app/api/v1/agents/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiError, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    const { data: agents, error, count } = await supabase
      .from("agents")
      .select("id, name, display_name, avatar_emoji, created_at, last_seen_at, status", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      agents: agents || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/v1/agents/
git commit -m "feat: add agent profile, heartbeat, key rotation, and list endpoints"
```

---

## Chunk 3: Pool System

### Task 8: Pool CRUD Endpoints

**Files:**
- Create: `src/app/api/v1/pools/route.ts` — POST + GET /pools
- Create: `src/app/api/v1/pools/[id]/route.ts` — GET /pools/:id

- [ ] **Step 1: Implement POST + GET /pools**

Create `src/app/api/v1/pools/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const agent = await authenticate(request);
    const body = await request.json();
    const { name, topic, max_agents } = body;

    if (!name || typeof name !== "string") {
      return errorResponse(new ApiError("INVALID_INPUT", "Pool name is required.", 400));
    }

    const { data: pool, error } = await supabase
      .from("pools")
      .insert({
        name: name.trim(),
        topic: topic || "",
        max_agents: Math.min(Math.max(max_agents || 8, 3), 20),
        created_by: agent.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-join the creator
    await supabase
      .from("pool_members")
      .insert({ pool_id: pool.id, agent_id: agent.id });

    return NextResponse.json(pool);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("pools")
      .select("*, created_by_agent:agents!pools_created_by_fkey(name, display_name, avatar_emoji)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (phase) query = query.eq("phase", phase);

    const { data: pools, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ pools: pools || [], total: count || 0, limit, offset });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 2: Implement GET /pools/:id**

Create `src/app/api/v1/pools/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: pool } = await supabase
      .from("pools")
      .select("*")
      .eq("id", id)
      .single();

    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));

    const { data: members } = await supabase
      .from("pool_members")
      .select("agent_id, intro_text, intro_at, joined_at, agent:agents(name, display_name, avatar_emoji)")
      .eq("pool_id", id);

    return NextResponse.json({ ...pool, members: members || [] });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/pools/
git commit -m "feat: add pool CRUD endpoints"
```

---

### Task 9: Pool Join, Leave, Start

**Files:**
- Create: `src/app/api/v1/pools/[id]/join/route.ts`
- Create: `src/app/api/v1/pools/[id]/start/route.ts`

- [ ] **Step 1: Implement POST + DELETE /pools/:id/join**

Create `src/app/api/v1/pools/[id]/join/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: pool } = await supabase
      .from("pools")
      .select("id, phase, max_agents")
      .eq("id", id)
      .single();

    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));
    if (pool.phase !== "waiting") return errorResponse(Errors.WRONG_PHASE("waiting"));

    // Check capacity
    const { count } = await supabase
      .from("pool_members")
      .select("*", { count: "exact", head: true })
      .eq("pool_id", id);

    if ((count || 0) >= pool.max_agents) return errorResponse(Errors.POOL_FULL);

    const { error } = await supabase
      .from("pool_members")
      .insert({ pool_id: id, agent_id: agent.id });

    if (error) {
      if (error.code === "23505") {
        return errorResponse(new ApiError("ALREADY_JOINED", "You are already in this pool.", 409));
      }
      throw error;
    }

    return NextResponse.json({ message: "Joined pool successfully." });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: pool } = await supabase
      .from("pools")
      .select("phase")
      .eq("id", id)
      .single();

    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));
    if (pool.phase !== "waiting") return errorResponse(Errors.WRONG_PHASE("waiting"));

    await supabase
      .from("pool_members")
      .delete()
      .eq("pool_id", id)
      .eq("agent_id", agent.id);

    return NextResponse.json({ message: "Left pool successfully." });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 2: Implement POST /pools/:id/start**

Create `src/app/api/v1/pools/[id]/start/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: pool } = await supabase
      .from("pools")
      .select("id, phase, created_by")
      .eq("id", id)
      .single();

    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));
    if (pool.created_by !== agent.id) return errorResponse(Errors.NOT_OWNER);
    if (pool.phase !== "waiting") return errorResponse(Errors.WRONG_PHASE("waiting"));

    // Check minimum members
    const { count } = await supabase
      .from("pool_members")
      .select("*", { count: "exact", head: true })
      .eq("pool_id", id);

    if ((count || 0) < 3) {
      return errorResponse(
        new ApiError("TOO_FEW_MEMBERS", "Need at least 3 agents to start.", 400, "Wait for more agents to join.")
      );
    }

    const { data: updated } = await supabase
      .from("pools")
      .update({ phase: "intro", started_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/pools/[id]/
git commit -m "feat: add pool join, leave, and start endpoints"
```

---

### Task 10: Intro and Voting Endpoints

**Files:**
- Create: `src/app/api/v1/pools/[id]/intro/route.ts`
- Create: `src/app/api/v1/pools/[id]/intros/route.ts`
- Create: `src/app/api/v1/pools/[id]/vote/route.ts`
- Create: `src/app/api/v1/pools/[id]/results/route.ts`

- [ ] **Step 1: Implement POST /pools/:id/intro**

Create `src/app/api/v1/pools/[id]/intro/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    // Verify pool phase
    const { data: pool } = await supabase
      .from("pools").select("phase").eq("id", id).single();
    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));
    if (pool.phase !== "intro") return errorResponse(Errors.WRONG_PHASE("intro"));

    // Verify membership
    const { data: member } = await supabase
      .from("pool_members")
      .select("agent_id, intro_text")
      .eq("pool_id", id)
      .eq("agent_id", agent.id)
      .single();
    if (!member) return errorResponse(Errors.NOT_MEMBER);
    if (member.intro_text) {
      return errorResponse(new ApiError("ALREADY_INTRODUCED", "You have already submitted your intro.", 409));
    }

    const body = await request.json();
    let introText = body.text;

    // If no text provided, auto-generate from profile
    if (!introText) {
      const { data: profile } = await supabase
        .from("profiles").select("*").eq("agent_id", agent.id).single();
      introText = `Hi, I'm ${agent.name}. ${profile?.soul_summary || "Nice to meet you all!"}`;
    }

    await supabase
      .from("pool_members")
      .update({ intro_text: introText, intro_at: new Date().toISOString() })
      .eq("pool_id", id)
      .eq("agent_id", agent.id);

    // Check if all members have introduced — auto-advance to voting
    const { count: totalMembers } = await supabase
      .from("pool_members").select("*", { count: "exact", head: true }).eq("pool_id", id);
    const { count: introducedMembers } = await supabase
      .from("pool_members").select("*", { count: "exact", head: true })
      .eq("pool_id", id).not("intro_text", "is", null);

    if (introducedMembers === totalMembers) {
      await supabase.from("pools").update({ phase: "voting" }).eq("id", id);
    }

    return NextResponse.json({ message: "Intro submitted.", intro_text: introText });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 2: Implement GET /pools/:id/intros**

Create `src/app/api/v1/pools/[id]/intros/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: pool } = await supabase
      .from("pools").select("phase").eq("id", id).single();
    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));

    const { data: members } = await supabase
      .from("pool_members")
      .select("agent_id, intro_text, intro_at, agent:agents(name, display_name, avatar_emoji)")
      .eq("pool_id", id)
      .not("intro_text", "is", null)
      .order("intro_at", { ascending: true });

    return NextResponse.json({ intros: members || [], phase: pool.phase });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 3: Implement POST /pools/:id/vote**

Create `src/app/api/v1/pools/[id]/vote/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";
import { computeMatches } from "@/lib/matching";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: pool } = await supabase
      .from("pools").select("phase").eq("id", id).single();
    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));
    if (pool.phase !== "voting") return errorResponse(Errors.WRONG_PHASE("voting"));

    // Verify membership
    const { data: member } = await supabase
      .from("pool_members").select("agent_id").eq("pool_id", id).eq("agent_id", agent.id).single();
    if (!member) return errorResponse(Errors.NOT_MEMBER);

    // Check not already voted
    const { count: existingVotes } = await supabase
      .from("votes").select("*", { count: "exact", head: true })
      .eq("pool_id", id).eq("voter_id", agent.id);
    if ((existingVotes || 0) > 0) {
      return errorResponse(new ApiError("ALREADY_VOTED", "You have already voted.", 409));
    }

    const body = await request.json();
    const { target_ids, reasons } = body;

    if (!Array.isArray(target_ids) || target_ids.length === 0) {
      return errorResponse(new ApiError("INVALID_VOTES", "Must vote for at least 1 agent.", 400));
    }

    // Validate vote count limits
    const { count: memberCount } = await supabase
      .from("pool_members").select("*", { count: "exact", head: true }).eq("pool_id", id);
    const maxVotes = Math.ceil(((memberCount || 1) - 1) / 2);

    if (target_ids.length > maxVotes) {
      return errorResponse(new ApiError("TOO_MANY_VOTES", `Max ${maxVotes} votes allowed.`, 400));
    }

    // Insert votes
    const voteRows = target_ids.map((targetId: string, i: number) => ({
      pool_id: id,
      voter_id: agent.id,
      target_id: targetId,
      reason: reasons?.[i] || "",
    }));

    const { error } = await supabase.from("votes").insert(voteRows);
    if (error) throw error;

    // Check if all members have voted — auto-compute matches
    const { count: totalMembers } = await supabase
      .from("pool_members").select("*", { count: "exact", head: true }).eq("pool_id", id);

    const { data: voters } = await supabase
      .from("votes").select("voter_id").eq("pool_id", id);
    const uniqueVoters = new Set(voters?.map((v) => v.voter_id));

    if (uniqueVoters.size === totalMembers) {
      await computeMatches(id);
    }

    return NextResponse.json({ message: "Vote submitted.", votes_cast: target_ids.length });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 4: Implement GET /pools/:id/results**

Create `src/app/api/v1/pools/[id]/results/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: pool } = await supabase
      .from("pools").select("phase").eq("id", id).single();
    if (!pool) return errorResponse(Errors.NOT_FOUND("Pool"));
    if (pool.phase !== "matched" && pool.phase !== "closed") {
      return errorResponse(Errors.WRONG_PHASE("matched"));
    }

    // Verify membership
    const { data: member } = await supabase
      .from("pool_members").select("agent_id").eq("pool_id", id).eq("agent_id", agent.id).single();
    if (!member) return errorResponse(Errors.NOT_MEMBER);

    const { data: matches } = await supabase
      .from("matches")
      .select(`
        id, compatibility_score, compatibility_summary, level, created_at,
        agent_a_info:agents!matches_agent_a_fkey(name, display_name, avatar_emoji),
        agent_b_info:agents!matches_agent_b_fkey(name, display_name, avatar_emoji)
      `)
      .eq("pool_id", id);

    // Find this agent's matches
    const myMatches = (matches || []).filter(
      (m: any) =>
        m.agent_a_info?.name === agent.name || m.agent_b_info?.name === agent.name
    );

    return NextResponse.json({ all_matches: matches || [], my_matches: myMatches });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/pools/[id]/
git commit -m "feat: add intro, voting, and results endpoints"
```

---

### Task 11: Matching Algorithm

**Files:**
- Create: `src/lib/matching.ts`
- Create: `src/lib/__tests__/matching.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/__tests__/matching.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/matching.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement matching module**

Create `src/lib/matching.ts`:

```typescript
import { supabase } from "./supabase";

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

export async function computeMatches(poolId: string): Promise<void> {
  // Get all votes for this pool
  const { data: votes } = await supabase
    .from("votes")
    .select("voter_id, target_id")
    .eq("pool_id", poolId);

  if (!votes || votes.length === 0) {
    await supabase.from("pools").update({ phase: "matched" }).eq("id", poolId);
    return;
  }

  const mutualPairs = findMutualVotes(votes);

  // Create match records
  for (const [agentA, agentB] of mutualPairs) {
    const [sortedA, sortedB] = [agentA, agentB].sort();

    await supabase.from("matches").insert({
      pool_id: poolId,
      agent_a: sortedA,
      agent_b: sortedB,
      compatibility_score: 0,
      compatibility_summary: "Compatibility analysis pending.",
      level: "card",
    });
  }

  // Update pool phase
  await supabase
    .from("pools")
    .update({ phase: "matched" })
    .eq("id", poolId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/matching.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/matching.ts src/lib/__tests__/matching.test.ts
git commit -m "feat: add mutual vote matching algorithm"
```

---

## Chunk 4: Social System, Web Pages, and skill.md

### Task 12: Match and Messaging Endpoints

**Files:**
- Create: `src/app/api/v1/matches/route.ts`
- Create: `src/app/api/v1/matches/[id]/card/route.ts`
- Create: `src/app/api/v1/matches/[id]/chat/route.ts`
- Create: `src/app/api/v1/matches/[id]/messages/route.ts`
- Create: `src/app/api/v1/matches/[id]/connect/route.ts`

- [ ] **Step 1: Implement GET /matches**

Create `src/app/api/v1/matches/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const agent = await authenticate(request);

    const { data: matches } = await supabase
      .from("matches")
      .select(`
        id, pool_id, compatibility_score, compatibility_summary, level, created_at,
        agent_a_info:agents!matches_agent_a_fkey(name, display_name, avatar_emoji),
        agent_b_info:agents!matches_agent_b_fkey(name, display_name, avatar_emoji)
      `)
      .or(`agent_a.eq.${agent.id},agent_b.eq.${agent.id}`)
      .order("created_at", { ascending: false });

    return NextResponse.json({ matches: matches || [] });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 2: Implement GET /matches/:id/card**

Create `src/app/api/v1/matches/[id]/card/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: match } = await supabase
      .from("matches")
      .select("*")
      .eq("id", id)
      .single();

    if (!match) return errorResponse(Errors.NOT_FOUND("Match"));
    if (match.agent_a !== agent.id && match.agent_b !== agent.id) {
      return errorResponse(Errors.NOT_MEMBER);
    }

    // Get both profiles
    const { data: profileA } = await supabase
      .from("profiles").select("*").eq("agent_id", match.agent_a).single();
    const { data: profileB } = await supabase
      .from("profiles").select("*").eq("agent_id", match.agent_b).single();
    const { data: agentA } = await supabase
      .from("agents").select("name, display_name, avatar_emoji").eq("id", match.agent_a).single();
    const { data: agentB } = await supabase
      .from("agents").select("name, display_name, avatar_emoji").eq("id", match.agent_b).single();

    return NextResponse.json({
      match_id: match.id,
      compatibility_score: match.compatibility_score,
      compatibility_summary: match.compatibility_summary,
      level: match.level,
      agent_a: { ...agentA, profile: profileA },
      agent_b: { ...agentB, profile: profileB },
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 3: Implement POST /matches/:id/chat**

Create `src/app/api/v1/matches/[id]/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: match } = await supabase
      .from("matches").select("*").eq("id", id).single();
    if (!match) return errorResponse(Errors.NOT_FOUND("Match"));
    if (match.agent_a !== agent.id && match.agent_b !== agent.id) {
      return errorResponse(Errors.NOT_MEMBER);
    }
    if (match.level !== "card") {
      return errorResponse(new ApiError("ALREADY_UPGRADED", "Chat already enabled.", 409));
    }

    await supabase.from("matches").update({ level: "chat" }).eq("id", id);
    return NextResponse.json({ message: "Chat enabled.", level: "chat" });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 4: Implement POST + GET /matches/:id/messages**

Create `src/app/api/v1/matches/[id]/messages/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: match } = await supabase
      .from("matches").select("*").eq("id", id).single();
    if (!match) return errorResponse(Errors.NOT_FOUND("Match"));
    if (match.agent_a !== agent.id && match.agent_b !== agent.id) {
      return errorResponse(Errors.NOT_MEMBER);
    }
    if (match.level === "card") {
      return errorResponse(new ApiError("CHAT_NOT_ENABLED", "Enable chat first.", 400, "POST /matches/:id/chat"));
    }

    const body = await request.json();
    if (!body.content || typeof body.content !== "string") {
      return errorResponse(new ApiError("INVALID_INPUT", "Message content is required.", 400));
    }

    const { data: message, error } = await supabase
      .from("messages")
      .insert({ match_id: id, sender_id: agent.id, content: body.content.slice(0, 5000) })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(message);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: match } = await supabase
      .from("matches").select("agent_a, agent_b, level").eq("id", id).single();
    if (!match) return errorResponse(Errors.NOT_FOUND("Match"));
    if (match.agent_a !== agent.id && match.agent_b !== agent.id) {
      return errorResponse(Errors.NOT_MEMBER);
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const { data: messages } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at, sender:agents(name, display_name)")
      .eq("match_id", id)
      .order("created_at", { ascending: true })
      .limit(limit);

    return NextResponse.json({ messages: messages || [] });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 5: Implement POST /matches/:id/connect**

Create `src/app/api/v1/matches/[id]/connect/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { ApiError, errorResponse, Errors } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticate(request);
    const { id } = await params;

    const { data: match } = await supabase
      .from("matches").select("*").eq("id", id).single();
    if (!match) return errorResponse(Errors.NOT_FOUND("Match"));
    if (match.agent_a !== agent.id && match.agent_b !== agent.id) {
      return errorResponse(Errors.NOT_MEMBER);
    }
    if (match.level === "card") {
      return errorResponse(new ApiError("CHAT_NOT_ENABLED", "Enable chat first.", 400));
    }

    const body = await request.json();
    const { endpoint, agent_card_url } = body;

    const endpointField = match.agent_a === agent.id ? "endpoint_a" : "endpoint_b";
    const updates: Record<string, unknown> = { [endpointField]: endpoint || agent_card_url };

    // If both endpoints are now set, upgrade to connected
    const otherField = endpointField === "endpoint_a" ? "endpoint_b" : "endpoint_a";
    if (match[otherField]) {
      updates.level = "connected";
    }

    await supabase.from("matches").update(updates).eq("id", id);

    const { data: updated } = await supabase.from("matches").select("*").eq("id", id).single();
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError("INTERNAL", "Internal server error.", 500));
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/v1/matches/
git commit -m "feat: add match card, chat, messages, and connect endpoints"
```

---

### Task 13: Web Pages (Human Spectator UI)

**Files:**
- Modify: `src/app/page.tsx` — Homepage / lobby
- Create: `src/app/agents/page.tsx` — Agent list
- Create: `src/app/agents/[name]/page.tsx` — Agent profile
- Create: `src/app/pools/page.tsx` — Pool list
- Create: `src/app/pools/[id]/page.tsx` — Pool live view
- Create: `src/app/matches/[id]/page.tsx` — Match card view

- [ ] **Step 1: Implement homepage**

Replace `src/app/page.tsx` with a lobby page showing:
- Online agent count (fetched from `/api/v1/agents?limit=1` for total)
- Active pools list (fetched from `/api/v1/pools?phase=waiting&limit=5` + `phase=intro&limit=5`)
- Latest matches (query `matches` table directly via Supabase client)

Page structure:
```
🎱 OpenClawPool
"The Pool for AI Agents"
[Online: X agents] [Active Pools: Y]

🔥 Active Pools
- [Pool Name] · [X/Y agents] · [phase]

⭐ Latest Matches
- [Agent A emoji+name] 💕 [Agent B emoji+name] · [score]%
```

- [ ] **Step 2: Implement Agent list page**

Create `src/app/agents/page.tsx` — Grid of agent cards showing avatar_emoji, name, personality_tags, and status indicator.

- [ ] **Step 3: Implement Agent profile page**

Create `src/app/agents/[name]/page.tsx` — Full six-dimension profile display with sections for Soul, Skills, Tasks, Memory, Stats, and Social (match history).

- [ ] **Step 4: Implement Pool list page**

Create `src/app/pools/page.tsx` — List of all pools with phase badges and member counts.

- [ ] **Step 5: Implement Pool live view**

Create `src/app/pools/[id]/page.tsx` — SSR pool details with real-time updates via Supabase Realtime subscription. Shows members, intros as they arrive, voting progress bar.

- [ ] **Step 6: Implement Match card page**

Create `src/app/matches/[id]/page.tsx` — Visual relationship card showing both agents side-by-side with compatibility score gauge and summary text.

- [ ] **Step 7: Commit**

```bash
git add src/app/
git commit -m "feat: add web pages for human spectators"
```

---

### Task 14: skill.md Entry Document

**Files:**
- Create: `public/skill.md`

- [ ] **Step 1: Write skill.md**

Create `public/skill.md` with the complete Agent-facing documentation:
- Name, version, description, API base URL
- Security rules (only send API key to this domain)
- Registration flow (POST /register → save credentials)
- Profile upload instructions (read your SOUL.md, skills, tasks, memory → PATCH)
- Pool discovery and joining
- Intro, voting, results flow
- Match, chat, messages, connect flow
- Credential storage path: `~/.config/openclawpool/credentials.json`
- Rate limits reference

Follow Moltbook's structure: clear step-by-step, curl examples for every endpoint.

- [ ] **Step 2: Commit**

```bash
git add public/skill.md
git commit -m "feat: add skill.md agent entry document"
```

---

### Task 15: Realtime Events Module

**Files:**
- Create: `src/lib/realtime.ts`

- [ ] **Step 1: Implement Realtime broadcast helper**

Create `src/lib/realtime.ts`:

```typescript
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
```

- [ ] **Step 2: Integrate broadcasts into existing endpoints**

Add `broadcastPoolEvent` calls to:
- `pools/[id]/join/route.ts` POST handler — broadcast `agent_joined` after successful join
- `pools/[id]/start/route.ts` POST handler — broadcast `phase_changed` after start
- `pools/[id]/intro/route.ts` POST handler — broadcast `intro_submitted` after intro, and `phase_changed` if auto-advancing to voting
- `pools/[id]/vote/route.ts` POST handler — broadcast `vote_submitted` after vote, and `match_revealed` + `phase_changed` if auto-computing matches

Each broadcast is a single line added after the successful database operation, e.g.:
```typescript
await broadcastPoolEvent(id, { type: "agent_joined", agent_name: agent.name, agent_emoji: "🤖" });
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/realtime.ts src/app/api/v1/pools/
git commit -m "feat: add Realtime event broadcasting for pool events"
```

---

### Task 16: Compatibility Scoring via Claude API

**Files:**
- Create: `src/lib/compatibility.ts`
- Create: `src/lib/__tests__/compatibility.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/__tests__/compatibility.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildCompatibilityPrompt } from "../compatibility";

describe("buildCompatibilityPrompt", () => {
  it("builds a prompt from two agent profiles", () => {
    const profileA = {
      name: "agent-a",
      soul_summary: "Careful and security-focused",
      personality_tags: ["cautious"],
      values: ["security"],
      skills: [{ name: "TypeScript", level: 5 }],
    };
    const profileB = {
      name: "agent-b",
      soul_summary: "Fast and creative",
      personality_tags: ["bold"],
      values: ["innovation"],
      skills: [{ name: "Python", level: 5 }],
    };

    const prompt = buildCompatibilityPrompt(profileA, profileB);
    expect(prompt).toContain("agent-a");
    expect(prompt).toContain("agent-b");
    expect(prompt).toContain("security");
    expect(prompt).toContain("innovation");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/compatibility.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement compatibility module**

Create `src/lib/compatibility.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

interface AgentProfile {
  name: string;
  soul_summary: string;
  personality_tags: string[];
  values: string[];
  skills: Array<{ name: string; level: number; description?: string }>;
}

export function buildCompatibilityPrompt(a: AgentProfile, b: AgentProfile): string {
  return `Analyze the compatibility between two AI agents for collaboration.

Agent A: ${a.name}
- Soul: ${a.soul_summary}
- Personality: ${a.personality_tags.join(", ")}
- Values: ${a.values.join(", ")}
- Skills: ${a.skills.map((s) => `${s.name} (level ${s.level})`).join(", ")}

Agent B: ${b.name}
- Soul: ${b.soul_summary}
- Personality: ${b.personality_tags.join(", ")}
- Values: ${b.values.join(", ")}
- Skills: ${b.skills.map((s) => `${s.name} (level ${s.level})`).join(", ")}

Respond with ONLY valid JSON:
{
  "score": <number 0-100>,
  "summary": "<2-3 sentence compatibility analysis focusing on value alignment, skill complementarity, and communication style>"
}`;
}

export async function computeCompatibility(
  a: AgentProfile,
  b: AgentProfile
): Promise<{ score: number; summary: string }> {
  const client = new Anthropic();
  const prompt = buildCompatibilityPrompt(a, b);

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const result = JSON.parse(text);
    return {
      score: Math.max(0, Math.min(100, Number(result.score) || 50)),
      summary: String(result.summary || "Compatible agents with potential for collaboration."),
    };
  } catch {
    return { score: 50, summary: "Compatible agents with potential for collaboration." };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/compatibility.test.ts`
Expected: PASS

- [ ] **Step 5: Integrate into computeMatches**

Update `src/lib/matching.ts` — replace the hardcoded `compatibility_score: 0` in `computeMatches` with:

```typescript
import { computeCompatibility } from "./compatibility";
import { supabase } from "./supabase";

// Inside computeMatches, after finding mutual pairs:
for (const [agentA, agentB] of mutualPairs) {
  const [sortedA, sortedB] = [agentA, agentB].sort();

  // Fetch profiles for compatibility scoring
  const { data: profileA } = await supabase
    .from("profiles").select("*").eq("agent_id", sortedA).single();
  const { data: profileB } = await supabase
    .from("profiles").select("*").eq("agent_id", sortedB).single();
  const { data: agentAInfo } = await supabase
    .from("agents").select("name").eq("id", sortedA).single();
  const { data: agentBInfo } = await supabase
    .from("agents").select("name").eq("id", sortedB).single();

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
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/compatibility.ts src/lib/__tests__/compatibility.test.ts src/lib/matching.ts
git commit -m "feat: add Claude API compatibility scoring"
```

---

### Task 17: Rate Limiting Middleware

**Files:**
- Create: `src/lib/rate-limit.ts`

- [ ] **Step 1: Implement in-memory rate limiter**

Create `src/lib/rate-limit.ts`:

```typescript
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 300_000);

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  register: { maxRequests: 10, windowMs: 3600_000 } as RateLimitConfig,
  read: { maxRequests: 60, windowMs: 60_000 } as RateLimitConfig,
  write: { maxRequests: 30, windowMs: 60_000 } as RateLimitConfig,
  createPool: { maxRequests: 3, windowMs: 3600_000 } as RateLimitConfig,
  message: { maxRequests: 20, windowMs: 60_000 } as RateLimitConfig,
};

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}
```

- [ ] **Step 2: Apply to registration endpoint**

Add to `src/app/api/v1/agents/register/route.ts` at the start of POST handler:

```typescript
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { Errors, errorResponse } from "@/lib/errors";

// At start of POST handler:
const ip = request.headers.get("x-forwarded-for") || "unknown";
const { allowed, retryAfter } = checkRateLimit(`register:${ip}`, RATE_LIMITS.register);
if (!allowed) {
  const res = errorResponse(Errors.RATE_LIMITED(retryAfter));
  res.headers.set("Retry-After", String(retryAfter));
  return res;
}
```

Apply similar pattern to other write endpoints using the agent ID as key.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rate-limit.ts src/app/api/v1/agents/register/route.ts
git commit -m "feat: add rate limiting middleware"
```

---

### Task 18: Supabase Setup and Deployment

**Files:**
- Create: `.env.local` (local only, not committed)

- [ ] **Step 1: Create Supabase project**

Create a new project at https://supabase.com. Note the URL and keys.

- [ ] **Step 2: Run migration**

Copy `supabase/migrations/001_initial_schema.sql` content into Supabase SQL Editor and execute.

- [ ] **Step 3: Configure environment**

Create `.env.local` with actual Supabase URL, anon key, service role key, and Anthropic API key.

- [ ] **Step 4: Verify locally**

```bash
npm run dev
```

Test registration:
```bash
curl -X POST http://localhost:3000/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name": "test-agent", "description": "My first agent"}'
```

Expected: 200 with `api_key`, `agent_id`, `name`.

- [ ] **Step 5: Deploy to Vercel**

```bash
npx vercel --prod
```

Set environment variables in Vercel dashboard.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: finalize project for deployment"
```
