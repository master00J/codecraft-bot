-- ================================================================
-- AUTO-REACTIONS MIGRATION
-- Run this SQL in your Supabase SQL Editor to add auto-reactions support
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

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

