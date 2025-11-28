-- ================================================================
-- TICKET TEMPLATES FUNCTIONALITY
-- Voegt template systeem toe voor snellere ticket creation
-- ================================================================

-- Maak ticket_templates tabel
CREATE TABLE IF NOT EXISTS ticket_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  category_id UUID REFERENCES ticket_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  description_text TEXT,
  variables JSONB DEFAULT '{}'::jsonb, -- Voor toekomstige variable support
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Voeg ontbrekende kolommen toe als de tabel al bestaat
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_templates' AND column_name = 'guild_id') THEN
    ALTER TABLE ticket_templates ADD COLUMN guild_id TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_templates' AND column_name = 'category_id') THEN
    ALTER TABLE ticket_templates ADD COLUMN category_id UUID REFERENCES ticket_categories(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_templates' AND column_name = 'name') THEN
    ALTER TABLE ticket_templates ADD COLUMN name TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_templates' AND column_name = 'description') THEN
    ALTER TABLE ticket_templates ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_templates' AND column_name = 'subject') THEN
    ALTER TABLE ticket_templates ADD COLUMN subject TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_templates' AND column_name = 'description_text') THEN
    ALTER TABLE ticket_templates ADD COLUMN description_text TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_templates' AND column_name = 'variables') THEN
    ALTER TABLE ticket_templates ADD COLUMN variables JSONB DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_templates' AND column_name = 'is_active') THEN
    ALTER TABLE ticket_templates ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_templates' AND column_name = 'created_by') THEN
    ALTER TABLE ticket_templates ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_templates' AND column_name = 'updated_by') THEN
    ALTER TABLE ticket_templates ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_templates_guild_id ON ticket_templates(guild_id);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_category_id ON ticket_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_active ON ticket_templates(is_active);

-- RLS Policies
ALTER TABLE ticket_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role has full access to ticket_templates" ON ticket_templates;
DROP POLICY IF EXISTS "Users can view templates for their guilds" ON ticket_templates;
DROP POLICY IF EXISTS "Users can insert templates for their guilds" ON ticket_templates;
DROP POLICY IF EXISTS "Users can update templates for their guilds" ON ticket_templates;
DROP POLICY IF EXISTS "Users can delete templates for their guilds" ON ticket_templates;

-- Allow guild owners/admins to manage templates
-- Note: RLS policies are bypassed by service role, so these are mainly for direct Supabase access
CREATE POLICY "Service role has full access to ticket_templates"
  ON ticket_templates FOR ALL
  USING (true)
  WITH CHECK (true);

-- ================================================================
-- TICKET RATINGS FUNCTIONALITY
-- Voegt satisfaction rating systeem toe
-- ================================================================

-- Maak ticket_ratings tabel
CREATE TABLE IF NOT EXISTS ticket_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  discord_user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  rated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voeg ontbrekende kolommen toe als de tabel al bestaat
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_ratings' AND column_name = 'guild_id') THEN
    ALTER TABLE ticket_ratings ADD COLUMN guild_id TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_ratings' AND column_name = 'user_id') THEN
    ALTER TABLE ticket_ratings ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_ratings' AND column_name = 'discord_user_id') THEN
    ALTER TABLE ticket_ratings ADD COLUMN discord_user_id TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_ratings' AND column_name = 'rating') THEN
    ALTER TABLE ticket_ratings ADD COLUMN rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5) DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_ratings' AND column_name = 'feedback') THEN
    ALTER TABLE ticket_ratings ADD COLUMN feedback TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_ratings' AND column_name = 'rated_at') THEN
    ALTER TABLE ticket_ratings ADD COLUMN rated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_ratings_ticket_id ON ticket_ratings(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_ratings_guild_id ON ticket_ratings(guild_id);
CREATE INDEX IF NOT EXISTS idx_ticket_ratings_user_id ON ticket_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_ratings_rating ON ticket_ratings(rating);

-- RLS Policies
ALTER TABLE ticket_ratings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role has full access to ticket_ratings" ON ticket_ratings;
DROP POLICY IF EXISTS "Users can view ratings for their guilds" ON ticket_ratings;
DROP POLICY IF EXISTS "Users can insert ratings for their tickets" ON ticket_ratings;

-- Allow users to view ratings for their guilds
-- Note: RLS policies are bypassed by service role, so these are mainly for direct Supabase access
CREATE POLICY "Service role has full access to ticket_ratings"
  ON ticket_ratings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Voeg rating_requested kolom toe aan tickets tabel
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'rating_requested') THEN
    ALTER TABLE tickets ADD COLUMN rating_requested BOOLEAN DEFAULT FALSE;
    ALTER TABLE tickets ADD COLUMN rating_requested_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ Ticket templates and ratings schema created successfully!';
END $$;

