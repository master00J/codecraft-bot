-- ================================================================
-- TICKET CONFIG MISSING COLUMNS
-- Adds missing columns to ticket_config table if they don't exist
-- ================================================================

-- Add panel_button_emoji column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_config' AND column_name = 'panel_button_emoji'
  ) THEN
    ALTER TABLE ticket_config ADD COLUMN panel_button_emoji TEXT;
    RAISE NOTICE '✅ Added panel_button_emoji column to ticket_config';
  ELSE
    RAISE NOTICE 'ℹ️  panel_button_emoji column already exists';
  END IF;
END $$;

-- Add panel_button_label column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_config' AND column_name = 'panel_button_label'
  ) THEN
    ALTER TABLE ticket_config ADD COLUMN panel_button_label TEXT;
    RAISE NOTICE '✅ Added panel_button_label column to ticket_config';
  ELSE
    RAISE NOTICE 'ℹ️  panel_button_label column already exists';
  END IF;
END $$;

-- Add panel_embed_thumbnail_url column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_config' AND column_name = 'panel_embed_thumbnail_url'
  ) THEN
    ALTER TABLE ticket_config ADD COLUMN panel_embed_thumbnail_url TEXT;
    RAISE NOTICE '✅ Added panel_embed_thumbnail_url column to ticket_config';
  ELSE
    RAISE NOTICE 'ℹ️  panel_embed_thumbnail_url column already exists';
  END IF;
END $$;

-- Add panel_embed_image_url column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_config' AND column_name = 'panel_embed_image_url'
  ) THEN
    ALTER TABLE ticket_config ADD COLUMN panel_embed_image_url TEXT;
    RAISE NOTICE '✅ Added panel_embed_image_url column to ticket_config';
  ELSE
    RAISE NOTICE 'ℹ️  panel_embed_image_url column already exists';
  END IF;
END $$;

-- Add panel_embed_footer column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_config' AND column_name = 'panel_embed_footer'
  ) THEN
    ALTER TABLE ticket_config ADD COLUMN panel_embed_footer TEXT;
    RAISE NOTICE '✅ Added panel_embed_footer column to ticket_config';
  ELSE
    RAISE NOTICE 'ℹ️  panel_embed_footer column already exists';
  END IF;
END $$;

-- Add panel_embed_color column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_config' AND column_name = 'panel_embed_color'
  ) THEN
    ALTER TABLE ticket_config ADD COLUMN panel_embed_color TEXT;
    RAISE NOTICE '✅ Added panel_embed_color column to ticket_config';
  ELSE
    RAISE NOTICE 'ℹ️  panel_embed_color column already exists';
  END IF;
END $$;

-- Add panel_embed_description column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_config' AND column_name = 'panel_embed_description'
  ) THEN
    ALTER TABLE ticket_config ADD COLUMN panel_embed_description TEXT;
    RAISE NOTICE '✅ Added panel_embed_description column to ticket_config';
  ELSE
    RAISE NOTICE 'ℹ️  panel_embed_description column already exists';
  END IF;
END $$;

-- Add panel_embed_title column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_config' AND column_name = 'panel_embed_title'
  ) THEN
    ALTER TABLE ticket_config ADD COLUMN panel_embed_title TEXT;
    RAISE NOTICE '✅ Added panel_embed_title column to ticket_config';
  ELSE
    RAISE NOTICE 'ℹ️  panel_embed_title column already exists';
  END IF;
END $$;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '';
  RAISE NOTICE '✅ Ticket Config Schema Update Complete!';
  RAISE NOTICE '📋 All missing columns have been added to ticket_config table';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 You can now use all ticket panel customization features!';
END $$;

