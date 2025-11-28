-- User Statistics & Stats Cards Update
-- Version: 2.2.2
-- Release Date: 2025-11-22

-- Insert the main update entry
INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('2.2.2', 'User Statistics & Stats Cards', CURRENT_DATE, 'Comprehensive user statistics tracking system with beautiful customizable stats cards. Track messages, voice activity, and engagement metrics with detailed period breakdowns and interactive charts.', 'feature', true, true, 0)
ON CONFLICT DO NOTHING;

-- Insert update items for User Statistics & Stats Cards feature
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Advanced Statistics Tracking',
  'Automatic tracking of user messages, voice channel activity, and engagement metrics. Real-time updates with comprehensive period analysis (1d, 7d, 14d, 30d).',
  'feature',
  '📊',
  0
FROM updates u WHERE u.version = '2.2.2'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Beautiful Stats Cards',
  'Generate stunning visual stats cards with /stats command. Includes user avatar, server ranks, level & XP progress, activity breakdowns, top channels, and interactive charts. Fully customizable appearance.',
  'feature',
  '🎨',
  1
FROM updates u WHERE u.version = '2.2.2'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Period-Based Analytics',
  'View statistics across multiple time periods: daily (24h), weekly (7d), bi-weekly (14d), and monthly (30d) breakdowns. Track message counts and voice activity duration for each period.',
  'feature',
  '📈',
  2
FROM updates u WHERE u.version = '2.2.2'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Server Ranks Integration',
  'See your message rank and voice rank compared to other server members. Combined with leveling system for complete activity overview in one card.',
  'feature',
  '🏆',
  3
FROM updates u WHERE u.version = '2.2.2'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Level & XP Display',
  'Stats cards now include level and XP information with progress bars. Track your current level, XP progress to next level, and level ranking all in one place.',
  'feature',
  '⭐',
  4
FROM updates u WHERE u.version = '2.2.2'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Top Channels Tracking',
  'Discover your most active channels with top channels list showing message counts and voice time per channel. See where you spend most of your time on the server.',
  'feature',
  '🔥',
  5
FROM updates u WHERE u.version = '2.2.2'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Interactive Activity Charts',
  'Visual 14-day activity charts showing message and voice trends over time. Combined line charts with legends for easy reading and pattern identification.',
  'feature',
  '📉',
  6
FROM updates u WHERE u.version = '2.2.2'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Customizable Stats Configuration',
  'Server owners can customize stats card appearance through dashboard: themes, colors, background images, display options, time periods, and timezone settings.',
  'feature',
  '⚙️',
  7
FROM updates u WHERE u.version = '2.2.2'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Real-Time Voice Tracking',
  'Accurate voice channel activity tracking with session management. Handles disconnects, reconnects, and calculates precise duration even for sessions spanning multiple days.',
  'improvement',
  '🎙️',
  8
FROM updates u WHERE u.version = '2.2.2'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Channel-Specific Statistics',
  'Track activity per channel with separate statistics for text and voice channels. See message counts and voice time broken down by individual channels.',
  'feature',
  '💬',
  9
FROM updates u WHERE u.version = '2.2.2'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Dashboard Statistics Page',
  'New dashboard page for configuring user statistics. Enable/disable tracking, customize card appearance, manage display options, and set time periods and timezone.',
  'feature',
  '🎛️',
  10
FROM updates u WHERE u.version = '2.2.2'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Unified Stats Command',
  'Combined /stats command replaces /rank command. View all your statistics, ranks, level, XP, and activity in one comprehensive, beautifully designed card.',
  'improvement',
  '✨',
  11
FROM updates u WHERE u.version = '2.2.2'
ON CONFLICT DO NOTHING;

