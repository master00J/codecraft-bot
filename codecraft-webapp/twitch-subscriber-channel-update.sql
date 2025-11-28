-- =====================================================
-- Twitch Subscriber Notifications - Channel Update
-- =====================================================
-- Add separate channel option for subscriber notifications
-- Run this in Supabase SQL Editor after twitch-subscriber-schema-safe.sql

-- Add optional subscriber channel ID
-- Falls back to main channel_id if not set
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stream_notifications' 
    AND column_name = 'subscriber_channel_id'
  ) THEN
    ALTER TABLE stream_notifications 
    ADD COLUMN subscriber_channel_id TEXT;
    RAISE NOTICE 'Added column: subscriber_channel_id';
  ELSE
    RAISE NOTICE 'Column subscriber_channel_id already exists';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ====================================';
  RAISE NOTICE '✅ Subscriber Channel Update Applied!';
  RAISE NOTICE '✅ ====================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 What was added:';
  RAISE NOTICE '   • subscriber_channel_id column (optional)';
  RAISE NOTICE '   • Falls back to channel_id if not set';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next:';
  RAISE NOTICE '   • Update and restart webapp';
  RAISE NOTICE '   • Configure separate channel in dashboard';
  RAISE NOTICE '';
END $$;

