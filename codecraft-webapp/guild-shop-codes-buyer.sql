-- Link sold codes to buyer so they can retrieve codes later (e.g. if thank-you page was closed).
ALTER TABLE public.guild_shop_codes
  ADD COLUMN IF NOT EXISTS buyer_discord_id TEXT DEFAULT NULL;
COMMENT ON COLUMN public.guild_shop_codes.buyer_discord_id IS 'Discord ID of the buyer; used so they can fetch their code again from "My codes" on the store.';

CREATE INDEX IF NOT EXISTS idx_guild_shop_codes_buyer ON public.guild_shop_codes(guild_id, buyer_discord_id) WHERE buyer_discord_id IS NOT NULL AND used_at IS NULL;
