-- Cam-Only Voice Channel Configuration Schema
-- This table stores configuration for voice channels that require camera

CREATE TABLE IF NOT EXISTS cam_only_voice_config (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT false,
  channel_ids TEXT[] DEFAULT '{}', -- Array of voice channel IDs
  grace_period_seconds INTEGER DEFAULT 10, -- Time before disconnecting (5-60 seconds)
  warning_enabled BOOLEAN DEFAULT true, -- Whether to warn before disconnecting
  max_warnings INTEGER DEFAULT 2, -- Max warnings before disconnect (0-5)
  exempt_roles TEXT[] DEFAULT '{}', -- Role IDs that are exempt
  exempt_users TEXT[] DEFAULT '{}', -- User IDs that are exempt
  log_channel_id TEXT, -- Channel to log actions
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cam_only_voice_guild ON cam_only_voice_config(guild_id);
CREATE INDEX IF NOT EXISTS idx_cam_only_voice_enabled ON cam_only_voice_config(enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE cam_only_voice_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow service role full access
CREATE POLICY "Service role can manage cam_only_voice_config"
  ON cam_only_voice_config
  FOR ALL
  USING (auth.role() = 'service_role');

-- Allow authenticated users to read their guild's config (if they have access)
CREATE POLICY "Users can read their guild cam_only_voice_config"
  ON cam_only_voice_config
  FOR SELECT
  USING (true); -- Public read for now, can be restricted later

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_cam_only_voice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cam_only_voice_updated_at
  BEFORE UPDATE ON cam_only_voice_config
  FOR EACH ROW
  EXECUTE FUNCTION update_cam_only_voice_updated_at();

COMMENT ON TABLE cam_only_voice_config IS 'Configuration for voice channels that require camera to be enabled';
COMMENT ON COLUMN cam_only_voice_config.channel_ids IS 'Array of voice channel IDs that require camera';
COMMENT ON COLUMN cam_only_voice_config.grace_period_seconds IS 'Time in seconds before disconnecting users without camera (5-60)';
COMMENT ON COLUMN cam_only_voice_config.warning_enabled IS 'Whether to warn users before disconnecting';
COMMENT ON COLUMN cam_only_voice_config.max_warnings IS 'Maximum number of warnings before disconnecting (0-5)';
COMMENT ON COLUMN cam_only_voice_config.exempt_roles IS 'Array of role IDs that are exempt from camera requirement';
COMMENT ON COLUMN cam_only_voice_config.exempt_users IS 'Array of user IDs that are exempt from camera requirement';

