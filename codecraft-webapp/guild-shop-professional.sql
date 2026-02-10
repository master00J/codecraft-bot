-- =============================================================================
-- Shop professional: categories, coupons, item fields, audit log, settings
-- Run after guild-shop-extended-schema.sql. Safe (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Categories (per guild)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guild_shop_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guild_configs(guild_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#5865F2',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_shop_categories_guild ON public.guild_shop_categories(guild_id);
COMMENT ON TABLE public.guild_shop_categories IS 'Per-guild shop categories for grouping items (e.g. Roles, Perks, Gift cards).';

ALTER TABLE public.guild_shop_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only guild_shop_categories" ON public.guild_shop_categories;
CREATE POLICY "Service role only guild_shop_categories"
  ON public.guild_shop_categories FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Item category reference
ALTER TABLE public.guild_shop_items
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.guild_shop_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_guild_shop_items_category ON public.guild_shop_items(category_id);

-- -----------------------------------------------------------------------------
-- 2. Item fields: image, compare_at_price, max_quantity_per_user
-- -----------------------------------------------------------------------------
ALTER TABLE public.guild_shop_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.guild_shop_items
  ADD COLUMN IF NOT EXISTS compare_at_price_cents INTEGER CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents >= 0);
ALTER TABLE public.guild_shop_items
  ADD COLUMN IF NOT EXISTS max_quantity_per_user INTEGER DEFAULT NULL CHECK (max_quantity_per_user IS NULL OR max_quantity_per_user >= 1);

COMMENT ON COLUMN public.guild_shop_items.image_url IS 'Optional product image URL for store front.';
COMMENT ON COLUMN public.guild_shop_items.compare_at_price_cents IS 'Original price for strikethrough (e.g. sale price).';
COMMENT ON COLUMN public.guild_shop_items.max_quantity_per_user IS 'Max one-time purchases or active subscriptions per user (null = unlimited).';

-- -----------------------------------------------------------------------------
-- 3. Coupons
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guild_shop_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guild_configs(guild_id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value_cents INTEGER NOT NULL CHECK (discount_value_cents > 0),
  max_redemptions INTEGER DEFAULT NULL,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(guild_id, code)
);

CREATE INDEX IF NOT EXISTS idx_guild_shop_coupons_guild ON public.guild_shop_coupons(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_shop_coupons_code ON public.guild_shop_coupons(guild_id, code);
COMMENT ON TABLE public.guild_shop_coupons IS 'Per-guild discount codes; percentage or fixed amount.';

ALTER TABLE public.guild_shop_coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only guild_shop_coupons" ON public.guild_shop_coupons;
CREATE POLICY "Service role only guild_shop_coupons"
  ON public.guild_shop_coupons FOR ALL TO service_role USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 4. Store settings: trust badges, testimonials, terms, refund, currency disclaimer
-- -----------------------------------------------------------------------------
ALTER TABLE public.guild_shop_settings
  ADD COLUMN IF NOT EXISTS trust_badges_json JSONB DEFAULT NULL;
ALTER TABLE public.guild_shop_settings
  ADD COLUMN IF NOT EXISTS testimonials_json JSONB DEFAULT NULL;
ALTER TABLE public.guild_shop_settings
  ADD COLUMN IF NOT EXISTS terms_url TEXT DEFAULT NULL;
ALTER TABLE public.guild_shop_settings
  ADD COLUMN IF NOT EXISTS refund_policy_url TEXT DEFAULT NULL;
ALTER TABLE public.guild_shop_settings
  ADD COLUMN IF NOT EXISTS currency_disclaimer TEXT DEFAULT NULL;

COMMENT ON COLUMN public.guild_shop_settings.trust_badges_json IS 'Array of { text, icon? } for trust badges.';
COMMENT ON COLUMN public.guild_shop_settings.testimonials_json IS 'Array of { quote, author? } for testimonials.';
COMMENT ON COLUMN public.guild_shop_settings.currency_disclaimer IS 'Optional text e.g. "Prices in EUR".';

-- -----------------------------------------------------------------------------
-- 5. Sales/orders view source: guild_shop_orders for tracking (optional denormalized)
-- We use guild_shop_codes + guild_shop_subscriptions for "sales". For one-time
-- role/code we have guild_shop_codes (stripe_session_id / paypal). For subs we have
-- guild_shop_subscriptions. Add a simple orders log for dashboard "Recent sales".
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guild_shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guild_configs(guild_id) ON DELETE CASCADE,
  shop_item_id UUID NOT NULL REFERENCES public.guild_shop_items(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  delivery_type TEXT NOT NULL DEFAULT 'role' CHECK (delivery_type IN ('role', 'code', 'prefilled')),
  stripe_session_id TEXT,
  paypal_capture_id TEXT,
  subscription_id UUID REFERENCES public.guild_shop_subscriptions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_shop_orders_guild ON public.guild_shop_orders(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_shop_orders_created ON public.guild_shop_orders(guild_id, created_at DESC);
COMMENT ON TABLE public.guild_shop_orders IS 'Denormalized sales log for dashboard; populated by webhook and checkout.';

ALTER TABLE public.guild_shop_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only guild_shop_orders" ON public.guild_shop_orders;
CREATE POLICY "Service role only guild_shop_orders"
  ON public.guild_shop_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 6. Audit log for support
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guild_shop_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guild_configs(guild_id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_shop_audit_guild ON public.guild_shop_audit_log(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_shop_audit_created ON public.guild_shop_audit_log(guild_id, created_at DESC);
COMMENT ON TABLE public.guild_shop_audit_log IS 'Audit trail: order_created, role_assigned, subscription_cancelled, revoke_by_scheduler, etc.';

ALTER TABLE public.guild_shop_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only guild_shop_audit_log" ON public.guild_shop_audit_log;
CREATE POLICY "Service role only guild_shop_audit_log"
  ON public.guild_shop_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 7. Store analytics (optional: page views, item clicks)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guild_shop_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guild_configs(guild_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  shop_item_id UUID REFERENCES public.guild_shop_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_shop_analytics_guild ON public.guild_shop_analytics(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_shop_analytics_created ON public.guild_shop_analytics(guild_id, created_at DESC);
COMMENT ON TABLE public.guild_shop_analytics IS 'Store page views and item click events.';

ALTER TABLE public.guild_shop_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only guild_shop_analytics" ON public.guild_shop_analytics;
CREATE POLICY "Service role only guild_shop_analytics"
  ON public.guild_shop_analytics FOR ALL TO service_role USING (true) WITH CHECK (true);
