-- Fix UUID generator for user_combat_inventory table
-- This fixes the "null value in column id" error

-- Ensure extensions are loaded
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set default UUID generator for user_combat_inventory.id
DO $$ 
BEGIN
  -- Try to alter the column to add default UUID generator
  BEGIN
    ALTER TABLE user_combat_inventory 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();
  EXCEPTION 
    WHEN others THEN
      -- If that fails, try uuid_generate_v4()
      BEGIN
        ALTER TABLE user_combat_inventory 
        ALTER COLUMN id SET DEFAULT uuid_generate_v4();
      EXCEPTION
        WHEN others THEN
          RAISE NOTICE 'Could not set UUID default for user_combat_inventory.id';
      END;
  END;
END $$;

-- Also fix user_equipped_items if needed
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE user_equipped_items 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();
  EXCEPTION 
    WHEN others THEN
      BEGIN
        ALTER TABLE user_equipped_items 
        ALTER COLUMN id SET DEFAULT uuid_generate_v4();
      EXCEPTION
        WHEN others THEN
          RAISE NOTICE 'Could not set UUID default for user_equipped_items.id';
      END;
  END;
END $$;

-- Also fix combat_item_transactions if needed
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE combat_item_transactions 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();
  EXCEPTION 
    WHEN others THEN
      BEGIN
        ALTER TABLE combat_item_transactions 
        ALTER COLUMN id SET DEFAULT uuid_generate_v4();
      EXCEPTION
        WHEN others THEN
          RAISE NOTICE 'Could not set UUID default for combat_item_transactions.id';
      END;
  END;
END $$;

-- Verify the changes
SELECT 
  table_name,
  column_name,
  column_default
FROM information_schema.columns
WHERE table_name IN ('user_combat_inventory', 'user_equipped_items', 'combat_item_transactions')
  AND column_name = 'id';

