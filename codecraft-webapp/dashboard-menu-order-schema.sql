-- Dashboard Menu Order Schema
-- Allows users to customize the order of menu items in the dashboard

-- Add menu_order column to guild_configs
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS menu_order JSONB DEFAULT NULL;

-- Index for menu order queries
CREATE INDEX IF NOT EXISTS idx_guild_configs_menu_order 
  ON guild_configs(guild_id) 
  WHERE menu_order IS NOT NULL;

COMMENT ON COLUMN guild_configs.menu_order IS 'JSONB array of menu item names in custom order. Example: ["Overview", "Leveling", "Moderation", ...]';

