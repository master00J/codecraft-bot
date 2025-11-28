-- Fix ComCraft Leveling System Tables
-- Run this in Supabase SQL Editor

-- ================================================================
-- USER LEVELS TABLE
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
-- LEVELING CONFIGS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS leveling_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  
  -- XP settings
  xp_min INTEGER DEFAULT 15,
  xp_max INTEGER DEFAULT 25,
  xp_cooldown INTEGER DEFAULT 60, -- seconds
  
  -- Level-up settings
  levelup_message_enabled BOOLEAN DEFAULT true,
  levelup_message_template TEXT DEFAULT 'Gefeliciteerd {user}! Je bent nu level {level}!',
  levelup_channel_id TEXT, -- null = same channel, or specific channel
  levelup_dm_enabled BOOLEAN DEFAULT false,
  
  -- XP multipliers
  voice_xp_enabled BOOLEAN DEFAULT false,
  voice_xp_per_minute INTEGER DEFAULT 2,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leveling_configs_guild ON leveling_configs(guild_id);

-- ================================================================
-- LEVEL REWARDS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS level_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  
  reward_type TEXT DEFAULT 'role', -- role, message, both
  role_id TEXT,
  message TEXT,
  
  stack_rewards BOOLEAN DEFAULT false, -- keep previous rewards or replace
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, level)
);

CREATE INDEX IF NOT EXISTS idx_level_rewards_guild ON level_rewards(guild_id);
CREATE INDEX IF NOT EXISTS idx_level_rewards_level ON level_rewards(guild_id, level);

-- ================================================================
-- AUTO-CREATE LEVELING CONFIG FOR EXISTING GUILDS
-- ================================================================

-- Insert default leveling config for any guild that doesn't have one
INSERT INTO leveling_configs (guild_id)
SELECT DISTINCT guild_id 
FROM guild_configs
WHERE guild_id NOT IN (SELECT guild_id FROM leveling_configs)
ON CONFLICT (guild_id) DO NOTHING;

-- Success message
SELECT 
  'Leveling system tables created successfully!' as status,
  (SELECT COUNT(*) FROM user_levels) as total_user_levels,
  (SELECT COUNT(*) FROM leveling_configs) as total_configs,
  (SELECT COUNT(*) FROM level_rewards) as total_rewards;

