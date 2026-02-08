-- Guild Stripe config: server owners add their own Stripe keys to receive payments directly.
-- Codecraft does not handle funds; payments go to the server owner's Stripe account.

CREATE TABLE IF NOT EXISTS public.guild_stripe_config (
  guild_id TEXT PRIMARY KEY REFERENCES public.guild_configs(guild_id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  stripe_publishable_key TEXT,
  stripe_secret_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.guild_stripe_config IS 'Per-guild Stripe keys so server owners receive payments directly (no platform intermediary).';
COMMENT ON COLUMN public.guild_stripe_config.stripe_secret_key IS 'Stored server-side only; never returned to client.';

-- RLS: only backend (service role) can read/write; anon/authenticated cannot access secret keys.
ALTER TABLE public.guild_stripe_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only guild_stripe_config"
  ON public.guild_stripe_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
