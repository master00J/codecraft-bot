-- Add is_verify_button column to role_menu_options
-- This allows role menus to include verify buttons that remove unverified roles

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'role_menu_options' AND column_name = 'is_verify_button'
  ) THEN
    ALTER TABLE role_menu_options ADD COLUMN is_verify_button BOOLEAN DEFAULT FALSE;
    RAISE NOTICE '✅ Added is_verify_button column to role_menu_options';
  ELSE
    RAISE NOTICE 'ℹ️  is_verify_button column already exists';
  END IF;
END $$;



