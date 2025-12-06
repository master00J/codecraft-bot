-- Discord Referral System Schema
-- Tracks referrals within Discord servers and gives rewards to both inviter and new member

-- Referral configuration per guild
CREATE TABLE IF NOT EXISTS discord_referral_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  
  -- Rewards for inviter (person who invited)
  inviter_reward_type TEXT DEFAULT 'none', -- 'none', 'role', 'coins', 'xp', 'both'
  inviter_reward_role_id TEXT, -- Role to give to inviter
  inviter_reward_coins INTEGER DEFAULT 0, -- Coins to give to inviter
  inviter_reward_xp INTEGER DEFAULT 0, -- XP to give to inviter
  
  -- Rewards for new member (person who was invited)
  new_member_reward_type TEXT DEFAULT 'none', -- 'none', 'role', 'coins', 'xp', 'both'
  new_member_reward_role_id TEXT, -- Role to give to new member
  new_member_reward_coins INTEGER DEFAULT 0, -- Coins to give to new member
  new_member_reward_xp INTEGER DEFAULT 0, -- XP to give to new member
  
  -- Settings
  require_min_account_age_days INTEGER DEFAULT 0, -- Minimum account age to count as referral
  require_min_members_invited INTEGER DEFAULT 1, -- Minimum invites before giving rewards
  cooldown_hours INTEGER DEFAULT 0, -- Cooldown between rewards for same inviter
  ignore_bots BOOLEAN DEFAULT true, -- Don't count bot invites
  
  -- Logging
  log_channel_id TEXT, -- Channel to log referral rewards
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referral tracking
CREATE TABLE IF NOT EXISTS discord_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  inviter_user_id TEXT NOT NULL, -- User who created the invite
  new_member_user_id TEXT NOT NULL, -- User who joined via invite
  invite_code TEXT, -- Discord invite code used
  
  -- Reward status
  inviter_reward_given BOOLEAN DEFAULT false,
  new_member_reward_given BOOLEAN DEFAULT false,
  inviter_reward_given_at TIMESTAMPTZ,
  new_member_reward_given_at TIMESTAMPTZ,
  
  -- Metadata
  new_member_account_age_days INTEGER, -- Account age when they joined
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(guild_id, new_member_user_id) -- One referral per new member per guild
);

-- Inviter stats (aggregated)
CREATE TABLE IF NOT EXISTS discord_referral_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  inviter_user_id TEXT NOT NULL,
  total_invites INTEGER DEFAULT 0,
  total_rewards_given INTEGER DEFAULT 0,
  last_reward_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(guild_id, inviter_user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_discord_referral_config_guild ON discord_referral_config(guild_id);
CREATE INDEX IF NOT EXISTS idx_discord_referral_config_enabled ON discord_referral_config(guild_id, enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_discord_referrals_guild ON discord_referrals(guild_id);
CREATE INDEX IF NOT EXISTS idx_discord_referrals_inviter ON discord_referrals(guild_id, inviter_user_id);
CREATE INDEX IF NOT EXISTS idx_discord_referrals_new_member ON discord_referrals(guild_id, new_member_user_id);
CREATE INDEX IF NOT EXISTS idx_discord_referrals_invite_code ON discord_referrals(invite_code);

CREATE INDEX IF NOT EXISTS idx_discord_referral_stats_guild_inviter ON discord_referral_stats(guild_id, inviter_user_id);

-- Enable RLS
ALTER TABLE discord_referral_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_referral_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role full access
CREATE POLICY "Service role can manage discord_referral_config"
  ON discord_referral_config
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage discord_referrals"
  ON discord_referrals
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage discord_referral_stats"
  ON discord_referral_stats
  FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read their guild's config
CREATE POLICY "Users can read their guild discord_referral_config"
  ON discord_referral_config
  FOR SELECT
  USING (true);

CREATE POLICY "Users can read their guild discord_referrals"
  ON discord_referrals
  FOR SELECT
  USING (true);

CREATE POLICY "Users can read their guild discord_referral_stats"
  ON discord_referral_stats
  FOR SELECT
  USING (true);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_discord_referral_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_discord_referral_config_updated_at
  BEFORE UPDATE ON discord_referral_config
  FOR EACH ROW
  EXECUTE FUNCTION update_discord_referral_config_updated_at();

CREATE OR REPLACE FUNCTION update_discord_referrals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_discord_referrals_updated_at
  BEFORE UPDATE ON discord_referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_discord_referrals_updated_at();

CREATE OR REPLACE FUNCTION update_discord_referral_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_discord_referral_stats_updated_at
  BEFORE UPDATE ON discord_referral_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_discord_referral_stats_updated_at();

COMMENT ON TABLE discord_referral_config IS 'Configuration for Discord referral rewards system per guild';
COMMENT ON TABLE discord_referrals IS 'Tracks individual referrals within Discord servers';
COMMENT ON TABLE discord_referral_stats IS 'Aggregated statistics for inviters per guild';

