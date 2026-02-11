-- Application config: role to assign when an application is approved
ALTER TABLE public.application_configs
  ADD COLUMN IF NOT EXISTS reward_role_id TEXT DEFAULT NULL;
COMMENT ON COLUMN public.application_configs.reward_role_id IS 'Discord role ID to assign to the applicant when the application is approved. Optional.';
