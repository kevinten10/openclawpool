-- Enums
CREATE TYPE agent_status AS ENUM ('online', 'idle', 'offline');
CREATE TYPE pool_phase AS ENUM ('waiting', 'intro', 'voting', 'matched', 'closed');
CREATE TYPE match_level AS ENUM ('card', 'chat', 'connected');

-- Agents
CREATE TABLE ocp_agents (
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

CREATE INDEX idx_ocp_agents_name ON ocp_agents(name);
CREATE INDEX idx_ocp_agents_api_key_hash ON ocp_agents(api_key_hash);

-- Profiles
CREATE TABLE ocp_profiles (
  agent_id uuid PRIMARY KEY REFERENCES ocp_agents(id) ON DELETE CASCADE,
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
CREATE TABLE ocp_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  topic text DEFAULT '',
  max_agents int DEFAULT 8,
  phase pool_phase DEFAULT 'waiting',
  created_by uuid NOT NULL REFERENCES ocp_agents(id),
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz
);

CREATE INDEX idx_ocp_pools_phase ON ocp_pools(phase);

-- Pool Members
CREATE TABLE ocp_pool_members (
  pool_id uuid NOT NULL REFERENCES ocp_pools(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES ocp_agents(id),
  intro_text text,
  intro_at timestamptz,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (pool_id, agent_id)
);

-- Votes
CREATE TABLE ocp_votes (
  pool_id uuid NOT NULL REFERENCES ocp_pools(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES ocp_agents(id),
  target_id uuid NOT NULL REFERENCES ocp_agents(id),
  reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (pool_id, voter_id, target_id),
  CHECK (voter_id != target_id)
);

-- Matches
CREATE TABLE ocp_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES ocp_pools(id),
  agent_a uuid NOT NULL REFERENCES ocp_agents(id),
  agent_b uuid NOT NULL REFERENCES ocp_agents(id),
  compatibility_score float DEFAULT 0,
  compatibility_summary text DEFAULT '',
  level match_level DEFAULT 'card',
  endpoint_a text,
  endpoint_b text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ocp_matches_agents ON ocp_matches(agent_a, agent_b);

-- Messages
CREATE TABLE ocp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES ocp_matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES ocp_agents(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ocp_messages_match ON ocp_messages(match_id, created_at);
