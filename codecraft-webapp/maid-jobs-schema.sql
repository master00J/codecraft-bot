-- Maid Jobs System Schema
-- Allows users to "work" as maids, cleaning channels and earning rewards

-- Main maid jobs configuration per guild
CREATE TABLE IF NOT EXISTS maid_jobs_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    maid_quarters_channel_id TEXT NOT NULL, -- Channel where users clock in
    channels_to_clean TEXT[] DEFAULT '{}', -- Channel IDs that can be cleaned (empty = all channels)
    cleanings_per_role_upgrade INTEGER DEFAULT 5, -- Number of cleanings needed for role upgrade
    cooldown_minutes INTEGER DEFAULT 5, -- Cooldown before same channel can be cleaned again
    coins_per_cleaning INTEGER DEFAULT 10, -- Coins reward per cleaning
    xp_per_cleaning INTEGER DEFAULT 5, -- XP reward per cleaning
    role_rewards JSONB DEFAULT '{}', -- {5: "role_id_1", 10: "role_id_2", 20: "role_id_3"} - Role at X cleanings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active maid sessions (clocked in users)
CREATE TABLE IF NOT EXISTS maid_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    clocked_in_at TIMESTAMPTZ DEFAULT NOW(),
    channels_cleaned INTEGER DEFAULT 0,
    last_cleaning_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    completed_at TIMESTAMPTZ,
    UNIQUE(guild_id, user_id) -- Only one active session per user per guild
);

-- Maid cleaning history (tracks what channels were cleaned)
CREATE TABLE IF NOT EXISTS maid_cleanings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES maid_sessions(id) ON DELETE CASCADE,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT, -- Cached channel name
    roleplay_message TEXT, -- The message that was shown
    cleaned_at TIMESTAMPTZ DEFAULT NOW(),
    coins_earned INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0
);

-- Total maid job statistics per user (for leaderboards)
CREATE TABLE IF NOT EXISTS maid_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    total_sessions INTEGER DEFAULT 0,
    total_cleanings INTEGER DEFAULT 0,
    total_channels_cleaned INTEGER DEFAULT 0, -- Unique channels
    total_coins_earned BIGINT DEFAULT 0,
    total_xp_earned BIGINT DEFAULT 0,
    current_role_level INTEGER DEFAULT 0, -- Highest role level achieved
    last_cleaning_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guild_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_maid_sessions_guild_user ON maid_sessions(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_maid_sessions_status ON maid_sessions(status);
CREATE INDEX IF NOT EXISTS idx_maid_cleanings_session ON maid_cleanings(session_id);
CREATE INDEX IF NOT EXISTS idx_maid_cleanings_guild_user ON maid_cleanings(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_maid_cleanings_channel ON maid_cleanings(channel_id);
CREATE INDEX IF NOT EXISTS idx_maid_statistics_guild_user ON maid_statistics(guild_id, user_id);

-- Roleplay messages (customizable per guild)
CREATE TABLE IF NOT EXISTS maid_roleplay_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    message TEXT NOT NULL, -- "You cleaned behind some dusty paintings"
    enabled BOOLEAN DEFAULT true,
    weight INTEGER DEFAULT 1, -- Higher weight = more likely to be selected
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roleplay messages for new guilds
-- These will be added when maid jobs are first enabled for a guild

-- Function to update maid statistics
CREATE OR REPLACE FUNCTION update_maid_statistics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO maid_statistics (guild_id, user_id, total_cleanings, total_coins_earned, total_xp_earned, last_cleaning_at, updated_at)
    VALUES (NEW.guild_id, NEW.user_id, 1, NEW.coins_earned, NEW.xp_earned, NEW.cleaned_at, NOW())
    ON CONFLICT (guild_id, user_id) 
    DO UPDATE SET
        total_cleanings = maid_statistics.total_cleanings + 1,
        total_coins_earned = maid_statistics.total_coins_earned + NEW.coins_earned,
        total_xp_earned = maid_statistics.total_xp_earned + NEW.xp_earned,
        last_cleaning_at = NEW.cleaned_at,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update statistics
CREATE TRIGGER trigger_update_maid_statistics
AFTER INSERT ON maid_cleanings
FOR EACH ROW EXECUTE FUNCTION update_maid_statistics();

