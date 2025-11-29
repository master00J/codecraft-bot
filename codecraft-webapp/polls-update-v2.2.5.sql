-- Advanced Polls & Voting System Update
-- Version: 2.2.5
-- Release Date: 2025-01-XX

-- Insert the main update entry
INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('2.2.5', 'Advanced Polls & Voting System', CURRENT_DATE, 'Introducing a comprehensive polls and voting system with real-time results, anonymous voting, scheduled reminders, and automated posting. Perfect for community decisions and engagement.', 'feature', true, true, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- POLLS & VOTING SYSTEM
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Poll Creation',
  'Create polls with multiple options, custom descriptions, and flexible voting types (single or multiple choice). Support for up to 25 options per poll.',
  'feature',
  '📊',
  0
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Voting Types',
  'Choose between public and anonymous voting. Public polls show who voted for what, while anonymous polls keep votes private while still showing results.',
  'feature',
  '🎯',
  1
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Expiry & Scheduling',
  'Set custom expiry times for polls (in hours) or leave them open indefinitely. Automatically closes polls when expiry time is reached.',
  'feature',
  '⏰',
  2
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Smart Reminders',
  'Enable automatic reminders that notify users 1 hour before a poll expires. Helps increase participation and engagement.',
  'feature',
  '🔔',
  3
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Real-Time Results',
  'View live poll results with visual progress bars, vote counts, and percentages. Results update automatically as votes are cast.',
  'feature',
  '📈',
  4
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Vote Changes',
  'Allow or disallow users to change their votes after submission. Configurable per poll for maximum flexibility.',
  'feature',
  '🔄',
  5
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Role Requirements',
  'Restrict voting to specific roles. Perfect for staff-only polls or member-exclusive decisions.',
  'feature',
  '👥',
  6
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Weighted Voting',
  'Set custom vote weights for different roles. Some roles can have more influence on poll outcomes (e.g., admins count as 2 votes).',
  'feature',
  '⚖️',
  7
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Discord Integration',
  'Polls are automatically posted to Discord channels with beautiful embeds, interactive buttons, and reaction-based voting support.',
  'feature',
  '🎨',
  8
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Multiple Choice Support',
  'Create polls where users can vote for multiple options. Perfect for "select all that apply" scenarios with configurable max votes.',
  'feature',
  '💬',
  9
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Dashboard Management',
  'Full poll management interface in the dashboard. Create, edit, delete, and close polls with ease. View all polls in organized tabs (Active, Closed, All).',
  'feature',
  '📱',
  10
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Discord Commands',
  'New slash commands: /poll create, /poll vote, /poll results, /poll end, /poll info, /poll list. Full control over polls from Discord.',
  'feature',
  '🤖',
  11
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Results Visualization',
  'Beautiful result displays with progress bars, vote percentages, and clear formatting. Results can be viewed via buttons or commands.',
  'feature',
  '📊',
  12
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Auto-Posting',
  'Polls created via the dashboard are automatically posted to Discord within 30 seconds. No manual steps required!',
  'feature',
  '🔄',
  13
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Button-Based Voting',
  'Users can vote directly via interactive buttons on the poll message. No need to remember poll IDs or use commands for simple voting.',
  'feature',
  '🎯',
  14
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Poll Information',
  'Get detailed information about any poll including status, expiry time, vote counts, and direct links to the poll message.',
  'feature',
  '📋',
  15
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Poll Management',
  'Close polls early, delete polls, and view complete poll history. Full administrative control over all polls in your server.',
  'feature',
  '🗑️',
  16
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Analytics Ready',
  'Poll data is stored with timestamps, vote counts, and user information (for public polls). Ready for future analytics features.',
  'feature',
  '📈',
  17
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Premium Feature',
  'Polls & Voting is available to Premium and Enterprise tier subscribers. Part of the comprehensive engagement toolkit.',
  'feature',
  '✨',
  18
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

-- General improvements
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Performance Improvements',
  'Optimized database queries and improved caching for better performance on large servers. Faster poll loading and vote processing.',
  'improvement',
  '🚀',
  19
FROM updates u WHERE u.version = '2.2.5'
ON CONFLICT DO NOTHING;

