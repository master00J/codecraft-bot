-- ================================================================
-- COMCRAFT ANALYTICS SYSTEM
-- Comprehensive event tracking and metrics
-- ================================================================

-- ================================================================
-- 1. ANALYTICS EVENTS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Event details
  event_type TEXT NOT NULL, -- 'message', 'join', 'leave', 'voice_join', 'voice_leave', 'reaction', 'command'
  guild_id TEXT NOT NULL,
  
  -- User info
  user_id TEXT NOT NULL,
  username TEXT,
  
  -- Context
  channel_id TEXT,
  channel_name TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timing (for hourly analysis)
  hour_of_day INTEGER, -- 0-23
  day_of_week INTEGER, -- 0-6 (Sunday = 0)
  
  -- Date partitioning (for faster queries)
  event_date DATE DEFAULT CURRENT_DATE
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_guild_date 
ON analytics_events(guild_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type 
ON analytics_events(guild_id, event_type, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user 
ON analytics_events(guild_id, user_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_channel 
ON analytics_events(guild_id, channel_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_hour 
ON analytics_events(guild_id, hour_of_day);

-- ================================================================
-- 2. DAILY AGGREGATES TABLE (for performance)
-- ================================================================

CREATE TABLE IF NOT EXISTS analytics_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  guild_id TEXT NOT NULL,
  
  -- Member stats
  total_members INTEGER DEFAULT 0,
  new_joins INTEGER DEFAULT 0,
  leaves INTEGER DEFAULT 0,
  net_growth INTEGER DEFAULT 0,
  
  -- Activity stats
  total_messages INTEGER DEFAULT 0,
  unique_active_users INTEGER DEFAULT 0,
  total_voice_minutes INTEGER DEFAULT 0,
  
  -- Engagement
  total_reactions INTEGER DEFAULT 0,
  total_commands INTEGER DEFAULT 0,
  
  -- Channel breakdown
  top_channels JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_guild_date 
ON analytics_daily_stats(guild_id, date DESC);

-- ================================================================
-- 3. USER ACTIVITY TRACKING
-- ================================================================

CREATE TABLE IF NOT EXISTS user_activity_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  
  -- Activity metrics
  messages_sent INTEGER DEFAULT 0,
  voice_minutes INTEGER DEFAULT 0,
  reactions_given INTEGER DEFAULT 0,
  commands_used INTEGER DEFAULT 0,
  
  -- Timing
  first_message_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  
  -- Channels used
  channels_active_in TEXT[], -- Array of channel IDs
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_activity_guild_date 
ON user_activity_summary(guild_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_user 
ON user_activity_summary(guild_id, user_id, date DESC);

-- ================================================================
-- 4. MEMBER RETENTION TRACKING
-- ================================================================

CREATE TABLE IF NOT EXISTS member_retention (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Join info
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- First activity milestones
  first_message_at TIMESTAMP WITH TIME ZONE,
  first_reaction_at TIMESTAMP WITH TIME ZONE,
  first_voice_at TIMESTAMP WITH TIME ZONE,
  
  -- Retention metrics
  time_to_first_message INTEGER, -- Seconds from join to first message
  is_retained_24h BOOLEAN DEFAULT false,
  is_retained_7d BOOLEAN DEFAULT false,
  is_retained_30d BOOLEAN DEFAULT false,
  
  -- Current status
  still_in_guild BOOLEAN DEFAULT true,
  left_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_member_retention_guild 
ON member_retention(guild_id, joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_retention_retained 
ON member_retention(guild_id, is_retained_7d, is_retained_30d);

-- ================================================================
-- 5. CHANNEL STATISTICS
-- ================================================================

CREATE TABLE IF NOT EXISTS channel_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  date DATE NOT NULL,
  
  -- Activity
  messages_count INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  reactions_count INTEGER DEFAULT 0,
  
  -- Peak activity
  peak_hour INTEGER, -- 0-23
  peak_hour_messages INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, channel_id, date)
);

CREATE INDEX IF NOT EXISTS idx_channel_stats_guild_date 
ON channel_stats(guild_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_channel_stats_messages 
ON channel_stats(guild_id, messages_count DESC);

-- ================================================================
-- 6. HOURLY ACTIVITY HEATMAP
-- ================================================================

CREATE TABLE IF NOT EXISTS hourly_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  date DATE NOT NULL,
  hour INTEGER NOT NULL, -- 0-23
  
  messages INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, date, hour)
);

CREATE INDEX IF NOT EXISTS idx_hourly_activity_guild_date 
ON hourly_activity(guild_id, date DESC, hour);

-- ================================================================
-- HELPER VIEWS
-- ================================================================

-- View: Recent activity (last 30 days)
CREATE OR REPLACE VIEW analytics_recent_activity AS
SELECT 
  guild_id,
  date,
  total_messages,
  unique_active_users,
  new_joins,
  leaves,
  net_growth
FROM analytics_daily_stats
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY guild_id, date DESC;

-- View: Top channels (last 7 days)
CREATE OR REPLACE VIEW analytics_top_channels AS
SELECT 
  guild_id,
  channel_id,
  channel_name,
  SUM(messages_count) as total_messages,
  SUM(unique_users) as total_users,
  AVG(messages_count) as avg_messages_per_day
FROM channel_stats
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY guild_id, channel_id, channel_name
ORDER BY guild_id, total_messages DESC;

-- View: Retention rates
CREATE OR REPLACE VIEW analytics_retention_rates AS
SELECT 
  guild_id,
  COUNT(*) as total_joined,
  COUNT(*) FILTER (WHERE first_message_at IS NOT NULL) as sent_first_message,
  COUNT(*) FILTER (WHERE is_retained_24h) as retained_24h,
  COUNT(*) FILTER (WHERE is_retained_7d) as retained_7d,
  COUNT(*) FILTER (WHERE is_retained_30d) as retained_30d,
  ROUND(100.0 * COUNT(*) FILTER (WHERE first_message_at IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as conversion_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_retained_7d) / NULLIF(COUNT(*), 0), 1) as retention_7d_rate,
  ROUND(AVG(time_to_first_message) / 60.0, 1) as avg_minutes_to_first_message
FROM member_retention
WHERE joined_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY guild_id;

-- ================================================================
-- RLS POLICIES
-- ================================================================

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_retention ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE hourly_activity ENABLE ROW LEVEL SECURITY;

-- Guild owners can view their analytics
CREATE POLICY "Guild owners view analytics_events"
  ON analytics_events FOR SELECT TO authenticated
  USING (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

CREATE POLICY "Guild owners view daily_stats"
  ON analytics_daily_stats FOR SELECT TO authenticated
  USING (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

CREATE POLICY "Guild owners view user_activity"
  ON user_activity_summary FOR SELECT TO authenticated
  USING (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

CREATE POLICY "Guild owners view retention"
  ON member_retention FOR SELECT TO authenticated
  USING (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

CREATE POLICY "Guild owners view channel_stats"
  ON channel_stats FOR SELECT TO authenticated
  USING (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

CREATE POLICY "Guild owners view hourly_activity"
  ON hourly_activity FOR SELECT TO authenticated
  USING (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

-- Service role can manage all
CREATE POLICY "Service manages analytics_events"
  ON analytics_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service manages daily_stats"
  ON analytics_daily_stats FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service manages user_activity"
  ON user_activity_summary FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service manages retention"
  ON member_retention FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service manages channel_stats"
  ON channel_stats FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service manages hourly_activity"
  ON hourly_activity FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

SELECT 
  'Analytics system created successfully!' as status,
  (SELECT COUNT(*) FROM analytics_events) as total_events,
  (SELECT COUNT(*) FROM analytics_daily_stats) as daily_records;

