-- Applications: multiple application types (functies) per guild
-- Each guild can have multiple configs: e.g. "Moderator", "Helper", "Event team"

-- 1. Add name column to application_configs (nullable first for existing rows)
ALTER TABLE public.application_configs
  ADD COLUMN IF NOT EXISTS name TEXT;

-- 2. Set default name for existing configs so they become "Staff" type
UPDATE public.application_configs
  SET name = 'Staff'
  WHERE name IS NULL;

-- 3. Make name required and set default for new rows
ALTER TABLE public.application_configs
  ALTER COLUMN name SET DEFAULT 'Staff';
ALTER TABLE public.application_configs
  ALTER COLUMN name SET NOT NULL;

-- 4. Drop old unique constraint on guild_id (one config per guild)
ALTER TABLE public.application_configs
  DROP CONSTRAINT IF EXISTS application_configs_guild_id_key;

-- 5. Unique per guild + name (one config per "function" per guild)
ALTER TABLE public.application_configs
  DROP CONSTRAINT IF EXISTS application_configs_guild_id_name_key;
ALTER TABLE public.application_configs
  ADD CONSTRAINT application_configs_guild_id_name_key UNIQUE (guild_id, name);

-- 6. Add config_id to applications to link to which type was applied for
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS config_id UUID REFERENCES public.application_configs(id) ON DELETE SET NULL;

-- 7. Backfill: link existing applications to the single config for that guild
UPDATE public.applications a
  SET config_id = c.id
  FROM public.application_configs c
  WHERE a.guild_id = c.guild_id
    AND a.config_id IS NULL;

-- 8. Index for filtering applications by type
CREATE INDEX IF NOT EXISTS idx_applications_config_id ON public.applications(config_id);

COMMENT ON COLUMN public.application_configs.name IS 'Application type name, e.g. Moderator, Helper. One config per name per guild.';
COMMENT ON COLUMN public.applications.config_id IS 'Which application type (config) this submission is for.';
