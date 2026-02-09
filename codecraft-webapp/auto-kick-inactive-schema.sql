-- Auto Kick Inactive Members
-- Server owners can enable automatic kicking of members inactive for a configurable number of days.

-- Add columns to guild_configs
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS auto_kick_inactive_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_kick_inactive_days INTEGER;

-- Constraint: days must be between 7 and 365 when enabled (optional, can be enforced in app)
-- COMMENT for documentation
COMMENT ON COLUMN guild_configs.auto_kick_inactive_enabled IS 'When true, members with no activity for auto_kick_inactive_days are automatically kicked';
COMMENT ON COLUMN guild_configs.auto_kick_inactive_days IS 'Number of days of inactivity after which a member is kicked (e.g. 30). Only used when auto_kick_inactive_enabled is true';

CREATE INDEX IF NOT EXISTS idx_guild_configs_auto_kick_inactive
  ON guild_configs(auto_kick_inactive_enabled)
  WHERE auto_kick_inactive_enabled = true;

-- Log of members kicked by auto-kick (for dashboard)
CREATE TABLE IF NOT EXISTS inactive_kick_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  inactive_days INTEGER NOT NULL,
  kicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inactive_kick_logs_guild_at
  ON inactive_kick_logs(guild_id, kicked_at DESC);

COMMENT ON TABLE inactive_kick_logs IS 'Log of members kicked by the auto-kick inactive feature, for dashboard display';
