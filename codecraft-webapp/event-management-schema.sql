-- Event Management System Schema
-- Comprehensive event management with RSVP, reminders, and more

-- Main events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'general', -- 'general', 'gaming', 'community', 'meeting', 'tournament', 'custom'
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  timezone TEXT DEFAULT 'UTC',
  location TEXT, -- Discord channel, voice channel, or external location
  channel_id TEXT, -- Discord channel for event announcements
  voice_channel_id TEXT, -- Voice channel for the event
  image_url TEXT, -- Event banner/image
  color TEXT DEFAULT '#5865F2', -- Embed color
  max_participants INTEGER, -- null = unlimited
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT, -- 'daily', 'weekly', 'monthly', 'yearly', 'custom'
  recurrence_end_date TIMESTAMP WITH TIME ZONE, -- When recurring events should stop
  requires_rsvp BOOLEAN DEFAULT true,
  rsvp_deadline TIMESTAMP WITH TIME ZONE, -- When RSVP closes
  auto_remind BOOLEAN DEFAULT true,
  reminder_times INTEGER[] DEFAULT ARRAY[60, 15]::INTEGER[], -- Minutes before event (e.g., [60, 15] = 1 hour and 15 min before)
  role_mentions TEXT[], -- Roles to mention in announcements
  role_requirements TEXT[], -- Required roles to RSVP
  auto_create_voice BOOLEAN DEFAULT false, -- Auto-create voice channel for event
  auto_delete_after_end BOOLEAN DEFAULT false, -- Auto-delete event after it ends
  is_active BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT true,
  created_by TEXT NOT NULL, -- Discord user ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RSVP tracking
CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Discord user ID
  discord_tag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'going', -- 'going', 'maybe', 'not_going'
  notes TEXT, -- Optional notes from user
  rsvp_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reminded BOOLEAN DEFAULT false, -- Track if reminder was sent
  UNIQUE(event_id, user_id)
);

-- Event reminders sent tracking
CREATE TABLE IF NOT EXISTS event_reminders_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Discord user ID
  reminder_minutes INTEGER NOT NULL, -- How many minutes before event
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id, reminder_minutes)
);

-- Event notifications (announcements sent)
CREATE TABLE IF NOT EXISTS event_notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL, -- Discord message ID
  notification_type TEXT DEFAULT 'announcement', -- 'announcement', 'reminder', 'starting_soon', 'ended'
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_guild_id ON events(guild_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_is_active ON events(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_events_is_published ON events(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_events_start_time_active ON events(start_time) WHERE is_active = true AND is_published = true;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_status ON event_rsvps(status);

CREATE INDEX IF NOT EXISTS idx_event_reminders_sent_event_id ON event_reminders_sent(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_sent_user_id ON event_reminders_sent(user_id);

CREATE INDEX IF NOT EXISTS idx_event_notifications_sent_event_id ON event_notifications_sent(event_id);

-- Add comments
COMMENT ON TABLE events IS 'Main events table for event management system';
COMMENT ON COLUMN events.recurrence_pattern IS 'Pattern for recurring events: daily, weekly, monthly, yearly, or custom cron';
COMMENT ON COLUMN events.reminder_times IS 'Array of minutes before event to send reminders (e.g., [60, 15] = 1 hour and 15 min before)';
COMMENT ON COLUMN events.role_requirements IS 'Array of role IDs required to RSVP for this event';
COMMENT ON COLUMN event_rsvps.status IS 'RSVP status: going, maybe, not_going';

