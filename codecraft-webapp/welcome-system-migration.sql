-- Welcome System Enhancement Migration
-- Adds comprehensive customization options for welcome messages

-- Add new columns to welcome_configs table
ALTER TABLE welcome_configs
  -- Embed enhancements
  ADD COLUMN IF NOT EXISTS welcome_embed_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS welcome_embed_footer_text TEXT,
  ADD COLUMN IF NOT EXISTS welcome_embed_footer_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS welcome_embed_fields JSONB DEFAULT '[]'::jsonb, -- Array of {name, value, inline}
  ADD COLUMN IF NOT EXISTS welcome_embed_author_name TEXT,
  ADD COLUMN IF NOT EXISTS welcome_embed_author_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS welcome_embed_author_url TEXT,
  
  -- Buttons/Actions
  ADD COLUMN IF NOT EXISTS welcome_buttons_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_buttons JSONB DEFAULT '[]'::jsonb, -- Array of {label, url, style, emoji}
  
  -- Leave message enhancements
  ADD COLUMN IF NOT EXISTS leave_embed_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS leave_embed_title TEXT,
  ADD COLUMN IF NOT EXISTS leave_embed_description TEXT,
  ADD COLUMN IF NOT EXISTS leave_embed_color TEXT DEFAULT '#FF0000',
  ADD COLUMN IF NOT EXISTS leave_embed_image_url TEXT,
  ADD COLUMN IF NOT EXISTS leave_embed_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS leave_embed_footer_text TEXT,
  ADD COLUMN IF NOT EXISTS leave_embed_footer_icon_url TEXT,
  
  -- DM enhancements
  ADD COLUMN IF NOT EXISTS welcome_dm_embed_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_dm_embed_title TEXT,
  ADD COLUMN IF NOT EXISTS welcome_dm_embed_description TEXT,
  ADD COLUMN IF NOT EXISTS welcome_dm_embed_color TEXT DEFAULT '#5865F2',
  ADD COLUMN IF NOT EXISTS welcome_dm_embed_image_url TEXT,
  
  -- Advanced options
  ADD COLUMN IF NOT EXISTS welcome_delete_after INTEGER DEFAULT 0, -- seconds (0 = never delete)
  ADD COLUMN IF NOT EXISTS welcome_mention_user BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_mention_roles TEXT[], -- Array of role IDs to mention
  ADD COLUMN IF NOT EXISTS welcome_mention_everyone BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_mention_here BOOLEAN DEFAULT false,
  
  -- Auto-role enhancements
  ADD COLUMN IF NOT EXISTS autorole_remove_on_leave BOOLEAN DEFAULT false, -- Remove roles when member leaves
  ADD COLUMN IF NOT EXISTS autorole_ignore_bots BOOLEAN DEFAULT false, -- Don't give roles to bots
  
  -- Statistics
  ADD COLUMN IF NOT EXISTS welcome_stats_enabled BOOLEAN DEFAULT false, -- Show member count, join position, etc.
  ADD COLUMN IF NOT EXISTS welcome_show_account_age BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_show_join_position BOOLEAN DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_welcome_configs_guild_id ON welcome_configs(guild_id);

-- Add comments for documentation
COMMENT ON COLUMN welcome_configs.welcome_embed_fields IS 'Array of embed fields: [{"name": "Field Name", "value": "Field Value", "inline": true}]';
COMMENT ON COLUMN welcome_configs.welcome_buttons IS 'Array of buttons: [{"label": "Button Text", "url": "https://...", "style": "primary|secondary|success|danger", "emoji": "🎉"}]';
COMMENT ON COLUMN welcome_configs.welcome_delete_after IS 'Delete welcome message after X seconds (0 = never)';
COMMENT ON COLUMN welcome_configs.welcome_mention_roles IS 'Array of role IDs to mention in welcome message';

