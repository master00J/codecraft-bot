-- Add member_count column to guild_configs
-- This is needed for the Comcraft stats API

-- Add the column if it doesn't exist
ALTER TABLE guild_configs 
ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;

-- Add is_active column if it doesn't exist
ALTER TABLE guild_configs 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Set all existing guilds to active
UPDATE guild_configs 
SET is_active = true 
WHERE is_active IS NULL;

-- Verify the changes
SELECT 
    guild_id,
    guild_name,
    is_active,
    member_count,
    subscription_tier
FROM guild_configs;

-- If you want to manually set member counts for your servers, use:
-- UPDATE guild_configs SET member_count = 100 WHERE guild_id = 'YOUR_GUILD_ID_HERE';

