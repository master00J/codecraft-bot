-- Twitch OAuth Integration Schema Migration
-- Adds support for per-streamer Twitch authentication

DO $$
BEGIN
    -- Add Twitch OAuth fields to stream_notifications
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_notifications' AND column_name = 'twitch_user_id') THEN
        ALTER TABLE stream_notifications ADD COLUMN twitch_user_id TEXT;
        RAISE NOTICE 'Added twitch_user_id column to stream_notifications table.';
    ELSE
        RAISE NOTICE 'Column twitch_user_id already exists. Skipping.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_notifications' AND column_name = 'twitch_access_token') THEN
        ALTER TABLE stream_notifications ADD COLUMN twitch_access_token TEXT;
        RAISE NOTICE 'Added twitch_access_token column to stream_notifications table.';
    ELSE
        RAISE NOTICE 'Column twitch_access_token already exists. Skipping.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_notifications' AND column_name = 'twitch_refresh_token') THEN
        ALTER TABLE stream_notifications ADD COLUMN twitch_refresh_token TEXT;
        RAISE NOTICE 'Added twitch_refresh_token column to stream_notifications table.';
    ELSE
        RAISE NOTICE 'Column twitch_refresh_token already exists. Skipping.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_notifications' AND column_name = 'twitch_token_expires_at') THEN
        ALTER TABLE stream_notifications ADD COLUMN twitch_token_expires_at TIMESTAMPTZ;
        RAISE NOTICE 'Added twitch_token_expires_at column to stream_notifications table.';
    ELSE
        RAISE NOTICE 'Column twitch_token_expires_at already exists. Skipping.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_notifications' AND column_name = 'twitch_connected_at') THEN
        ALTER TABLE stream_notifications ADD COLUMN twitch_connected_at TIMESTAMPTZ;
        RAISE NOTICE 'Added twitch_connected_at column to stream_notifications table.';
    ELSE
        RAISE NOTICE 'Column twitch_connected_at already exists. Skipping.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_notifications' AND column_name = 'twitch_display_name') THEN
        ALTER TABLE stream_notifications ADD COLUMN twitch_display_name TEXT;
        RAISE NOTICE 'Added twitch_display_name column to stream_notifications table.';
    ELSE
        RAISE NOTICE 'Column twitch_display_name already exists. Skipping.';
    END IF;
END
$$;

-- Create OAuth state table for CSRF protection
CREATE TABLE IF NOT EXISTS twitch_oauth_states (
    state TEXT PRIMARY KEY,
    notification_id UUID NOT NULL,
    guild_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes'
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_twitch_oauth_states_expires 
ON twitch_oauth_states(expires_at);

-- Enable RLS
ALTER TABLE twitch_oauth_states ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access states for their guilds
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'twitch_oauth_states' 
        AND policyname = 'Users can manage their guild OAuth states'
    ) THEN
        CREATE POLICY "Users can manage their guild OAuth states"
        ON twitch_oauth_states
        FOR ALL
        USING (true); -- Simplified for now, can be restricted later
        
        RAISE NOTICE 'Created RLS policy for twitch_oauth_states.';
    ELSE
        RAISE NOTICE 'RLS policy already exists for twitch_oauth_states. Skipping.';
    END IF;
END
$$;

-- Cleanup function: Remove expired OAuth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
    DELETE FROM twitch_oauth_states 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create cleanup job (run every hour)
-- Note: This requires pg_cron extension, which may not be available on all Supabase plans
-- Alternative: Clean up in application code
COMMENT ON FUNCTION cleanup_expired_oauth_states IS 'Removes expired OAuth state tokens (run periodically)';

DO $$
BEGIN
    RAISE NOTICE 'Twitch OAuth schema migration completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next Steps:';
    RAISE NOTICE '1. Deploy updated webapp with OAuth endpoints';
    RAISE NOTICE '2. Test OAuth flow with a Twitch account';
    RAISE NOTICE '3. Enable subscriber notifications';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Security Notes:';
    RAISE NOTICE '- Tokens are stored in database (consider encryption for production)';
    RAISE NOTICE '- OAuth states expire after 10 minutes';
    RAISE NOTICE '- Implement token refresh logic in application';
END
$$;

