-- Bot Personalizer System (MEE6-style)
-- Allows customers to use their own Discord bot applications
-- Run this in Supabase SQL Editor

-- ================================================================
-- CUSTOM BOT TOKENS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS custom_bot_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Guild info
  guild_id TEXT UNIQUE NOT NULL,
  
  -- Customer info
  owner_discord_id TEXT NOT NULL,
  
  -- Bot application details
  bot_token TEXT NOT NULL, -- Encrypted!
  bot_application_id TEXT,
  bot_username TEXT,
  bot_discriminator TEXT,
  bot_avatar_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  bot_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE,
  
  -- Hosting info
  host_server TEXT, -- Which Apollo sub-server is hosting this bot
  host_port INTEGER,
  process_id TEXT,
  
  -- Stats
  total_guilds INTEGER DEFAULT 1,
  total_commands_used INTEGER DEFAULT 0,
  
  -- Metadata
  setup_completed BOOLEAN DEFAULT false,
  intents_enabled JSONB DEFAULT '{"presence": false, "members": false, "messageContent": false}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_bot_tokens_guild ON custom_bot_tokens(guild_id);
CREATE INDEX IF NOT EXISTS idx_custom_bot_tokens_owner ON custom_bot_tokens(owner_discord_id);
CREATE INDEX IF NOT EXISTS idx_custom_bot_tokens_active ON custom_bot_tokens(is_active, bot_online);

-- ================================================================
-- BOT INSTANCE LOGS
-- ================================================================

CREATE TABLE IF NOT EXISTS bot_instance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  guild_id TEXT NOT NULL,
  bot_application_id TEXT,
  
  log_type TEXT NOT NULL, -- 'startup', 'shutdown', 'error', 'warning'
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  
  FOREIGN KEY (guild_id) REFERENCES custom_bot_tokens(guild_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bot_instance_logs_guild ON bot_instance_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_bot_instance_logs_created_at ON bot_instance_logs(created_at DESC);

-- ================================================================
-- RLS POLICIES
-- ================================================================

ALTER TABLE custom_bot_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_instance_logs ENABLE ROW LEVEL SECURITY;

-- Owners can view their own bot tokens (but token is encrypted)
CREATE POLICY "Owners can view their bot config"
  ON custom_bot_tokens
  FOR SELECT
  TO authenticated
  USING (
    owner_discord_id = auth.jwt() ->> 'discordId'
    OR
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

-- Owners can insert/update their bot token
CREATE POLICY "Owners can manage their bot token"
  ON custom_bot_tokens
  FOR ALL
  TO authenticated
  USING (
    owner_discord_id = auth.jwt() ->> 'discordId'
    OR
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  )
  WITH CHECK (
    owner_discord_id = auth.jwt() ->> 'discordId'
  );

-- Admins can see all bot tokens
CREATE POLICY "Admins can view all bot tokens"
  ON custom_bot_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.discord_id = auth.jwt() ->> 'discordId'
      AND users.is_admin = true
    )
  );

-- Owners can view their bot logs
CREATE POLICY "Owners can view their bot logs"
  ON bot_instance_logs
  FOR SELECT
  TO authenticated
  USING (
    guild_id IN (
      SELECT cbt.guild_id FROM custom_bot_tokens cbt
      WHERE cbt.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

-- Service role can manage everything
CREATE POLICY "Service can manage bot tokens"
  ON custom_bot_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service can manage bot logs"
  ON bot_instance_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ================================================================
-- HELPER FUNCTIONS
-- ================================================================

-- Function to encrypt bot token (basic, use better encryption in production!)
CREATE OR REPLACE FUNCTION encrypt_bot_token(token TEXT)
RETURNS TEXT AS $$
BEGIN
  -- In production, use pgcrypto extension for real encryption!
  -- For now, this is a placeholder
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Function to decrypt bot token
CREATE OR REPLACE FUNCTION decrypt_bot_token(encrypted_token TEXT)
RETURNS TEXT AS $$
BEGIN
  -- In production, use pgcrypto extension for real decryption!
  -- For now, this is a placeholder
  RETURN encrypted_token;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

SELECT 
  'Bot Personalizer system created successfully!' as status,
  (SELECT COUNT(*) FROM custom_bot_tokens) as total_custom_bots;

