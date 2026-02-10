-- =============================================================================
-- Codecraft / ComCraft update v3.0.2
-- Shop: purchase notifications, PayPal in Recent sales. Giveaways: channel
-- announcement, unlimited duration, join button removed when ended. Bot: /store.
-- Safe to run on existing databases (ADD COLUMN IF NOT EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Shop: optional Discord channel for purchase notifications
-- -----------------------------------------------------------------------------
ALTER TABLE public.guild_shop_settings
  ADD COLUMN IF NOT EXISTS purchase_notification_channel_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.guild_shop_settings.purchase_notification_channel_id IS 'Discord channel ID to post a message when someone purchases from the guild shop (e.g. private admin notifications).';

-- -----------------------------------------------------------------------------
-- 2. Shop codes: link to buyer so they can retrieve code later (thank-you closed)
-- -----------------------------------------------------------------------------
ALTER TABLE public.guild_shop_codes
  ADD COLUMN IF NOT EXISTS buyer_discord_id TEXT DEFAULT NULL;
COMMENT ON COLUMN public.guild_shop_codes.buyer_discord_id IS 'Discord ID of the buyer; so they can fetch their code again from "Your purchased codes" on the store.';
CREATE INDEX IF NOT EXISTS idx_guild_shop_codes_buyer ON public.guild_shop_codes(guild_id, buyer_discord_id) WHERE buyer_discord_id IS NOT NULL AND used_at IS NULL;

-- =============================================================================
-- Changelog: show v3.0.2 on https://codecraft-solutions.com/en/updates
-- =============================================================================

INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('3.0.2', 'Shop notifications, giveaways & /store', CURRENT_DATE, 'Purchase notification channel, PayPal in Recent sales, giveaway improvements, and /store slash command.', 'feature', false, true, 0)
ON CONFLICT DO NOTHING;

-- Shop: purchase notifications
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'Purchase notification channel', 'Choose a private Discord channel to get a message whenever someone buys from your shop (e.g. "User X purchased Premium"). Configure in Dashboard → Shop → Store appearance.', 'feature', '🔔', 0
FROM updates u WHERE u.version = '3.0.2'
ON CONFLICT DO NOTHING;

-- Shop: PayPal in Recent sales
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'PayPal in Recent sales', 'PayPal purchases are now logged in guild_shop_orders and appear in the dashboard "Recent sales" list, with audit log entries for consistency with Stripe.', 'improvement', '📊', 1
FROM updates u WHERE u.version = '3.0.2'
ON CONFLICT DO NOTHING;

-- Giveaways: channel announcement + join button
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'Giveaway winner announcement in channel', 'When a giveaway ends, the bot posts the winner(s) in the same channel so everyone can see who won. DM to winners is unchanged.', 'feature', '🎉', 2
FROM updates u WHERE u.version = '3.0.2'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'Join button removed when giveaway ended', 'The original giveaway message no longer shows a disabled join button after the draw; only the optional link button remains. Cleaner look for ended giveaways.', 'improvement', '🛒', 3
FROM updates u WHERE u.version = '3.0.2'
ON CONFLICT DO NOTHING;

-- Giveaways: unlimited duration
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'Unlimited giveaway duration', 'One-shot and recurring giveaways no longer have a 7-day maximum. You can set any duration (minutes, hours, or days) for both types.', 'improvement', '⏱️', 4
FROM updates u WHERE u.version = '3.0.2'
ON CONFLICT DO NOTHING;

-- Bot: /store command
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'Slash command /store', 'New /store command in Discord: opens the server store with a link button so members can browse and buy roles and premium from the web store.', 'feature', '🛒', 5
FROM updates u WHERE u.version = '3.0.2'
ON CONFLICT DO NOTHING;

-- Database
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT u.id, 'Database update', 'Run update-v3.0.2.sql for the new column guild_shop_settings.purchase_notification_channel_id. No other schema changes required.', 'improvement', '📋', 6
FROM updates u WHERE u.version = '3.0.2'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- End of update v3.0.2
-- =============================================================================
