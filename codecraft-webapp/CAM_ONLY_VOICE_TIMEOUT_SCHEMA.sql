-- Add per-channel timeout configuration to cam_only_voice_config
-- This allows each voice channel to have its own timeout duration for kicked users

ALTER TABLE cam_only_voice_config 
ADD COLUMN IF NOT EXISTS channel_timeouts JSONB DEFAULT '{}';

COMMENT ON COLUMN cam_only_voice_config.channel_timeouts IS 'JSON object mapping voice channel IDs to timeout configurations. Format: {"voice_channel_id": {"enabled": true, "duration": 60, "unit": "minutes"}, ...}. Units: "minutes", "hours", "days".';

-- Example: {"123456789": {"enabled": true, "duration": 30, "unit": "minutes"}, "111222333": {"enabled": true, "duration": 2, "unit": "hours"}}
-- This means voice channel 123456789 has a 30 minute timeout, and voice channel 111222333 has a 2 hour timeout

-- Table to track user timeouts
CREATE TABLE IF NOT EXISTS cam_only_voice_timeouts (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, user_id, channel_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_cam_voice_timeouts_guild_user ON cam_only_voice_timeouts(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cam_voice_timeouts_channel ON cam_only_voice_timeouts(channel_id);
CREATE INDEX IF NOT EXISTS idx_cam_voice_timeouts_expires ON cam_only_voice_timeouts(expires_at);

-- Enable RLS
ALTER TABLE cam_only_voice_timeouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage cam_only_voice_timeouts"
  ON cam_only_voice_timeouts
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can read their guild cam_only_voice_timeouts"
  ON cam_only_voice_timeouts
  FOR SELECT
  USING (true); -- Public read for now, can be restricted later

COMMENT ON TABLE cam_only_voice_timeouts IS 'Tracks timeout periods for users who were kicked from cam-only voice channels';

