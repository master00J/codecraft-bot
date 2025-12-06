-- Discord Referral Tiered Rewards Schema
-- Allows configuring tiered rewards based on invite count (e.g., 1 invite = bronze, 5 invites = silver, etc.)

-- Tiered reward tiers per guild
CREATE TABLE IF NOT EXISTS discord_referral_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  tier_name TEXT NOT NULL, -- e.g., "Bronze", "Silver", "Gold"
  min_invites INTEGER NOT NULL, -- Minimum invites required for this tier
  role_id TEXT, -- Role to give when reaching this tier
  coins INTEGER DEFAULT 0, -- Coins to give when reaching this tier
  xp INTEGER DEFAULT 0, -- XP to give when reaching this tier
  order_index INTEGER DEFAULT 0, -- Order for display (lower = higher tier)
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(guild_id, min_invites) -- One tier per invite count per guild
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_discord_referral_tiers_guild ON discord_referral_tiers(guild_id);
CREATE INDEX IF NOT EXISTS idx_discord_referral_tiers_guild_order ON discord_referral_tiers(guild_id, order_index ASC);
CREATE INDEX IF NOT EXISTS idx_discord_referral_tiers_enabled ON discord_referral_tiers(guild_id, enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE discord_referral_tiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role full access
CREATE POLICY "Service role can manage discord_referral_tiers"
  ON discord_referral_tiers
  FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read their guild's tiers
CREATE POLICY "Users can read their guild discord_referral_tiers"
  ON discord_referral_tiers
  FOR SELECT
  USING (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_discord_referral_tiers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_discord_referral_tiers_updated_at
  BEFORE UPDATE ON discord_referral_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_discord_referral_tiers_updated_at();

COMMENT ON TABLE discord_referral_tiers IS 'Tiered rewards for Discord referrals based on invite count';
COMMENT ON COLUMN discord_referral_tiers.min_invites IS 'Minimum number of successful invites required to reach this tier';
COMMENT ON COLUMN discord_referral_tiers.order_index IS 'Display order (lower = higher tier, shown first)';

