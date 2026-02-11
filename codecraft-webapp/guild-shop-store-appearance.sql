-- Store page appearance: background image + color palettes
-- Run after guild_shop_settings exists.

ALTER TABLE public.guild_shop_settings
  ADD COLUMN IF NOT EXISTS store_background_image_url TEXT,
  ADD COLUMN IF NOT EXISTS store_color_preset TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS store_secondary_color TEXT,
  ADD COLUMN IF NOT EXISTS store_background_color TEXT;

COMMENT ON COLUMN public.guild_shop_settings.store_background_image_url IS 'Optional full-page background image URL for the public store page.';
COMMENT ON COLUMN public.guild_shop_settings.store_color_preset IS 'Color palette: default, dark, ocean, forest, sunset, custom.';
COMMENT ON COLUMN public.guild_shop_settings.store_secondary_color IS 'Secondary/accent hex color; used when preset is custom or to override.';
COMMENT ON COLUMN public.guild_shop_settings.store_background_color IS 'Page background hex color; used when preset is custom or with background image overlay.';
