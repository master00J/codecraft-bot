-- =============================================================================
-- Codecraft / ComCraft update v3.0.1
-- Schema changes for: Shop (roles + gift cards), Stripe webhook, PayPal.
-- Safe to run on existing databases (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Stripe: webhook signing secret per guild (for shop role/code delivery)
-- -----------------------------------------------------------------------------
ALTER TABLE public.guild_stripe_config
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT;

COMMENT ON COLUMN public.guild_stripe_config.stripe_webhook_secret IS 'Stripe webhook signing secret for this guild; used to verify checkout.session.completed.';

-- -----------------------------------------------------------------------------
-- 2. Shop items table (if not already created)
-- -----------------------------------------------------------------------------
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

COMMENT ON TABLE public.guild_shop_items IS 'Per-guild shop items (e.g. buyable roles, gift cards). Payment goes to guild Stripe/PayPal; role or code via webhook.';

ALTER TABLE public.guild_shop_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only guild_shop_items" ON public.guild_shop_items;
CREATE POLICY "Service role only guild_shop_items"
  ON public.guild_shop_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Delivery type: 'role' = assign role on payment; 'code' = gift card (buyer gets code to redeem)
ALTER TABLE public.guild_shop_items
  ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'role' CHECK (delivery_type IN ('role', 'code'));

COMMENT ON COLUMN public.guild_shop_items.delivery_type IS 'role = assign role to buyer on payment; code = generate a code (gift card) for buyer to redeem or give away.';

-- -----------------------------------------------------------------------------
-- 3. PayPal config per guild
-- -----------------------------------------------------------------------------
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

ALTER TABLE public.guild_paypal_config
  ADD COLUMN IF NOT EXISTS webhook_id TEXT;

COMMENT ON TABLE public.guild_paypal_config IS 'Per-guild PayPal app credentials; server owners receive payments directly.';
COMMENT ON COLUMN public.guild_paypal_config.webhook_id IS 'Webhook ID from PayPal Developer Dashboard (for verifying shop payment webhooks).';
COMMENT ON COLUMN public.guild_paypal_config.client_secret IS 'Stored server-side only; never returned to client.';

ALTER TABLE public.guild_paypal_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only guild_paypal_config" ON public.guild_paypal_config;
CREATE POLICY "Service role only guild_paypal_config"
  ON public.guild_paypal_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 4. Shop codes (gift cards): generated on payment, redeemable for role
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guild_shop_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guild_configs(guild_id) ON DELETE CASCADE,
  shop_item_id UUID NOT NULL REFERENCES public.guild_shop_items(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discord_role_id TEXT NOT NULL,
  stripe_session_id TEXT,
  paypal_capture_id TEXT,
  paypal_order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_by_discord_id TEXT,
  UNIQUE(code)
);

CREATE INDEX IF NOT EXISTS idx_guild_shop_codes_code ON public.guild_shop_codes(code);
CREATE INDEX IF NOT EXISTS idx_guild_shop_codes_guild ON public.guild_shop_codes(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_shop_codes_stripe_session ON public.guild_shop_codes(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_guild_shop_codes_paypal_capture ON public.guild_shop_codes(paypal_capture_id);
CREATE INDEX IF NOT EXISTS idx_guild_shop_codes_paypal_order ON public.guild_shop_codes(paypal_order_id);

COMMENT ON TABLE public.guild_shop_codes IS 'Redeemable codes sold as shop items (gift cards). Redeemer gets the role.';

ALTER TABLE public.guild_shop_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only guild_shop_codes" ON public.guild_shop_codes;
CREATE POLICY "Service role only guild_shop_codes"
  ON public.guild_shop_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- Changelog: show v3.0.1 on https://codecraft-solutions.com/en/updates
-- =============================================================================

INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('3.0.1', 'Shop, PayPal & Gift Cards', CURRENT_DATE, 'Shop with role and code delivery, PayPal payments alongside Stripe, and gift card redeem flow.', 'feature', false, true, 1)
ON CONFLICT DO NOTHING;

-- Shop & store
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'Shop: sell roles', 'Sell Discord roles via your server; buyers get the role automatically after payment (Stripe or PayPal).', 'feature', '🛒', 0
FROM updates u WHERE u.version = '3.0.1'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'Shop dashboard & store page', 'Manage shop items in the dashboard and publish a public store page at /comcraft/store/[guildId] for your server.', 'feature', '📦', 1
FROM updates u WHERE u.version = '3.0.1'
ON CONFLICT DO NOTHING;

-- PayPal
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'PayPal alongside Stripe', 'Accept payments and donations via PayPal in addition to Stripe; same flows for Payments, Donations, and Shop.', 'feature', '💳', 2
FROM updates u WHERE u.version = '3.0.1'
ON CONFLICT DO NOTHING;

-- Gift cards
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'Gift cards / codes', 'Shop items can be delivered as a code (gift card). Buyer sees the code on the thank-you page and can share it.', 'feature', '🎁', 3
FROM updates u WHERE u.version = '3.0.1'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'Redeem codes', 'Redeem gift card codes on the store page or via the bot command /redeem; redeemer receives the associated role.', 'feature', '🔑', 4
FROM updates u WHERE u.version = '3.0.1'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'Database update', 'Run update-v3.0.1.sql on your database for new tables and columns (shop items, codes, PayPal config, Stripe webhook secret).', 'improvement', '📋', 5
FROM updates u WHERE u.version = '3.0.1'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- End of update v3.0.1
-- =============================================================================
