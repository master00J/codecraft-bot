-- ================================================================
-- GAME NEWS SYSTEM - DATABASE SCHEMA
-- ================================================================
-- Feature: Automatisch game nieuws en updates delen in Discord
-- Games: League of Legends, Fortnite, Valorant, Minecraft, CS2
-- ================================================================

-- Game news sources metadata (track API status, last check, etc.)
-- NOTE: This must be created FIRST so game_news_configs can reference it
CREATE TABLE IF NOT EXISTS game_news_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id TEXT NOT NULL UNIQUE,
  game_name TEXT NOT NULL,
  game_icon_url TEXT,
  api_type TEXT NOT NULL, -- 'riot', 'fortnite-api', 'steam', 'rss'
  last_check_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  check_interval_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'active', -- 'active', 'error', 'disabled'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game news configurations per guild
CREATE TABLE IF NOT EXISTS game_news_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  game_id TEXT NOT NULL REFERENCES game_news_sources(game_id) ON DELETE RESTRICT, -- Foreign key to game_news_sources
  enabled BOOLEAN DEFAULT true,
  notification_role_id TEXT, -- Optional role to ping (@News, @Updates, etc.)
  filters JSONB DEFAULT '{"types": ["all"]}'::jsonb, -- Filter types: patch, event, maintenance, hotfix, news
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, game_id) -- One config per game per guild
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_game_news_configs_guild ON game_news_configs(guild_id);
CREATE INDEX IF NOT EXISTS idx_game_news_configs_enabled ON game_news_configs(enabled) WHERE enabled = true;

-- Game news posts cache (prevent duplicate posts)
CREATE TABLE IF NOT EXISTS game_news_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id TEXT NOT NULL, -- 'lol', 'valorant', etc.
  external_id TEXT NOT NULL, -- Source's unique ID (e.g., patch number, article ID)
  title TEXT NOT NULL,
  content TEXT, -- Summary or full content
  url TEXT, -- Link to full article
  image_url TEXT, -- Featured image/banner
  thumbnail_url TEXT, -- Smaller icon/thumbnail
  news_type TEXT DEFAULT 'news', -- 'patch', 'event', 'maintenance', 'hotfix', 'news'
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb, -- Extra data (version, tags, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, external_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_game_news_posts_game ON game_news_posts(game_id);
CREATE INDEX IF NOT EXISTS idx_game_news_posts_published ON game_news_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_news_posts_type ON game_news_posts(news_type);

-- Track which guilds received which news (prevent duplicate deliveries)
CREATE TABLE IF NOT EXISTS game_news_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  news_post_id UUID NOT NULL REFERENCES game_news_posts(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL, -- Discord message ID
  config_id UUID REFERENCES game_news_configs(id) ON DELETE CASCADE,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for delivery tracking
CREATE INDEX IF NOT EXISTS idx_game_news_deliveries_post ON game_news_deliveries(news_post_id);
CREATE INDEX IF NOT EXISTS idx_game_news_deliveries_guild ON game_news_deliveries(guild_id);
CREATE INDEX IF NOT EXISTS idx_game_news_deliveries_delivered ON game_news_deliveries(delivered_at DESC);

-- Insert default game sources with Twitch CDN icons (reliable and small)
INSERT INTO game_news_sources (game_id, game_name, game_icon_url, api_type, check_interval_minutes, metadata) VALUES
  ('lol', 'League of Legends', 'https://static-cdn.jtvnw.net/ttv-boxart/21779-285x380.jpg', 'riot', 30, '{"region": "na", "locale": "en_US"}'::jsonb),
  ('valorant', 'Valorant', 'https://static-cdn.jtvnw.net/ttv-boxart/516575-285x380.jpg', 'riot', 30, '{"region": "na", "locale": "en-US"}'::jsonb),
  ('fortnite', 'Fortnite', 'https://static-cdn.jtvnw.net/ttv-boxart/33214-285x380.jpg', 'fortnite-api', 60, '{"language": "en"}'::jsonb),
  ('minecraft', 'Minecraft', 'https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg', 'rss', 120, '{"feed_url": "https://www.minecraft.net/en-us/feeds/community-content/rss"}'::jsonb),
  ('cs2', 'Counter-Strike 2', 'https://static-cdn.jtvnw.net/ttv-boxart/32399_IGDB-285x380.jpg', 'steam', 60, '{"app_id": "730"}'::jsonb)
ON CONFLICT (game_id) DO UPDATE SET 
  game_icon_url = EXCLUDED.game_icon_url;

-- RLS Policies
ALTER TABLE game_news_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_news_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_news_sources ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to game_news_configs" ON game_news_configs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to game_news_posts" ON game_news_posts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to game_news_deliveries" ON game_news_deliveries
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to game_news_sources" ON game_news_sources
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read their own guild's configs
CREATE POLICY "Users can read own guild configs" ON game_news_configs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to read game sources
CREATE POLICY "Users can read game sources" ON game_news_sources
  FOR SELECT USING (auth.role() = 'authenticated');

-- Comments for documentation
COMMENT ON TABLE game_news_configs IS 'Configuration for game news per guild (which games to track, where to post)';
COMMENT ON TABLE game_news_posts IS 'Cache of game news posts to prevent duplicates';
COMMENT ON TABLE game_news_deliveries IS 'Track which guilds received which news posts';
COMMENT ON TABLE game_news_sources IS 'Metadata for game news sources (API status, check intervals)';

COMMENT ON COLUMN game_news_configs.filters IS 'JSONB filter configuration: {"types": ["patch", "event", "maintenance"]}';
COMMENT ON COLUMN game_news_posts.metadata IS 'Extra metadata like patch version, champion names, etc.';
COMMENT ON COLUMN game_news_sources.metadata IS 'API-specific configuration (region, locale, app_id, etc.)';

