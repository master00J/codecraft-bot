-- Extended Quests & Missions System Update
-- Version: 2.2.4
-- Release Date: 2025-12-02

-- Insert the main update entry
INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('2.2.4', 'Extended Quests & Missions System', CURRENT_DATE, 'Massive expansion of the Quests & Missions system with milestones, timers, deadlines, difficulty levels, rarity tiers, quest chains, and 8 new quest types. Create complex quest systems with progress milestones, time limits, and sequential quest chains.', 'feature', true, true, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- QUEST MILESTONES SYSTEM
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Quest Milestones',
  'Set milestone rewards at specific progress percentages (e.g., 25%, 50%, 75%). Users receive milestone rewards as they progress through quests, keeping engagement high throughout the quest journey. Multiple milestones per quest supported.',
  'feature',
  '🎯',
  0
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Milestone Notifications',
  'Automatic DM notifications when users reach milestones. Beautiful embeds show progress percentage, milestone rewards received, and encouragement messages to keep users motivated.',
  'feature',
  '📬',
  1
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

-- ============================================
-- QUEST TIMERS & DEADLINES
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Deadline System',
  'Set absolute deadlines for quest completion. Quests automatically expire after the deadline date, creating urgency and time-sensitive challenges for your community.',
  'feature',
  '⏰',
  2
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Time Limit Quests',
  'Set time limits in hours from when a quest is started. Perfect for speed challenges and timed events. Automatically tracks elapsed time and expires quests when limit is reached.',
  'feature',
  '⏱️',
  3
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Start & End Dates',
  'Configure quest availability windows with start and end dates. Quests automatically become available and expire at specified times, perfect for seasonal events and limited-time challenges.',
  'feature',
  '📅',
  4
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Automatic Deadline Monitoring',
  'Smart deadline checker runs every 5 minutes to detect expired quests and update progress. Ensures quests expire accurately and on time without manual intervention.',
  'improvement',
  '🤖',
  5
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

-- ============================================
-- DIFFICULTY & RARITY SYSTEM
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Quest Difficulty Levels',
  'Assign difficulty levels to quests: Easy, Normal, Hard, and Expert. Visual badges help users identify quest difficulty at a glance. Perfect for creating quest tiers and progression systems.',
  'feature',
  '📊',
  6
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Rarity System',
  'Categorize quests with rarity tiers: Common, Rare, Epic, and Legendary. Color-coded badges make rare quests stand out and create excitement for special challenges.',
  'feature',
  '💎',
  7
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

-- ============================================
-- QUEST CHAINS SYSTEM
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Quest Chains',
  'Link multiple quests together in sequential chains. Users must complete quests in order to unlock the next quest in the chain. Perfect for story-driven quest lines and progressive challenges.',
  'feature',
  '🔗',
  8
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Chain Completion Rewards',
  'Set special rewards for completing entire quest chains. Chain completion rewards are given in addition to individual quest rewards, creating big payouts for dedicated players.',
  'feature',
  '🏆',
  9
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Automatic Chain Unlocking',
  'Quest chains automatically unlock the next quest when previous quests are completed. No manual intervention needed - the system handles quest prerequisites seamlessly.',
  'improvement',
  '🔓',
  10
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Chain Management Dashboard',
  'Easy-to-use dashboard interface for creating and managing quest chains. Drag-and-drop quest ordering, chain configuration, and visual quest flow editor. All chain settings in one place.',
  'feature',
  '🎛️',
  11
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Chain Completion Notifications',
  'Beautiful DM notifications when users complete entire quest chains. Celebrates achievements and clearly shows chain completion rewards received.',
  'feature',
  '🎉',
  12
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

-- ============================================
-- NEW QUEST TYPES
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  '8 New Quest Types',
  'Expanded quest type selection: Reaction Count, Invite Count, Channel Visit, Role Obtain, Stock Profit, Command Use, Giveaway Enter, and Ticket Create. Track virtually any user action as quest progress.',
  'feature',
  '✨',
  13
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Reaction Count Tracking',
  'Track when users add reactions to messages. Perfect for engagement quests and community interaction challenges. Automatic tracking with no user action required.',
  'feature',
  '👍',
  14
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Command Use Tracking',
  'Track command usage for quest progress. Can track specific commands or any command usage. Perfect for onboarding quests teaching users about bot features.',
  'feature',
  '⌨️',
  15
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Role Obtain Tracking',
  'Track when users obtain specific roles or any role. Great for progression quests and role-based challenges. Automatically detects role additions via guild member updates.',
  'feature',
  '🎭',
  16
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Giveaway Participation',
  'Track giveaway entries as quest progress. Encourage participation in server events and giveaways with quest rewards.',
  'feature',
  '🎁',
  17
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Ticket Creation Tracking',
  'Reward users for creating support tickets. Perfect for encouraging proper support channel usage and community help-seeking behavior.',
  'feature',
  '🎫',
  18
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Stock Profit Tracking',
  'Track profits made from stock market trading. Rewards successful traders and encourages economic engagement in your server.',
  'feature',
  '📈',
  19
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Custom Quest Type',
  'Manual quest completion option for admin-controlled quests. Perfect for special events, manual verification quests, or custom quest requirements.',
  'feature',
  '✋',
  20
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

-- ============================================
-- DASHBOARD IMPROVEMENTS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Enhanced Quest Dashboard',
  'Completely redesigned quest management dashboard with tabs for Active Quests, Create Quest, Quest Chains, and Analytics. Intuitive interface for managing complex quest systems.',
  'improvement',
  '🎨',
  21
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Milestone Configuration UI',
  'User-friendly interface for adding, editing, and removing quest milestones. Set progress percentages and milestone rewards with easy-to-use forms.',
  'feature',
  '⚙️',
  22
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Quest Chain Builder',
  'Visual quest chain builder with drag-and-drop quest ordering. Select quests from dropdown, reorder with arrow buttons, and configure chain settings all in one interface.',
  'feature',
  '🔧',
  23
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Timer & Deadline Configuration',
  'Easy date/time pickers for setting deadlines, time limits, and availability windows. All timer-related settings in one convenient section.',
  'improvement',
  '📅',
  24
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Difficulty & Rarity Selectors',
  'Dropdown selectors for difficulty levels and rarity tiers with visual indicators. Quick categorization of quests for better organization.',
  'improvement',
  '🎚️',
  25
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

-- ============================================
-- TECHNICAL IMPROVEMENTS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Extended Database Schema',
  'New database tables and columns for milestones, chain progress, timers, and quest metadata. Optimized indexes for fast quest lookups and progress tracking.',
  'improvement',
  '🗄️',
  26
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Smart Quest Availability Checking',
  'Intelligent quest availability system checks start dates, end dates, deadlines, and time limits before tracking progress. Prevents tracking on unavailable or expired quests.',
  'improvement',
  '🧠',
  27
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Automatic Chain Progress Tracking',
  'System automatically tracks chain progress and detects when all quests in a chain are completed. Chain completion rewards are given instantly without delay.',
  'improvement',
  '⚡',
  28
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Quest API Routes',
  'Complete REST API for quest and chain management. Create, read, update, and delete quests and chains programmatically. Full CRUD operations with proper authentication.',
  'improvement',
  '🔌',
  29
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

-- ============================================
-- INTEGRATION IMPROVEMENTS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Seamless Feature Integration',
  'New quest types automatically integrate with existing systems: reactions, commands, roles, giveaways, tickets, and stock market. No additional configuration needed.',
  'improvement',
  '🔗',
  30
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Premium Tier Feature',
  'Extended Quests & Missions system is available to Premium+ tier subscribers. Access all quest features including chains, milestones, and new quest types.',
  'improvement',
  '💎',
  31
FROM updates u WHERE u.version = '2.2.4'
ON CONFLICT DO NOTHING;

