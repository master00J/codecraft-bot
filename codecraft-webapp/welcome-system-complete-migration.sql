-- Complete Welcome System Migration
-- Creates the table if it doesn't exist and adds all new columns

-- First, create the base table if it doesn't exist
CREATE TABLE IF NOT EXISTS welcome_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  
  -- Welcome message
  welcome_enabled BOOLEAN DEFAULT false,
  welcome_channel_id TEXT,
  welcome_message TEXT DEFAULT 'Welcome {user} to {server}!',
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
  leave_message TEXT DEFAULT '{user} has left the server.',
  
  -- Auto-role
  autorole_enabled BOOLEAN DEFAULT false,
  autorole_ids TEXT[], -- array of role IDs to give on join
  autorole_delay INTEGER DEFAULT 0, -- seconds to wait
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Now add all the new columns (using IF NOT EXISTS pattern with DO block)
DO $$ 
BEGIN
  -- Embed enhancements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_embed_thumbnail_url') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_embed_thumbnail_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_embed_footer_text') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_embed_footer_text TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_embed_footer_icon_url') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_embed_footer_icon_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_embed_fields') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_embed_fields JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_embed_author_name') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_embed_author_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_embed_author_icon_url') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_embed_author_icon_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_embed_author_url') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_embed_author_url TEXT;
  END IF;
  
  -- Buttons/Actions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_buttons_enabled') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_buttons_enabled BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_buttons') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_buttons JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  -- Leave message enhancements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'leave_embed_enabled') THEN
    ALTER TABLE welcome_configs ADD COLUMN leave_embed_enabled BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'leave_embed_title') THEN
    ALTER TABLE welcome_configs ADD COLUMN leave_embed_title TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'leave_embed_description') THEN
    ALTER TABLE welcome_configs ADD COLUMN leave_embed_description TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'leave_embed_color') THEN
    ALTER TABLE welcome_configs ADD COLUMN leave_embed_color TEXT DEFAULT '#FF0000';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'leave_embed_image_url') THEN
    ALTER TABLE welcome_configs ADD COLUMN leave_embed_image_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'leave_embed_thumbnail_url') THEN
    ALTER TABLE welcome_configs ADD COLUMN leave_embed_thumbnail_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'leave_embed_footer_text') THEN
    ALTER TABLE welcome_configs ADD COLUMN leave_embed_footer_text TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'leave_embed_footer_icon_url') THEN
    ALTER TABLE welcome_configs ADD COLUMN leave_embed_footer_icon_url TEXT;
  END IF;
  
  -- DM enhancements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_dm_embed_enabled') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_dm_embed_enabled BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_dm_embed_title') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_dm_embed_title TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_dm_embed_description') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_dm_embed_description TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_dm_embed_color') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_dm_embed_color TEXT DEFAULT '#5865F2';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_dm_embed_image_url') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_dm_embed_image_url TEXT;
  END IF;
  
  -- Advanced options
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_delete_after') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_delete_after INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_mention_user') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_mention_user BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_mention_roles') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_mention_roles TEXT[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_mention_everyone') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_mention_everyone BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_mention_here') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_mention_here BOOLEAN DEFAULT false;
  END IF;
  
  -- Auto-role enhancements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'autorole_remove_on_leave') THEN
    ALTER TABLE welcome_configs ADD COLUMN autorole_remove_on_leave BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'autorole_ignore_bots') THEN
    ALTER TABLE welcome_configs ADD COLUMN autorole_ignore_bots BOOLEAN DEFAULT false;
  END IF;
  
  -- Statistics
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_stats_enabled') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_stats_enabled BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_show_account_age') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_show_account_age BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'welcome_configs' AND column_name = 'welcome_show_join_position') THEN
    ALTER TABLE welcome_configs ADD COLUMN welcome_show_join_position BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_welcome_configs_guild_id ON welcome_configs(guild_id);

-- Enable RLS (Row Level Security) if not already enabled
ALTER TABLE welcome_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view their own guild welcome configs" ON welcome_configs;
  DROP POLICY IF EXISTS "Users can update their own guild welcome configs" ON welcome_configs;
  DROP POLICY IF EXISTS "Users can insert their own guild welcome configs" ON welcome_configs;
  
  -- Create new policies
  CREATE POLICY "Users can view their own guild welcome configs" ON welcome_configs
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM guild_configs gc
        WHERE gc.guild_id = welcome_configs.guild_id
        AND (
          gc.owner_discord_id = auth.jwt() ->> 'discord_id'
          OR EXISTS (
            SELECT 1 FROM authorized_users au
            WHERE au.guild_id = welcome_configs.guild_id
            AND au.user_id = auth.jwt() ->> 'discord_id'
          )
        )
      )
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.discord_id = auth.jwt() ->> 'discord_id'
        AND u.is_admin = true
      )
    );
  
  CREATE POLICY "Users can update their own guild welcome configs" ON welcome_configs
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM guild_configs gc
        WHERE gc.guild_id = welcome_configs.guild_id
        AND (
          gc.owner_discord_id = auth.jwt() ->> 'discord_id'
          OR EXISTS (
            SELECT 1 FROM authorized_users au
            WHERE au.guild_id = welcome_configs.guild_id
            AND au.user_id = auth.jwt() ->> 'discord_id'
          )
        )
      )
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.discord_id = auth.jwt() ->> 'discord_id'
        AND u.is_admin = true
      )
    );
  
  CREATE POLICY "Users can insert their own guild welcome configs" ON welcome_configs
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM guild_configs gc
        WHERE gc.guild_id = welcome_configs.guild_id
        AND (
          gc.owner_discord_id = auth.jwt() ->> 'discord_id'
          OR EXISTS (
            SELECT 1 FROM authorized_users au
            WHERE au.guild_id = welcome_configs.guild_id
            AND au.user_id = auth.jwt() ->> 'discord_id'
          )
        )
      )
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.discord_id = auth.jwt() ->> 'discord_id'
        AND u.is_admin = true
      )
    );
END $$;

