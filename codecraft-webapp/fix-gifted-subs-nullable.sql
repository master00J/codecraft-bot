-- Fix: Make subscriber_id nullable for gifted sub events
-- Gifted sub events (channel.subscription.gift) don't have a subscriber_id,
-- only individual sub events (channel.subscribe) have it.

-- Check if the column needs to be altered
DO $$
BEGIN
  -- Drop the NOT NULL constraint on subscriber_id
  ALTER TABLE twitch_subscriber_events 
    ALTER COLUMN subscriber_id DROP NOT NULL;
  
  RAISE NOTICE 'Successfully made subscriber_id nullable for gifted sub events';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error or constraint already removed: %', SQLERRM;
END $$;

-- Same for subscriber_name and subscriber_display_name
DO $$
BEGIN
  ALTER TABLE twitch_subscriber_events 
    ALTER COLUMN subscriber_name DROP NOT NULL;
  
  RAISE NOTICE 'Successfully made subscriber_name nullable';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error or constraint already removed: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE twitch_subscriber_events 
    ALTER COLUMN subscriber_display_name DROP NOT NULL;
  
  RAISE NOTICE 'Successfully made subscriber_display_name nullable';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error or constraint already removed: %', SQLERRM;
END $$;

