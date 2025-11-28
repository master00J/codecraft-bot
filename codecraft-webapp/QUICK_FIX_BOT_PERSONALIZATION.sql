-- Add bot personalization fields to guild_configs
-- Run this in Supabase SQL Editor

-- Add custom bot name and avatar columns
ALTER TABLE guild_configs 
ADD COLUMN IF NOT EXISTS custom_bot_name TEXT DEFAULT 'ComCraft',
ADD COLUMN IF NOT EXISTS custom_bot_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS custom_embed_color TEXT DEFAULT '#5865F2',
ADD COLUMN IF NOT EXISTS custom_embed_footer TEXT DEFAULT 'Powered by ComCraft';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guild_configs_custom_bot ON guild_configs(guild_id, custom_bot_name);

-- Update existing guilds to have default values
UPDATE guild_configs 
SET 
  custom_bot_name = COALESCE(custom_bot_name, 'ComCraft'),
  custom_embed_color = COALESCE(custom_embed_color, '#5865F2'),
  custom_embed_footer = COALESCE(custom_embed_footer, 'Powered by ComCraft')
WHERE custom_bot_name IS NULL 
   OR custom_embed_color IS NULL 
   OR custom_embed_footer IS NULL;

-- Success message
SELECT 
  'Bot personalization fields added successfully!' as status,
  COUNT(*) as guilds_updated
FROM guild_configs;

