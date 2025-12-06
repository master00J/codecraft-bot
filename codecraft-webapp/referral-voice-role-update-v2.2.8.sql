-- Referral System & Voice Chat Role Update
-- Version: 2.2.8
-- Release Date: 2025-01-XX

-- Insert the main update entry
INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('2.2.8', 'Referral System & Voice Chat Role', CURRENT_DATE, 'Introducing a comprehensive Discord referral system with customizable rewards (roles, coins, XP) and automatic invite tracking. Plus, automatic voice chat role assignment for active voice channel participants.', 'feature', true, true, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- REFERRAL SYSTEM
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Discord Referral System',
  'Track and reward users who invite new members to your server. Automatically detect which invite was used when a member joins and reward both the inviter and the new member with customizable rewards.',
  'feature',
  '🎁',
  0
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Automatic Invite Tracking',
  'The bot automatically tracks all Discord invites in your server. When a new member joins, the system detects which invite they used and attributes the referral to the correct inviter.',
  'feature',
  '🔍',
  1
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Customizable Inviter Rewards',
  'Reward users who successfully invite new members with roles, coins, and XP. Configure separate rewards for each type and set minimum invite requirements before rewards are given.',
  'feature',
  '💎',
  2
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'New Member Welcome Rewards',
  'Welcome new members with instant rewards when they join via a referral. Give them roles, coins, or XP as a welcome bonus to encourage engagement from day one.',
  'feature',
  '👋',
  3
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Referral Requirements & Cooldowns',
  'Set minimum account age requirements, minimum invite counts, and cooldown periods between rewards. Prevent abuse and ensure only legitimate referrals are rewarded.',
  'feature',
  '🛡️',
  4
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Referral Statistics Dashboard',
  'View comprehensive referral statistics including total referrals, successful referrals, top inviters, and referral trends. Track the effectiveness of your referral program.',
  'feature',
  '📊',
  5
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Real-time Invite Cache',
  'Optimized invite tracking with in-memory caching for fast lookups. Invites are automatically synced when created or deleted, ensuring accurate referral attribution.',
  'feature',
  '⚡',
  6
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

-- ============================================
-- VOICE CHAT ROLE
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Automatic Voice Chat Role',
  'Automatically assign a custom role to users when they join a voice channel and remove it when they leave. Perfect for highlighting active voice participants and creating voice-only channels.',
  'feature',
  '🎤',
  7
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Instant Role Assignment',
  'Roles are assigned immediately when users join any voice channel and removed instantly when they leave. Works seamlessly with all voice channels including stage channels.',
  'feature',
  '⚡',
  8
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Dashboard Configuration',
  'Configure the voice chat role directly from the web dashboard. Select any role from your server and enable/disable the feature with a simple toggle. Changes apply immediately.',
  'feature',
  '⚙️',
  9
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Existing Member Support',
  'The system automatically assigns the voice chat role to members already in voice channels when the feature is enabled, ensuring consistency across all active participants.',
  'feature',
  '🔄',
  10
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

-- ============================================
-- DATABASE SCHEMA CHANGES
-- ============================================

-- Note: The referral system tables (discord_referral_config, discord_referrals, discord_referral_stats)
-- are already created by discord-referral-schema.sql. This update only adds the update post entries.

-- Note: The voice_chat_role_config table is already created by voice-chat-role-schema.sql.
-- This update only adds the update post entries.

-- ============================================
-- GENERAL IMPROVEMENTS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Enhanced Dashboard Navigation',
  'Referral system is now available in the dashboard sidebar menu with full locale support. Access referral configuration from any language version of the dashboard.',
  'improvement',
  '🧭',
  11
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Improved Voice XP Tracking',
  'Fixed voice XP tracking to ensure users receive XP correctly every minute while in voice channels. Voice XP is now awarded consistently with proper timestamp tracking.',
  'improvement',
  '🔧',
  12
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Better Error Handling',
  'Improved error handling for role assignments and referral tracking. The system gracefully handles edge cases like missing roles, permission issues, and invalid invites.',
  'improvement',
  '🛡️',
  13
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Performance Optimizations',
  'Optimized invite tracking with efficient caching and database queries. Referral lookups are fast and accurate, even in large servers with many active invites.',
  'improvement',
  '🚀',
  14
FROM updates u WHERE u.version = '2.2.8'
ON CONFLICT DO NOTHING;

