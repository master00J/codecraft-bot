-- Terms and Refund policy content (optional text, shown on store pages).
-- Run after guild-shop-professional.sql.
ALTER TABLE public.guild_shop_settings
  ADD COLUMN IF NOT EXISTS terms_content TEXT DEFAULT NULL;
ALTER TABLE public.guild_shop_settings
  ADD COLUMN IF NOT EXISTS refund_policy_content TEXT DEFAULT NULL;
COMMENT ON COLUMN public.guild_shop_settings.terms_content IS 'Optional terms of sale text; shown on store if set (else terms_url link is used).';
COMMENT ON COLUMN public.guild_shop_settings.refund_policy_content IS 'Optional refund policy text; shown on store if set (else refund_policy_url link is used).';
