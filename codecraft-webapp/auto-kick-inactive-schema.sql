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
