-- Add User Profiles feature to feature_definitions table

INSERT INTO feature_definitions (feature_key, feature_name, feature_description, feature_category, is_boolean, default_limit)
VALUES (
  'user_profiles',
  'User Profiles',
  'Create interactive profile forms with checkboxes. Users select options and results are posted in threads.',
  'premium',
  true,
  NULL
)
ON CONFLICT (feature_key) DO UPDATE
SET 
  feature_name = EXCLUDED.feature_name,
  feature_description = EXCLUDED.feature_description,
  feature_category = EXCLUDED.feature_category,
  is_boolean = EXCLUDED.is_boolean;

