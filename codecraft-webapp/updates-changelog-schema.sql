-- Updates/Changelog System Schema
-- Allows admins to easily add and manage bot updates/changelog entries

CREATE TABLE IF NOT EXISTS updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL, -- e.g., "2.1.0", "v3.0"
  title TEXT NOT NULL, -- e.g., "Major Update: Welcome System Overhaul"
  release_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT, -- Main description of the update
  type TEXT NOT NULL DEFAULT 'feature', -- 'feature', 'improvement', 'bugfix', 'security', 'breaking'
  is_major BOOLEAN DEFAULT false, -- Highlight major updates
  is_published BOOLEAN DEFAULT true, -- Show/hide updates
  featured_image_url TEXT, -- Optional banner image
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT, -- Discord ID of admin who created it
  order_index INTEGER DEFAULT 0 -- For custom ordering
);

-- Update items (features/changes within an update)
CREATE TABLE IF NOT EXISTS update_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- e.g., "Welcome System Customization"
  description TEXT, -- Detailed description
  category TEXT DEFAULT 'feature', -- 'feature', 'improvement', 'bugfix', 'security', 'other'
  icon TEXT, -- Emoji or icon identifier
  order_index INTEGER DEFAULT 0, -- Order within the update
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_updates_release_date ON updates(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_updates_published ON updates(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_updates_type ON updates(type);
CREATE INDEX IF NOT EXISTS idx_update_items_update_id ON update_items(update_id);

-- Enable RLS
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE update_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for updates (public read, admin write)
CREATE POLICY "Updates are viewable by everyone" ON updates
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can manage updates" ON updates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.discord_id = auth.jwt() ->> 'discord_id'
      AND users.is_admin = true
    )
  );

-- RLS Policies for update_items (public read, admin write)
CREATE POLICY "Update items are viewable by everyone" ON update_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM updates
      WHERE updates.id = update_items.update_id
      AND updates.is_published = true
    )
  );

CREATE POLICY "Admins can manage update items" ON update_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.discord_id = auth.jwt() ->> 'discord_id'
      AND users.is_admin = true
    )
  );

-- Insert some example updates
INSERT INTO updates (version, title, release_date, description, type, is_major, order_index) VALUES
('2.1.0', 'Welcome System Overhaul', CURRENT_DATE, 'Complete redesign of the welcome system with full customization options', 'feature', true, 0),
('2.0.5', 'Game News Integration', CURRENT_DATE - INTERVAL '7 days', 'Added support for game news from multiple sources', 'feature', false, 1),
('2.0.4', 'Combat Items System', CURRENT_DATE - INTERVAL '14 days', 'New combat items and inventory management system', 'feature', false, 2),
('2.0.3', 'Auto-Reactions Feature', CURRENT_DATE - INTERVAL '21 days', 'Automatically react to messages based on keywords', 'feature', false, 3),
('2.0.2', 'Twitch Subscriber Notifications', CURRENT_DATE - INTERVAL '30 days', 'Enhanced Twitch integration with subscriber alerts', 'improvement', false, 4),
('2.0.1', 'Performance Improvements', CURRENT_DATE - INTERVAL '45 days', 'Various performance optimizations and bug fixes', 'improvement', false, 5),
('2.0.0', 'Major Platform Update', CURRENT_DATE - INTERVAL '60 days', 'Complete rewrite with new features and improved architecture', 'feature', true, 6)
ON CONFLICT DO NOTHING;

-- Insert example update items for version 2.1.0
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Fully Customizable Welcome Messages',
  'Create beautiful welcome embeds with custom fields, buttons, images, and more',
  'feature',
  '👋',
  0
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Welcome Direct Messages',
  'Send personalized welcome DMs to new members with embed support',
  'feature',
  '📨',
  1
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Enhanced Leave Messages',
  'Customize leave messages with embeds, thumbnails, and custom styling',
  'feature',
  '👋',
  2
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Action Buttons',
  'Add up to 25 action buttons to welcome messages with custom styles',
  'feature',
  '🔘',
  3
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Test Preview Functionality',
  'Test your welcome messages before they go live with the preview feature',
  'improvement',
  '👁️',
  4
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

-- Insert example items for other versions
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Fortnite News Integration',
  'Get automatic updates about Fortnite news and events',
  'feature',
  '🎮',
  0
FROM updates u WHERE u.version = '2.0.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Minecraft RSS Feeds',
  'Subscribe to Minecraft RSS feeds for automatic updates',
  'feature',
  '⛏️',
  1
FROM updates u WHERE u.version = '2.0.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Steam Game Updates',
  'Track updates for your favorite Steam games',
  'feature',
  '🎮',
  2
FROM updates u WHERE u.version = '2.0.5'
ON CONFLICT DO NOTHING;

