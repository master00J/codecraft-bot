-- Voice XP Multipliers Schema
-- Allows server owners to set custom voice XP multipliers for specific Discord roles
-- Similar to rank_xp_multipliers but for voice XP

-- ================================================================
-- VOICE XP MULTIPLIERS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS rank_voice_xp_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  role_name TEXT, -- Optional: store role name for display purposes
  multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0, -- e.g., 1.5 = 150% XP, 2.0 = 200% XP
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, role_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_rank_voice_xp_multipliers_guild ON rank_voice_xp_multipliers(guild_id);
CREATE INDEX IF NOT EXISTS idx_rank_voice_xp_multipliers_role ON rank_voice_xp_multipliers(role_id);
CREATE INDEX IF NOT EXISTS idx_rank_voice_xp_multipliers_enabled ON rank_voice_xp_multipliers(guild_id, enabled) WHERE enabled = true;

-- Update timestamp trigger
CREATE TRIGGER update_rank_voice_xp_multipliers_updated_at
  BEFORE UPDATE ON rank_voice_xp_multipliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security
ALTER TABLE rank_voice_xp_multipliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adjust based on your auth requirements)
CREATE POLICY "Users can view voice XP multipliers for their guilds"
  ON rank_voice_xp_multipliers FOR SELECT
  USING (true);

CREATE POLICY "Users can insert voice XP multipliers for their guilds"
  ON rank_voice_xp_multipliers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update voice XP multipliers for their guilds"
  ON rank_voice_xp_multipliers FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete voice XP multipliers for their guilds"
  ON rank_voice_xp_multipliers FOR DELETE
  USING (true);

-- Comments
COMMENT ON TABLE rank_voice_xp_multipliers IS 'Stores custom voice XP multipliers for Discord roles per guild';
COMMENT ON COLUMN rank_voice_xp_multipliers.multiplier IS 'Voice XP multiplier (e.g., 1.5 = 150% XP, 2.0 = 200% XP, 0.5 = 50% XP)';
COMMENT ON COLUMN rank_voice_xp_multipliers.role_name IS 'Optional: stores role name for display purposes in dashboard';

