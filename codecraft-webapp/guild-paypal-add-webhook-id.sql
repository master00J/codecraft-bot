-- Add webhook_id to guild_paypal_config if the table was created without it (e.g. earlier migration).
ALTER TABLE public.guild_paypal_config
  ADD COLUMN IF NOT EXISTS webhook_id TEXT;

COMMENT ON COLUMN public.guild_paypal_config.webhook_id IS 'Webhook ID from PayPal Developer Dashboard (for verifying shop payment webhooks).';
