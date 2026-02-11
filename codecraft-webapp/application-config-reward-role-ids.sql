-- Multiple roles per application type: reviewer chooses which role to assign when approving (e.g. Head Admin vs Transfer Admin).
ALTER TABLE public.application_configs
  ADD COLUMN IF NOT EXISTS reward_role_ids JSONB DEFAULT NULL;
COMMENT ON COLUMN public.application_configs.reward_role_ids IS 'Array of Discord role IDs. When approving, reviewer picks one to assign. If one role, auto-assign; if multiple, show select menu.';
