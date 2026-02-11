-- Which roles can use which slash commands (e.g. /store only for admins).
-- If no row or allowed_role_ids is null/empty, everyone can use the command.
CREATE TABLE IF NOT EXISTS public.guild_command_permissions (
  guild_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  allowed_role_ids JSONB DEFAULT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (guild_id, command_name)
);

COMMENT ON TABLE public.guild_command_permissions IS 'Optional role restriction per slash command. Empty/null = everyone. Set = only those roles (and server admins) can use the command.';

CREATE INDEX IF NOT EXISTS idx_guild_command_permissions_guild ON public.guild_command_permissions(guild_id);

ALTER TABLE public.guild_command_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage guild_command_permissions" ON public.guild_command_permissions;
CREATE POLICY "Service role can manage guild_command_permissions" ON public.guild_command_permissions FOR ALL USING (true);
