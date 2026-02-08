-- Guild PayPal config: server owners add their own PayPal app (Client ID + Secret) to receive payments.
-- Payments go directly to the server owner's PayPal account; Codecraft does not handle funds.

CREATE TABLE IF NOT EXISTS public.guild_paypal_config (
  guild_id TEXT PRIMARY KEY REFERENCES public.guild_configs(guild_id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  client_id TEXT,
  client_secret TEXT,
  sandbox BOOLEAN NOT NULL DEFAULT true,
  webhook_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.guild_paypal_config IS 'Per-guild PayPal app credentials; server owners receive payments directly.';
COMMENT ON COLUMN public.guild_paypal_config.webhook_id IS 'Webhook ID from PayPal Developer Dashboard (for verifying shop payment webhooks).';
COMMENT ON COLUMN public.guild_paypal_config.client_secret IS 'Stored server-side only; never returned to client.';

ALTER TABLE public.guild_paypal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only guild_paypal_config"
  ON public.guild_paypal_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
