-- Subscription Tiers Management Schema (SAFE TO RE-RUN)
-- Allows admin to configure pricing and features for each tier

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tiers are publicly readable" ON subscription_tiers;
DROP POLICY IF EXISTS "Features are publicly readable" ON feature_definitions;
DROP POLICY IF EXISTS "Only admins can modify tiers" ON subscription_tiers;

-- 1. Subscription Tiers Table
CREATE TABLE IF NOT EXISTS subscription_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) DEFAULT 0,
    price_yearly DECIMAL(10,2) DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    features JSONB DEFAULT '{}',
    limits JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tier Features (More structured approach)
CREATE TABLE IF NOT EXISTS tier_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_id UUID REFERENCES subscription_tiers(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    feature_description TEXT,
    enabled BOOLEAN DEFAULT true,
    limit_value INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tier_id, feature_key)
);

-- 3. Feature Definitions (Master list of all possible features)
CREATE TABLE IF NOT EXISTS feature_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key TEXT UNIQUE NOT NULL,
    feature_name TEXT NOT NULL,
    feature_description TEXT,
    feature_category TEXT,
    is_boolean BOOLEAN DEFAULT true,
    default_limit INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tiers (use ON CONFLICT to prevent duplicates)
INSERT INTO subscription_tiers (tier_name, display_name, description, price_monthly, price_yearly, sort_order, features, limits)
VALUES 
    ('free', 'Free', 'Perfect for small communities getting started', 0.00, 0.00, 1, 
     '{"leveling": true, "moderation_basic": true, "welcome": false, "analytics": false, "custom_branding": false}'::jsonb,
     '{"custom_commands": 5, "stream_notifications": 1, "xp_boost": 1.0}'::jsonb),
    
    ('basic', 'Basic', 'Great for growing communities', 4.99, 49.90, 2,
     '{"leveling": true, "moderation_advanced": true, "welcome": true, "analytics": true, "custom_branding": false}'::jsonb,
     '{"custom_commands": 25, "stream_notifications": 5, "xp_boost": 1.2}'::jsonb),
    
    ('premium', 'Premium', 'Most popular for active communities', 9.99, 99.90, 3,
     '{"leveling": true, "moderation_advanced": true, "welcome": true, "analytics": true, "custom_branding": true}'::jsonb,
     '{"custom_commands": -1, "stream_notifications": -1, "xp_boost": 1.5}'::jsonb),
    
    ('enterprise', 'Enterprise', 'Full power for large communities', 29.99, 299.90, 4,
     '{"leveling": true, "moderation_advanced": true, "welcome": true, "analytics": true, "custom_branding": true, "api_access": true, "multi_guild": true}'::jsonb,
     '{"custom_commands": -1, "stream_notifications": -1, "xp_boost": 2.0, "max_guilds": 5}'::jsonb)
ON CONFLICT (tier_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    sort_order = EXCLUDED.sort_order,
    features = EXCLUDED.features,
    limits = EXCLUDED.limits;

-- Insert feature definitions (use ON CONFLICT to prevent duplicates)
INSERT INTO feature_definitions (feature_key, feature_name, feature_description, feature_category, is_boolean, default_limit)
VALUES 
    ('leveling', 'Leveling System', 'XP and level progression for members', 'core', true, NULL),
    ('moderation_basic', 'Basic Moderation', 'Kick, ban, mute commands', 'core', true, NULL),
    ('moderation_advanced', 'Advanced Moderation', 'Auto-mod, word filters, warnings', 'premium', true, NULL),
    ('custom_commands', 'Custom Commands', 'Create custom bot commands', 'core', false, 5),
    ('stream_notifications', 'Stream Notifications', 'Twitch/YouTube go-live alerts', 'core', false, 1),
    ('welcome', 'Welcome System', 'Welcome messages and auto-roles', 'premium', true, NULL),
    ('analytics', 'Analytics Dashboard', 'Server statistics and insights', 'premium', true, NULL),
    ('custom_branding', 'Custom Branding', 'Customize bot name, avatar, colors', 'premium', true, NULL),
    ('api_access', 'API Access', 'REST API for integrations', 'enterprise', true, NULL),
    ('multi_guild', 'Multi-Guild Support', 'Use one subscription for multiple servers', 'enterprise', false, 5),
    ('xp_boost', 'XP Boost Multiplier', 'Increase XP gain rate', 'core', false, 10),
    ('priority_support', 'Priority Support', 'Faster response times', 'premium', true, NULL),
    ('custom_features', 'Custom Features', 'Request custom bot features', 'enterprise', true, NULL)
ON CONFLICT (feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    feature_description = EXCLUDED.feature_description,
    feature_category = EXCLUDED.feature_category;

-- Create indexes (IF NOT EXISTS doesn't work for indexes, so we need to handle separately)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_subscription_tiers_active') THEN
        CREATE INDEX idx_subscription_tiers_active ON subscription_tiers(is_active);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_subscription_tiers_name') THEN
        CREATE INDEX idx_subscription_tiers_name ON subscription_tiers(tier_name);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tier_features_tier') THEN
        CREATE INDEX idx_tier_features_tier ON tier_features(tier_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tier_features_key') THEN
        CREATE INDEX idx_tier_features_key ON tier_features(feature_key);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_definitions ENABLE ROW LEVEL SECURITY;

-- Create policies (we dropped them at the start, so safe to recreate)
CREATE POLICY "Tiers are publicly readable" ON subscription_tiers
    FOR SELECT USING (is_active = true);

CREATE POLICY "Features are publicly readable" ON feature_definitions
    FOR SELECT USING (true);

CREATE POLICY "Only admins can modify tiers" ON subscription_tiers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.discord_id = (current_setting('request.jwt.claims', true)::json->>'discord_id')
            AND users.is_admin = true
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_tier_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS subscription_tiers_updated_at ON subscription_tiers;
CREATE TRIGGER subscription_tiers_updated_at
    BEFORE UPDATE ON subscription_tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_tier_timestamp();

-- Verify installation
SELECT 
    tier_name,
    display_name,
    price_monthly,
    price_yearly,
    features,
    limits,
    is_active
FROM subscription_tiers
ORDER BY sort_order;

