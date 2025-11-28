-- Ensure guild_configs has a manual subscription control column
ALTER TABLE guild_configs
ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN DEFAULT true;

ALTER TABLE guild_configs
ADD COLUMN IF NOT EXISTS subscription_notes TEXT;

ALTER TABLE guild_configs
ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMPTZ;

-- Backfill existing rows
UPDATE guild_configs
SET subscription_active = true
WHERE subscription_active IS NULL;

UPDATE guild_configs
SET subscription_updated_at = NOW()
WHERE subscription_updated_at IS NULL;

-- Verify
SELECT guild_id, guild_name, subscription_tier, subscription_active, subscription_updated_at
FROM guild_configs
ORDER BY updated_at DESC NULLS LAST
LIMIT 25;
