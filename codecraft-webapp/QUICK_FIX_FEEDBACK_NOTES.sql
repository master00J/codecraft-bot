-- QUICK FIX: Ensure feedback submissions table has user_notes and moderator_notes columns
-- Run this in Supabase SQL editor if you migrated before the new columns were added
-- Safe to run multiple times

ALTER TABLE comcraft_feedback_submissions
  ADD COLUMN IF NOT EXISTS user_notes TEXT,
  ADD COLUMN IF NOT EXISTS moderator_notes TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;

ALTER TABLE comcraft_feedback_configs
  ADD COLUMN IF NOT EXISTS queue_embed_title TEXT DEFAULT '🎧 Sample Feedback Queue',
  ADD COLUMN IF NOT EXISTS queue_embed_description TEXT DEFAULT 'Click the button below to submit your sample for feedback.\n\n• Provide a Soundcloud, YouTube, Dropbox... link\n• Optionally add context (genre, type of feedback)\n• Moderators pick submissions in order during feedback sessions',
  ADD COLUMN IF NOT EXISTS queue_embed_color TEXT DEFAULT '#8B5CF6',
  ADD COLUMN IF NOT EXISTS queue_embed_footer TEXT DEFAULT 'ComCraft Feedback Queue',
  ADD COLUMN IF NOT EXISTS queue_embed_thumbnail TEXT,
  ADD COLUMN IF NOT EXISTS queue_embed_image TEXT,
  ADD COLUMN IF NOT EXISTS queue_button_label TEXT DEFAULT '🎵 Sample indienen',
  ADD COLUMN IF NOT EXISTS queue_button_style TEXT DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS queue_button_emoji TEXT,
  ADD COLUMN IF NOT EXISTS notification_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS notification_ping_role TEXT,
  ADD COLUMN IF NOT EXISTS notification_message TEXT DEFAULT '🔔 New submission from {{user}} waiting for feedback!';

-- Optional: migrate legacy data from old notes column
UPDATE comcraft_feedback_submissions
SET user_notes = COALESCE(user_notes, notes)
WHERE notes IS NOT NULL;
