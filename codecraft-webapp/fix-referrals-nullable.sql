-- Fix referrals table to allow NULL referred_discord_id for 'clicked' status
-- Users who only clicked the link (not yet logged in) won't have a Discord ID

-- Make referred_discord_id nullable
ALTER TABLE referrals 
  ALTER COLUMN referred_discord_id DROP NOT NULL;

-- Also ensure referred_guild_id is nullable (users may not have selected a guild yet)
ALTER TABLE referrals 
  ALTER COLUMN referred_guild_id DROP NOT NULL;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Referrals table columns now nullable - clicks can be tracked without Discord ID';
END $$;

