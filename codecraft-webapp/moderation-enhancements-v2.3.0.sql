-- Moderation enhancements v2.3.0
-- Adds warning decay, case management fields, and appeals.

-- =============================================
-- Moderation config extensions
-- =============================================
ALTER TABLE moderation_configs
  ADD COLUMN IF NOT EXISTS warning_decay_days_manual INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS warning_decay_days_auto INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS auto_warn_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS appeals_channel_id TEXT;

-- =============================================
-- Moderation logs extensions (case management)
-- =============================================
ALTER TABLE moderation_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS moderator_name TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT,
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_mod_logs_deleted
  ON moderation_logs(guild_id, deleted_at);

-- =============================================
-- User warnings extensions (warning decay)
-- =============================================
ALTER TABLE user_warnings
  ADD COLUMN IF NOT EXISTS warning_type TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_warnings_expiration
  ON user_warnings(guild_id, active, expires_at);

-- =============================================
-- Appeals table
-- =============================================
CREATE TABLE IF NOT EXISTS moderation_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  case_id INTEGER,
  user_id TEXT NOT NULL,
  username TEXT,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, denied
  source TEXT DEFAULT 'dashboard', -- dashboard, discord
  channel_id TEXT,
  message_id TEXT,
  decided_by TEXT,
  decision_reason TEXT,
  decided_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appeals_guild_status
  ON moderation_appeals(guild_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appeals_case
  ON moderation_appeals(guild_id, case_id);

ALTER TABLE moderation_appeals ENABLE ROW LEVEL SECURITY;

-- Allow guild owners and authorized users to manage appeals
CREATE POLICY "Users can view own guild appeals"
ON moderation_appeals
FOR SELECT
USING (
  guild_id IN (
    SELECT gc.guild_id FROM guild_configs gc
    WHERE gc.owner_discord_id = current_setting('app.user_discord_id', true)
  )
  OR
  guild_id IN (
    SELECT gau.guild_id FROM guild_authorized_users gau
    WHERE gau.discord_id = current_setting('app.user_discord_id', true)
  )
);

CREATE POLICY "Users can manage own guild appeals"
ON moderation_appeals
FOR ALL
USING (
  guild_id IN (
    SELECT gc.guild_id FROM guild_configs gc
    WHERE gc.owner_discord_id = current_setting('app.user_discord_id', true)
  )
  OR
  guild_id IN (
    SELECT gau.guild_id FROM guild_authorized_users gau
    WHERE gau.discord_id = current_setting('app.user_discord_id', true)
  )
);
