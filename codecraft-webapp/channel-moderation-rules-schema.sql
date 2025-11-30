-- Channel-Specific Moderation Rules Schema
-- Allows different moderation settings per Discord channel

CREATE TABLE IF NOT EXISTS channel_moderation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT, -- Store channel name for display purposes
  
  -- Override general filters (null = use general, true/false = override)
  filter_spam BOOLEAN, -- null = use general setting, true/false = override
  filter_links BOOLEAN,
  filter_invites BOOLEAN,
  filter_caps BOOLEAN,
  filter_mention_spam BOOLEAN,
  filter_emoji_spam BOOLEAN,
  filter_duplicates BOOLEAN,
  filter_words BOOLEAN, -- Whether to apply word filter in this channel
  
  -- Channel-specific content restrictions
  images_only BOOLEAN DEFAULT false, -- Only allow images/attachments, no text
  text_only BOOLEAN DEFAULT false, -- Only allow text, no images/attachments
  links_only BOOLEAN DEFAULT false, -- Only allow messages with links
  no_links BOOLEAN DEFAULT false, -- Block all links (same as filter_links but more explicit)
  
  -- Override thresholds (null = use general, number = override)
  spam_messages INTEGER, -- Override general spam_messages threshold
  spam_interval INTEGER, -- Override general spam_interval threshold
  caps_threshold INTEGER, -- Override general caps_threshold
  caps_min_length INTEGER, -- Override general caps_min_length
  max_mentions INTEGER, -- Override general max_mentions
  max_emojis INTEGER, -- Override general max_emojis
  duplicate_time_window INTEGER, -- Override general duplicate_time_window
  
  -- Auto-slowmode for this channel
  auto_slowmode_enabled BOOLEAN DEFAULT false,
  auto_slowmode_duration INTEGER DEFAULT 5,
  auto_slowmode_reset INTEGER DEFAULT 300,
  
  -- Enabled flag
  enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, channel_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_channel_mod_rules_guild ON channel_moderation_rules(guild_id);
CREATE INDEX IF NOT EXISTS idx_channel_mod_rules_channel ON channel_moderation_rules(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_mod_rules_enabled ON channel_moderation_rules(guild_id, enabled) WHERE enabled = true;

-- Update timestamp trigger
CREATE TRIGGER update_channel_mod_rules_updated_at
  BEFORE UPDATE ON channel_moderation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security
ALTER TABLE channel_moderation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view channel moderation rules for their guilds"
  ON channel_moderation_rules FOR SELECT
  USING (true);

CREATE POLICY "Users can insert channel moderation rules for their guilds"
  ON channel_moderation_rules FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update channel moderation rules for their guilds"
  ON channel_moderation_rules FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete channel moderation rules for their guilds"
  ON channel_moderation_rules FOR DELETE
  USING (true);

-- Comments
COMMENT ON TABLE channel_moderation_rules IS 'Stores channel-specific moderation rules that override general guild moderation settings';
COMMENT ON COLUMN channel_moderation_rules.filter_spam IS 'Override general spam filter (null = use general, true/false = override)';
COMMENT ON COLUMN channel_moderation_rules.images_only IS 'Only allow messages with images/attachments, block text-only messages';
COMMENT ON COLUMN channel_moderation_rules.text_only IS 'Only allow text messages, block all images/attachments';
COMMENT ON COLUMN channel_moderation_rules.links_only IS 'Only allow messages containing links';
COMMENT ON COLUMN channel_moderation_rules.no_links IS 'Explicitly block all links in this channel';

