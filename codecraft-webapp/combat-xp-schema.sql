-- Combat XP and Leveling System
-- Separate XP system for PvP duels

-- Add combat stats columns to user_economy table
ALTER TABLE user_economy
ADD COLUMN IF NOT EXISTS combat_xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS combat_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS duels_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS duels_lost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_duels INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_damage_dealt BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_damage_taken BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS highest_win_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_win_streak INTEGER DEFAULT 0;

-- Create index for faster combat leaderboard queries
CREATE INDEX IF NOT EXISTS idx_user_economy_combat_xp ON user_economy(guild_id, combat_xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_economy_combat_level ON user_economy(guild_id, combat_level DESC);
CREATE INDEX IF NOT EXISTS idx_user_economy_duels_won ON user_economy(guild_id, duels_won DESC);

-- Create combat_xp_history table for tracking XP gains
CREATE TABLE IF NOT EXISTS combat_xp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  xp_gained INTEGER NOT NULL,
  reason TEXT NOT NULL, -- 'duel_win', 'duel_loss', 'streak_bonus'
  duel_id TEXT, -- Reference to the duel (if applicable)
  level_before INTEGER NOT NULL,
  level_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for combat XP history queries
CREATE INDEX IF NOT EXISTS idx_combat_xp_history_user ON combat_xp_history(guild_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_combat_xp_history_duel ON combat_xp_history(duel_id);

-- Enable RLS
ALTER TABLE combat_xp_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for combat_xp_history
DROP POLICY IF EXISTS "Public read access to combat_xp_history" ON combat_xp_history;
CREATE POLICY "Public read access to combat_xp_history"
  ON combat_xp_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role has full access to combat_xp_history" ON combat_xp_history;
CREATE POLICY "Service role has full access to combat_xp_history"
  ON combat_xp_history FOR ALL
  USING (true);

-- Combat level thresholds (similar to chat XP but separate progression)
-- Level 1: 0 XP
-- Level 2: 100 XP
-- Level 3: 250 XP
-- Level 4: 450 XP
-- Level 5: 700 XP
-- Level 10: 2,250 XP
-- Level 20: 9,000 XP
-- Level 50: 62,500 XP
-- Level 100: 250,000 XP
-- Formula: XP = 50 * (level^2 - level)

COMMENT ON COLUMN user_economy.combat_xp IS 'Total combat XP earned from PvP duels';
COMMENT ON COLUMN user_economy.combat_level IS 'Current combat level based on combat_xp';
COMMENT ON COLUMN user_economy.duels_won IS 'Total number of duels won';
COMMENT ON COLUMN user_economy.duels_lost IS 'Total number of duels lost';
COMMENT ON COLUMN user_economy.total_duels IS 'Total number of duels participated in';
COMMENT ON COLUMN user_economy.total_damage_dealt IS 'Total damage dealt across all duels';
COMMENT ON COLUMN user_economy.total_damage_taken IS 'Total damage taken across all duels';
COMMENT ON COLUMN user_economy.highest_win_streak IS 'Longest win streak achieved';
COMMENT ON COLUMN user_economy.current_win_streak IS 'Current consecutive wins';

