-- Update Notifications System Schema
-- Allows server owners to receive automatic notifications about new bot updates

-- Add columns to guild_configs for update notifications preferences
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS update_notifications_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS update_notification_channel_id TEXT, -- Custom channel for notifications (null = DM/system channel)
  ADD COLUMN IF NOT EXISTS update_notification_types TEXT[] DEFAULT ARRAY['feature', 'improvement', 'bugfix', 'security', 'breaking']::TEXT[], -- Which update types to receive
  ADD COLUMN IF NOT EXISTS update_notification_role_ids TEXT[] DEFAULT ARRAY[]::TEXT[]; -- Roles to mention (empty = only mention owner)

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guild_configs_update_notifications 
  ON guild_configs(update_notifications_enabled) 
  WHERE update_notifications_enabled = true;

-- Add comments
COMMENT ON COLUMN guild_configs.update_notifications_enabled IS 
  'Whether to send automatic notifications about new bot updates to server owners';
COMMENT ON COLUMN guild_configs.update_notification_channel_id IS 
  'Custom Discord channel ID for update notifications (null = use DM or system channel)';
COMMENT ON COLUMN guild_configs.update_notification_types IS 
  'Array of update types to receive notifications for: feature, improvement, bugfix, security, breaking';
COMMENT ON COLUMN guild_configs.update_notification_role_ids IS 
  'Array of role IDs to mention in update notifications (empty = only mention owner)';

-- Create table to track which updates have been sent to which guilds
CREATE TABLE IF NOT EXISTS update_notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_via TEXT DEFAULT 'dm', -- 'dm' or 'channel'
  channel_id TEXT, -- If sent via channel
  UNIQUE(update_id, guild_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_update_notifications_sent_update_id 
  ON update_notifications_sent(update_id);

CREATE INDEX IF NOT EXISTS idx_update_notifications_sent_guild_id 
  ON update_notifications_sent(guild_id);

CREATE INDEX IF NOT EXISTS idx_update_notifications_sent_sent_at 
  ON update_notifications_sent(sent_at DESC);

-- Add comment
COMMENT ON TABLE update_notifications_sent IS 
  'Tracks which update notifications have been sent to which guilds to prevent duplicates';

