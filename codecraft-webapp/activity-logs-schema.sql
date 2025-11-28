-- Activity Logging System
-- Tracks all important actions in CodeCraft & ComCraft
-- Run this in Supabase SQL Editor

-- Main activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Action details
  action_type TEXT NOT NULL, -- 'stream.added', 'config.updated', 'bot.deployed', etc.
  action_category TEXT NOT NULL, -- 'stream', 'config', 'moderation', 'admin', 'billing'
  description TEXT NOT NULL,
  
  -- User/Actor info
  actor_type TEXT DEFAULT 'user', -- 'user', 'bot', 'system', 'admin'
  actor_id TEXT, -- Discord ID or 'system'
  actor_name TEXT,
  
  -- Target info (what was affected)
  target_type TEXT, -- 'guild', 'stream', 'order', 'user'
  target_id TEXT,
  target_name TEXT,
  
  -- Context
  guild_id TEXT, -- For guild-specific actions
  metadata JSONB DEFAULT '{}'::jsonb, -- Extra data
  
  -- Status
  status TEXT DEFAULT 'success', -- 'success', 'failed', 'pending'
  error_message TEXT,
  
  -- IP and user agent (optional)
  ip_address TEXT,
  user_agent TEXT
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_guild_id ON activity_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id ON activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_category ON activity_logs(action_category);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target_type ON activity_logs(target_type, target_id);

-- RLS Policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can see all logs
CREATE POLICY "Admins can view all logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.discord_id = auth.jwt() ->> 'discordId'
      AND users.is_admin = true
    )
  );

-- Users can see their own guild's logs
CREATE POLICY "Users can view own guild logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

-- Service role can insert logs
CREATE POLICY "Service can insert logs"
  ON activity_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Common action types for easy reference
COMMENT ON TABLE activity_logs IS 'Activity logging for all platform actions';
COMMENT ON COLUMN activity_logs.action_type IS 'Examples: stream.added, stream.removed, config.updated, bot.deployed, payment.verified, user.warned, etc.';
COMMENT ON COLUMN activity_logs.metadata IS 'JSON field for extra contextual data (e.g., old vs new values, error details, API responses)';

-- Create a view for recent activity
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
  id,
  created_at,
  action_type,
  action_category,
  description,
  actor_name,
  target_name,
  guild_id,
  status
FROM activity_logs
ORDER BY created_at DESC
LIMIT 100;

-- Helper function to log activity (can be called from API routes)
CREATE OR REPLACE FUNCTION log_activity(
  p_action_type TEXT,
  p_action_category TEXT,
  p_description TEXT,
  p_actor_id TEXT DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL,
  p_target_type TEXT DEFAULT NULL,
  p_target_id TEXT DEFAULT NULL,
  p_target_name TEXT DEFAULT NULL,
  p_guild_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_status TEXT DEFAULT 'success'
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO activity_logs (
    action_type,
    action_category,
    description,
    actor_id,
    actor_name,
    target_type,
    target_id,
    target_name,
    guild_id,
    metadata,
    status
  ) VALUES (
    p_action_type,
    p_action_category,
    p_description,
    p_actor_id,
    p_actor_name,
    p_target_type,
    p_target_id,
    p_target_name,
    p_guild_id,
    p_metadata,
    p_status
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
SELECT 
  'Activity logging system created successfully!' as status,
  COUNT(*) as existing_logs
FROM activity_logs;

