-- Moderation System Enhancements Update
-- Version: 3.0.0
-- Release Date: 2025-12-21

-- Insert the main update entry
INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('3.0.0', 'Moderation Workflow Overhaul', CURRENT_DATE, 'Major moderation improvements including warning decay, auto-warning support, case management, appeals workflows, and analytics dashboards.', 'feature', true, true, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- CORE MODERATION ENHANCEMENTS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT
  u.id,
  'Warning Decay (Per-Type)',
  'Manual warnings and auto-warnings now expire automatically based on configurable decay windows, keeping your warning system fair and up to date.',
  'feature',
  '⏳',
  0
FROM updates u WHERE u.version = '3.0.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT
  u.id,
  'Auto-Warn Integration',
  'Auto-moderation can now create structured warning cases that count toward auto-ban thresholds, with clear audit trails in the modlog.',
  'feature',
  '🤖',
  1
FROM updates u WHERE u.version = '3.0.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT
  u.id,
  'Auto-Ban Threshold Improvements',
  'Auto-ban now evaluates active (non-expired) warnings to prevent outdated cases from triggering punishments.',
  'improvement',
  '🚫',
  2
FROM updates u WHERE u.version = '3.0.0'
ON CONFLICT DO NOTHING;

-- ============================================
-- CASE MANAGEMENT
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT
  u.id,
  'Case Editing & Soft Deletion',
  'Moderators can edit reasons and durations or soft-delete cases directly from the dashboard without losing historical analytics.',
  'feature',
  '🗂️',
  3
FROM updates u WHERE u.version = '3.0.0'
ON CONFLICT DO NOTHING;

-- ============================================
-- APPEALS SYSTEM
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT
  u.id,
  'Appeals Workflow (Discord + Dashboard)',
  'Members can submit appeals via Discord, while staff review, approve, or deny appeals from the dashboard with decision notes.',
  'feature',
  '⚖️',
  4
FROM updates u WHERE u.version = '3.0.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT
  u.id,
  'Dedicated Appeals Channel',
  'Configure a specific channel for appeal notifications, with mod log fallback if no channel is selected.',
  'improvement',
  '📣',
  5
FROM updates u WHERE u.version = '3.0.0'
ON CONFLICT DO NOTHING;

-- ============================================
-- ANALYTICS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT
  u.id,
  'Moderation Analytics Dashboard',
  'New analytics view with totals, action breakdowns, top moderators, and daily activity trends.',
  'feature',
  '📊',
  6
FROM updates u WHERE u.version = '3.0.0'
ON CONFLICT DO NOTHING;
