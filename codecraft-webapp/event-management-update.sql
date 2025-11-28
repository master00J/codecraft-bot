-- Add Event Management System update to updates table
-- Date: 2024-12-19

INSERT INTO updates (
  version,
  title,
  description,
  release_date,
  type,
  is_major,
  is_published,
  created_at,
  updated_at
) VALUES (
  '2.1.0',
  'Event Management System',
  'Comprehensive event management system with RSVP, reminders, and automatic notifications. Create and manage events directly from the dashboard with full customization options.',
  CURRENT_DATE,
  'feature',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Add update items
INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Event Creation & Management',
  'Create and manage events with custom titles, descriptions, dates, and locations. Support for recurring events and event types (gaming, community, meetings, tournaments).',
  'feature',
  '📅',
  0
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'RSVP System',
  'Full RSVP system with Going, Maybe, and Not Going options. Track participant counts, set maximum participants, and manage RSVP deadlines.',
  'feature',
  '✅',
  1
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Automatic Reminders',
  'Configure custom reminder times (e.g., 1 hour and 15 minutes before). Automatic notifications sent to all RSVP participants.',
  'feature',
  '🔔',
  2
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Role Mentions & Requirements',
  'Mention specific roles in event announcements. Set role requirements for RSVP participation.',
  'feature',
  '👥',
  3
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Custom Channels & Voice',
  'Select custom announcement channels and voice channels for events. Auto-create voice channels option.',
  'feature',
  '🔊',
  4
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Recurring Events',
  'Support for daily, weekly, monthly, and yearly recurring events. Set end dates for recurring patterns.',
  'feature',
  '🔁',
  5
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Interactive RSVP Buttons',
  'One-click RSVP buttons directly in Discord announcements. Real-time RSVP count updates.',
  'feature',
  '🎯',
  6
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Event Dashboard',
  'Beautiful dashboard interface for creating, editing, and managing events. View upcoming and past events with filters.',
  'feature',
  '🎨',
  7
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

INSERT INTO update_items (update_id, title, description, category, icon, order_index)
SELECT 
  u.id,
  'Starting Soon Notifications',
  'Automatic "starting soon" notifications sent 5 minutes before events begin.',
  'feature',
  '🚀',
  8
FROM updates u WHERE u.version = '2.1.0'
ON CONFLICT DO NOTHING;

