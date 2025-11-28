-- ================================================================
-- USER STATS TRACKING SYSTEM
-- Tracks detailed user statistics for stats cards
-- ================================================================

-- ================================================================
-- 1. USER STATS CUMULATIVE TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Message stats (all time)
  total_messages INTEGER DEFAULT 0,
  
  -- Voice stats (all time, in seconds)
  total_voice_seconds INTEGER DEFAULT 0,
  
  -- First and last activity
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_voice_at TIMESTAMP WITH TIME ZONE,
  
  -- Created/joined dates for server
  server_joined_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_stats_guild_user 
ON user_stats(guild_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_stats_messages 
ON user_stats(guild_id, total_messages DESC);

CREATE INDEX IF NOT EXISTS idx_user_stats_voice 
ON user_stats(guild_id, total_voice_seconds DESC);

-- ================================================================
-- 2. VOICE SESSIONS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel_id TEXT,
  channel_name TEXT,
  
  -- Session tracking
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
  left_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER, -- Calculated when session ends
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_guild_user 
ON voice_sessions(guild_id, user_id, joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_active 
ON voice_sessions(guild_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_voice_sessions_channel 
ON voice_sessions(guild_id, channel_id, joined_at DESC);

-- ================================================================
-- 3. USER CHANNEL STATS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS user_channel_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  channel_type TEXT, -- 'text' or 'voice'
  
  -- Stats
  message_count INTEGER DEFAULT 0,
  voice_seconds INTEGER DEFAULT 0,
  
  -- Last activity
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_user_channel_stats_user 
ON user_channel_stats(guild_id, user_id, message_count DESC);

CREATE INDEX IF NOT EXISTS idx_user_channel_stats_channel 
ON user_channel_stats(guild_id, channel_id, message_count DESC);

-- ================================================================
-- 4. STATS CONFIGURATION TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS stats_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL UNIQUE,
  
  -- Card customization
  card_background_url TEXT,
  card_border_color TEXT DEFAULT '#5865F2',
  card_theme TEXT DEFAULT 'dark', -- 'dark' or 'light'
  
  -- Display options
  show_message_rank BOOLEAN DEFAULT true,
  show_voice_rank BOOLEAN DEFAULT true,
  show_top_channels BOOLEAN DEFAULT true,
  show_charts BOOLEAN DEFAULT true,
  
  -- Periods to show
  show_1d BOOLEAN DEFAULT true,
  show_7d BOOLEAN DEFAULT true,
  show_14d BOOLEAN DEFAULT true,
  show_30d BOOLEAN DEFAULT false,
  
  -- Lookback period for stats
  lookback_days INTEGER DEFAULT 14,
  
  -- Timezone
  timezone TEXT DEFAULT 'UTC',
  
  enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stats_config_guild 
ON stats_config(guild_id);

-- ================================================================
-- HELPER FUNCTIONS
-- ================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON user_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_updated_at();

CREATE TRIGGER update_voice_sessions_updated_at
  BEFORE UPDATE ON voice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_updated_at();

CREATE TRIGGER update_user_channel_stats_updated_at
  BEFORE UPDATE ON user_channel_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_updated_at();

CREATE TRIGGER update_stats_config_updated_at
  BEFORE UPDATE ON stats_config
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_updated_at();

-- ================================================================
-- VIEWS FOR EASY QUERIES
-- ================================================================

-- View: User stats with ranks
CREATE OR REPLACE VIEW user_stats_with_ranks AS
SELECT 
  us.*,
  ROW_NUMBER() OVER (PARTITION BY us.guild_id ORDER BY us.total_messages DESC) as message_rank,
  ROW_NUMBER() OVER (PARTITION BY us.guild_id ORDER BY us.total_voice_seconds DESC) as voice_rank
FROM user_stats us;

-- View: Top channels per user
CREATE OR REPLACE VIEW user_top_channels AS
SELECT 
  guild_id,
  user_id,
  channel_id,
  channel_name,
  message_count,
  ROW_NUMBER() OVER (PARTITION BY guild_id, user_id ORDER BY message_count DESC) as channel_rank
FROM user_channel_stats
WHERE channel_type = 'text'
ORDER BY guild_id, user_id, message_count DESC;

-- ================================================================
-- RLS POLICIES
-- ================================================================

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_channel_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_config ENABLE ROW LEVEL SECURITY;

-- Service role can manage all
CREATE POLICY "Service manages user_stats"
  ON user_stats FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service manages voice_sessions"
  ON voice_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service manages user_channel_stats"
  ON user_channel_stats FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service manages stats_config"
  ON stats_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Guild owners can view their stats
CREATE POLICY "Guild owners view user_stats"
  ON user_stats FOR SELECT TO authenticated
  USING (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

CREATE POLICY "Guild owners view stats_config"
  ON stats_config FOR SELECT TO authenticated
  USING (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

-- Users can view their own stats (public read for now)
CREATE POLICY "Users can read user_stats"
  ON user_stats FOR SELECT
  USING (true);

CREATE POLICY "Users can read stats_config"
  ON stats_config FOR SELECT
  USING (true);

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

SELECT 
  'User Stats system created successfully!' as status,
  (SELECT COUNT(*) FROM user_stats) as total_users_tracked;

