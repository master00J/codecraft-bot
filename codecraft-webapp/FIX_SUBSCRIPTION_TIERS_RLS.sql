-- Fix RLS policies for subscription_tiers
-- The current policies use auth.jwt() which doesn't work with NextAuth
-- We need to disable RLS or use service role key for admin operations

-- Drop existing policies
DROP POLICY IF EXISTS "Tiers are publicly readable" ON subscription_tiers;
DROP POLICY IF EXISTS "Features are publicly readable" ON feature_definitions;
DROP POLICY IF EXISTS "Only admins can modify tiers" ON subscription_tiers;

-- Disable RLS for now since we're using service role key and checking admin in API
ALTER TABLE subscription_tiers DISABLE ROW LEVEL SECURITY;
ALTER TABLE tier_features DISABLE ROW LEVEL SECURITY;
ALTER TABLE feature_definitions DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename IN ('subscription_tiers', 'tier_features', 'feature_definitions');

-- Test query
SELECT tier_name, display_name, price_monthly FROM subscription_tiers ORDER BY sort_order;

