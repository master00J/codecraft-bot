-- Scheduled Messages Feature Update
-- Version: 2.2.0
-- Release Date: 2025-11-21

-- Insert the main update entry
INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('2.2.0', 'Scheduled Messages Feature', '2025-11-21', 'Automate your server communications with scheduled messages. Send announcements, reminders, and updates at programmed times with full Discord embed support and timezone handling.', 'feature', true, true, 0)
ON CONFLICT DO NOTHING;

-- Insert update items for Scheduled Messages feature
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Automated Message Scheduling',
  'Create messages that are automatically sent at programmed times. Perfect for daily announcements, weekly reminders, or custom cron-based schedules.',
  'feature',
  '⏰',
  0
FROM updates u WHERE u.version = '2.2.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Rich Embed Builder',
  'Full Discord embed support with custom titles, descriptions, images, thumbnails, author info, custom fields, footers, and color customization.',
  'feature',
  '🎨',
  1
FROM updates u WHERE u.version = '2.2.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Flexible Scheduling',
  'Daily, weekly, or custom cron schedules. Set specific times (HH:MM) and days with full timezone support for accurate delivery worldwide.',
  'feature',
  '📅',
  2
FROM updates u WHERE u.version = '2.2.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Timezone Support',
  'Schedule in any timezone with automatic conversion. Messages arrive exactly when you want them, regardless of where your members are located.',
  'feature',
  '🌍',
  3
FROM updates u WHERE u.version = '2.2.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Custom Embed Fields',
  'Add unlimited custom fields with inline display options. Perfect for organizing information and displaying structured data.',
  'feature',
  '📋',
  4
FROM updates u WHERE u.version = '2.2.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Dashboard Integration',
  'Intuitive dashboard interface to create, edit, and manage scheduled messages. View next send times, message history, and statistics at a glance.',
  'feature',
  '🎛️',
  5
FROM updates u WHERE u.version = '2.2.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Active/Inactive Toggle',
  'Enable or disable messages without deleting them. Perfect for pausing during events or testing new schedules.',
  'improvement',
  '🔄',
  6
FROM updates u WHERE u.version = '2.2.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Message Statistics',
  'Track send counts, last sent timestamps, and next scheduled times. Monitor your automated communications performance.',
  'improvement',
  '📊',
  7
FROM updates u WHERE u.version = '2.2.0'
ON CONFLICT DO NOTHING;

