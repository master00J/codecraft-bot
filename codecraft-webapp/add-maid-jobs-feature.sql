-- Add Maid Jobs feature to feature_definitions
INSERT INTO feature_definitions (feature_key, feature_name, feature_description, feature_category, is_boolean, default_limit)
VALUES 
    ('maid_jobs', 'Maid Jobs', 'Allow users to clock in, clean channels, and earn rewards with roleplay messages and role upgrades', 'premium', true, NULL)
ON CONFLICT (feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    feature_description = EXCLUDED.feature_description,
    feature_category = EXCLUDED.feature_category,
    is_boolean = EXCLUDED.is_boolean;

-- Optionally enable maid_jobs for Premium and Enterprise tiers by default
-- Update subscription_tiers to include maid_jobs in features JSONB
UPDATE subscription_tiers
SET features = jsonb_set(
    COALESCE(features, '{}'::jsonb),
    '{maid_jobs}',
    'true'::jsonb
)
WHERE tier_name IN ('premium', 'enterprise')
AND NOT (features ? 'maid_jobs');

