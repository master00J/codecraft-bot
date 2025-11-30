-- Voice Leveling System Schema
-- Adds voice XP and voice level tracking to user_levels table

-- Add voice XP and voice level columns to user_levels
ALTER TABLE user_levels
  ADD COLUMN IF NOT EXISTS voice_xp BIGINT DEFAULT 0;

ALTER TABLE user_levels
  ADD COLUMN IF NOT EXISTS voice_level INTEGER DEFAULT 0;

-- Add index for voice level leaderboard
CREATE INDEX IF NOT EXISTS idx_user_levels_voice_xp ON user_levels(guild_id, voice_xp DESC);

-- Update leveling_configs defaults if needed (these should already exist, but ensure they're there)
DO $$
BEGIN
  -- Ensure voice_xp_enabled and voice_xp_per_minute exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leveling_configs' 
    AND column_name = 'voice_xp_enabled'
  ) THEN
    ALTER TABLE leveling_configs ADD COLUMN voice_xp_enabled BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leveling_configs' 
    AND column_name = 'voice_xp_per_minute'
  ) THEN
    ALTER TABLE leveling_configs ADD COLUMN voice_xp_per_minute INTEGER DEFAULT 2;
  END IF;
END $$;

