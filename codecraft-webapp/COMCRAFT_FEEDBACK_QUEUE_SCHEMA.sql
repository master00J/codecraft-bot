-- ================================================================
-- COMCRAFT FEEDBACK QUEUE SYSTEM
-- Run this script in Supabase to add feedback queue tables and policies.
-- Safe to run multiple times.
-- ================================================================

-- Configuration table (per guild)
CREATE TABLE IF NOT EXISTS comcraft_feedback_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  button_role_id TEXT,
  modal_title TEXT DEFAULT 'Submit your sample for feedback',
  modal_link_label TEXT DEFAULT 'Sample link',
  modal_notes_label TEXT DEFAULT 'Feedback request',
  modal_notes_required BOOLEAN DEFAULT false,
  extra_fields JSONB DEFAULT '[]'::JSONB,
  queue_embed_title TEXT DEFAULT '🎧 Sample Feedback Queue',
  queue_embed_description TEXT DEFAULT 'Click the button below to submit your sample for feedback.\n\n• Provide a Soundcloud, YouTube, Dropbox... link\n• Optionally add context (genre, type of feedback)\n• Moderators pick submissions in order during feedback sessions',
  queue_embed_color TEXT DEFAULT '#8B5CF6',
  queue_embed_footer TEXT DEFAULT 'ComCraft Feedback Queue',
  queue_embed_thumbnail TEXT,
  queue_embed_image TEXT,
  queue_button_label TEXT DEFAULT '🎵 Sample indienen',
  queue_button_style TEXT DEFAULT 'primary',
  queue_button_emoji TEXT,
  notification_channel_id TEXT,
  notification_ping_role TEXT,
  notification_message TEXT DEFAULT '🔔 New submission from {{user}} waiting for feedback!',
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_configs_guild ON comcraft_feedback_configs(guild_id);

-- Submissions table
CREATE TABLE IF NOT EXISTS comcraft_feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT,
  sample_url TEXT NOT NULL,
  user_notes TEXT,
  moderator_notes TEXT,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, skipped
  claimed_by TEXT,
  claimed_at TIMESTAMP WITH TIME ZONE,
  completed_by TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_guild ON comcraft_feedback_submissions(guild_id);
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_status ON comcraft_feedback_submissions(guild_id, status, created_at);

-- Enable RLS
ALTER TABLE comcraft_feedback_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE comcraft_feedback_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER TABLE comcraft_feedback_submissions
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;
EXCEPTION
  WHEN duplicate_column THEN
    NULL;
END;
$$;

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

-- Policies for configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comcraft_feedback_configs'
      AND policyname = 'Users can manage feedback configs'
  ) THEN
    EXECUTE '
      CREATE POLICY "Users can manage feedback configs" ON public.comcraft_feedback_configs
        FOR ALL USING (
          guild_id IN (
            SELECT guild_id FROM public.guild_configs
            WHERE owner_discord_id = current_setting(''app.user_discord_id'', true)
          )
        );
    ';
  END IF;
END;
$$;

-- Policies for submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comcraft_feedback_submissions'
      AND policyname = 'Users can view feedback submissions'
  ) THEN
    EXECUTE '
      CREATE POLICY "Users can view feedback submissions" ON public.comcraft_feedback_submissions
        FOR SELECT USING (
          guild_id IN (
            SELECT guild_id FROM public.guild_configs
            WHERE owner_discord_id = current_setting(''app.user_discord_id'', true)
          )
        );
    ';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comcraft_feedback_submissions'
      AND policyname = 'Users can manage feedback submissions'
  ) THEN
    EXECUTE '
      CREATE POLICY "Users can manage feedback submissions" ON public.comcraft_feedback_submissions
        FOR ALL USING (
          guild_id IN (
            SELECT guild_id FROM public.guild_configs
            WHERE owner_discord_id = current_setting(''app.user_discord_id'', true)
          )
        );
    ';
  END IF;
END;
$$;

-- Update trigger
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_feedback_configs_updated_at ON comcraft_feedback_configs;
CREATE TRIGGER update_feedback_configs_updated_at
  BEFORE UPDATE ON comcraft_feedback_configs
  FOR EACH ROW EXECUTE FUNCTION update_feedback_updated_at();
