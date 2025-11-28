-- ================================================================
-- COMCRAFT BIRTHDAY SYSTEM
-- Run this script in Supabase to add the birthday feature tables
-- and settings. Safe to run multiple times.
-- ================================================================

-- Add birthday settings columns to guild_configs
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS birthdays_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS birthday_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS birthday_role_id TEXT,
  ADD COLUMN IF NOT EXISTS birthday_message_template TEXT DEFAULT 'Happy birthday {user}! 🎂',
  ADD COLUMN IF NOT EXISTS birthday_ping_role BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS birthday_announcement_time TIME WITHOUT TIME ZONE DEFAULT '09:00:00';

-- Table to store member birthdays per guild
CREATE TABLE IF NOT EXISTS comcraft_birthdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT,
  birthday DATE NOT NULL,
  timezone TEXT,
  is_private BOOLEAN DEFAULT false,
  last_announced_year INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comcraft_birthdays_guild ON comcraft_birthdays(guild_id);
CREATE INDEX IF NOT EXISTS idx_comcraft_birthdays_month_day ON comcraft_birthdays (EXTRACT(MONTH FROM birthday), EXTRACT(DAY FROM birthday));

-- Enable RLS
ALTER TABLE comcraft_birthdays ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comcraft_birthdays'
      AND policyname = 'Users can view guild birthdays'
  ) THEN
    EXECUTE '
      CREATE POLICY "Users can view guild birthdays" ON public.comcraft_birthdays
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
      AND tablename = 'comcraft_birthdays'
      AND policyname = 'Users can manage guild birthdays'
  ) THEN
    EXECUTE '
      CREATE POLICY "Users can manage guild birthdays" ON public.comcraft_birthdays
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

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_comcraft_birthdays_updated_at
  BEFORE UPDATE ON comcraft_birthdays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Optional: ensure birthday defaults exist when a guild is created
CREATE OR REPLACE FUNCTION ensure_birthday_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.birthday_message_template IS NULL THEN
    NEW.birthday_message_template := 'Happy birthday {user}! 🎂';
  END IF;
  IF NEW.birthday_announcement_time IS NULL THEN
    NEW.birthday_announcement_time := '09:00:00';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_birthday_defaults_trigger
  BEFORE INSERT ON guild_configs
  FOR EACH ROW EXECUTE FUNCTION ensure_birthday_defaults();
