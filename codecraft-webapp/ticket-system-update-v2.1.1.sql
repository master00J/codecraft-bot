-- Ticket System Improvements Update
-- Version: 2.1.1
-- Release Date: 2025-11-19

-- Insert the main update entry
INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('2.1.1', 'Ticket System Adjustments', '2025-11-19', 'Complete overhaul of the ticket system with powerful new features including categories, message logging, claiming system, transcripts, and enhanced dashboard management.', 'improvement', false, true, 1)
ON CONFLICT DO NOTHING;

-- Insert update items for Ticket System improvements
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Ticket Categories & Multi-Button Panels',
  'Create multiple ticket categories (Support, Bug Reports, Sales, etc.) with dedicated buttons. Each category has its own support role, auto-response, and Discord channel.',
  'feature',
  '🎯',
  0
FROM updates u WHERE u.version = '2.1.1'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Complete Message Logging',
  'All ticket messages are automatically logged to the database. View complete conversation history, search messages, and sync historical messages from Discord channels.',
  'feature',
  '📝',
  1
FROM updates u WHERE u.version = '2.1.1'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Category-Specific Support Roles',
  'Assign different support teams to different ticket types. Each category can have its own support role that gets automatically mentioned when tickets are created.',
  'feature',
  '👥',
  2
FROM updates u WHERE u.version = '2.1.1'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Ticket Claiming System',
  'Support members can claim tickets to take ownership. See who is handling each ticket and when it was claimed. Unclaim tickets to make them available for others.',
  'feature',
  '✋',
  3
FROM updates u WHERE u.version = '2.1.1'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Professional Transcripts',
  'Beautiful, formatted transcripts are automatically generated when tickets are closed. Includes complete conversation history, attachments, and embeds. Distributed to channel, owner DMs, and transcript channel.',
  'feature',
  '📄',
  4
FROM updates u WHERE u.version = '2.1.1'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Archive & Delete Functionality',
  'Archive tickets from Discord or dashboard to keep active list clean. Soft delete with tracking and audit trails. Dedicated Archived tab with bulk operations support.',
  'feature',
  '📦',
  5
FROM updates u WHERE u.version = '2.1.1'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Enhanced Dashboard',
  'New Archived tab, real-time message counts, complete conversation viewer, improved search and filtering, and visual status indicators for tickets.',
  'improvement',
  '🎨',
  6
FROM updates u WHERE u.version = '2.1.1'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Modular Architecture',
  'Improved code structure for better maintainability. Full custom bot support - all features work with both main and custom bots.',
  'improvement',
  '🔧',
  7
FROM updates u WHERE u.version = '2.1.1'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Optimized Database',
  'Proper indexing and relationships for better performance. Real-time synchronization between Discord and dashboard with comprehensive API.',
  'improvement',
  '⚡',
  8
FROM updates u WHERE u.version = '2.1.1'
ON CONFLICT DO NOTHING;

