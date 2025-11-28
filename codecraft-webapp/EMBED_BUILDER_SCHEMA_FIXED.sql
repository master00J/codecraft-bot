/**
 * ComCraft Embed Builder Schema - FIXED
 * Visual embed creator with templates, scheduling, and image uploads
 */

-- Saved Embeds
CREATE TABLE IF NOT EXISTS saved_embeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  guild_id TEXT NOT NULL,
  created_by TEXT NOT NULL, -- Discord user ID
  
  -- Embed Details
  name TEXT NOT NULL, -- Internal name (e.g. "Server Rules")
  template_type TEXT DEFAULT 'custom', -- custom, rules, announcement, welcome, info
  
  -- Embed Content
  title TEXT,
  description TEXT,
  color TEXT DEFAULT '#5865F2',
  url TEXT, -- Title URL
  
  -- Images
  thumbnail_url TEXT, -- Small image top right
  image_url TEXT, -- Large image in embed
  footer_text TEXT,
  footer_icon_url TEXT, -- Small icon next to footer
  
  -- Author
  author_name TEXT,
  author_icon_url TEXT,
  author_url TEXT,
  
  -- Timestamp
  show_timestamp BOOLEAN DEFAULT false,
  
  -- Fields (stored as JSONB)
  fields JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"name": "Rule 1", "value": "Be respectful", "inline": false}]
  
  -- Buttons/Components (stored as JSONB)
  -- Max 5 action rows, each with max 5 buttons
  -- Example: [
  --   {
  --     "type": 1, // ActionRow
  --     "components": [
  --       {
  --         "type": 2, // Button
  --         "style": 1, // Primary, Secondary, Success, Danger, Link
  --         "label": "Click Me",
  --         "custom_id": "button_1",
  --         "emoji": "✅",
  --         "url": null, // Only for Link buttons
  --         "disabled": false
  --       }
  --     ]
  --   }
  -- ]
  components JSONB DEFAULT '[]'::jsonb,
  
  -- Usage Stats
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Tags for organization
  tags TEXT[] DEFAULT '{}',
  
  UNIQUE(guild_id, name)
);

-- Scheduled Embeds
CREATE TABLE IF NOT EXISTS scheduled_embeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  guild_id TEXT NOT NULL,
  embed_id UUID REFERENCES saved_embeds(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  
  -- Schedule Type
  schedule_type TEXT NOT NULL, -- once, daily, weekly, monthly
  
  -- Timing
  scheduled_for TIMESTAMP WITH TIME ZONE, -- For 'once' type
  time_of_day TIME, -- For recurring (e.g. 15:00)
  day_of_week INTEGER, -- For weekly (0-6, Sunday=0)
  day_of_month INTEGER, -- For monthly (1-31)
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, sent, failed, cancelled
  last_sent_at TIMESTAMP WITH TIME ZONE,
  next_send_at TIMESTAMP WITH TIME ZONE,
  
  -- Options
  mention_role_id TEXT, -- Optional @role mention
  pin_message BOOLEAN DEFAULT false,
  
  -- Metadata
  message_id TEXT, -- Discord message ID after posting
  error_message TEXT
);

-- Embed Images (for uploaded images)
CREATE TABLE IF NOT EXISTS embed_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  guild_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL, -- Discord user ID
  
  filename TEXT NOT NULL,
  url TEXT NOT NULL, -- CDN URL (Supabase Storage)
  size_bytes INTEGER,
  mime_type TEXT,
  
  -- Usage tracking
  used_in_embeds TEXT[] DEFAULT '{}', -- Array of embed IDs
  
  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Embed Templates (Presets) - FIXED: removed duplicate description
CREATE TABLE IF NOT EXISTS embed_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  name TEXT UNIQUE NOT NULL,
  template_description TEXT, -- Description of the template itself
  category TEXT, -- rules, announcement, welcome, event, etc.
  
  -- Template structure (embed content)
  embed_title TEXT,
  embed_description TEXT,
  embed_color TEXT,
  embed_fields JSONB DEFAULT '[]'::jsonb,
  embed_footer_text TEXT,
  
  -- Metadata
  is_premium BOOLEAN DEFAULT false,
  preview_image_url TEXT,
  times_used INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_embeds_guild ON saved_embeds(guild_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_embeds_guild ON scheduled_embeds(guild_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_embeds_next_send ON scheduled_embeds(next_send_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_embed_images_guild ON embed_images(guild_id);

-- RLS Policies
ALTER TABLE saved_embeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_embeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE embed_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE embed_templates ENABLE ROW LEVEL SECURITY;

-- Insert Default Templates (only if they don't exist)
INSERT INTO embed_templates (name, template_description, category, embed_title, embed_description, embed_color, embed_fields, embed_footer_text) VALUES
(
  'Server Rules',
  'Clean and professional server rules template',
  'rules',
  '📜 Server Rules',
  'Please read and follow these rules to keep our community safe and friendly!',
  '#FF6B6B',
  '[
    {"name": "1️⃣ Be Respectful", "value": "Treat everyone with respect. No harassment, hate speech, or discrimination.", "inline": false},
    {"name": "2️⃣ No Spam", "value": "Keep chat clean. No spam, excessive caps, or advertising.", "inline": false},
    {"name": "3️⃣ Safe Content", "value": "Keep all content SFW. No NSFW content anywhere.", "inline": false}
  ]'::jsonb,
  'Keep our community safe!'
),
(
  'Stream Announcement',
  'Eye-catching stream going live announcement',
  'announcement',
  '🔴 STREAM IS LIVE!',
  'Come join the stream and hang out with the community!',
  '#9146FF',
  '[
    {"name": "🎮 Playing", "value": "Game Name", "inline": true},
    {"name": "👥 Viewers", "value": "Join now!", "inline": true}
  ]'::jsonb,
  'Thanks for watching!'
),
(
  'Welcome Message',
  'Friendly welcome message for new members',
  'welcome',
  '👋 Welcome!',
  'Thanks for joining our community! We are glad to have you here.',
  '#5865F2',
  '[
    {"name": "📚 Getting Started", "value": "Check out #rules and #info to get started!", "inline": false},
    {"name": "💬 Chat", "value": "Say hi in #general!", "inline": false}
  ]'::jsonb,
  'Enjoy your stay!'
),
(
  'Event Announcement',
  'Promote upcoming events',
  'event',
  '🎉 Upcoming Event',
  'Join us for an exciting community event!',
  '#FEE75C',
  '[
    {"name": "📅 When", "value": "Date & Time", "inline": true},
    {"name": "📍 Where", "value": "Voice Channel", "inline": true},
    {"name": "🎁 Prizes", "value": "Details here", "inline": false}
  ]'::jsonb,
  'See you there!'
)
ON CONFLICT (name) DO NOTHING;

-- Function to update next_send_at for recurring schedules
CREATE OR REPLACE FUNCTION calculate_next_send_time(schedule_type TEXT, time_of_day TIME, day_of_week INTEGER, day_of_month INTEGER)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  next_time TIMESTAMP WITH TIME ZONE;
  today DATE := CURRENT_DATE;
BEGIN
  IF schedule_type = 'daily' THEN
    next_time := today + time_of_day;
    IF next_time <= NOW() THEN
      next_time := next_time + INTERVAL '1 day';
    END IF;
    
  ELSIF schedule_type = 'weekly' THEN
    -- Find next occurrence of day_of_week
    next_time := date_trunc('week', today) + (day_of_week || ' days')::INTERVAL + time_of_day;
    IF next_time <= NOW() THEN
      next_time := next_time + INTERVAL '1 week';
    END IF;
    
  ELSIF schedule_type = 'monthly' THEN
    -- Find next occurrence of day_of_month
    next_time := date_trunc('month', today) + ((day_of_month - 1) || ' days')::INTERVAL + time_of_day;
    IF next_time <= NOW() THEN
      next_time := date_trunc('month', next_time) + INTERVAL '1 month' + ((day_of_month - 1) || ' days')::INTERVAL + time_of_day;
    END IF;
  END IF;
  
  RETURN next_time;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate next_send_at
CREATE OR REPLACE FUNCTION update_next_send_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.schedule_type IN ('daily', 'weekly', 'monthly') THEN
    NEW.next_send_at := calculate_next_send_time(
      NEW.schedule_type,
      NEW.time_of_day,
      NEW.day_of_week,
      NEW.day_of_month
    );
  ELSIF NEW.schedule_type = 'once' THEN
    NEW.next_send_at := NEW.scheduled_for;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_next_send ON scheduled_embeds;
CREATE TRIGGER calculate_next_send
  BEFORE INSERT OR UPDATE ON scheduled_embeds
  FOR EACH ROW
  EXECUTE FUNCTION update_next_send_trigger();

SELECT '✅ Embed Builder schema created successfully!' as status;

