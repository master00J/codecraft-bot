-- Voice Chat Role Configuration Schema
-- Automatically assigns/removes a role when users join/leave voice channels

CREATE TABLE IF NOT EXISTS voice_chat_role_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  role_id TEXT, -- Discord role ID to assign
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_voice_chat_role_config_guild ON voice_chat_role_config(guild_id);
CREATE INDEX IF NOT EXISTS idx_voice_chat_role_config_enabled ON voice_chat_role_config(guild_id, enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE voice_chat_role_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow service role full access
CREATE POLICY "Service role can manage voice_chat_role_config"
  ON voice_chat_role_config
  FOR ALL
  USING (auth.role() = 'service_role');

-- Allow authenticated users to read their guild's config
CREATE POLICY "Users can read their guild voice_chat_role_config"
  ON voice_chat_role_config
  FOR SELECT
  USING (true); -- Public read for now, can be restricted later

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_voice_chat_role_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_voice_chat_role_config_updated_at
  BEFORE UPDATE ON voice_chat_role_config
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_chat_role_config_updated_at();

COMMENT ON TABLE voice_chat_role_config IS 'Configuration for automatically assigning/removing roles when users join/leave voice channels';
COMMENT ON COLUMN voice_chat_role_config.role_id IS 'Discord role ID to assign when users join voice channels';

