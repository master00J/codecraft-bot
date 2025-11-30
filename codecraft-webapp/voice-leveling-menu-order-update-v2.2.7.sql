-- Voice Leveling & Customizable Menu Order Update
-- Version: 2.2.7
-- Release Date: 2025-01-XX

-- Insert the main update entry
INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('2.2.7', 'Voice Leveling & Customizable Menu Order', CURRENT_DATE, 'Introducing voice activity leveling system with separate voice levels, XP tracking, and role-based multipliers. Plus, customizable dashboard menu order with drag-and-drop interface for personalized server management.', 'feature', true, true, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- VOICE LEVELING SYSTEM
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Voice Activity Leveling',
  'Track voice channel activity separately from text messaging. Users earn voice XP and gain voice levels based on time spent in voice channels, encouraging community engagement through voice communication.',
  'feature',
  '🎤',
  0
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Separate Voice Levels',
  'Voice levels are tracked independently from text message levels. Users have separate voice XP, voice level, and voice rank, providing a complete picture of their server participation.',
  'feature',
  '📊',
  1
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Automatic XP Tracking',
  'Voice XP is automatically awarded every minute for active voice channel participants. XP is calculated based on configurable rates and applied multipliers, ensuring fair and transparent progression.',
  'feature',
  '⚡',
  2
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Voice XP Configuration',
  'Configure voice XP settings per server including enabling/disabling voice leveling and setting XP per minute rates. Control voice leveling behavior to match your server needs.',
  'feature',
  '⚙️',
  3
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Role-Based Voice XP Multipliers',
  'Set custom voice XP multipliers for specific Discord roles. Reward active community members, boosters, or staff with increased voice XP rates. Configure multipliers from 0.1x to 10.0x.',
  'feature',
  '🎭',
  4
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Voice Stats in /rank & /stats',
  'Voice leveling information is now displayed in /rank and /stats commands. See voice level, voice XP progress, and voice rank alongside text message statistics for comprehensive user profiles.',
  'feature',
  '📈',
  5
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Voice Leaderboard Support',
  'Voice XP and voice levels are indexed for fast leaderboard queries. Track your most active voice participants and create voice-specific leaderboards and rankings.',
  'feature',
  '🏆',
  6
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Voice Analytics Integration',
  'Voice statistics are integrated into the analytics dashboard. View voice activity over time, top voice channels, voice activity heatmaps, and voice user leaderboards.',
  'feature',
  '📊',
  7
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

-- ============================================
-- CUSTOMIZABLE MENU ORDER
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Drag-and-Drop Menu Reordering',
  'Customize your dashboard menu order with an intuitive drag-and-drop interface. Reorder menu items to match your workflow and prioritize the features you use most.',
  'feature',
  '🔀',
  8
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Persistent Menu Customization',
  'Your custom menu order is saved per server and persists across sessions. Each server can have its own personalized menu layout tailored to its needs.',
  'feature',
  '💾',
  9
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Reorder Mode Toggle',
  'Easy-to-use reorder mode with visual grip handles for drag-and-drop. Toggle between normal navigation and reorder mode with a single click. Save or cancel changes with dedicated buttons.',
  'feature',
  '🎛️',
  10
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Smart Menu Ordering',
  'Menu items can be reordered while preserving tier badges and visual indicators. Missing items are automatically appended, ensuring all features remain accessible after customization.',
  'feature',
  '🧠',
  11
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

-- ============================================
-- DATABASE SCHEMA CHANGES
-- ============================================

-- Voice Leveling Schema
-- Add voice XP and voice level columns to user_levels
ALTER TABLE user_levels
  ADD COLUMN IF NOT EXISTS voice_xp BIGINT DEFAULT 0;

ALTER TABLE user_levels
  ADD COLUMN IF NOT EXISTS voice_level INTEGER DEFAULT 0;

-- Add index for voice level leaderboard
CREATE INDEX IF NOT EXISTS idx_user_levels_voice_xp ON user_levels(guild_id, voice_xp DESC);

-- Update leveling_configs defaults if needed
DO $$
BEGIN
  -- Ensure voice_xp_enabled and voice_xp_per_minute exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leveling_configs' 
    AND column_name = 'voice_xp_enabled'
  ) THEN
    ALTER TABLE leveling_configs ADD COLUMN voice_xp_enabled BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leveling_configs' 
    AND column_name = 'voice_xp_per_minute'
  ) THEN
    ALTER TABLE leveling_configs ADD COLUMN voice_xp_per_minute INTEGER DEFAULT 2;
  END IF;
END $$;

-- Voice XP Multipliers Schema
CREATE TABLE IF NOT EXISTS rank_voice_xp_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  role_name TEXT, -- Optional: store role name for display purposes
  multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0, -- e.g., 1.5 = 150% XP, 2.0 = 200% XP
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, role_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_rank_voice_xp_multipliers_guild ON rank_voice_xp_multipliers(guild_id);
CREATE INDEX IF NOT EXISTS idx_rank_voice_xp_multipliers_role ON rank_voice_xp_multipliers(role_id);
CREATE INDEX IF NOT EXISTS idx_rank_voice_xp_multipliers_enabled ON rank_voice_xp_multipliers(guild_id, enabled) WHERE enabled = true;

-- Update timestamp trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_rank_voice_xp_multipliers_updated_at'
  ) THEN
    CREATE TRIGGER update_rank_voice_xp_multipliers_updated_at
      BEFORE UPDATE ON rank_voice_xp_multipliers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE rank_voice_xp_multipliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rank_voice_xp_multipliers' 
    AND policyname = 'Users can view voice XP multipliers for their guilds'
  ) THEN
    CREATE POLICY "Users can view voice XP multipliers for their guilds"
      ON rank_voice_xp_multipliers FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rank_voice_xp_multipliers' 
    AND policyname = 'Users can insert voice XP multipliers for their guilds'
  ) THEN
    CREATE POLICY "Users can insert voice XP multipliers for their guilds"
      ON rank_voice_xp_multipliers FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rank_voice_xp_multipliers' 
    AND policyname = 'Users can update voice XP multipliers for their guilds'
  ) THEN
    CREATE POLICY "Users can update voice XP multipliers for their guilds"
      ON rank_voice_xp_multipliers FOR UPDATE
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rank_voice_xp_multipliers' 
    AND policyname = 'Users can delete voice XP multipliers for their guilds'
  ) THEN
    CREATE POLICY "Users can delete voice XP multipliers for their guilds"
      ON rank_voice_xp_multipliers FOR DELETE
      USING (true);
  END IF;
END $$;

-- Comments
COMMENT ON TABLE rank_voice_xp_multipliers IS 'Stores custom voice XP multipliers for Discord roles per guild';
COMMENT ON COLUMN rank_voice_xp_multipliers.multiplier IS 'Voice XP multiplier (e.g., 1.5 = 150% XP, 2.0 = 200% XP, 0.5 = 50% XP)';
COMMENT ON COLUMN rank_voice_xp_multipliers.role_name IS 'Optional: stores role name for display purposes in dashboard';

-- Dashboard Menu Order Schema
-- Add menu_order column to guild_configs
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS menu_order JSONB DEFAULT NULL;

-- Index for menu order queries
CREATE INDEX IF NOT EXISTS idx_guild_configs_menu_order 
  ON guild_configs(guild_id) 
  WHERE menu_order IS NOT NULL;

COMMENT ON COLUMN guild_configs.menu_order IS 'JSONB array of menu item names in custom order. Example: ["Overview", "Leveling", "Moderation", ...]';

-- ============================================
-- GENERAL IMPROVEMENTS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Enhanced Analytics Dashboard',
  'Analytics dashboard now includes comprehensive voice statistics with activity charts, top voice channels, voice user leaderboards, and hourly activity heatmaps for better server insights.',
  'improvement',
  '📊',
  12
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Improved Stats Cards',
  'Stats cards (/stats command) now display both text and voice leveling information with separate progress bars and XP tracking. Voice level and XP are clearly shown alongside text statistics.',
  'improvement',
  '🎨',
  13
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Better User Experience',
  'Intuitive drag-and-drop interface for menu customization with visual feedback. Smooth transitions and clear save/cancel options make customization easy and accessible.',
  'improvement',
  '✨',
  14
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Performance Optimizations',
  'Optimized voice session tracking and XP calculations. Efficient database queries for voice statistics and menu order loading with proper indexing for fast lookups.',
  'improvement',
  '🚀',
  15
FROM updates u WHERE u.version = '2.2.7'
ON CONFLICT DO NOTHING;

