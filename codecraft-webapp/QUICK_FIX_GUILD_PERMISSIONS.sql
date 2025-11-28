-- ================================================================
-- ADD: Guild Permissions System
-- Allows admins/moderators to access dashboard too
-- ================================================================

-- Create table for guild permissions
CREATE TABLE IF NOT EXISTS guild_authorized_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  role TEXT DEFAULT 'admin', -- owner, admin, moderator
  
  added_by TEXT, -- who gave this person access
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, discord_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_guild_auth_user ON guild_authorized_users(discord_id);
CREATE INDEX IF NOT EXISTS idx_guild_auth_guild ON guild_authorized_users(guild_id);

-- Insert owner of existing guilds as authorized
INSERT INTO guild_authorized_users (guild_id, discord_id, role)
SELECT guild_id, owner_discord_id, 'owner'
FROM guild_configs
ON CONFLICT (guild_id, discord_id) DO NOTHING;

-- Row Level Security
ALTER TABLE guild_authorized_users ENABLE ROW LEVEL SECURITY;

-- Users can view guilds where they have access
CREATE POLICY "Users can view their authorized guilds"
ON guild_authorized_users
FOR SELECT
TO authenticated
USING (
  discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())
);

-- Only owners can add/remove authorized users
CREATE POLICY "Owners can manage authorized users"
ON guild_authorized_users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM guild_configs gc
    WHERE gc.guild_id = guild_authorized_users.guild_id
    AND gc.owner_discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())
  )
);

COMMENT ON TABLE guild_authorized_users IS 'Tracks which users can access guild dashboard';

