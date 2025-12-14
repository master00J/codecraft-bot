-- Add authorized roles support to guild permissions system
-- Allows guild owners to grant dashboard access based on Discord roles

CREATE TABLE IF NOT EXISTS guild_authorized_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL, -- Discord role ID
  added_by TEXT, -- Discord ID of who added this role
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_auth_role_guild ON guild_authorized_roles(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_auth_role_role ON guild_authorized_roles(role_id);

-- Row Level Security
ALTER TABLE guild_authorized_roles ENABLE ROW LEVEL SECURITY;

-- Users can view authorized roles for their guilds
CREATE POLICY "Users can view authorized roles"
ON guild_authorized_roles
FOR SELECT
TO authenticated
USING (
  guild_id IN (
    SELECT gc.guild_id FROM guild_configs gc
    WHERE gc.owner_discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())
  )
  OR
  guild_id IN (
    SELECT gau.guild_id FROM guild_authorized_users gau
    WHERE gau.discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())
  )
);

-- Only owners can manage authorized roles
CREATE POLICY "Owners can manage authorized roles"
ON guild_authorized_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM guild_configs gc
    WHERE gc.guild_id = guild_authorized_roles.guild_id
    AND gc.owner_discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())
  )
);

COMMENT ON TABLE guild_authorized_roles IS 'Discord roles that grant dashboard access';






