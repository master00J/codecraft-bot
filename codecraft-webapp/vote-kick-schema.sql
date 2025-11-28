-- Vote Kick System Schema
-- Allows users to vote to kick members from voice channels

-- Vote kick configuration per guild
CREATE TABLE IF NOT EXISTS vote_kick_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    required_votes INTEGER DEFAULT 3, -- Minimum votes needed to kick
    vote_duration_seconds INTEGER DEFAULT 60, -- How long votes are active
    cooldown_seconds INTEGER DEFAULT 300, -- Cooldown between vote kicks for same user
    allowed_channels TEXT[], -- Channel IDs where vote kick is allowed (empty = all voice channels)
    exempt_roles TEXT[], -- Role IDs that cannot be vote kicked
    exempt_users TEXT[], -- User IDs that cannot be vote kicked
    log_channel_id TEXT, -- Channel to log vote kick actions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active vote kick sessions
CREATE TABLE IF NOT EXISTS vote_kick_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    initiator_user_id TEXT NOT NULL,
    required_votes INTEGER NOT NULL,
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    voters TEXT[] DEFAULT '{}', -- Array of user IDs who voted
    status TEXT DEFAULT 'active', -- 'active', 'passed', 'failed', 'expired', 'cancelled'
    expires_at TIMESTAMPTZ NOT NULL,
    message_id TEXT, -- Discord message ID for the vote embed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vote kick history/logs
CREATE TABLE IF NOT EXISTS vote_kick_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    target_username TEXT NOT NULL,
    initiator_user_id TEXT NOT NULL,
    initiator_username TEXT NOT NULL,
    votes_for INTEGER NOT NULL,
    votes_against INTEGER NOT NULL,
    total_voters INTEGER NOT NULL,
    status TEXT NOT NULL, -- 'passed', 'failed', 'expired', 'cancelled'
    kicked BOOLEAN DEFAULT FALSE, -- Whether the user was actually kicked
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vote_kick_config_guild ON vote_kick_config(guild_id);
CREATE INDEX IF NOT EXISTS idx_vote_kick_sessions_guild ON vote_kick_sessions(guild_id);
CREATE INDEX IF NOT EXISTS idx_vote_kick_sessions_status ON vote_kick_sessions(status);
CREATE INDEX IF NOT EXISTS idx_vote_kick_sessions_expires ON vote_kick_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_vote_kick_logs_guild ON vote_kick_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_vote_kick_logs_target ON vote_kick_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_vote_kick_logs_created ON vote_kick_logs(created_at);

-- RLS Policies
ALTER TABLE vote_kick_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_kick_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_kick_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for safe re-running)
DROP POLICY IF EXISTS "Guild owners manage vote_kick_config" ON vote_kick_config;
DROP POLICY IF EXISTS "Guild owners view vote_kick_sessions" ON vote_kick_sessions;
DROP POLICY IF EXISTS "Guild owners view vote_kick_logs" ON vote_kick_logs;
DROP POLICY IF EXISTS "Service manages vote_kick_config" ON vote_kick_config;
DROP POLICY IF EXISTS "Service manages vote_kick_sessions" ON vote_kick_sessions;
DROP POLICY IF EXISTS "Service manages vote_kick_logs" ON vote_kick_logs;

-- Guild owners can manage their vote kick config
CREATE POLICY "Guild owners manage vote_kick_config"
    ON vote_kick_config
    FOR ALL
    TO authenticated
    USING (
        guild_id IN (
            SELECT gc.guild_id FROM guild_configs gc
            WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
        )
    )
    WITH CHECK (
        guild_id IN (
            SELECT gc.guild_id FROM guild_configs gc
            WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
        )
    );

-- Guild owners can view their vote kick sessions
CREATE POLICY "Guild owners view vote_kick_sessions"
    ON vote_kick_sessions
    FOR SELECT
    TO authenticated
    USING (
        guild_id IN (
            SELECT gc.guild_id FROM guild_configs gc
            WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
        )
    );

-- Guild owners can view their vote kick logs
CREATE POLICY "Guild owners view vote_kick_logs"
    ON vote_kick_logs
    FOR SELECT
    TO authenticated
    USING (
        guild_id IN (
            SELECT gc.guild_id FROM guild_configs gc
            WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
        )
    );

-- Service role can manage everything
CREATE POLICY "Service manages vote_kick_config"
    ON vote_kick_config
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service manages vote_kick_sessions"
    ON vote_kick_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service manages vote_kick_logs"
    ON vote_kick_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vote_kick_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_vote_kick_sessions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist (for safe re-running)
DROP TRIGGER IF EXISTS vote_kick_config_updated_at ON vote_kick_config;
DROP TRIGGER IF EXISTS vote_kick_sessions_updated_at ON vote_kick_sessions;

CREATE TRIGGER vote_kick_config_updated_at
    BEFORE UPDATE ON vote_kick_config
    FOR EACH ROW
    EXECUTE FUNCTION update_vote_kick_config_timestamp();

CREATE TRIGGER vote_kick_sessions_updated_at
    BEFORE UPDATE ON vote_kick_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_vote_kick_sessions_timestamp();

