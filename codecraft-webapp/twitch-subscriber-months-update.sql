-- =====================================================
-- Twitch Subscriber Months Update
-- =====================================================
-- Add subscription duration tracking (cumulative and streak months)
-- Run this in Supabase SQL Editor

-- Add cumulative_months column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'twitch_subscriber_events' 
    AND column_name = 'cumulative_months'
  ) THEN
    ALTER TABLE twitch_subscriber_events 
    ADD COLUMN cumulative_months INTEGER DEFAULT 1;
    RAISE NOTICE 'Added column: cumulative_months';
  ELSE
    RAISE NOTICE 'Column cumulative_months already exists';
  END IF;
END $$;

-- Add streak_months column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'twitch_subscriber_events' 
    AND column_name = 'streak_months'
  ) THEN
    ALTER TABLE twitch_subscriber_events 
    ADD COLUMN streak_months INTEGER DEFAULT 1;
    RAISE NOTICE 'Added column: streak_months';
  ELSE
    RAISE NOTICE 'Column streak_months already exists';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ====================================';
  RAISE NOTICE '✅ Subscriber Months Update Applied!';
  RAISE NOTICE '✅ ====================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 What was added:';
  RAISE NOTICE '   • cumulative_months column (total months subscribed)';
  RAISE NOTICE '   • streak_months column (current consecutive months)';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Examples:';
  RAISE NOTICE '   • 6 month subscriber = cumulative_months: 6';
  RAISE NOTICE '   • 12 month streak = streak_months: 12';
  RAISE NOTICE '';
END $$;

