-- ================================================================
-- COMCRAFT - Complete Database Schema
-- MEE6-like Discord Bot Platform voor Content Creators
-- ================================================================

-- ================================================================
-- CLEANUP (Run dit als je het schema opnieuw wilt installeren)
-- ================================================================
-- UNCOMMENT onderstaande regels ALLEEN als je alles opnieuw wilt installeren:

-- DROP VIEW IF EXISTS active_mod_cases CASCADE;
-- DROP VIEW IF EXISTS guild_leaderboards CASCADE;
-- DROP TABLE IF EXISTS subscription_invoices CASCADE;
-- DROP TABLE IF EXISTS comcraft_subscriptions CASCADE;
-- DROP TABLE IF EXISTS message_activity CASCADE;
-- DROP TABLE IF EXISTS server_stats CASCADE;
-- DROP TABLE IF EXISTS giveaways CASCADE;
-- DROP TABLE IF EXISTS stream_history CASCADE;
-- DROP TABLE IF EXISTS stream_notifications CASCADE;
-- DROP TABLE IF EXISTS welcome_configs CASCADE;
-- DROP TABLE IF EXISTS user_warnings CASCADE;
-- DROP TABLE IF EXISTS moderation_logs CASCADE;
-- DROP TABLE IF EXISTS moderation_configs CASCADE;
-- DROP TABLE IF EXISTS custom_commands CASCADE;
-- DROP TABLE IF EXISTS level_rewards CASCADE;
-- DROP TABLE IF EXISTS leveling_configs CASCADE;
-- DROP TABLE IF EXISTS user_levels CASCADE;
-- DROP TABLE IF EXISTS guild_configs CASCADE;
-- DROP TABLE IF EXISTS subscription_tier_limits CASCADE;

-- Of om ALLEEN de active kolom toe te voegen aan bestaande table:
-- ALTER TABLE moderation_logs ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- ================================================================
-- GUILD CONFIGURATIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS guild_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  guild_name TEXT,
  guild_icon_url TEXT,
  owner_discord_id TEXT NOT NULL,
  
  -- Subscription info
  subscription_tier TEXT DEFAULT 'free', -- free, basic, premium, enterprise
  subscription_status TEXT DEFAULT 'active', -- active, cancelled, expired
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  subscription_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Bot settings
  prefix TEXT DEFAULT '!',
  language TEXT DEFAULT 'nl', -- nl, en
  timezone TEXT DEFAULT 'Europe/Amsterdam',
  
  -- Module toggles
  leveling_enabled BOOLEAN DEFAULT true,
  moderation_enabled BOOLEAN DEFAULT true,
  welcome_enabled BOOLEAN DEFAULT false,
  streaming_enabled BOOLEAN DEFAULT false,
  custom_commands_enabled BOOLEAN DEFAULT true,
  
  -- Advanced settings
  xp_boost DECIMAL(3,2) DEFAULT 1.0,
  custom_branding_enabled BOOLEAN DEFAULT false,
  bot_color TEXT DEFAULT '#5865F2',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index voor snelle guild lookups
CREATE INDEX IF NOT EXISTS idx_guild_configs_guild_id ON guild_configs(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_configs_owner ON guild_configs(owner_discord_id);

-- Trial kolommen (per november 2025 toegevoegd)
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false;

ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- ================================================================
-- LEVELING SYSTEM
-- ================================================================

-- User levels per guild
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

-- Leveling configuration per guild
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

-- Level rewards (roles to give at specific levels)
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

-- ================================================================
-- CUSTOM COMMANDS
-- ================================================================
CREATE TABLE IF NOT EXISTS custom_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  
  trigger TEXT NOT NULL,
  response TEXT NOT NULL,
  
  -- Embed settings
  embed_enabled BOOLEAN DEFAULT false,
  embed_title TEXT,
  embed_description TEXT,
  embed_color TEXT DEFAULT '#5865F2',
  embed_thumbnail_url TEXT,
  embed_image_url TEXT,
  embed_footer TEXT,
  embed_fields JSONB, -- array of {name, value, inline}
  
  -- Permissions
  allowed_roles TEXT[], -- array of role IDs, empty = everyone
  allowed_channels TEXT[], -- array of channel IDs, empty = all
  
  -- Stats
  uses INTEGER DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE,
  
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, trigger)
);

CREATE INDEX IF NOT EXISTS idx_custom_commands_guild ON custom_commands(guild_id);
CREATE INDEX IF NOT EXISTS idx_custom_commands_trigger ON custom_commands(guild_id, trigger);

-- ================================================================
-- MODERATION SYSTEM
-- ================================================================

-- Moderation configuration
CREATE TABLE IF NOT EXISTS moderation_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  
  -- Auto-mod settings
  automod_enabled BOOLEAN DEFAULT false,
  filter_spam BOOLEAN DEFAULT true,
  filter_links BOOLEAN DEFAULT false,
  filter_invites BOOLEAN DEFAULT true,
  filter_caps BOOLEAN DEFAULT false,
  filter_words TEXT[], -- array of banned words
  filter_mention_spam BOOLEAN DEFAULT true,
  filter_emoji_spam BOOLEAN DEFAULT false,
  filter_duplicates BOOLEAN DEFAULT false,
  
  -- AI Moderation
  ai_moderation_enabled BOOLEAN DEFAULT false,
  
  -- Caps settings
  caps_threshold INTEGER DEFAULT 70, -- percentage
  caps_min_length INTEGER DEFAULT 10,
  
  -- Spam settings
  spam_messages INTEGER DEFAULT 5,
  spam_interval INTEGER DEFAULT 5, -- seconds
  
  -- Mention spam settings
  max_mentions INTEGER DEFAULT 5,
  
  -- Emoji spam settings
  max_emojis INTEGER DEFAULT 10,
  
  -- Duplicate message settings
  duplicate_time_window INTEGER DEFAULT 60, -- seconds
  
  -- Auto slowmode settings
  auto_slowmode_enabled BOOLEAN DEFAULT false,
  auto_slowmode_duration INTEGER DEFAULT 5, -- seconds
  auto_slowmode_reset INTEGER DEFAULT 300, -- seconds until slowmode is removed
  
  -- Anti-raid settings
  anti_raid_enabled BOOLEAN DEFAULT false,
  raid_time_window INTEGER DEFAULT 10, -- seconds
  raid_max_joins INTEGER DEFAULT 5,
  raid_kick_new_members BOOLEAN DEFAULT false,
  
  -- Auto-ban settings
  auto_ban_enabled BOOLEAN DEFAULT false,
  auto_ban_threshold INTEGER DEFAULT 3, -- warnings before auto-ban
  auto_ban_duration INTEGER, -- minutes, null = permanent
  
  -- Action settings
  muted_role_id TEXT,
  mod_log_channel_id TEXT,
  mod_role_id TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns to existing tables (safe migration)
ALTER TABLE moderation_configs 
  ADD COLUMN IF NOT EXISTS filter_mention_spam BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS filter_emoji_spam BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS filter_duplicates BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_moderation_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_mentions INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_emojis INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS duplicate_time_window INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS auto_slowmode_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_slowmode_duration INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS auto_slowmode_reset INTEGER DEFAULT 300,
  ADD COLUMN IF NOT EXISTS anti_raid_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS raid_time_window INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS raid_max_joins INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS raid_kick_new_members BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_ban_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_ban_threshold INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS auto_ban_duration INTEGER,
  ADD COLUMN IF NOT EXISTS mod_role_id TEXT;

-- Moderation logs/cases
CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  case_id INTEGER NOT NULL,
  
  user_id TEXT NOT NULL,
  username TEXT,
  
  moderator_id TEXT NOT NULL,
  moderator_name TEXT,
  
  action TEXT NOT NULL, -- warn, mute, unmute, kick, ban, unban
  reason TEXT,
  duration INTEGER, -- in minutes, null = permanent
  expires_at TIMESTAMP WITH TIME ZONE,
  
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, case_id)
);

CREATE INDEX IF NOT EXISTS idx_mod_logs_guild ON moderation_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_mod_logs_user ON moderation_logs(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mod_logs_active ON moderation_logs(guild_id, active, expires_at);

-- User warnings (separate tracking)
CREATE TABLE IF NOT EXISTS user_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  moderator_id TEXT NOT NULL,
  reason TEXT,
  
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id, created_at)
);

CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON user_warnings(guild_id, user_id, active);

-- ================================================================
-- STREAMING NOTIFICATIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS stream_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  
  -- Discord settings
  channel_id TEXT NOT NULL, -- where to post notifications
  role_to_ping TEXT, -- role to ping, null = no ping
  
  -- Streamer info
  platform TEXT NOT NULL, -- twitch, youtube
  streamer_id TEXT NOT NULL,
  streamer_name TEXT NOT NULL,
  streamer_avatar_url TEXT,
  
  -- Message template
  message_template TEXT DEFAULT '🔴 {streamer} is nu LIVE!',
  custom_message TEXT,
  
  -- Status tracking
  is_live BOOLEAN DEFAULT false,
  current_stream_id TEXT,
  last_notification_sent TIMESTAMP WITH TIME ZONE,
  notification_message_id TEXT, -- to edit/delete later
  
  -- Stats
  total_notifications_sent INTEGER DEFAULT 0,
  
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, platform, streamer_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_notifs_guild ON stream_notifications(guild_id);
CREATE INDEX IF NOT EXISTS idx_stream_notifs_enabled ON stream_notifications(enabled, is_live);

-- Stream history (for analytics)
CREATE TABLE IF NOT EXISTS stream_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES stream_notifications(id) ON DELETE CASCADE,
  
  stream_id TEXT NOT NULL,
  title TEXT,
  game_name TEXT,
  viewer_count INTEGER,
  
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_history_notif ON stream_history(notification_id);

-- ================================================================
-- WELCOME SYSTEM
-- ================================================================
CREATE TABLE IF NOT EXISTS welcome_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  
  -- Welcome message
  welcome_enabled BOOLEAN DEFAULT false,
  welcome_channel_id TEXT,
  welcome_message TEXT DEFAULT 'Welkom {user} bij {server}!',
  welcome_embed_enabled BOOLEAN DEFAULT false,
  welcome_embed_title TEXT,
  welcome_embed_description TEXT,
  welcome_embed_color TEXT DEFAULT '#5865F2',
  welcome_embed_image_url TEXT,
  welcome_dm_enabled BOOLEAN DEFAULT false,
  welcome_dm_message TEXT,
  
  -- Leave message
  leave_enabled BOOLEAN DEFAULT false,
  leave_channel_id TEXT,
  leave_message TEXT DEFAULT '{user} heeft de server verlaten.',
  
  -- Auto-role
  autorole_enabled BOOLEAN DEFAULT false,
  autorole_ids TEXT[], -- array of role IDs to give on join
  autorole_delay INTEGER DEFAULT 0, -- seconds to wait
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- GIVEAWAYS (Bonus feature)
-- ================================================================
CREATE TABLE IF NOT EXISTS giveaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  
  prize TEXT NOT NULL,
  winner_count INTEGER DEFAULT 1,
  
  host_id TEXT NOT NULL,
  host_name TEXT,
  
  required_role_id TEXT, -- null = no requirement
  
  -- Embed customization
  embed_title TEXT,
  embed_description TEXT,
  embed_color TEXT,
  embed_footer TEXT,
  embed_image_url TEXT,
  embed_thumbnail_url TEXT,
  join_button_label TEXT,
  cta_button_label TEXT,
  cta_button_url TEXT,

  -- Reward automation
  reward_role_id TEXT,
  reward_role_remove_after INTEGER,
  reward_dm_message TEXT,
  reward_channel_id TEXT,
  reward_channel_message TEXT,

  entries TEXT[], -- array of user IDs who entered
  winners TEXT[], -- array of user IDs who won
  
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id);
CREATE INDEX IF NOT EXISTS idx_giveaways_active ON giveaways(ended, ends_at);

-- ================================================================
-- AI CONFIGURATION
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_personas (
  guild_id TEXT PRIMARY KEY,
  assistant_name TEXT,
  system_prompt TEXT,
  style_guidelines TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_settings (
  guild_id TEXT PRIMARY KEY,
  allow_question_command BOOLEAN DEFAULT true,
  allow_moderation BOOLEAN DEFAULT false,
  default_provider TEXT DEFAULT 'gemini',
  chat_enabled BOOLEAN DEFAULT false,
  chat_channel_id TEXT,
  chat_reply_in_thread BOOLEAN DEFAULT true,
  memory_enabled BOOLEAN DEFAULT true,
  memory_max_entries INTEGER DEFAULT 200,
  memory_retention_days INTEGER DEFAULT 90,
  web_search_enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  tags TEXT[],
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_documents_guild ON ai_documents(guild_id);
CREATE INDEX IF NOT EXISTS idx_ai_documents_guild_pinned ON ai_documents(guild_id, is_pinned);

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT,
  channel_id TEXT,
  message_id TEXT,
  type TEXT NOT NULL DEFAULT 'fact', -- fact, event, summary, note
  label TEXT,
  summary TEXT NOT NULL,
  details JSONB, -- raw data payload (optional)
  importance SMALLINT DEFAULT 0, -- -5..5 scale, higher = more important
  expires_at TIMESTAMP WITH TIME ZONE, -- optional expiry
  embedding vector(768),
  embedding_model TEXT,
  embedding_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE IF EXISTS ai_memories
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_ai_memories_guild ON ai_memories(guild_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_guild_user ON ai_memories(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_importance ON ai_memories(guild_id, importance DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memories_expiry ON ai_memories(guild_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_memories_embedding
  ON ai_memories
  USING ivfflat (embedding vector_l2_ops)
  WITH (lists = 100);

CREATE OR REPLACE FUNCTION match_ai_memories(
  p_guild_id TEXT,
  query_embedding vector(768),
  match_count INTEGER DEFAULT 8,
  similarity_threshold REAL DEFAULT 0.2,
  p_user_id TEXT DEFAULT NULL,
  include_global BOOLEAN DEFAULT true,
  min_importance SMALLINT DEFAULT -2
)
RETURNS TABLE (
  id UUID,
  guild_id TEXT,
  user_id TEXT,
  channel_id TEXT,
  message_id TEXT,
  type TEXT,
  label TEXT,
  summary TEXT,
  importance SMALLINT,
  expires_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  similarity REAL
) AS $$
  SELECT
    m.id,
    m.guild_id,
    m.user_id,
    m.channel_id,
    m.message_id,
    m.type,
    m.label,
    m.summary,
    m.importance,
    m.expires_at,
    m.updated_at,
    1 - (m.embedding <-> query_embedding) AS similarity
  FROM ai_memories m
  WHERE
    m.guild_id = p_guild_id
    AND m.embedding IS NOT NULL
    AND m.importance >= min_importance
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND (
      p_user_id IS NULL AND include_global = true
      OR (p_user_id IS NOT NULL AND include_global = true AND (m.user_id = p_user_id OR m.user_id IS NULL))
      OR (p_user_id IS NOT NULL AND include_global = false AND m.user_id = p_user_id)
      OR (p_user_id IS NULL AND include_global = false AND m.user_id IS NULL)
    )
    AND 1 - (m.embedding <-> query_embedding) >= similarity_threshold
  ORDER BY m.embedding <-> query_embedding
  LIMIT match_count;
$$ LANGUAGE SQL STABLE;

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  task_type TEXT NOT NULL,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  tokens_total INTEGER DEFAULT 0,
  cost_usd NUMERIC(12,6) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_guild ON ai_usage_logs(guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider ON ai_usage_logs(provider, created_at DESC);

-- ================================================================
-- ANALYTICS & STATISTICS
-- ================================================================

-- Daily server statistics
CREATE TABLE IF NOT EXISTS server_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  date DATE NOT NULL,
  
  -- Member stats
  total_members INTEGER DEFAULT 0,
  members_joined INTEGER DEFAULT 0,
  members_left INTEGER DEFAULT 0,
  
  -- Message stats
  total_messages INTEGER DEFAULT 0,
  total_xp_gained BIGINT DEFAULT 0,
  
  -- Moderation stats
  total_warnings INTEGER DEFAULT 0,
  total_mutes INTEGER DEFAULT 0,
  total_kicks INTEGER DEFAULT 0,
  total_bans INTEGER DEFAULT 0,
  
  -- Command stats
  commands_used INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, date)
);

CREATE INDEX IF NOT EXISTS idx_server_stats_guild ON server_stats(guild_id, date DESC);

-- Message activity per hour (for heatmaps)
CREATE TABLE IF NOT EXISTS message_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  date DATE NOT NULL,
  hour INTEGER NOT NULL, -- 0-23
  
  message_count INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, date, hour)
);

CREATE INDEX IF NOT EXISTS idx_message_activity ON message_activity(guild_id, date, hour);

-- ================================================================
-- SUBSCRIPTIONS & PAYMENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS comcraft_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  owner_discord_id TEXT NOT NULL,
  
  tier TEXT NOT NULL, -- free, basic, premium, enterprise
  status TEXT DEFAULT 'active', -- active, cancelled, expired, past_due
  
  -- Payment info
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  
  -- Pricing
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'eur',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_guild ON comcraft_subscriptions(guild_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_owner ON comcraft_subscriptions(owner_discord_id);

-- Subscription history/invoices
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES comcraft_subscriptions(id) ON DELETE CASCADE,
  
  stripe_invoice_id TEXT,
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'eur',
  
  status TEXT, -- paid, pending, failed
  paid_at TIMESTAMP WITH TIME ZONE,
  
  invoice_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

-- Enable RLS
ALTER TABLE guild_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE leveling_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE comcraft_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see/edit their own guilds
CREATE POLICY "Users can view own guilds" ON guild_configs
  FOR SELECT USING (
    owner_discord_id = current_setting('app.user_discord_id', true)
  );

CREATE POLICY "Users can update own guilds" ON guild_configs
  FOR UPDATE USING (
    owner_discord_id = current_setting('app.user_discord_id', true)
  );

-- Similar policies for other tables
CREATE POLICY "Users can view own guild data" ON user_levels
  FOR SELECT USING (
    guild_id IN (
      SELECT guild_id FROM guild_configs 
      WHERE owner_discord_id = current_setting('app.user_discord_id', true)
    )
  );

CREATE POLICY "Users can view own guild commands" ON custom_commands
  FOR SELECT USING (
    guild_id IN (
      SELECT guild_id FROM guild_configs 
      WHERE owner_discord_id = current_setting('app.user_discord_id', true)
    )
  );

CREATE POLICY "Users can manage own guild commands" ON custom_commands
  FOR ALL USING (
    guild_id IN (
      SELECT guild_id FROM guild_configs 
      WHERE owner_discord_id = current_setting('app.user_discord_id', true)
    )
  );

-- ================================================================
-- FUNCTIONS & TRIGGERS
-- ================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_guild_configs_updated_at
  BEFORE UPDATE ON guild_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_leveling_configs_updated_at
  BEFORE UPDATE ON leveling_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_custom_commands_updated_at
  BEFORE UPDATE ON custom_commands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to automatically create configs when guild is added
CREATE OR REPLACE FUNCTION create_guild_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Create leveling config
  INSERT INTO leveling_configs (guild_id)
  VALUES (NEW.guild_id)
  ON CONFLICT (guild_id) DO NOTHING;
  
  -- Create moderation config
  INSERT INTO moderation_configs (guild_id)
  VALUES (NEW.guild_id)
  ON CONFLICT (guild_id) DO NOTHING;
  
  -- Create welcome config
  INSERT INTO welcome_configs (guild_id)
  VALUES (NEW.guild_id)
  ON CONFLICT (guild_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_guild_defaults_trigger
  AFTER INSERT ON guild_configs
  FOR EACH ROW EXECUTE FUNCTION create_guild_defaults();

-- ================================================================
-- INITIAL DATA / SEED
-- ================================================================

-- Insert default subscription tier limits
CREATE TABLE IF NOT EXISTS subscription_tier_limits (
  tier TEXT PRIMARY KEY,
  max_custom_commands INTEGER,
  max_stream_notifications INTEGER,
  max_guilds INTEGER DEFAULT 1,
  xp_boost DECIMAL(3,2) DEFAULT 1.0,
  custom_branding BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  api_access BOOLEAN DEFAULT false
);

INSERT INTO subscription_tier_limits (tier, max_custom_commands, max_stream_notifications, max_guilds, xp_boost, custom_branding, priority_support, api_access) VALUES
('free', 5, 1, 1, 1.0, false, false, false),
('basic', 25, 5, 1, 1.2, false, false, false),
('premium', -1, -1, 1, 1.5, true, true, false),
('enterprise', -1, -1, 5, 2.0, true, true, true)
ON CONFLICT (tier) DO NOTHING;

-- ================================================================
-- VIEWS (for easier queries)
-- ================================================================

-- View: Guild leaderboard
CREATE OR REPLACE VIEW guild_leaderboards AS
SELECT 
  guild_id,
  user_id,
  username,
  level,
  xp,
  total_messages,
  ROW_NUMBER() OVER (PARTITION BY guild_id ORDER BY xp DESC) as rank
FROM user_levels
ORDER BY guild_id, xp DESC;

-- View: Active moderation cases (Optional - can be removed if causing issues)
-- Uncomment if needed:
-- CREATE OR REPLACE VIEW active_mod_cases AS
-- SELECT *,
--   CASE 
--     WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN false
--     ELSE active
--   END as is_currently_active
-- FROM moderation_logs
-- WHERE active = true;

-- ================================================================
-- ECONOMY SYSTEM
-- ================================================================

-- User economy balances per guild
CREATE TABLE IF NOT EXISTS user_economy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  avatar_url TEXT,
  
  balance BIGINT DEFAULT 0, -- coins/currency amount
  total_earned BIGINT DEFAULT 0, -- lifetime earnings
  total_spent BIGINT DEFAULT 0, -- lifetime spending
  
  daily_streak INTEGER DEFAULT 0, -- consecutive daily rewards
  last_daily_claim TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_economy_guild ON user_economy(guild_id);
CREATE INDEX IF NOT EXISTS idx_user_economy_user ON user_economy(user_id);
CREATE INDEX IF NOT EXISTS idx_user_economy_balance ON user_economy(guild_id, balance DESC);

-- Economy transactions log
CREATE TABLE IF NOT EXISTS economy_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  
  from_user_id TEXT, -- null for system transactions
  to_user_id TEXT, -- null for system transactions
  
  amount BIGINT NOT NULL,
  transaction_type TEXT NOT NULL, -- daily, pay, casino_win, casino_loss, xp_convert, admin_add, admin_remove
  description TEXT,
  
  metadata JSONB, -- additional data (game type, bet amount, etc.)
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economy_transactions_guild ON economy_transactions(guild_id);
CREATE INDEX IF NOT EXISTS idx_economy_transactions_user ON economy_transactions(guild_id, from_user_id);
CREATE INDEX IF NOT EXISTS idx_economy_transactions_type ON economy_transactions(guild_id, transaction_type);

-- Economy configuration per guild
CREATE TABLE IF NOT EXISTS economy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  
  -- Daily rewards
  daily_reward_base INTEGER DEFAULT 100, -- base daily reward
  daily_streak_bonus INTEGER DEFAULT 10, -- bonus per streak day
  daily_max_streak INTEGER DEFAULT 30, -- max streak bonus
  
  -- XP conversion
  xp_to_coins_rate DECIMAL(10,2) DEFAULT 0.1, -- 1 XP = 0.1 coins
  xp_conversion_enabled BOOLEAN DEFAULT true,
  
  -- Limits
  max_balance BIGINT DEFAULT 1000000000, -- max balance per user
  min_pay_amount INTEGER DEFAULT 1, -- minimum payment amount
  max_pay_amount BIGINT DEFAULT 1000000, -- maximum payment amount
  
  -- Settings
  economy_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- CASINO SYSTEM
-- ================================================================

-- Casino game history
CREATE TABLE IF NOT EXISTS casino_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  
  game_type TEXT NOT NULL, -- dice, slots, coinflip, blackjack, roulette
  bet_amount BIGINT NOT NULL,
  win_amount BIGINT DEFAULT 0, -- 0 if lost
  result TEXT, -- win, loss, draw
  
  game_data JSONB, -- game-specific data (dice rolls, slot symbols, etc.)
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casino_history_guild ON casino_history(guild_id);
CREATE INDEX IF NOT EXISTS idx_casino_history_user ON casino_history(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_casino_history_game ON casino_history(guild_id, game_type);
CREATE INDEX IF NOT EXISTS idx_casino_history_date ON casino_history(guild_id, created_at DESC);

-- Casino statistics per user
CREATE TABLE IF NOT EXISTS casino_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  total_games INTEGER DEFAULT 0,
  total_bet BIGINT DEFAULT 0,
  total_won BIGINT DEFAULT 0,
  total_lost BIGINT DEFAULT 0,
  
  -- Per game type stats
  dice_games INTEGER DEFAULT 0,
  dice_wins INTEGER DEFAULT 0,
  dice_profit BIGINT DEFAULT 0,
  
  slots_games INTEGER DEFAULT 0,
  slots_wins INTEGER DEFAULT 0,
  slots_profit BIGINT DEFAULT 0,
  
  coinflip_games INTEGER DEFAULT 0,
  coinflip_wins INTEGER DEFAULT 0,
  coinflip_profit BIGINT DEFAULT 0,
  
  blackjack_games INTEGER DEFAULT 0,
  blackjack_wins INTEGER DEFAULT 0,
  blackjack_profit BIGINT DEFAULT 0,
  
  biggest_win BIGINT DEFAULT 0,
  biggest_loss BIGINT DEFAULT 0,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_casino_stats_guild ON casino_stats(guild_id);
CREATE INDEX IF NOT EXISTS idx_casino_stats_user ON casino_stats(user_id);

-- Casino configuration per guild
CREATE TABLE IF NOT EXISTS casino_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  
  -- General settings
  casino_enabled BOOLEAN DEFAULT true,
  
  -- Bet limits
  min_bet INTEGER DEFAULT 10,
  max_bet BIGINT DEFAULT 100000,
  
  -- Game settings
  dice_enabled BOOLEAN DEFAULT true,
  slots_enabled BOOLEAN DEFAULT true,
  coinflip_enabled BOOLEAN DEFAULT true,
  blackjack_enabled BOOLEAN DEFAULT true,
  roulette_enabled BOOLEAN DEFAULT false,
  
  -- House edge (percentage the house keeps)
  house_edge DECIMAL(5,2) DEFAULT 5.0, -- 5% house edge
  
  -- Cooldowns (in seconds)
  game_cooldown INTEGER DEFAULT 0, -- 0 = no cooldown
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- UPDATE SUBSCRIPTION TIER LIMITS
-- ================================================================

-- Add economy and casino columns to subscription_tier_limits
ALTER TABLE subscription_tier_limits
  ADD COLUMN IF NOT EXISTS economy_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS casino_enabled BOOLEAN DEFAULT false;

-- Update existing tier limits with economy/casino features
UPDATE subscription_tier_limits
SET 
  economy_enabled = CASE 
    WHEN tier IN ('premium', 'enterprise') THEN true 
    ELSE false 
  END,
  casino_enabled = CASE 
    WHEN tier IN ('premium', 'enterprise') THEN true 
    ELSE false 
  END
WHERE tier IN ('free', 'basic', 'premium', 'enterprise');

-- Insert/update tier limits with economy and casino
INSERT INTO subscription_tier_limits (
  tier, 
  max_custom_commands, 
  max_stream_notifications, 
  max_guilds, 
  xp_boost, 
  custom_branding, 
  priority_support, 
  api_access,
  economy_enabled,
  casino_enabled
) VALUES
('free', 5, 1, 1, 1.0, false, false, false, false, false),
('basic', 25, 5, 1, 1.2, false, false, false, false, false),
('premium', -1, -1, 1, 1.5, true, true, false, true, true),
('enterprise', -1, -1, 5, 2.0, true, true, true, true, true)
ON CONFLICT (tier) DO UPDATE SET
  economy_enabled = EXCLUDED.economy_enabled,
  casino_enabled = EXCLUDED.casino_enabled;

-- Enable RLS for new tables
ALTER TABLE user_economy ENABLE ROW LEVEL SECURITY;
ALTER TABLE economy_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE economy_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_configs ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- AUTO-REACTIONS SYSTEM
-- ================================================================

-- Auto-reactions configuration per guild
CREATE TABLE IF NOT EXISTS auto_reactions_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  
  -- General settings
  enabled BOOLEAN DEFAULT true,
  
  -- Channel restrictions (empty array = all channels)
  allowed_channels TEXT[], -- array of channel IDs, empty = all channels
  ignored_channels TEXT[], -- array of channel IDs to ignore
  
  -- Word boundaries (match whole words only)
  use_word_boundaries BOOLEAN DEFAULT true,
  
  -- Case sensitivity
  case_sensitive BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_reactions_configs_guild ON auto_reactions_configs(guild_id);

-- Auto-reactions rules (trigger words and emoji reactions)
CREATE TABLE IF NOT EXISTS auto_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  
  -- Trigger word(s)
  trigger_words TEXT[] NOT NULL, -- array of trigger words (e.g., ['goeiemorgen', 'goedemorgen'])
  
  -- Emoji reactions (server emoji IDs or unicode emoji names)
  emoji_ids TEXT[] NOT NULL, -- array of emoji IDs or names (e.g., ['😊', '👋', 'custom_emoji_id'])
  
  -- Settings
  enabled BOOLEAN DEFAULT true,
  case_sensitive BOOLEAN DEFAULT false, -- override global setting
  use_word_boundaries BOOLEAN DEFAULT true, -- override global setting
  
  -- Channel restrictions (null = all channels)
  allowed_channels TEXT[], -- array of channel IDs, null = all channels
  ignored_channels TEXT[], -- array of channel IDs to ignore
  
  -- Cooldown (prevent spam)
  cooldown_seconds INTEGER DEFAULT 0, -- 0 = no cooldown
  
  -- Stats
  trigger_count INTEGER DEFAULT 0,
  last_triggered TIMESTAMP WITH TIME ZONE,
  
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_reactions_guild ON auto_reactions(guild_id);
CREATE INDEX IF NOT EXISTS idx_auto_reactions_enabled ON auto_reactions(guild_id, enabled);

-- Enable RLS for auto-reactions tables
ALTER TABLE auto_reactions_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_reactions ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- COMPLETE! Schema ready for Comcraft (with Economy, Casino & Auto-Reactions)
-- ================================================================

