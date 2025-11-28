-- Scheduled Messages Table
-- Allows bots to send messages at programmed times (daily, weekly, custom schedules)

CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  
  -- Message content
  message_content TEXT,
  message_embed JSONB, -- Discord embed object
  
  -- Schedule configuration
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'custom')),
  schedule_time TEXT NOT NULL, -- HH:MM format (e.g., "14:30")
  schedule_days INTEGER[], -- Array of day numbers (0=Sunday, 6=Saturday) for weekly schedules
  schedule_cron TEXT, -- Cron expression for custom schedules (e.g., "0 9 * * 1" = every Monday at 9 AM)
  timezone TEXT DEFAULT 'UTC',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_by TEXT, -- Discord user ID
  last_sent_at TIMESTAMP WITH TIME ZONE,
  next_send_at TIMESTAMP WITH TIME ZONE NOT NULL,
  times_sent INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_guild_id ON public.scheduled_messages(guild_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_next_send_at ON public.scheduled_messages(next_send_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_active ON public.scheduled_messages(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view scheduled messages for their guilds" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Admins can manage scheduled messages" ON public.scheduled_messages;

-- Policy: Service role can manage all scheduled messages
-- (API routes handle user verification via session/auth)
CREATE POLICY "Service role can manage scheduled messages"
  ON public.scheduled_messages
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Allow service role to read all scheduled messages
CREATE POLICY "Service role can view scheduled messages"
  ON public.scheduled_messages
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_scheduled_messages_updated_at ON public.scheduled_messages;
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_messages_updated_at();

