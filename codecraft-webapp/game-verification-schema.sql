-- Game Verification System
-- Allows servers to verify members with an in-game username (e.g. FC26 Pro Clubs).
-- One-time verification per user optional; admins can update username manually.

-- Config per guild
CREATE TABLE IF NOT EXISTS game_verification_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  game_name TEXT NOT NULL DEFAULT 'In-Game',
  unregistered_role_id TEXT,
  verified_role_id TEXT,
  one_time_only BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_verification_config_guild ON game_verification_config(guild_id);

-- Verified users per guild (one row per user when one_time_only; stores current in-game name)
CREATE TABLE IF NOT EXISTS game_verified_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  in_game_username TEXT NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_verified_users_guild ON game_verified_users(guild_id);
CREATE INDEX IF NOT EXISTS idx_game_verified_users_user ON game_verified_users(guild_id, user_id);

-- RLS
ALTER TABLE game_verification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_verified_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own guild game verification config" ON game_verification_config;
CREATE POLICY "Users can view own guild game verification config"
ON game_verification_config FOR SELECT
USING (
  guild_id IN (SELECT gc.guild_id FROM guild_configs gc WHERE gc.owner_discord_id = current_setting('app.user_discord_id', true))
  OR guild_id IN (SELECT gau.guild_id FROM guild_authorized_users gau WHERE gau.discord_id = current_setting('app.user_discord_id', true))
);

DROP POLICY IF EXISTS "Owners can manage game verification config" ON game_verification_config;
CREATE POLICY "Owners can manage game verification config"
ON game_verification_config FOR ALL
USING (
  guild_id IN (SELECT gc.guild_id FROM guild_configs gc WHERE gc.owner_discord_id = current_setting('app.user_discord_id', true))
  OR guild_id IN (SELECT gau.guild_id FROM guild_authorized_users gau WHERE gau.discord_id = current_setting('app.user_discord_id', true))
);

DROP POLICY IF EXISTS "Users can view own guild verified users" ON game_verified_users;
CREATE POLICY "Users can view own guild verified users"
ON game_verified_users FOR SELECT
USING (
  guild_id IN (SELECT gc.guild_id FROM guild_configs gc WHERE gc.owner_discord_id = current_setting('app.user_discord_id', true))
  OR guild_id IN (SELECT gau.guild_id FROM guild_authorized_users gau WHERE gau.discord_id = current_setting('app.user_discord_id', true))
);

DROP POLICY IF EXISTS "Owners can manage verified users" ON game_verified_users;
CREATE POLICY "Owners can manage verified users"
ON game_verified_users FOR ALL
USING (
  guild_id IN (SELECT gc.guild_id FROM guild_configs gc WHERE gc.owner_discord_id = current_setting('app.user_discord_id', true))
  OR guild_id IN (SELECT gau.guild_id FROM guild_authorized_users gau WHERE gau.discord_id = current_setting('app.user_discord_id', true))
);

COMMENT ON TABLE game_verification_config IS 'Per-guild settings for in-game username verification (e.g. FC26 Pro Clubs)';
COMMENT ON TABLE game_verified_users IS 'Stores verified in-game username per user per guild';
