-- Staff Applications & Sticky Messages Update
-- Version: 2.2.9
-- Release Date: 2025-01-XX

-- Insert the main update entry
INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('2.2.9', 'Staff Applications & Sticky Messages', CURRENT_DATE, 'Professional staff recruitment system with voting, reviews, and comprehensive application management. Plus sticky messages that automatically stay at the bottom of your channels for important announcements.', 'feature', true, true, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- STAFF APPLICATION SYSTEM
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Complete Staff Application System',
  'Accept and review staff applications directly in Discord. Configure custom questions (up to 5), set requirements, and manage the entire recruitment process from application to approval.',
  'feature',
  '📝',
  0
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Custom Application Forms',
  'Create up to 5 custom questions for your application form. Questions are presented in a Discord modal when users apply via /application apply. Answers are automatically saved and displayed to reviewers.',
  'feature',
  '📋',
  1
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Interactive Voting System',
  'Staff members can vote on applications with "Vote For" (👍) and "Vote Against" (👎) buttons. Vote counts are tracked and displayed in real-time on each application.',
  'feature',
  '🗳️',
  2
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Approve/Reject Workflow',
  'Admins can approve or reject applications with a single click. Applicants are automatically notified via DM with the decision and next steps. All reviews are logged with timestamp and reviewer.',
  'feature',
  '✅',
  3
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Application Requirements',
  'Set minimum Discord account age requirements, cooldown periods between applications (default 7 days), and control when applications are accepted. Prevent spam and ensure quality applicants.',
  'feature',
  '🛡️',
  4
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Auto-Thread Creation',
  'Automatically create discussion threads for each application. Staff members can discuss candidates privately in dedicated threads without cluttering the main channel.',
  'feature',
  '💬',
  5
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Role Ping Notifications',
  'Optionally ping a specific role when new applications are submitted. Ensure your recruitment team is always notified immediately of new candidates.',
  'feature',
  '🔔',
  6
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Comprehensive Dashboard',
  'Full-featured web dashboard for application management. View statistics, filter by status (pending/approved/rejected), search applicants, and configure all settings without leaving your browser.',
  'feature',
  '📊',
  7
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Application Statistics',
  'Real-time statistics showing total applications, pending reviews, approved, and rejected candidates. Track your recruitment pipeline at a glance.',
  'feature',
  '📈',
  8
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Question Management',
  'Add, remove, or edit application questions directly from the dashboard. Questions support both short answers and paragraph text input, with a maximum of 1000 characters per answer.',
  'feature',
  '✏️',
  9
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Application History',
  'Complete history of all applications with timestamps, voting records, reviewer information, and reasons for approval/rejection. Perfect for maintaining recruitment records.',
  'feature',
  '📜',
  10
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

-- ============================================
-- STICKY MESSAGES SYSTEM
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Sticky Messages',
  'Pin important messages at the bottom of channels that automatically repost when new messages are sent. Perfect for rules, announcements, or important information that should always be visible.',
  'feature',
  '📌',
  11
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Automatic Reposting',
  'Sticky messages automatically repost themselves when new messages are sent in the channel. The old sticky is deleted and replaced with a fresh one, keeping it always at the bottom.',
  'feature',
  '🔄',
  12
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Smart Cooldown System',
  'Built-in 3-second cooldown prevents spam and excessive API calls. Sticky messages only repost when necessary, optimizing performance while maintaining visibility.',
  'feature',
  '⏱️',
  13
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Embed Support',
  'Sticky messages support both plain text and rich Discord embeds with titles, descriptions, colors, fields, images, and thumbnails. Create professional-looking persistent messages.',
  'feature',
  '🎨',
  14
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Multiple Sticky Messages',
  'Set different sticky messages for multiple channels. Each channel can have its own unique sticky message with independent configuration.',
  'feature',
  '📑',
  15
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Enable/Disable Toggle',
  'Temporarily disable sticky messages without deleting them. Perfect for events or temporary channel purposes where you want to pause the sticky functionality.',
  'feature',
  '🎚️',
  16
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Manual Refresh Command',
  'Force refresh a sticky message on demand with /sticky refresh. Useful when you update the message content or need to ensure it''s at the bottom immediately.',
  'feature',
  '🔃',
  17
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Sticky Message List',
  'View all configured sticky messages in your server with /sticky list. Shows channel, status (active/disabled), and message preview for easy management.',
  'feature',
  '📋',
  18
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

-- ============================================
-- DISCORD COMMANDS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  '/application apply',
  'Submit a staff application through an interactive Discord modal. Users can apply directly in Discord without external forms or websites.',
  'feature',
  '💼',
  19
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  '/application setup',
  'Quick setup command for admins to configure the application system with default questions and reasonable settings. Get started in seconds.',
  'feature',
  '⚙️',
  20
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  '/application list',
  'View all applications with optional status filtering. Admins can quickly review pending, approved, or rejected applications with vote counts and dates.',
  'feature',
  '📋',
  21
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  '/sticky set',
  'Create a new sticky message for any channel. Supports plain text messages up to 2000 characters. Embed support available through configuration.',
  'feature',
  '📌',
  22
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  '/sticky remove',
  'Remove a sticky message from a channel. The current sticky message is deleted and the configuration is removed from the database.',
  'feature',
  '🗑️',
  23
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  '/sticky toggle',
  'Enable or disable a sticky message without removing it. Perfect for temporarily pausing sticky functionality during events or announcements.',
  'feature',
  '🔀',
  24
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

-- ============================================
-- DATABASE SCHEMA CHANGES
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'application_configs Table',
  'New table storing application system configuration per guild including channel ID, questions (JSONB), cooldown settings, account age requirements, and auto-thread preferences.',
  'technical',
  '🗄️',
  25
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'applications Table',
  'New table storing all submitted applications with user info, answers (JSONB), status, voting data (JSONB), review information, and message/thread IDs for Discord integration.',
  'technical',
  '🗄️',
  26
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'sticky_messages Table',
  'New table for sticky message configuration including channel ID, message content, embed data (JSONB), last message ID, and enabled status with unique constraint per channel.',
  'technical',
  '🗄️',
  27
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

-- ============================================
-- GENERAL IMPROVEMENTS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Enhanced Dashboard Navigation',
  'Applications management is now available in the dashboard sidebar with ClipboardList icon. Full locale support for /en pages and seamless integration with existing navigation.',
  'improvement',
  '🧭',
  28
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Professional DM Notifications',
  'Applicants receive beautifully formatted DM notifications when their application is reviewed. Messages include review decision, reviewer name, timestamp, and next steps.',
  'improvement',
  '💌',
  29
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Optimized Vote Tracking',
  'Vote changes are handled efficiently with toggle functionality. Users can change their vote or remove it by clicking the same button again.',
  'improvement',
  '⚡',
  30
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Row Level Security',
  'All new tables include comprehensive RLS policies ensuring secure access. Only service role can manage data, protecting sensitive application information.',
  'improvement',
  '🔒',
  31
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Activity Logging',
  'All application configuration changes and deletions are logged to activity_logs table. Track who made changes and when for audit purposes.',
  'improvement',
  '📝',
  32
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Performance Indexes',
  'Strategic database indexes on guild_id, user_id, status, channel_id, and enabled columns for lightning-fast queries even with thousands of applications.',
  'improvement',
  '🚀',
  33
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Automatic Timestamps',
  'All tables include created_at and updated_at columns with automatic triggers. Track when applications were submitted and when configurations were last modified.',
  'improvement',
  '⏰',
  34
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Graceful Error Handling',
  'Comprehensive error handling for edge cases including missing channels, deleted messages, permission issues, and database failures. Users always receive clear error messages.',
  'improvement',
  '🛡️',
  35
FROM updates u WHERE u.version = '2.2.9'
ON CONFLICT DO NOTHING;

-- ============================================
-- NOTES
-- ============================================

-- Database schema for application_configs, applications, and sticky_messages tables
-- is defined in supabase-setup.sql. This update only adds the changelog entries.

-- Staff Applications System provides a complete recruitment workflow:
-- 1. Admins configure via /application setup or web dashboard
-- 2. Users apply with /application apply (Discord modal with custom questions)
-- 3. Applications posted to designated channel with vote/review buttons
-- 4. Staff vote for/against, admins approve/reject
-- 5. Applicants notified via DM with decision
-- 6. All data tracked in database for reporting

-- Sticky Messages System keeps important messages visible:
-- 1. Admins create with /sticky set or configure via web dashboard
-- 2. Message automatically reposts when new messages are sent
-- 3. Smart cooldown prevents spam (3 seconds between reposts)
-- 4. Supports plain text and rich embeds
-- 5. Can be temporarily disabled without deletion
-- 6. Multiple channels can each have their own sticky message
