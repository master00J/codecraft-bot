-- Purchase notification channel: optional Discord channel ID for "someone purchased X" notifications.
-- Run after guild-shop-professional.sql (or any migration that has guild_shop_settings).
ALTER TABLE public.guild_shop_settings
  ADD COLUMN IF NOT EXISTS purchase_notification_channel_id TEXT DEFAULT NULL;
COMMENT ON COLUMN public.guild_shop_settings.purchase_notification_channel_id IS 'Discord channel ID to post a message when someone purchases from the guild shop (e.g. private admin notifications).';
