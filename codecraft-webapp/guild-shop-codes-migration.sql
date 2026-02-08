-- Shop codes (gift cards): server owners can sell items that deliver a redeemable code instead of assigning a role immediately.

-- Add delivery type to shop items: 'role' = assign role on payment, 'code' = generate code for buyer to redeem
ALTER TABLE public.guild_shop_items
  ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'role' CHECK (delivery_type IN ('role', 'code'));

COMMENT ON COLUMN public.guild_shop_items.delivery_type IS 'role = assign role to buyer on payment; code = generate a code (gift card) for buyer to redeem or give away.';

-- Generated codes: one row per sold code product (created by Stripe/PayPal webhook)
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

COMMENT ON TABLE public.guild_shop_codes IS 'Redeemable codes sold as shop items (gift cards). Redeemer gets the role.';

ALTER TABLE public.guild_shop_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only guild_shop_codes"
  ON public.guild_shop_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
