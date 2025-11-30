-- Voice Move & DeepSeek AI Integration Update
-- Version: 2.2.6
-- Release Date: 2025-01-XX

-- Insert the main update entry
INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('2.2.6', 'Voice Move & DeepSeek AI Integration', CURRENT_DATE, 'New voice channel management tools for moving multiple users simultaneously, plus DeepSeek AI provider integration with flexible model selection. Enhanced AI capabilities and better server administration.', 'feature', true, true, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- VOICE MOVE FUNCTIONALITY
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Move All Users',
  'Move all users from one voice channel to another with a single command. Perfect for organizing events, moving to different game lobbies, or managing channel migrations.',
  'feature',
  '🔀',
  0
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Move Multiple Users',
  'Select specific users to move between voice channels. Supports moving multiple users at once with detailed results showing successes and failures.',
  'feature',
  '👥',
  1
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Move by Role',
  'Move all users with a specific role who are currently in a voice channel. Great for moving entire teams, staff members, or role-based groups.',
  'feature',
  '🎭',
  2
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Permission Checks',
  'Comprehensive permission system ensures only authorized users can move members. Checks for Move Members permission, bot permissions, and role hierarchy.',
  'feature',
  '🔒',
  3
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Detailed Results',
  'Get comprehensive feedback on move operations including success count, failures, skipped users (bots, not in voice), and detailed error messages.',
  'feature',
  '📊',
  4
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Smart Source Detection',
  'If no source channel is specified, automatically uses the channel the command executor is currently in. Makes commands more intuitive and faster.',
  'feature',
  '🧠',
  5
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Rate Limiting Protection',
  'Built-in rate limiting prevents command abuse and ensures smooth operation even during high-traffic events or migrations.',
  'feature',
  '⏱️',
  6
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

-- ============================================
-- DEEPSEEK AI INTEGRATION
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'DeepSeek AI Provider',
  'New DeepSeek AI provider integrated with support for DeepSeek-V3.2 models. Choose between DeepSeek Chat and DeepSeek Reasoner models based on your needs.',
  'feature',
  '🤖',
  7
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Model Selection',
  'Select specific AI models per server or use provider defaults. Support for DeepSeek Chat (128K context, 4-8K output) and DeepSeek Reasoner (128K context, 32-64K output).',
  'feature',
  '⚙️',
  8
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'AI Model Management Command',
  'New /aimodel command allows server administrators to change AI provider and model directly from Discord. View current settings, set new models, or reset to defaults.',
  'feature',
  '💬',
  9
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Dashboard Model Selection',
  'Manage AI provider and model selection from the web dashboard. Visual dropdown menus for easy provider and model selection with real-time updates.',
  'feature',
  '📱',
  10
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Streaming Support',
  'DeepSeek provider supports real-time streaming responses, providing immediate feedback as the AI generates responses for better user experience.',
  'feature',
  '📡',
  11
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Flexible Provider System',
  'Switch between Gemini, Claude, and DeepSeek providers seamlessly. Each server can use a different provider and model combination based on their needs.',
  'feature',
  '🔄',
  12
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Cost Tracking Support',
  'DeepSeek cost tracking integrated into usage logs. Monitor AI costs per provider with configurable pricing for accurate cost management.',
  'feature',
  '💰',
  13
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'OpenAI-Compatible API',
  'DeepSeek uses OpenAI-compatible API structure, ensuring reliable integration and future compatibility with OpenAI ecosystem features.',
  'feature',
  '🔌',
  14
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Guild-Specific Model Settings',
  'Each server can configure its own AI provider and model. Settings are stored per-guild, allowing different servers to use different AI configurations.',
  'feature',
  '🏠',
  15
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Provider Fallback System',
  'Intelligent fallback system ensures AI features remain available even if one provider encounters issues. Automatically uses configured provider or falls back to available ones.',
  'feature',
  '🛡️',
  16
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

-- General improvements
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Performance Improvements',
  'Optimized AI provider loading and caching. Improved voice channel operations with better error handling and user feedback.',
  'improvement',
  '🚀',
  17
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Code Quality Enhancements',
  'Improved error handling, better logging, and enhanced code structure for both voice move operations and AI provider integrations.',
  'improvement',
  '🔧',
  18
FROM updates u WHERE u.version = '2.2.6'
ON CONFLICT DO NOTHING;

