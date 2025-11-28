-- Combat System Builder
-- Custom items, abilities, bosses, and classes per guild

-- ============================================================================
-- CUSTOM ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS guild_combat_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('weapon', 'armor', 'consumable')),
  icon_url TEXT,
  icon_emoji TEXT DEFAULT '⚔️',
  
  -- Stat bonuses
  damage_bonus DECIMAL(5,2) DEFAULT 0, -- Percentage bonus (e.g., 15.00 = +15%)
  defense_bonus DECIMAL(5,2) DEFAULT 0,
  hp_bonus INTEGER DEFAULT 0,
  crit_chance_bonus DECIMAL(5,2) DEFAULT 0, -- Percentage bonus
  
  -- Consumable effects
  effect_type TEXT, -- 'heal', 'buff_damage', 'buff_defense', 'restore_hp'
  effect_value INTEGER,
  effect_duration INTEGER, -- rounds (0 = instant, -1 = permanent)
  
  -- Economy
  price INTEGER NOT NULL DEFAULT 100,
  sell_price INTEGER, -- If null, defaults to price * 0.5
  
  -- Rarity & Availability
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  required_level INTEGER DEFAULT 1, -- Combat level required to equip
  max_stock INTEGER, -- NULL = unlimited
  
  -- Meta
  is_active BOOLEAN DEFAULT true,
  created_by TEXT, -- User ID who created it
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guild_combat_items_guild ON guild_combat_items(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_combat_items_type ON guild_combat_items(guild_id, type);
CREATE INDEX IF NOT EXISTS idx_guild_combat_items_active ON guild_combat_items(guild_id, is_active);

-- ============================================================================
-- PLAYER INVENTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_combat_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES guild_combat_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id, item_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_combat_inventory_user ON user_combat_inventory(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_combat_inventory_item ON user_combat_inventory(item_id);

-- ============================================================================
-- EQUIPPED ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_equipped_items (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  weapon_id UUID REFERENCES guild_combat_items(id) ON DELETE SET NULL,
  armor_id UUID REFERENCES guild_combat_items(id) ON DELETE SET NULL,
  equipped_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (guild_id, user_id)
);

-- ============================================================================
-- CUSTOM ABILITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS guild_combat_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_emoji TEXT DEFAULT '⚡',
  
  -- Unlock requirements
  unlock_level INTEGER DEFAULT 1,
  unlock_cost_xp INTEGER DEFAULT 0,
  unlock_cost_coins INTEGER DEFAULT 0,
  
  -- Ability effects
  ability_type TEXT NOT NULL CHECK (ability_type IN ('damage', 'heal', 'buff_damage', 'buff_defense', 'special')),
  effect_value INTEGER NOT NULL,
  effect_duration INTEGER DEFAULT 0, -- rounds (0 = instant)
  
  -- Usage
  cooldown_type TEXT DEFAULT 'once_per_duel' CHECK (cooldown_type IN ('once_per_duel', 'unlimited', 'cooldown_rounds')),
  cooldown_rounds INTEGER, -- If cooldown_type = 'cooldown_rounds'
  
  -- Meta
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_combat_abilities_guild ON guild_combat_abilities(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_combat_abilities_active ON guild_combat_abilities(guild_id, is_active);

-- ============================================================================
-- UNLOCKED ABILITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_unlocked_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  ability_id UUID NOT NULL REFERENCES guild_combat_abilities(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id, ability_id)
);

CREATE INDEX IF NOT EXISTS idx_user_unlocked_abilities_user ON user_unlocked_abilities(guild_id, user_id);

-- ============================================================================
-- CUSTOM BOSSES
-- ============================================================================

CREATE TABLE IF NOT EXISTS guild_combat_bosses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  icon_emoji TEXT DEFAULT '🐉',
  
  -- Boss stats
  hp INTEGER DEFAULT 500 CHECK (hp > 0),
  min_damage INTEGER DEFAULT 10,
  max_damage INTEGER DEFAULT 30,
  attack_pattern TEXT DEFAULT 'random' CHECK (attack_pattern IN ('aggressive', 'defensive', 'random', 'adaptive')),
  
  -- Requirements
  required_level INTEGER DEFAULT 1,
  entry_cost INTEGER DEFAULT 0,
  
  -- Rewards
  reward_coins INTEGER DEFAULT 0,
  reward_xp_multiplier DECIMAL(5,2) DEFAULT 1.5,
  reward_items JSONB, -- [{item_id: UUID, drop_chance: 0.5}]
  
  -- Scheduling
  schedule_type TEXT DEFAULT 'always' CHECK (schedule_type IN ('always', 'daily', 'weekly', 'event')),
  last_reset TIMESTAMPTZ,
  
  -- Meta
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_combat_bosses_guild ON guild_combat_bosses(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_combat_bosses_active ON guild_combat_bosses(guild_id, is_active);

-- ============================================================================
-- BOSS DEFEATS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_boss_defeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  boss_id UUID NOT NULL REFERENCES guild_combat_bosses(id) ON DELETE CASCADE,
  time_taken INTEGER, -- seconds
  hp_remaining INTEGER,
  defeated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_boss_defeats_user ON user_boss_defeats(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_boss_defeats_boss ON user_boss_defeats(boss_id);
CREATE INDEX IF NOT EXISTS idx_user_boss_defeats_time ON user_boss_defeats(boss_id, time_taken ASC);

-- ============================================================================
-- CUSTOM CLASSES
-- ============================================================================

CREATE TABLE IF NOT EXISTS guild_combat_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_emoji TEXT DEFAULT '⚔️',
  
  -- Stat modifiers
  damage_multiplier DECIMAL(5,2) DEFAULT 1.0,
  defense_multiplier DECIMAL(5,2) DEFAULT 1.0,
  hp_modifier INTEGER DEFAULT 0,
  crit_chance_modifier DECIMAL(5,2) DEFAULT 0,
  
  -- Special traits
  special_trait TEXT, -- Description of unique trait
  
  -- Unlock requirements
  unlock_level INTEGER DEFAULT 1,
  unlock_cost INTEGER DEFAULT 0,
  
  -- Exclusive abilities
  exclusive_abilities JSONB, -- [ability_id, ...]
  
  -- Meta
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_combat_classes_guild ON guild_combat_classes(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_combat_classes_active ON guild_combat_classes(guild_id, is_active);

-- ============================================================================
-- USER SELECTED CLASS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_combat_class (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  class_id UUID REFERENCES guild_combat_classes(id) ON DELETE SET NULL,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (guild_id, user_id)
);

-- ============================================================================
-- COMBAT ECONOMY SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS guild_combat_settings (
  guild_id TEXT PRIMARY KEY,
  
  -- XP Settings
  win_xp_min INTEGER DEFAULT 50,
  win_xp_max INTEGER DEFAULT 75,
  loss_xp_min INTEGER DEFAULT 15,
  loss_xp_max INTEGER DEFAULT 25,
  boss_xp_multiplier DECIMAL(5,2) DEFAULT 1.5,
  
  -- Coin Settings
  win_coin_bonus INTEGER DEFAULT 0, -- Extra coins on win (on top of bet)
  daily_shop_discount DECIMAL(5,2) DEFAULT 0, -- Percentage discount
  
  -- Bet Settings
  min_bet INTEGER DEFAULT 10,
  max_bet INTEGER, -- NULL = unlimited
  high_stakes_level INTEGER, -- Combat level required for high bets
  
  -- Feature Toggles
  shop_enabled BOOLEAN DEFAULT true,
  abilities_enabled BOOLEAN DEFAULT true,
  classes_enabled BOOLEAN DEFAULT false,
  bosses_enabled BOOLEAN DEFAULT false,
  
  -- Meta
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ITEM TRANSACTIONS (for analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS combat_item_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  item_id UUID REFERENCES guild_combat_items(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'reward', 'admin_give')),
  quantity INTEGER DEFAULT 1,
  price INTEGER, -- Price paid/received
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combat_item_transactions_guild ON combat_item_transactions(guild_id);
CREATE INDEX IF NOT EXISTS idx_combat_item_transactions_user ON combat_item_transactions(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_combat_item_transactions_item ON combat_item_transactions(item_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE guild_combat_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_combat_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_equipped_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_combat_abilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_unlocked_abilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_combat_bosses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_boss_defeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_combat_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_combat_class ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_combat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE combat_item_transactions ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access to guild_combat_items" ON guild_combat_items FOR SELECT USING (true);
CREATE POLICY "Public read access to user_combat_inventory" ON user_combat_inventory FOR SELECT USING (true);
CREATE POLICY "Public read access to user_equipped_items" ON user_equipped_items FOR SELECT USING (true);
CREATE POLICY "Public read access to guild_combat_abilities" ON guild_combat_abilities FOR SELECT USING (true);
CREATE POLICY "Public read access to user_unlocked_abilities" ON user_unlocked_abilities FOR SELECT USING (true);
CREATE POLICY "Public read access to guild_combat_bosses" ON guild_combat_bosses FOR SELECT USING (true);
CREATE POLICY "Public read access to user_boss_defeats" ON user_boss_defeats FOR SELECT USING (true);
CREATE POLICY "Public read access to guild_combat_classes" ON guild_combat_classes FOR SELECT USING (true);
CREATE POLICY "Public read access to user_combat_class" ON user_combat_class FOR SELECT USING (true);
CREATE POLICY "Public read access to guild_combat_settings" ON guild_combat_settings FOR SELECT USING (true);
CREATE POLICY "Public read access to combat_item_transactions" ON combat_item_transactions FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service role full access to guild_combat_items" ON guild_combat_items FOR ALL USING (true);
CREATE POLICY "Service role full access to user_combat_inventory" ON user_combat_inventory FOR ALL USING (true);
CREATE POLICY "Service role full access to user_equipped_items" ON user_equipped_items FOR ALL USING (true);
CREATE POLICY "Service role full access to guild_combat_abilities" ON guild_combat_abilities FOR ALL USING (true);
CREATE POLICY "Service role full access to user_unlocked_abilities" ON user_unlocked_abilities FOR ALL USING (true);
CREATE POLICY "Service role full access to guild_combat_bosses" ON guild_combat_bosses FOR ALL USING (true);
CREATE POLICY "Service role full access to user_boss_defeats" ON user_boss_defeats FOR ALL USING (true);
CREATE POLICY "Service role full access to guild_combat_classes" ON guild_combat_classes FOR ALL USING (true);
CREATE POLICY "Service role full access to user_combat_class" ON user_combat_class FOR ALL USING (true);
CREATE POLICY "Service role full access to guild_combat_settings" ON guild_combat_settings FOR ALL USING (true);
CREATE POLICY "Service role full access to combat_item_transactions" ON combat_item_transactions FOR ALL USING (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE guild_combat_items IS 'Custom combat items created by server owners';
COMMENT ON TABLE user_combat_inventory IS 'Player inventory for custom items';
COMMENT ON TABLE user_equipped_items IS 'Currently equipped weapon and armor per player';
COMMENT ON TABLE guild_combat_abilities IS 'Custom abilities created by server owners';
COMMENT ON TABLE guild_combat_bosses IS 'Custom boss fights created by server owners';
COMMENT ON TABLE guild_combat_classes IS 'Custom combat classes created by server owners';
COMMENT ON TABLE guild_combat_settings IS 'Combat economy and feature settings per guild';

