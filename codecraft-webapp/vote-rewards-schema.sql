-- ================================================================
-- VOTE REWARDS SYSTEM SCHEMA
-- Allows users to earn points from Top.gg votes and redeem them for tier unlocks
-- Points are deducted daily while a tier is unlocked
-- ================================================================

-- 1. Vote Points Balance (per user)
CREATE TABLE IF NOT EXISTS vote_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  discord_user_id TEXT UNIQUE NOT NULL,
  total_points INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0, -- Total earned from votes
  points_spent INTEGER DEFAULT 0, -- Total spent on unlocks
  last_vote_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vote_points_discord_user ON vote_points(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_vote_points_user_id ON vote_points(user_id);

-- 2. Vote Rewards Global Configuration
CREATE TABLE IF NOT EXISTS vote_rewards_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  points_per_vote INTEGER DEFAULT 1,
  points_per_weekend_vote INTEGER DEFAULT 2, -- Weekend bonus (2x)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default config (only if table is empty)
INSERT INTO vote_rewards_config (points_per_vote, points_per_weekend_vote, is_active)
SELECT 1, 2, true
WHERE NOT EXISTS (SELECT 1 FROM vote_rewards_config);

-- 3. Tier Vote Rewards Configuration (points per day per tier)
CREATE TABLE IF NOT EXISTS tier_vote_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id UUID REFERENCES subscription_tiers(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL, -- Denormalized for quick access
  points_per_day INTEGER NOT NULL, -- How many points per day this tier costs
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tier_id)
);

CREATE INDEX IF NOT EXISTS idx_tier_vote_rewards_tier ON tier_vote_rewards(tier_id);
CREATE INDEX IF NOT EXISTS idx_tier_vote_rewards_active ON tier_vote_rewards(is_active);

-- 4. Active Vote Tier Unlocks
CREATE TABLE IF NOT EXISTS vote_tier_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL, -- Which guild gets the tier
  tier_id UUID REFERENCES subscription_tiers(id),
  tier_name TEXT NOT NULL,
  points_per_day INTEGER NOT NULL, -- Points deducted per day
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_deduction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Last time points were deducted
  expires_at TIMESTAMP WITH TIME ZONE, -- Calculated based on remaining points
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vote_tier_unlocks_user ON vote_tier_unlocks(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_vote_tier_unlocks_guild ON vote_tier_unlocks(guild_id);
CREATE INDEX IF NOT EXISTS idx_vote_tier_unlocks_active ON vote_tier_unlocks(is_active);
CREATE INDEX IF NOT EXISTS idx_vote_tier_unlocks_expires ON vote_tier_unlocks(expires_at) WHERE is_active = true;

-- 5. Vote Points Transaction History (for tracking)
CREATE TABLE IF NOT EXISTS vote_points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  discord_user_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- 'earned' (from vote), 'spent' (on unlock), 'deducted' (daily deduction), 'expired' (unlock expired)
  points INTEGER NOT NULL, -- Positive for earned, negative for spent/deducted
  description TEXT,
  related_unlock_id UUID REFERENCES vote_tier_unlocks(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vote_points_transactions_user ON vote_points_transactions(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_vote_points_transactions_type ON vote_points_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_vote_points_transactions_created ON vote_points_transactions(created_at DESC);

-- RLS Policies
ALTER TABLE vote_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_rewards_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_vote_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_tier_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_points_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for safe re-running)
DROP POLICY IF EXISTS "Users can view own vote points" ON vote_points;
DROP POLICY IF EXISTS "Users can view own unlocks" ON vote_tier_unlocks;
DROP POLICY IF EXISTS "Users can view own transactions" ON vote_points_transactions;
DROP POLICY IF EXISTS "Public can read vote rewards config" ON vote_rewards_config;
DROP POLICY IF EXISTS "Public can read tier vote rewards" ON tier_vote_rewards;
DROP POLICY IF EXISTS "Only admins can modify vote rewards config" ON vote_rewards_config;
DROP POLICY IF EXISTS "Only admins can modify tier vote rewards" ON tier_vote_rewards;
DROP POLICY IF EXISTS "Service role has full access to vote_points" ON vote_points;
DROP POLICY IF EXISTS "Service role has full access to vote_tier_unlocks" ON vote_tier_unlocks;
DROP POLICY IF EXISTS "Service role has full access to vote_points_transactions" ON vote_points_transactions;

-- Users can view their own points
CREATE POLICY "Users can view own vote points" ON vote_points
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.discord_id = auth.jwt() ->> 'discordId'
      AND users.discord_id = vote_points.discord_user_id
    )
  );

-- Users can view their own unlocks
CREATE POLICY "Users can view own unlocks" ON vote_tier_unlocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.discord_id = auth.jwt() ->> 'discordId'
      AND users.discord_id = vote_tier_unlocks.discord_user_id
    )
  );

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON vote_points_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.discord_id = auth.jwt() ->> 'discordId'
      AND users.discord_id = vote_points_transactions.discord_user_id
    )
  );

-- Public can read vote rewards config (for pricing display)
CREATE POLICY "Public can read vote rewards config" ON vote_rewards_config
  FOR SELECT USING (is_active = true);

-- Public can read tier vote rewards (for pricing display)
CREATE POLICY "Public can read tier vote rewards" ON tier_vote_rewards
  FOR SELECT USING (is_active = true);

-- Only admins can modify config
CREATE POLICY "Only admins can modify vote rewards config" ON vote_rewards_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.discord_id = auth.jwt() ->> 'discordId'
      AND users.is_admin = true
    )
  );

CREATE POLICY "Only admins can modify tier vote rewards" ON tier_vote_rewards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.discord_id = auth.jwt() ->> 'discordId'
      AND users.is_admin = true
    )
  );

-- Service role has full access (for bot operations)
CREATE POLICY "Service role has full access to vote_points" ON vote_points
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to vote_tier_unlocks" ON vote_tier_unlocks
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to vote_points_transactions" ON vote_points_transactions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vote_points_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist (for safe re-running)
DROP TRIGGER IF EXISTS vote_points_updated_at ON vote_points;
DROP TRIGGER IF EXISTS vote_rewards_config_updated_at ON vote_rewards_config;
DROP TRIGGER IF EXISTS tier_vote_rewards_updated_at ON tier_vote_rewards;

CREATE TRIGGER vote_points_updated_at
    BEFORE UPDATE ON vote_points
    FOR EACH ROW
    EXECUTE FUNCTION update_vote_points_timestamp();

CREATE TRIGGER vote_rewards_config_updated_at
    BEFORE UPDATE ON vote_rewards_config
    FOR EACH ROW
    EXECUTE FUNCTION update_vote_points_timestamp();

CREATE TRIGGER tier_vote_rewards_updated_at
    BEFORE UPDATE ON tier_vote_rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_vote_points_timestamp();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Vote Rewards System Schema Created!';
  RAISE NOTICE '📋 Tables created: vote_points, vote_rewards_config, tier_vote_rewards, vote_tier_unlocks, vote_points_transactions';
  RAISE NOTICE '';
END $$;

