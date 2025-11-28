-- ================================================================
-- COMCRAFT AUTO-ROLES SYSTEM
-- Self-assignable roles via buttons, reactions, or dropdowns
-- ================================================================

-- ================================================================
-- 1. ROLE MENUS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS role_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Guild info
  guild_id TEXT NOT NULL,
  
  -- Menu details
  menu_name TEXT NOT NULL, -- "Notification Roles", "Pronoun Roles", etc.
  menu_type TEXT DEFAULT 'buttons', -- 'buttons', 'reactions', 'dropdown'
  
  -- Display
  channel_id TEXT NOT NULL,
  message_id TEXT, -- Discord message ID (set after posting)
  
  -- Embed customization
  embed_title TEXT DEFAULT 'Select Your Roles',
  embed_description TEXT DEFAULT 'Click the buttons below to assign yourself roles:',
  embed_color TEXT DEFAULT '#5865F2',
  
  -- Settings
  max_roles INTEGER DEFAULT 1, -- 0 = unlimited, 1 = single choice, N = max N roles
  required_role_id TEXT, -- Users need this role to use menu (optional)
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Stats
  total_uses INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_role_menus_guild ON role_menus(guild_id);
CREATE INDEX IF NOT EXISTS idx_role_menus_message ON role_menus(message_id);
CREATE INDEX IF NOT EXISTS idx_role_menus_active ON role_menus(guild_id, is_active);

-- ================================================================
-- 2. ROLE MENU OPTIONS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS role_menu_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Link to menu
  menu_id UUID NOT NULL REFERENCES role_menus(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  
  -- Role details
  role_id TEXT NOT NULL,
  role_name TEXT NOT NULL,
  
  -- Display
  button_label TEXT, -- For buttons
  button_emoji TEXT, -- Emoji for button/reaction
  button_style TEXT DEFAULT 'primary', -- 'primary', 'secondary', 'success', 'danger'
  
  description TEXT, -- For dropdown
  
  -- Position
  position INTEGER DEFAULT 0,
  
  -- Stats
  total_assigns INTEGER DEFAULT 0,
  
  UNIQUE(menu_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_role_menu_options_menu ON role_menu_options(menu_id);
CREATE INDEX IF NOT EXISTS idx_role_menu_options_role ON role_menu_options(role_id);

-- ================================================================
-- 3. ROLE ASSIGNMENTS LOG
-- ================================================================

CREATE TABLE IF NOT EXISTS role_assignments_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  
  menu_id UUID REFERENCES role_menus(id) ON DELETE SET NULL,
  role_id TEXT NOT NULL,
  role_name TEXT,
  
  action TEXT NOT NULL, -- 'assigned', 'removed'
  
  -- Context
  channel_id TEXT,
  interaction_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_role_assignments_guild ON role_assignments_log(guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_assignments_user ON role_assignments_log(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_role ON role_assignments_log(role_id);

-- ================================================================
-- RLS POLICIES
-- ================================================================

ALTER TABLE role_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_menu_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments_log ENABLE ROW LEVEL SECURITY;

-- Guild owners can manage their role menus
CREATE POLICY "Guild owners manage role_menus"
  ON role_menus
  FOR ALL
  TO authenticated
  USING (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  )
  WITH CHECK (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

-- Guild owners can manage role menu options
CREATE POLICY "Guild owners manage role_menu_options"
  ON role_menu_options
  FOR ALL
  TO authenticated
  USING (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  )
  WITH CHECK (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

-- Guild owners can view role assignment logs
CREATE POLICY "Guild owners view role_assignments_log"
  ON role_assignments_log
  FOR SELECT
  TO authenticated
  USING (
    guild_id IN (
      SELECT gc.guild_id FROM guild_configs gc
      WHERE gc.owner_discord_id = auth.jwt() ->> 'discordId'
    )
  );

-- Service role can manage everything
CREATE POLICY "Service manages role_menus"
  ON role_menus
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service manages role_menu_options"
  ON role_menu_options
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service manages role_assignments_log"
  ON role_assignments_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ================================================================
-- HELPER FUNCTIONS
-- ================================================================

-- Get all role menus for a guild
CREATE OR REPLACE VIEW guild_role_menus_with_options AS
SELECT 
  rm.*,
  (
    SELECT json_agg(
      json_build_object(
        'id', rmo.id,
        'role_id', rmo.role_id,
        'role_name', rmo.role_name,
        'button_label', rmo.button_label,
        'button_emoji', rmo.button_emoji,
        'button_style', rmo.button_style,
        'description', rmo.description,
        'position', rmo.position,
        'total_assigns', rmo.total_assigns
      )
      ORDER BY rmo.position
    )
    FROM role_menu_options rmo
    WHERE rmo.menu_id = rm.id
  ) as options
FROM role_menus rm
WHERE rm.is_active = true
ORDER BY rm.created_at DESC;

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

SELECT 
  'Auto-roles system created successfully!' as status,
  (SELECT COUNT(*) FROM role_menus) as total_menus,
  (SELECT COUNT(*) FROM role_menu_options) as total_options;

