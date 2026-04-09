-- Rate limiting table for distributed rate limiting
CREATE TABLE IF NOT EXISTS ocp_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index for efficient cleanup and lookups
CREATE INDEX IF NOT EXISTS idx_ocp_rate_limits_key_window 
ON ocp_rate_limits(key, window_start);

-- Index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_ocp_rate_limits_window_start 
ON ocp_rate_limits(window_start);

-- Add expires_at column to agents for API key expiration
ALTER TABLE ocp_agents 
ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Add key rotation tracking
ALTER TABLE ocp_agents 
ADD COLUMN IF NOT EXISTS key_rotated_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN ocp_agents.expires_at IS 'API key expiration timestamp. NULL means no expiration.';
COMMENT ON COLUMN ocp_agents.key_rotated_at IS 'Last time the API key was rotated.';

-- Row Level Security for rate_limits (optional, for multi-tenant scenarios)
ALTER TABLE ocp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limits
CREATE POLICY "Service role only" ON ocp_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Cleanup old rate limit records (can be run periodically)
-- DELETE FROM ocp_rate_limits WHERE window_start < now() - interval '1 hour';
