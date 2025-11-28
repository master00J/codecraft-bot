-- Create stream_history table if it doesn't exist
-- Run this in Supabase SQL Editor after QUICK_FIX_STREAM_NOTIFICATIONS.sql

-- Stream history table to track stream sessions
CREATE TABLE IF NOT EXISTS stream_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Link to notification
  notification_id UUID NOT NULL REFERENCES stream_notifications(id) ON DELETE CASCADE,
  
  -- Stream details
  stream_id TEXT NOT NULL, -- Twitch/YouTube stream ID
  title TEXT,
  game_name TEXT,
  viewer_count INTEGER DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  peak_viewers INTEGER,
  average_viewers INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stream_history_notification 
ON stream_history(notification_id);

CREATE INDEX IF NOT EXISTS idx_stream_history_stream_id 
ON stream_history(stream_id);

CREATE INDEX IF NOT EXISTS idx_stream_history_started_at 
ON stream_history(started_at DESC);

-- RLS Policies
ALTER TABLE stream_history ENABLE ROW LEVEL SECURITY;

-- Admins can see all history
CREATE POLICY "Admins can view all stream history"
  ON stream_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.discord_id = auth.jwt() ->> 'discordId'
      AND users.is_admin = true
    )
  );

-- Guild owners can see their history
CREATE POLICY "Guild owners can view their stream history"
  ON stream_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stream_notifications sn
      JOIN guild_configs gc ON gc.guild_id = sn.guild_id
      WHERE sn.id = stream_history.notification_id
      AND gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

-- Service role can insert/update
CREATE POLICY "Service can manage stream history"
  ON stream_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Success message
SELECT 
  'Stream history table created successfully!' as status,
  COUNT(*) as existing_records
FROM stream_history;

