-- =============================================================================
-- Shop extended: store customization + subscription items + subscription tracking
-- Run after existing shop migrations. Safe (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Store customization (per-guild shop branding)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guild_shop_settings (
  guild_id TEXT PRIMARY KEY REFERENCES public.guild_configs(guild_id) ON DELETE CASCADE,
  store_name TEXT,
  store_description TEXT,
  store_primary_color TEXT DEFAULT '#5865F2',
  store_logo_url TEXT,
  store_footer_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.guild_shop_settings IS 'Per-guild store front customization: name, description, color, logo, footer.';
ALTER TABLE public.guild_shop_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only guild_shop_settings" ON public.guild_shop_settings;
CREATE POLICY "Service role only guild_shop_settings"
  ON public.guild_shop_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. Subscription fields on shop items
-- -----------------------------------------------------------------------------
ALTER TABLE public.guild_shop_items
  ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'one_time'
  CHECK (billing_type IN ('one_time', 'subscription'));

ALTER TABLE public.guild_shop_items
  ADD COLUMN IF NOT EXISTS subscription_interval TEXT
  CHECK (subscription_interval IS NULL OR subscription_interval IN ('month', 'year'));

ALTER TABLE public.guild_shop_items
  ADD COLUMN IF NOT EXISTS subscription_interval_count INTEGER DEFAULT 1
  CHECK (subscription_interval_count IS NULL OR subscription_interval_count >= 1);

COMMENT ON COLUMN public.guild_shop_items.billing_type IS 'one_time = single payment; subscription = recurring, role removed when subscription ends.';
COMMENT ON COLUMN public.guild_shop_items.subscription_interval IS 'For subscription: month or year.';
COMMENT ON COLUMN public.guild_shop_items.subscription_interval_count IS 'For subscription: interval count (e.g. 1 = every month, 3 = every 3 months).';

-- -----------------------------------------------------------------------------
-- 3. Active subscriptions (role access; revoke when period ends or cancelled)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guild_shop_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guild_configs(guild_id) ON DELETE CASCADE,
  shop_item_id UUID NOT NULL REFERENCES public.guild_shop_items(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  paypal_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(guild_id, shop_item_id, discord_user_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_shop_subs_guild ON public.guild_shop_subscriptions(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_shop_subs_period ON public.guild_shop_subscriptions(status, current_period_end)
  WHERE status = 'active';

COMMENT ON TABLE public.guild_shop_subscriptions IS 'Active role subscriptions; bot revokes role when current_period_end passed or subscription cancelled.';
ALTER TABLE public.guild_shop_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only guild_shop_subscriptions" ON public.guild_shop_subscriptions;
CREATE POLICY "Service role only guild_shop_subscriptions"
  ON public.guild_shop_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
