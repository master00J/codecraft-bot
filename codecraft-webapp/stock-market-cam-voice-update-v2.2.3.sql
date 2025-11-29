-- Stock Market & Cam-Only Voice Channels Update
-- Version: 2.2.3
-- Release Date: 2025-11-29

-- Insert the main update entry
INSERT INTO updates (version, title, release_date, description, type, is_major, is_published, order_index) VALUES
('2.2.3', 'Stock Market & Cam-Only Voice Channels', CURRENT_DATE, 'Advanced stock market trading system with limit orders, price alerts, and market events. Plus cam-only voice channel enforcement with grace periods and smart warning system.', 'feature', true, true, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- STOCK MARKET FEATURES
-- ============================================

-- Insert update items for Stock Market feature
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Complete Stock Trading System',
  'Full-featured stock market where users can buy, sell, and trade stocks with real-time price updates. Track portfolios, profit/loss, average buy prices, and market performance.',
  'feature',
  '📈',
  0
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Limit Orders & Stop-Loss',
  'Set advanced trading orders: Limit Buy/Sell at target prices, Stop-Loss to limit losses, and Stop-Profit to lock in gains. Orders execute automatically when conditions are met.',
  'feature',
  '🎯',
  1
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Price Alerts & Notifications',
  'Create price alerts to get DM notifications when stocks reach your target prices. Set alerts for "Price Above" or "Price Below" conditions. Never miss a trading opportunity!',
  'feature',
  '🔔',
  2
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Market Events System',
  'Admins can create dynamic market events: IPOs (new stock launches), Crashes, Booms, Stock Splits, and Dividends. Events affect stock prices and create exciting market dynamics.',
  'feature',
  '📊',
  3
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Interactive Price Charts',
  'Visual price history charts showing stock performance over time. View trends, patterns, and make informed trading decisions with beautiful line graphs.',
  'feature',
  '📉',
  4
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Automatic Price Updates',
  'Stock prices automatically update every 15 minutes (configurable) with realistic volatility. Each stock has customizable volatility settings (1-100%) for different market behaviors.',
  'feature',
  '⚡',
  5
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Portfolio Management',
  'Track your complete portfolio with profit/loss calculations, average buy prices, current values, and individual stock performance. View transaction history and portfolio leaderboards.',
  'feature',
  '💼',
  6
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Dividend System',
  'Stocks can pay dividends to shareholders based on holdings. Configure dividend rates, frequency, and automatic payout system for passive income opportunities.',
  'feature',
  '💰',
  7
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Bulk Operations',
  'Import and export stocks via JSON files. Quickly set up markets with multiple stocks or backup your configuration. Perfect for server migrations and market templates.',
  'feature',
  '📦',
  8
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Market Activity Log',
  'Track all market activity including transactions, events, and price changes. Monitor market health and engagement with comprehensive activity tracking.',
  'feature',
  '📋',
  9
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  '13 New Trading Commands',
  'Complete command suite: /stocks, /stock, /stockbuy, /stocksell, /portfolio, /stockhistory, /stockleaderboard, /stockorder, /stockorders, /stockcancelorder, /stockalert, /stockalerts, /stockevents.',
  'feature',
  '⌨️',
  10
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

-- ============================================
-- CAM-ONLY VOICE CHANNELS FEATURES
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Camera Enforcement System',
  'Enforce camera requirements in specific voice channels. Perfect for cam-only streaming channels, video meetings, or content creation spaces where camera is mandatory.',
  'feature',
  '📹',
  11
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Smart Grace Period System',
  'Configurable grace period (5-60 seconds) gives users time to enable their camera before warnings. Respects dashboard configuration and prevents premature disconnections.',
  'feature',
  '⏱️',
  12
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Warning System',
  'Customizable warning system before disconnection. Set maximum warnings, warning messages, and automatic user notification. Gives users fair chance to comply.',
  'feature',
  '⚠️',
  13
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Exemptions & Permissions',
  'Add exempt roles and users who can join cam-only channels without camera. Perfect for moderators, staff, or special members who need access without restrictions.',
  'feature',
  '✅',
  14
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Automatic Disconnection',
  'Users without camera are automatically disconnected after grace period expires and warnings are exhausted. System monitors voice state changes and enforces rules consistently.',
  'feature',
  '🚫',
  15
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Activity Logging',
  'Optional log channel to track cam-only voice actions. Monitor warnings, disconnections, and system activity for transparency and moderation purposes.',
  'feature',
  '📝',
  16
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Real-Time Monitoring',
  'Continuous monitoring of voice state changes. Detects when users join, enable/disable camera, or leave channels. Handles edge cases like reconnections and channel switches.',
  'improvement',
  '👁️',
  17
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Dashboard Configuration',
  'Easy-to-use dashboard interface for configuring cam-only voice channels. Select channels, set grace periods, configure warnings, manage exemptions, and set log channels all in one place.',
  'feature',
  '🎛️',
  18
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

-- ============================================
-- GENERAL IMPROVEMENTS
-- ============================================

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Premium Tier Features',
  'Both Stock Market and Cam-Only Voice Channels are available to Premium+ tier subscribers. Configure feature access per tier in the subscription tiers admin panel.',
  'improvement',
  '💎',
  19
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Enhanced Feature Gates',
  'Improved feature permission system ensures correct tier access across all commands. Feature gates now properly check subscription tiers before allowing access to premium features.',
  'improvement',
  '🔐',
  20
FROM updates u WHERE u.version = '2.2.3'
ON CONFLICT DO NOTHING;

