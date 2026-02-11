-- Dashboard menu visibility: hide navbar items per guild
ALTER TABLE public.guild_configs
  ADD COLUMN IF NOT EXISTS menu_hidden JSONB DEFAULT NULL;

COMMENT ON COLUMN public.guild_configs.menu_hidden IS 'JSONB array of menu item names to hide from the dashboard sidebar. Example: ["Casino", "Polls"].';
