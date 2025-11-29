-- Polls & Voting System Schema

-- Main polls table
CREATE TABLE IF NOT EXISTS polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    channel_id TEXT NOT NULL,
    message_id TEXT, -- Discord message ID for the poll embed
    poll_type TEXT NOT NULL DEFAULT 'single' CHECK (poll_type IN ('single', 'multiple')),
    voting_type TEXT NOT NULL DEFAULT 'public' CHECK (voting_type IN ('public', 'anonymous')),
    allow_change_vote BOOLEAN DEFAULT true,
    allow_add_options BOOLEAN DEFAULT false, -- Users can add custom options
    max_votes INTEGER DEFAULT 1, -- For multiple choice polls
    expires_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    closed_by TEXT, -- User who closed the poll
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
    require_roles TEXT[] DEFAULT '{}', -- Roles required to vote
    weighted_voting JSONB DEFAULT '{}', -- Role-based vote weights: {"role_id": 2.0}
    reminder_enabled BOOLEAN DEFAULT false,
    reminder_sent BOOLEAN DEFAULT false,
    total_votes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poll options (choices)
CREATE TABLE IF NOT EXISTS poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    emoji TEXT, -- Optional emoji for the option
    option_order INTEGER NOT NULL DEFAULT 0,
    vote_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poll votes (for public polls - anonymous polls don't store user IDs)
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    option_ids UUID[] NOT NULL, -- Array of option IDs (for multiple choice)
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);

-- Poll templates (for reusable polls)
CREATE TABLE IF NOT EXISTS poll_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    title TEXT NOT NULL,
    description_text TEXT,
    poll_type TEXT NOT NULL DEFAULT 'single',
    voting_type TEXT NOT NULL DEFAULT 'public',
    default_options TEXT[] NOT NULL, -- Array of default option texts
    require_roles TEXT[] DEFAULT '{}',
    weighted_voting JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_polls_guild_id ON polls(guild_id);
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_expires_at ON polls(expires_at);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_poll_templates_guild_id ON poll_templates(guild_id);

-- RLS Policies (if using RLS)
-- ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE poll_templates ENABLE ROW LEVEL SECURITY;

-- Functions for updating vote counts
CREATE OR REPLACE FUNCTION update_poll_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE polls
    SET total_votes = (
        SELECT COUNT(DISTINCT user_id)
        FROM poll_votes
        WHERE poll_id = NEW.poll_id
    )
    WHERE id = NEW.poll_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_option_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE poll_options
    SET vote_count = (
        SELECT COUNT(*)
        FROM poll_votes
        WHERE poll_id = NEW.poll_id
        AND NEW.option_ids && ARRAY[id]
    )
    WHERE poll_id = NEW.poll_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_poll_vote_count
AFTER INSERT OR UPDATE OR DELETE ON poll_votes
FOR EACH ROW EXECUTE FUNCTION update_poll_vote_count();

CREATE TRIGGER trigger_update_option_vote_count
AFTER INSERT OR UPDATE OR DELETE ON poll_votes
FOR EACH ROW EXECUTE FUNCTION update_option_vote_count();

-- Function to close expired polls
CREATE OR REPLACE FUNCTION close_expired_polls()
RETURNS void AS $$
BEGIN
    UPDATE polls
    SET status = 'closed',
        closed_at = NOW(),
        updated_at = NOW()
    WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

