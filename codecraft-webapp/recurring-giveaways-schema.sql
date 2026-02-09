-- Recurring giveaways: server owners set a schedule (interval) and the bot starts a new giveaway automatically.
-- Run after giveaways table exists.

CREATE TABLE IF NOT EXISTS recurring_giveaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  created_by_discord_id TEXT NOT NULL,

  prize TEXT NOT NULL,
  winner_count INTEGER NOT NULL DEFAULT 1,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  required_role_id TEXT,

  interval_hours INTEGER NOT NULL CHECK (interval_hours >= 1 AND interval_hours <= 8760),
  next_run_at TIMESTAMPTZ NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,

  embed_title TEXT,
  embed_description TEXT,
  embed_color TEXT,
  embed_footer TEXT,
  embed_image_url TEXT,
  embed_thumbnail_url TEXT,
  join_button_label TEXT,
  cta_button_label TEXT,
  cta_button_url TEXT,
  reward_role_id TEXT,
  reward_role_remove_after INTEGER,
  reward_dm_message TEXT,
  reward_channel_id TEXT,
  reward_channel_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_giveaways_guild ON recurring_giveaways(guild_id);
CREATE INDEX IF NOT EXISTS idx_recurring_giveaways_next_run ON recurring_giveaways(enabled, next_run_at) WHERE enabled = true;

COMMENT ON TABLE recurring_giveaways IS 'Templates for recurring giveaways; bot starts a new giveaway when next_run_at is reached.';

ALTER TABLE recurring_giveaways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only recurring_giveaways" ON recurring_giveaways;
CREATE POLICY "Service role only recurring_giveaways"
  ON recurring_giveaways FOR ALL TO service_role USING (true) WITH CHECK (true);
