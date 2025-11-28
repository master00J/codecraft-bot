-- Fix guild_configs if is_active column doesn't exist or is not set correctly

-- Option 1: Add is_active column if it doesn't exist
ALTER TABLE guild_configs 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Option 2: Set all existing guilds to active
UPDATE guild_configs 
SET is_active = true 
WHERE is_active IS NULL;

-- Option 3: Verify the changes
SELECT 
    guild_id,
    guild_name,
    is_active,
    member_count
FROM guild_configs;

