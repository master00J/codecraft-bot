-- Application config: optional custom text shown in the Discord embed (requirements, expectations, etc.)
ALTER TABLE public.application_configs
  ADD COLUMN IF NOT EXISTS embed_description TEXT DEFAULT NULL;
COMMENT ON COLUMN public.application_configs.embed_description IS 'Optional custom text shown in the application embed in Discord (e.g. requirements, expectations).';
