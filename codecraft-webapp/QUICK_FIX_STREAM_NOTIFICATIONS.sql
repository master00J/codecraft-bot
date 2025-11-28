-- Add missing columns to stream_notifications table
-- Run this in Supabase SQL Editor

-- Add last_notification_sent column if missing
ALTER TABLE stream_notifications 
ADD COLUMN IF NOT EXISTS last_notification_sent TIMESTAMP WITH TIME ZONE;

-- Add notification_message_id column if missing (stores Discord message ID)
ALTER TABLE stream_notifications 
ADD COLUMN IF NOT EXISTS notification_message_id TEXT;

-- Add total_notifications_sent column if missing
ALTER TABLE stream_notifications 
ADD COLUMN IF NOT EXISTS total_notifications_sent INTEGER DEFAULT 0;

-- Add current_stream_id column if missing (stores current live stream ID)
ALTER TABLE stream_notifications 
ADD COLUMN IF NOT EXISTS current_stream_id TEXT;

-- Update existing rows to have default values
UPDATE stream_notifications 
SET total_notifications_sent = 0 
WHERE total_notifications_sent IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stream_notifications_live 
ON stream_notifications(guild_id, is_live);

CREATE INDEX IF NOT EXISTS idx_stream_notifications_last_sent 
ON stream_notifications(last_notification_sent);

-- Success message
SELECT 
  'Stream notifications columns added successfully!' as status,
  COUNT(*) as total_notifications
FROM stream_notifications;

