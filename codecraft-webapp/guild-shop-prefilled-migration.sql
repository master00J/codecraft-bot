-- =============================================================================
-- Pre-filled codes: server owners can sell their own codes (e.g. Amazon gift cards).
-- Run after update-v3.0.1.sql. Adds delivery_type 'prefilled' and code pool.
-- =============================================================================

-- Allow delivery_type 'prefilled' (owner-supplied codes, no redeem in bot)
ALTER TABLE public.guild_shop_items
  DROP CONSTRAINT IF EXISTS guild_shop_items_delivery_type_check;

ALTER TABLE public.guild_shop_items
  ADD CONSTRAINT guild_shop_items_delivery_type_check
  CHECK (delivery_type IN ('role', 'code', 'prefilled'));

COMMENT ON COLUMN public.guild_shop_items.delivery_type IS 'role = assign role on payment; code = generated gift card (redeem for role); prefilled = owner adds codes to sell (e.g. Amazon), buyer gets one.';

-- discord_role_id not needed for prefilled items
ALTER TABLE public.guild_shop_items
  ALTER COLUMN discord_role_id DROP NOT NULL;

-- Pool of codes the owner adds; one is assigned to buyer on payment
CREATE TABLE IF NOT EXISTS public.guild_shop_prefilled_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guild_configs(guild_id) ON DELETE CASCADE,
  shop_item_id UUID NOT NULL REFERENCES public.guild_shop_items(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_shop_prefilled_codes_shop_item
  ON public.guild_shop_prefilled_codes(shop_item_id);
CREATE INDEX IF NOT EXISTS idx_guild_shop_prefilled_codes_guild
  ON public.guild_shop_prefilled_codes(guild_id);

COMMENT ON TABLE public.guild_shop_prefilled_codes IS 'Codes added by server owner to sell (e.g. Amazon gift cards). One is assigned per purchase.';

ALTER TABLE public.guild_shop_prefilled_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only guild_shop_prefilled_codes" ON public.guild_shop_prefilled_codes;
CREATE POLICY "Service role only guild_shop_prefilled_codes"
  ON public.guild_shop_prefilled_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Sold prefilled codes are written to guild_shop_codes (with discord_role_id null)
ALTER TABLE public.guild_shop_codes
  ALTER COLUMN discord_role_id DROP NOT NULL;
