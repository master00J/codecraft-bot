-- Add support for Twitch gifted subscriptions
-- This migration adds columns and tables needed for gifted sub notifications

-- Add gifted sub EventSub subscription ID column to stream_notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stream_notifications' 
        AND column_name = 'eventsub_gift_subscription_id'
    ) THEN
        ALTER TABLE stream_notifications 
        ADD COLUMN eventsub_gift_subscription_id TEXT;
        
        RAISE NOTICE 'Added eventsub_gift_subscription_id column to stream_notifications table.';
    ELSE
        RAISE NOTICE 'Column eventsub_gift_subscription_id already exists in stream_notifications table. Skipping.';
    END IF;
END
$$;

-- Add gifted sub message template column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stream_notifications' 
        AND column_name = 'gifted_sub_message_template'
    ) THEN
        ALTER TABLE stream_notifications 
        ADD COLUMN gifted_sub_message_template TEXT DEFAULT '🎁 {gifter} just gifted {amount} sub(s)!';
        
        RAISE NOTICE 'Added gifted_sub_message_template column to stream_notifications table.';
    ELSE
        RAISE NOTICE 'Column gifted_sub_message_template already exists in stream_notifications table. Skipping.';
    END IF;
END
$$;

-- Add gifter information columns to twitch_subscriber_events
DO $$
BEGIN
    -- Add gifter_user_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'twitch_subscriber_events' 
        AND column_name = 'gifter_user_id'
    ) THEN
        ALTER TABLE twitch_subscriber_events 
        ADD COLUMN gifter_user_id TEXT;
        
        RAISE NOTICE 'Added gifter_user_id column to twitch_subscriber_events table.';
    ELSE
        RAISE NOTICE 'Column gifter_user_id already exists. Skipping.';
    END IF;

    -- Add gifter_user_name column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'twitch_subscriber_events' 
        AND column_name = 'gifter_user_name'
    ) THEN
        ALTER TABLE twitch_subscriber_events 
        ADD COLUMN gifter_user_name TEXT;
        
        RAISE NOTICE 'Added gifter_user_name column to twitch_subscriber_events table.';
    ELSE
        RAISE NOTICE 'Column gifter_user_name already exists. Skipping.';
    END IF;

    -- Add gifter_display_name column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'twitch_subscriber_events' 
        AND column_name = 'gifter_display_name'
    ) THEN
        ALTER TABLE twitch_subscriber_events 
        ADD COLUMN gifter_display_name TEXT;
        
        RAISE NOTICE 'Added gifter_display_name column to twitch_subscriber_events table.';
    ELSE
        RAISE NOTICE 'Column gifter_display_name already exists. Skipping.';
    END IF;

    -- Add total_gifts column (for gift events, this is the total number of subs gifted in the batch)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'twitch_subscriber_events' 
        AND column_name = 'total_gifts'
    ) THEN
        ALTER TABLE twitch_subscriber_events 
        ADD COLUMN total_gifts INTEGER DEFAULT 1;
        
        RAISE NOTICE 'Added total_gifts column to twitch_subscriber_events table.';
    ELSE
        RAISE NOTICE 'Column total_gifts already exists. Skipping.';
    END IF;

    -- Add is_anonymous column (some gifters gift anonymously)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'twitch_subscriber_events' 
        AND column_name = 'is_anonymous'
    ) THEN
        ALTER TABLE twitch_subscriber_events 
        ADD COLUMN is_anonymous BOOLEAN DEFAULT false;
        
        RAISE NOTICE 'Added is_anonymous column to twitch_subscriber_events table.';
    ELSE
        RAISE NOTICE 'Column is_anonymous already exists. Skipping.';
    END IF;
END
$$;

-- Create index on gifter_user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_twitch_subscriber_events_gifter 
ON twitch_subscriber_events(gifter_user_id);

-- Final success message
DO $$
BEGIN
    RAISE NOTICE 'Gifted subscriptions schema migration completed successfully!';
END
$$;

