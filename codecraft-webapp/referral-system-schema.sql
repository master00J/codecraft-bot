-- ================================================================
-- REFERRAL/AFFILIATE SYSTEM
-- ================================================================
-- Allows users to refer new customers and earn rewards
-- Reward: 1 week free Enterprise tier for each successful referral
-- Condition: Referred user must purchase Enterprise tier (≥1 month)

-- 1. Referral Codes Table
-- Stores unique referral codes for each user
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    discord_id TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    total_clicks INTEGER DEFAULT 0,
    total_signups INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_rewards_earned INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  -- Add all possible missing columns (for existing tables)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_codes' AND column_name = 'user_id') THEN
    ALTER TABLE referral_codes ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_codes' AND column_name = 'discord_id') THEN
    ALTER TABLE referral_codes ADD COLUMN discord_id TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_codes' AND column_name = 'code') THEN
    ALTER TABLE referral_codes ADD COLUMN code TEXT UNIQUE NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_codes' AND column_name = 'total_clicks') THEN
    ALTER TABLE referral_codes ADD COLUMN total_clicks INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_codes' AND column_name = 'total_signups') THEN
    ALTER TABLE referral_codes ADD COLUMN total_signups INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_codes' AND column_name = 'total_conversions') THEN
    ALTER TABLE referral_codes ADD COLUMN total_conversions INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_codes' AND column_name = 'total_rewards_earned') THEN
    ALTER TABLE referral_codes ADD COLUMN total_rewards_earned INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_codes' AND column_name = 'is_active') THEN
    ALTER TABLE referral_codes ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  
  RAISE NOTICE 'Referral codes table ready';
END $$;

-- 2. Referrals Table  
-- Tracks who was referred by whom
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    referrer_discord_id TEXT NOT NULL,
    referral_code_id UUID REFERENCES referral_codes(id) ON DELETE SET NULL,
    referral_code TEXT NOT NULL,
    referred_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    referred_discord_id TEXT,
    referred_guild_id TEXT,
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    signed_up_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    subscription_tier TEXT,
    subscription_duration INTEGER,
    subscription_price DECIMAL(10,2),
    conversion_status TEXT DEFAULT 'clicked' CHECK (conversion_status IN ('clicked', 'signed_up', 'converted', 'expired')),
    reward_given BOOLEAN DEFAULT false,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  -- Add all possible missing columns (for existing tables)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referrer_user_id') THEN
    ALTER TABLE referrals ADD COLUMN referrer_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referrer_discord_id') THEN
    ALTER TABLE referrals ADD COLUMN referrer_discord_id TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referral_code_id') THEN
    ALTER TABLE referrals ADD COLUMN referral_code_id UUID REFERENCES referral_codes(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referral_code') THEN
    ALTER TABLE referrals ADD COLUMN referral_code TEXT DEFAULT '';
    -- Make it NOT NULL after adding
    ALTER TABLE referrals ALTER COLUMN referral_code SET NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referred_user_id') THEN
    ALTER TABLE referrals ADD COLUMN referred_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referred_discord_id') THEN
    ALTER TABLE referrals ADD COLUMN referred_discord_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referred_guild_id') THEN
    ALTER TABLE referrals ADD COLUMN referred_guild_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'signed_up_at') THEN
    ALTER TABLE referrals ADD COLUMN signed_up_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'converted_at') THEN
    ALTER TABLE referrals ADD COLUMN converted_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'subscription_tier') THEN
    ALTER TABLE referrals ADD COLUMN subscription_tier TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'subscription_duration') THEN
    ALTER TABLE referrals ADD COLUMN subscription_duration INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'subscription_price') THEN
    ALTER TABLE referrals ADD COLUMN subscription_price DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'conversion_status') THEN
    ALTER TABLE referrals ADD COLUMN conversion_status TEXT DEFAULT 'clicked';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'reward_given') THEN
    ALTER TABLE referrals ADD COLUMN reward_given BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'ip_address') THEN
    ALTER TABLE referrals ADD COLUMN ip_address TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'user_agent') THEN
    ALTER TABLE referrals ADD COLUMN user_agent TEXT;
  END IF;
  
  RAISE NOTICE 'Referrals table ready';
END $$;

-- 3. Referral Rewards Table
-- Tracks rewards given to referrers
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    referrer_discord_id TEXT NOT NULL,
    referrer_guild_id TEXT,
    referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
    referred_discord_id TEXT NOT NULL,
    reward_type TEXT DEFAULT 'free_enterprise_week',
    reward_duration INTEGER DEFAULT 7,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    original_tier TEXT,
    original_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  -- Add all possible missing columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_rewards' AND column_name = 'referrer_user_id') THEN
    ALTER TABLE referral_rewards ADD COLUMN referrer_user_id UUID REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_rewards' AND column_name = 'referrer_discord_id') THEN
    ALTER TABLE referral_rewards ADD COLUMN referrer_discord_id TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_rewards' AND column_name = 'referrer_guild_id') THEN
    ALTER TABLE referral_rewards ADD COLUMN referrer_guild_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_rewards' AND column_name = 'referral_id') THEN
    ALTER TABLE referral_rewards ADD COLUMN referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_rewards' AND column_name = 'referred_discord_id') THEN
    ALTER TABLE referral_rewards ADD COLUMN referred_discord_id TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_rewards' AND column_name = 'reward_type') THEN
    ALTER TABLE referral_rewards ADD COLUMN reward_type TEXT DEFAULT 'free_enterprise_week';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_rewards' AND column_name = 'reward_duration') THEN
    ALTER TABLE referral_rewards ADD COLUMN reward_duration INTEGER DEFAULT 7;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_rewards' AND column_name = 'applied_at') THEN
    ALTER TABLE referral_rewards ADD COLUMN applied_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_rewards' AND column_name = 'expires_at') THEN
    ALTER TABLE referral_rewards ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_rewards' AND column_name = 'is_active') THEN
    ALTER TABLE referral_rewards ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_rewards' AND column_name = 'original_tier') THEN
    ALTER TABLE referral_rewards ADD COLUMN original_tier TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_rewards' AND column_name = 'original_expires_at') THEN
    ALTER TABLE referral_rewards ADD COLUMN original_expires_at TIMESTAMPTZ;
  END IF;
  
  RAISE NOTICE 'Referral rewards table ready';
END $$;

-- 4. Referral Settings Table (global config)
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS referral_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_tier_for_reward TEXT DEFAULT 'enterprise',
    min_duration_months INTEGER DEFAULT 1,
    reward_duration_days INTEGER DEFAULT 7,
    max_rewards_per_referrer INTEGER DEFAULT -1,
    max_rewards_per_month INTEGER DEFAULT -1,
    require_payment_confirmation BOOLEAN DEFAULT true,
    block_self_referrals BOOLEAN DEFAULT true,
    ip_tracking_enabled BOOLEAN DEFAULT true,
    system_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  -- Add all possible missing columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'min_tier_for_reward') THEN
    ALTER TABLE referral_settings ADD COLUMN min_tier_for_reward TEXT DEFAULT 'enterprise';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'min_duration_months') THEN
    ALTER TABLE referral_settings ADD COLUMN min_duration_months INTEGER DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'reward_duration_days') THEN
    ALTER TABLE referral_settings ADD COLUMN reward_duration_days INTEGER DEFAULT 7;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'max_rewards_per_referrer') THEN
    ALTER TABLE referral_settings ADD COLUMN max_rewards_per_referrer INTEGER DEFAULT -1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'max_rewards_per_month') THEN
    ALTER TABLE referral_settings ADD COLUMN max_rewards_per_month INTEGER DEFAULT -1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'require_payment_confirmation') THEN
    ALTER TABLE referral_settings ADD COLUMN require_payment_confirmation BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'block_self_referrals') THEN
    ALTER TABLE referral_settings ADD COLUMN block_self_referrals BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'ip_tracking_enabled') THEN
    ALTER TABLE referral_settings ADD COLUMN ip_tracking_enabled BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'system_enabled') THEN
    ALTER TABLE referral_settings ADD COLUMN system_enabled BOOLEAN DEFAULT true;
  END IF;
  
  RAISE NOTICE 'Referral settings table ready';
END $$;

-- Insert default settings
INSERT INTO referral_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- ================================================================
-- INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_discord ON referral_codes(discord_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON referral_codes(is_active);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_discord_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_discord_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(conversion_status);
CREATE INDEX IF NOT EXISTS idx_referrals_guild ON referrals(referred_guild_id);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_discord_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_guild ON referral_rewards(referrer_guild_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_active ON referral_rewards(is_active, expires_at);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies safely
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own referral code" ON referral_codes;
  DROP POLICY IF EXISTS "Users can update own referral code" ON referral_codes;
  DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
  DROP POLICY IF EXISTS "Users can view own rewards" ON referral_rewards;
  DROP POLICY IF EXISTS "Admins can manage referral codes" ON referral_codes;
  DROP POLICY IF EXISTS "Admins can manage referrals" ON referrals;
  DROP POLICY IF EXISTS "Admins can manage rewards" ON referral_rewards;
  DROP POLICY IF EXISTS "Admins can manage settings" ON referral_settings;
  DROP POLICY IF EXISTS "Everyone can view settings" ON referral_settings;
  RAISE NOTICE 'Policies dropped';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Tables not yet created, skipping policy drops';
END $$;

-- User policies
CREATE POLICY "Users can view own referral code" ON referral_codes
  FOR SELECT USING (
    discord_id = (current_setting('request.jwt.claims', true)::json->>'discord_id') OR
    user_id IN (SELECT id FROM users WHERE discord_id = (current_setting('request.jwt.claims', true)::json->>'discord_id'))
  );

CREATE POLICY "Users can update own referral code" ON referral_codes
  FOR UPDATE USING (
    discord_id = (current_setting('request.jwt.claims', true)::json->>'discord_id') OR
    user_id IN (SELECT id FROM users WHERE discord_id = (current_setting('request.jwt.claims', true)::json->>'discord_id'))
  );

CREATE POLICY "Users can view own referrals" ON referrals
  FOR SELECT USING (
    referrer_discord_id = (current_setting('request.jwt.claims', true)::json->>'discord_id') OR
    referred_discord_id = (current_setting('request.jwt.claims', true)::json->>'discord_id')
  );

CREATE POLICY "Users can view own rewards" ON referral_rewards
  FOR SELECT USING (
    referrer_discord_id = (current_setting('request.jwt.claims', true)::json->>'discord_id')
  );

-- Admin policies
CREATE POLICY "Admins can manage referral codes" ON referral_codes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.discord_id = (current_setting('request.jwt.claims', true)::json->>'discord_id')
      AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can manage referrals" ON referrals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.discord_id = (current_setting('request.jwt.claims', true)::json->>'discord_id')
      AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can manage rewards" ON referral_rewards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.discord_id = (current_setting('request.jwt.claims', true)::json->>'discord_id')
      AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can manage settings" ON referral_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.discord_id = (current_setting('request.jwt.claims', true)::json->>'discord_id')
      AND users.is_admin = true
    )
  );

CREATE POLICY "Everyone can view settings" ON referral_settings
  FOR SELECT USING (true);

-- ================================================================
-- FUNCTIONS
-- ================================================================

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_discord_tag TEXT)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Try username-based code first (e.g., "EMMA2024")
  v_code := UPPER(REPLACE(SPLIT_PART(p_discord_tag, '#', 1), ' ', '')) || EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;
  
  -- If taken, add random suffix
  WHILE v_exists LOOP
    v_code := v_code || LPAD(FLOOR(RANDOM() * 100)::TEXT, 2, '0');
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Function to apply referral reward
CREATE OR REPLACE FUNCTION apply_referral_reward(
  p_referrer_discord_id TEXT,
  p_referrer_guild_id TEXT,
  p_referral_id UUID,
  p_referred_discord_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_reward_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_original_tier TEXT;
  v_original_expires_at TIMESTAMPTZ;
BEGIN
  -- Get current subscription info for backup
  SELECT subscription_tier, subscription_expires_at 
  INTO v_original_tier, v_original_expires_at
  FROM guild_configs 
  WHERE guild_id = p_referrer_guild_id;
  
  -- Calculate expiry (7 days from now)
  v_expires_at := NOW() + INTERVAL '7 days';
  
  -- Create reward record
  INSERT INTO referral_rewards (
    referrer_discord_id,
    referrer_guild_id,
    referral_id,
    referred_discord_id,
    expires_at,
    original_tier,
    original_expires_at
  ) VALUES (
    p_referrer_discord_id,
    p_referrer_guild_id,
    p_referral_id,
    p_referred_discord_id,
    v_expires_at,
    v_original_tier,
    v_original_expires_at
  ) RETURNING id INTO v_reward_id;
  
  -- Upgrade guild to Enterprise for 1 week
  UPDATE guild_configs
  SET 
    subscription_tier = 'enterprise',
    subscription_status = 'active',
    subscription_expires_at = v_expires_at,
    updated_at = NOW()
  WHERE guild_id = p_referrer_guild_id;
  
  -- Mark referral as rewarded
  UPDATE referrals
  SET reward_given = true, updated_at = NOW()
  WHERE id = p_referral_id;
  
  -- Update referral code stats
  UPDATE referral_codes
  SET total_rewards_earned = total_rewards_earned + 1, updated_at = NOW()
  WHERE discord_id = p_referrer_discord_id;
  
  RETURN v_reward_id;
END;
$$ LANGUAGE plpgsql;

-- Function to handle expired rewards (called by cron/scheduler)
CREATE OR REPLACE FUNCTION expire_referral_rewards()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_reward RECORD;
BEGIN
  -- Find expired rewards
  FOR v_reward IN 
    SELECT * FROM referral_rewards 
    WHERE is_active = true AND expires_at < NOW()
  LOOP
    -- Restore original subscription
    UPDATE guild_configs
    SET 
      subscription_tier = COALESCE(v_reward.original_tier, 'free'),
      subscription_expires_at = v_reward.original_expires_at,
      updated_at = NOW()
    WHERE guild_id = v_reward.referrer_guild_id;
    
    -- Mark reward as expired
    UPDATE referral_rewards
    SET is_active = false
    WHERE id = v_reward.id;
    
    v_expired_count := v_expired_count + 1;
  END LOOP;
  
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- TRIGGERS
-- ================================================================

-- Update timestamps on changes
CREATE OR REPLACE FUNCTION update_referral_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers safely
DO $$
BEGIN
  DROP TRIGGER IF EXISTS referral_codes_updated_at ON referral_codes;
  CREATE TRIGGER referral_codes_updated_at
    BEFORE UPDATE ON referral_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_referral_timestamp();
  
  DROP TRIGGER IF EXISTS referrals_updated_at ON referrals;
  CREATE TRIGGER referrals_updated_at
    BEFORE UPDATE ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_referral_timestamp();
  
  DROP TRIGGER IF EXISTS referral_settings_updated_at ON referral_settings;
  CREATE TRIGGER referral_settings_updated_at
    BEFORE UPDATE ON referral_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_referral_timestamp();
  
  RAISE NOTICE 'Triggers created';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating triggers: %', SQLERRM;
END $$;

-- ================================================================
-- VERIFICATION
-- ================================================================
SELECT 
  'Referral system installed successfully!' as status,
  (SELECT COUNT(*) FROM referral_codes) as total_codes,
  (SELECT COUNT(*) FROM referrals) as total_referrals,
  (SELECT COUNT(*) FROM referral_rewards) as total_rewards;
