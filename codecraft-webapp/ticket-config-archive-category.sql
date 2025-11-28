-- ================================================================
-- ADD ARCHIVE CATEGORY COLUMN TO TICKET_CONFIG
-- ================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_config' AND column_name = 'archive_category_id'
  ) THEN
    ALTER TABLE ticket_config ADD COLUMN archive_category_id TEXT;
    RAISE NOTICE '✅ Added archive_category_id column to ticket_config';
  ELSE
    RAISE NOTICE 'ℹ️  archive_category_id column already exists';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '📋 Archive category column added successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 You can now configure the archive category in the dashboard!';
END $$;

