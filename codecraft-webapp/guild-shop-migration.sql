-- Shop: server owners can sell roles (or other products). Payment via their Stripe; role assigned on success.

-- Add webhook secret to Stripe config (for verifying Stripe webhooks per guild)
ALTER TABLE public.guild_stripe_config
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT;

COMMENT ON COLUMN public.guild_stripe_config.stripe_webhook_secret IS 'Stripe webhook signing secret for this guild; used to verify checkout.session.completed.';

-- Shop items: name, price, Discord role to assign
CREATE TABLE IF NOT EXISTS public.guild_shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guild_configs(guild_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_amount_cents INTEGER NOT NULL CHECK (price_amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'eur',
  discord_role_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_shop_items_guild_id ON public.guild_shop_items(guild_id);

COMMENT ON TABLE public.guild_shop_items IS 'Per-guild shop items (e.g. buyable roles). Payment goes to guild Stripe; role assigned via webhook.';

ALTER TABLE public.guild_shop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only guild_shop_items"
  ON public.guild_shop_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
