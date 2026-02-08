-- Reply Bot & Applications System Enhancements Update
-- Version: 2.2.9
-- Release Date: 2025-01-XX

-- Insert the main update entry
INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('2.2.9', 'Reply Bot & Applications System Enhancements', CURRENT_DATE, 'Major improvements to the reply bot system including dual pings, delete functionality, and forwarded media support. Plus enhanced application system with channel selectors, auto-post messages, and separate review channels.', 'feature', true, true, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- REPLY BOT IMPROVEMENTS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Enhanced Reply Notifications',
  'Replies now ping both the person replying AND the original poster. No more missed notifications - everyone stays in the loop when someone responds to their media posts.',
  'improvement',
  '🔔',
  0
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Delete Your Own Media Posts',
  'Users can now delete their own media posts directly from Discord. A delete button appears on all webhook messages, allowing users to remove posts they made by mistake. Only the original poster can delete their own content.',
  'feature',
  '🗑️',
  1
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Forwarded Media Support',
  'The reply bot now works with forwarded messages! When someone forwards a picture or video, the reply button appears automatically. Forwarded attachments and embeds are properly detected and reposted via webhook.',
  'feature',
  '📤',
  2
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Improved Media Detection',
  'Better detection of media content including GIFs, images, videos, and embeds. The system now properly handles all types of media attachments and ensures reply buttons appear on all relevant posts.',
  'improvement',
  '🔍',
  3
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

-- ============================================
-- APPLICATION SYSTEM ENHANCEMENTS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Discord Channel Selector',
  'No more manual channel ID entry! Select Discord channels directly from a dropdown menu in the dashboard. See all available text channels with their names for easy selection.',
  'improvement',
  '📋',
  4
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Auto-Post Application Message',
  'When you save your application configuration, a beautiful embed with an "Apply Now" button is automatically posted to your selected application channel. No need to manually create the application message anymore!',
  'feature',
  '🚀',
  5
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Separate Review Channel',
  'Keep your application channel clean! Applications with vote buttons can now be posted to a separate review channel. Configure both an application channel (for the apply button) and a review channel (for voting) independently.',
  'feature',
  '📊',
  6
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Application Message Template',
  'The auto-posted application message includes all important information: how to apply, cooldown period, number of questions, and a clear call-to-action button. Fully customizable and automatically formatted.',
  'improvement',
  '📝',
  7
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

-- ============================================
-- BUG FIXES
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Fixed Application Config Save Error',
  'Resolved duplicate key constraint error when saving application configuration. The system now properly handles updates to existing configurations without database conflicts.',
  'bugfix',
  '🐛',
  8
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Improved Error Messages',
  'All error messages in the reply bot and application system are now in English and provide clear, actionable feedback to users.',
  'improvement',
  '💬',
  9
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

-- ============================================
-- TECHNICAL IMPROVEMENTS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Better Webhook Message Tracking',
  'Improved tracking of original message authors and IDs in webhook messages. This enables proper delete functionality and ensures notifications reach the correct users.',
  'technical',
  '🔧',
  10
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Enhanced Button ID System',
  'Button custom IDs now include all necessary information (original message ID, original author ID, webhook message ID) for proper functionality across all reply bot features.',
  'technical',
  '⚙️',
  11
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

-- ============================================
-- NOTES
-- ============================================

-- This update focuses on improving user experience for both the reply bot and application systems.
-- All features are backward compatible and work seamlessly with existing configurations.
-- The review channel feature is optional - if not set, applications will be posted in the application channel as before.

