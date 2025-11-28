-- ================================================================
-- COMPLETE COMCRAFT DATABASE FIX
-- Run this entire script in Supabase SQL Editor to fix all issues
-- ================================================================

-- ================================================================
-- 1. GUILD CONFIGS - Add missing columns
-- ================================================================

ALTER TABLE guild_configs 
ADD COLUMN IF NOT EXISTS guild_icon_url TEXT,
ADD COLUMN IF NOT EXISTS custom_bot_name TEXT DEFAULT 'ComCraft',
ADD COLUMN IF NOT EXISTS custom_bot_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS custom_embed_color TEXT DEFAULT '#5865F2',
ADD COLUMN IF NOT EXISTS custom_embed_footer TEXT DEFAULT 'Powered by ComCraft';

UPDATE guild_configs 
SET 
  custom_bot_name = COALESCE(custom_bot_name, 'ComCraft'),
  custom_embed_color = COALESCE(custom_embed_color, '#5865F2'),
  custom_embed_footer = COALESCE(custom_embed_footer, 'Powered by ComCraft')
WHERE custom_bot_name IS NULL 
   OR custom_embed_color IS NULL 
   OR custom_embed_footer IS NULL;

-- ================================================================
-- 2. GUILD AUTHORIZED USERS - Permission system
-- ================================================================

CREATE TABLE IF NOT EXISTS guild_authorized_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  added_by TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, discord_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_auth_user ON guild_authorized_users(discord_id);
CREATE INDEX IF NOT EXISTS idx_guild_auth_guild ON guild_authorized_users(guild_id);

-- Insert owners as authorized
INSERT INTO guild_authorized_users (guild_id, discord_id, role)
SELECT guild_id, owner_discord_id, 'owner'
FROM guild_configs
ON CONFLICT (guild_id, discord_id) DO NOTHING;

-- ================================================================
-- 3. USER LEVELS - Leveling system
-- ================================================================

CREATE TABLE IF NOT EXISTS user_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  discriminator TEXT,
  avatar_url TEXT,
  
  xp BIGINT DEFAULT 0,
  level INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  
  last_xp_gain TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_levels_guild ON user_levels(guild_id);
CREATE INDEX IF NOT EXISTS idx_user_levels_user ON user_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_levels_xp ON user_levels(guild_id, xp DESC);

-- ================================================================
-- 4. LEVELING CONFIGS
-- ================================================================

CREATE TABLE IF NOT EXISTS leveling_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  
  xp_min INTEGER DEFAULT 15,
  xp_max INTEGER DEFAULT 25,
  xp_cooldown INTEGER DEFAULT 60,
  
  levelup_message_enabled BOOLEAN DEFAULT true,
  levelup_message_template TEXT DEFAULT 'Gefeliciteerd {user}! Je bent nu level {level}!',
  levelup_channel_id TEXT,
  levelup_dm_enabled BOOLEAN DEFAULT false,
  
  voice_xp_enabled BOOLEAN DEFAULT false,
  voice_xp_per_minute INTEGER DEFAULT 2,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leveling_configs_guild ON leveling_configs(guild_id);

-- Auto-create leveling config for existing guilds
INSERT INTO leveling_configs (guild_id)
SELECT DISTINCT guild_id FROM guild_configs
WHERE guild_id NOT IN (SELECT guild_id FROM leveling_configs)
ON CONFLICT (guild_id) DO NOTHING;

-- ================================================================
-- 5. LEVEL REWARDS
-- ================================================================

CREATE TABLE IF NOT EXISTS level_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  
  reward_type TEXT DEFAULT 'role',
  role_id TEXT,
  message TEXT,
  
  stack_rewards BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, level)
);

CREATE INDEX IF NOT EXISTS idx_level_rewards_guild ON level_rewards(guild_id);
CREATE INDEX IF NOT EXISTS idx_level_rewards_level ON level_rewards(guild_id, level);

-- ================================================================
-- 6. STREAM NOTIFICATIONS - Add missing columns
-- ================================================================

ALTER TABLE stream_notifications 
ADD COLUMN IF NOT EXISTS last_notification_sent TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notification_message_id TEXT,
ADD COLUMN IF NOT EXISTS total_notifications_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_stream_id TEXT;

UPDATE stream_notifications 
SET total_notifications_sent = 0 
WHERE total_notifications_sent IS NULL;

CREATE INDEX IF NOT EXISTS idx_stream_notifications_live 
ON stream_notifications(guild_id, is_live);

CREATE INDEX IF NOT EXISTS idx_stream_notifications_last_sent 
ON stream_notifications(last_notification_sent);

-- ================================================================
-- 7. STREAM HISTORY
-- ================================================================

CREATE TABLE IF NOT EXISTS stream_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  notification_id UUID NOT NULL REFERENCES stream_notifications(id) ON DELETE CASCADE,
  
  stream_id TEXT NOT NULL,
  title TEXT,
  game_name TEXT,
  viewer_count INTEGER DEFAULT 0,
  
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  
  peak_viewers INTEGER,
  average_viewers INTEGER
);

CREATE INDEX IF NOT EXISTS idx_stream_history_notification ON stream_history(notification_id);
CREATE INDEX IF NOT EXISTS idx_stream_history_stream_id ON stream_history(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_history_started_at ON stream_history(started_at DESC);

-- ================================================================
-- 8. ENABLE LEVELING FOR ALL GUILDS (Default ON)
-- ================================================================

UPDATE guild_configs 
SET leveling_enabled = true 
WHERE leveling_enabled IS NULL OR leveling_enabled = false;

-- ================================================================
-- SUCCESS SUMMARY
-- ================================================================

SELECT 
  '✅ ComCraft Database Complete!' as status,
  (SELECT COUNT(*) FROM guild_configs) as total_guilds,
  (SELECT COUNT(*) FROM user_levels) as total_users_tracked,
  (SELECT COUNT(*) FROM leveling_configs) as leveling_configs,
  (SELECT COUNT(*) FROM stream_notifications) as stream_notifications,
  (SELECT COUNT(*) FROM stream_history) as stream_history_records;

