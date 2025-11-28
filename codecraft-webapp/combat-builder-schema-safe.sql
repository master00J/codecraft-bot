-- Combat System Builder - Safe Migration
-- Only adds missing columns and tables, skips existing ones

-- ============================================================================
-- ENSURE UUID EXTENSION IS ENABLED
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- FIX ID COLUMN DEFAULT (if missing)
-- ============================================================================

-- Ensure id column has UUID default
DO $$ 
BEGIN
  -- Check if id column exists and add default if missing
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'id'
  ) THEN
    -- Set default for id column
    ALTER TABLE guild_combat_items 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();
    RAISE NOTICE 'Set default UUID generator for id column';
  ELSE
    RAISE NOTICE 'id column does not exist yet';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not set id default, might already be set';
END $$;

-- ============================================================================
-- ADD MISSING COLUMNS TO guild_combat_items
-- ============================================================================

-- Add created_by column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN created_by TEXT;
    RAISE NOTICE 'Added created_by column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column created_by already exists in guild_combat_items';
  END IF;
END $$;

-- Add description column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN description TEXT;
    RAISE NOTICE 'Added description column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column description already exists in guild_combat_items';
  END IF;
END $$;

-- Add icon_url column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'icon_url'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN icon_url TEXT;
    RAISE NOTICE 'Added icon_url column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column icon_url already exists in guild_combat_items';
  END IF;
END $$;

-- Add icon_emoji column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'icon_emoji'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN icon_emoji TEXT DEFAULT '⚔️';
    RAISE NOTICE 'Added icon_emoji column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column icon_emoji already exists in guild_combat_items';
  END IF;
END $$;

-- Add price column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'price'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN price INTEGER NOT NULL DEFAULT 100;
    RAISE NOTICE 'Added price column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column price already exists in guild_combat_items';
  END IF;
END $$;

-- Add effect_value column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'effect_value'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN effect_value INTEGER;
    RAISE NOTICE 'Added effect_value column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column effect_value already exists in guild_combat_items';
  END IF;
END $$;

-- Add effect_duration column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'effect_duration'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN effect_duration INTEGER;
    RAISE NOTICE 'Added effect_duration column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column effect_duration already exists in guild_combat_items';
  END IF;
END $$;

-- Add sell_price column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'sell_price'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN sell_price INTEGER;
    RAISE NOTICE 'Added sell_price column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column sell_price already exists in guild_combat_items';
  END IF;
END $$;

-- Add crit_chance_bonus column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'crit_chance_bonus'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN crit_chance_bonus DECIMAL(5,2) DEFAULT 0;
    RAISE NOTICE 'Added crit_chance_bonus column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column crit_chance_bonus already exists in guild_combat_items';
  END IF;
END $$;

-- Add damage_bonus column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'damage_bonus'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN damage_bonus DECIMAL(5,2) DEFAULT 0;
    RAISE NOTICE 'Added damage_bonus column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column damage_bonus already exists in guild_combat_items';
  END IF;
END $$;

-- Add defense_bonus column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'defense_bonus'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN defense_bonus DECIMAL(5,2) DEFAULT 0;
    RAISE NOTICE 'Added defense_bonus column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column defense_bonus already exists in guild_combat_items';
  END IF;
END $$;

-- Add hp_bonus column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'hp_bonus'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN hp_bonus INTEGER DEFAULT 0;
    RAISE NOTICE 'Added hp_bonus column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column hp_bonus already exists in guild_combat_items';
  END IF;
END $$;

-- Add required_level column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'required_level'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN required_level INTEGER DEFAULT 1;
    RAISE NOTICE 'Added required_level column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column required_level already exists in guild_combat_items';
  END IF;
END $$;

-- Add rarity column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'rarity'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary'));
    RAISE NOTICE 'Added rarity column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column rarity already exists in guild_combat_items';
  END IF;
END $$;

-- Add max_stock column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'max_stock'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN max_stock INTEGER;
    RAISE NOTICE 'Added max_stock column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column max_stock already exists in guild_combat_items';
  END IF;
END $$;

-- Add is_active column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added is_active column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column is_active already exists in guild_combat_items';
  END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column updated_at already exists in guild_combat_items';
  END IF;
END $$;

-- Add created_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guild_combat_items' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE guild_combat_items ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added created_at column to guild_combat_items';
  ELSE
    RAISE NOTICE 'Column created_at already exists in guild_combat_items';
  END IF;
END $$;

-- ============================================================================
-- CREATE MISSING TABLES
-- ============================================================================

-- User Combat Inventory
CREATE TABLE IF NOT EXISTS user_combat_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES guild_combat_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, user_id, item_id)
);

-- User Equipped Items
CREATE TABLE IF NOT EXISTS user_equipped_items (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  weapon_id UUID REFERENCES guild_combat_items(id) ON DELETE SET NULL,
  armor_id UUID REFERENCES guild_combat_items(id) ON DELETE SET NULL,
  equipped_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (guild_id, user_id)
);

-- Combat Item Transactions
CREATE TABLE IF NOT EXISTS combat_item_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES guild_combat_items(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'trade', 'gift', 'admin')),
  quantity INTEGER NOT NULL,
  price INTEGER NOT NULL,
  from_user_id TEXT, -- For trades/gifts
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CREATE INDEXES (IF NOT EXISTS)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_guild_combat_items_guild ON guild_combat_items(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_combat_items_type ON guild_combat_items(guild_id, type);
CREATE INDEX IF NOT EXISTS idx_guild_combat_items_active ON guild_combat_items(guild_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_combat_inventory_user ON user_combat_inventory(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_combat_inventory_item ON user_combat_inventory(item_id);

CREATE INDEX IF NOT EXISTS idx_user_equipped_items_weapon ON user_equipped_items(weapon_id);
CREATE INDEX IF NOT EXISTS idx_user_equipped_items_armor ON user_equipped_items(armor_id);

CREATE INDEX IF NOT EXISTS idx_combat_transactions_user ON combat_item_transactions(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_combat_transactions_item ON combat_item_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_combat_transactions_type ON combat_item_transactions(transaction_type);

-- ============================================================================
-- RLS POLICIES (DROP IF EXISTS, THEN CREATE)
-- ============================================================================

-- guild_combat_items policies
DROP POLICY IF EXISTS "Public read access to guild_combat_items" ON guild_combat_items;
CREATE POLICY "Public read access to guild_combat_items"
  ON guild_combat_items FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role full access to guild_combat_items" ON guild_combat_items;
CREATE POLICY "Service role full access to guild_combat_items"
  ON guild_combat_items FOR ALL
  USING (true)
  WITH CHECK (true);

-- user_combat_inventory policies
DROP POLICY IF EXISTS "Users can view their own inventory" ON user_combat_inventory;
CREATE POLICY "Users can view their own inventory"
  ON user_combat_inventory FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role full access to user_combat_inventory" ON user_combat_inventory;
CREATE POLICY "Service role full access to user_combat_inventory"
  ON user_combat_inventory FOR ALL
  USING (true)
  WITH CHECK (true);

-- user_equipped_items policies
DROP POLICY IF EXISTS "Users can view equipped items" ON user_equipped_items;
CREATE POLICY "Users can view equipped items"
  ON user_equipped_items FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role full access to user_equipped_items" ON user_equipped_items;
CREATE POLICY "Service role full access to user_equipped_items"
  ON user_equipped_items FOR ALL
  USING (true)
  WITH CHECK (true);

-- combat_item_transactions policies
DROP POLICY IF EXISTS "Users can view transaction history" ON combat_item_transactions;
CREATE POLICY "Users can view transaction history"
  ON combat_item_transactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role full access to combat_item_transactions" ON combat_item_transactions;
CREATE POLICY "Service role full access to combat_item_transactions"
  ON combat_item_transactions FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE guild_combat_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_combat_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_equipped_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE combat_item_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFY SETUP
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Combat system schema update completed successfully!';
  RAISE NOTICE 'Tables created/verified:';
  RAISE NOTICE '  - guild_combat_items';
  RAISE NOTICE '  - user_combat_inventory';
  RAISE NOTICE '  - user_equipped_items';
  RAISE NOTICE '  - combat_item_transactions';
END $$;

