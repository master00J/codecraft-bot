-- Add unverified_role_id column to welcome_configs
-- This allows servers to configure which role should be removed when users verify

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'welcome_configs' AND column_name = 'unverified_role_id'
  ) THEN
    ALTER TABLE welcome_configs ADD COLUMN unverified_role_id TEXT;
    RAISE NOTICE '✅ Added unverified_role_id column to welcome_configs';
  ELSE
    RAISE NOTICE 'ℹ️  unverified_role_id column already exists';
  END IF;
END $$;



