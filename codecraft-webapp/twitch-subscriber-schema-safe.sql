-- =====================================================
-- Twitch Subscriber Notifications - Safe Migration
-- =====================================================
-- This script safely adds subscriber tracking to the existing Twitch integration
-- Run this in Supabase SQL Editor

-- Add subscriber tracking columns to stream_notifications
DO $$ 
BEGIN
  -- Enable subscriber notifications per stream
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stream_notifications' 
    AND column_name = 'subscriber_notifications_enabled'
  ) THEN
    ALTER TABLE stream_notifications 
    ADD COLUMN subscriber_notifications_enabled BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added column: subscriber_notifications_enabled';
  END IF;

  -- Subscriber notification message template
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stream_notifications' 
    AND column_name = 'subscriber_message_template'
  ) THEN
    ALTER TABLE stream_notifications 
    ADD COLUMN subscriber_message_template TEXT DEFAULT '🎉 {subscriber} just subscribed to {streamer}!';
    RAISE NOTICE 'Added column: subscriber_message_template';
  END IF;

  -- Total subscriber notifications sent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stream_notifications' 
    AND column_name = 'total_subscriber_notifications_sent'
  ) THEN
    ALTER TABLE stream_notifications 
    ADD COLUMN total_subscriber_notifications_sent INTEGER DEFAULT 0;
    RAISE NOTICE 'Added column: total_subscriber_notifications_sent';
  END IF;

  -- Last subscriber notification
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stream_notifications' 
    AND column_name = 'last_subscriber_notification_sent'
  ) THEN
    ALTER TABLE stream_notifications 
    ADD COLUMN last_subscriber_notification_sent TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Added column: last_subscriber_notification_sent';
  END IF;

  -- Twitch EventSub subscription ID (for webhook management)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stream_notifications' 
    AND column_name = 'eventsub_subscription_id'
  ) THEN
    ALTER TABLE stream_notifications 
    ADD COLUMN eventsub_subscription_id TEXT;
    RAISE NOTICE 'Added column: eventsub_subscription_id';
  END IF;

  -- EventSub subscription status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stream_notifications' 
    AND column_name = 'eventsub_subscription_status'
  ) THEN
    ALTER TABLE stream_notifications 
    ADD COLUMN eventsub_subscription_status TEXT; -- 'enabled', 'webhook_callback_verification_pending', 'webhook_callback_verification_failed', etc.
    RAISE NOTICE 'Added column: eventsub_subscription_status';
  END IF;
END $$;

-- Create subscriber_events table to store subscriber history
CREATE TABLE IF NOT EXISTS twitch_subscriber_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to stream notification
  notification_id UUID REFERENCES stream_notifications(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  
  -- Twitch event details
  twitch_event_id TEXT NOT NULL UNIQUE, -- Twitch's unique event ID
  broadcaster_id TEXT NOT NULL, -- Twitch user ID of the streamer
  broadcaster_name TEXT NOT NULL,
  
  -- Subscriber info
  subscriber_id TEXT NOT NULL, -- Twitch user ID of the subscriber
  subscriber_name TEXT NOT NULL,
  subscriber_display_name TEXT,
  
  -- Subscription details
  tier TEXT NOT NULL, -- '1000', '2000', '3000' (Tier 1, 2, 3)
  is_gift BOOLEAN DEFAULT false,
  cumulative_months INTEGER DEFAULT 1, -- How many months subscribed (cumulative)
  streak_months INTEGER DEFAULT 1, -- Current streak months
  gifter_id TEXT, -- If subscription was gifted
  gifter_name TEXT,
  
  -- Notification tracking
  discord_message_id TEXT, -- ID of the Discord message sent
  discord_channel_id TEXT, -- Channel where notification was sent
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for quick lookups
  CONSTRAINT unique_twitch_event UNIQUE (twitch_event_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriber_events_notification_id 
  ON twitch_subscriber_events(notification_id);

CREATE INDEX IF NOT EXISTS idx_subscriber_events_guild_id 
  ON twitch_subscriber_events(guild_id);

CREATE INDEX IF NOT EXISTS idx_subscriber_events_broadcaster_id 
  ON twitch_subscriber_events(broadcaster_id);

CREATE INDEX IF NOT EXISTS idx_subscriber_events_created_at 
  ON twitch_subscriber_events(created_at DESC);

-- Create RLS policies for security
ALTER TABLE twitch_subscriber_events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role can do anything on subscriber events" ON twitch_subscriber_events;
CREATE POLICY "Service role can do anything on subscriber events"
  ON twitch_subscriber_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to view their guild's subscriber events
-- Note: This policy is simplified to allow all authenticated users
-- You can make it more restrictive later based on your guild_members setup
DROP POLICY IF EXISTS "Users can view their guild subscriber events" ON twitch_subscriber_events;
CREATE POLICY "Users can view their guild subscriber events"
  ON twitch_subscriber_events
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- Success Message
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ====================================';
  RAISE NOTICE '✅ Twitch Subscriber Schema Applied!';
  RAISE NOTICE '✅ ====================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 What was added:';
  RAISE NOTICE '   • subscriber_notifications_enabled column';
  RAISE NOTICE '   • subscriber_message_template column';
  RAISE NOTICE '   • total_subscriber_notifications_sent column';
  RAISE NOTICE '   • eventsub_subscription_id column';
  RAISE NOTICE '   • twitch_subscriber_events table';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next Steps:';
  RAISE NOTICE '   1. Update your .env with TWITCH_EVENTSUB_SECRET';
  RAISE NOTICE '   2. Set your public webhook URL in environment';
  RAISE NOTICE '   3. Restart your Discord bot';
  RAISE NOTICE '   4. Enable subscriber notifications in the dashboard';
  RAISE NOTICE '';
END $$;

