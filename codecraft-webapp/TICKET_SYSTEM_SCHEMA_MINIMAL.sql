-- ================================================================
-- COMCRAFT TICKET SYSTEM - MINIMAL WORKING VERSION
-- Alleen de essentiële tabellen, geen fancy views of dependencies
-- ================================================================

-- ============================================================
-- STAP 1: TABLES
-- ============================================================

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  guild_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_username TEXT,
  discord_channel_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  claimed_by_discord_id TEXT,
  claimed_by_username TEXT,
  claimed_at TIMESTAMP WITH TIME ZONE,
  closed_by_discord_id TEXT,
  closed_by_username TEXT,
  closed_at TIMESTAMP WITH TIME ZONE,
  close_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ticket config per guild
CREATE TABLE IF NOT EXISTS ticket_config (
  guild_id TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT TRUE,
  support_category_id TEXT,
  log_channel_id TEXT,
  transcript_channel_id TEXT,
  panel_channel_id TEXT,
  panel_message_id TEXT,
  support_role_id TEXT,
  auto_close_hours INTEGER DEFAULT 24,
  max_open_tickets_per_user INTEGER DEFAULT 3,
  ticket_counter INTEGER DEFAULT 0,
  welcome_message TEXT DEFAULT 'Thanks for creating a ticket! A team member will be with you shortly.',
  panel_embed_title TEXT,
  panel_embed_description TEXT,
  panel_embed_color TEXT,
  panel_embed_footer TEXT,
  panel_embed_thumbnail_url TEXT,
  panel_embed_image_url TEXT,
  panel_button_label TEXT,
  panel_button_emoji TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ticket messages (optioneel, voor transcripts)
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  discord_message_id TEXT NOT NULL,
  author_discord_id TEXT NOT NULL,
  author_username TEXT NOT NULL,
  content TEXT,
  has_attachments BOOLEAN DEFAULT FALSE,
  has_embeds BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ticket ratings (optioneel, voor feedback)
CREATE TABLE IF NOT EXISTS ticket_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ticket_id)
);

-- ============================================================
-- STAP 2: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_discord_user_id ON tickets(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);

-- ============================================================
-- STAP 3: RLS POLICIES (Simpel: alles toegankelijk voor service role)
-- ============================================================

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_ratings ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "tickets_service_access" ON tickets;
DROP POLICY IF EXISTS "ticket_config_service_access" ON ticket_config;
DROP POLICY IF EXISTS "ticket_messages_service_access" ON ticket_messages;
DROP POLICY IF EXISTS "ticket_ratings_service_access" ON ticket_ratings;

-- Create simple policies (alle access voor service role)
CREATE POLICY "tickets_service_access" ON tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "ticket_config_service_access" ON ticket_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "ticket_messages_service_access" ON ticket_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "ticket_ratings_service_access" ON ticket_ratings FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- KLAAR!
-- ============================================================

DO $$ 
BEGIN 
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE '✅ TICKET SYSTEM INSTALLED SUCCESSFULLY!';
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Tables created:';
  RAISE NOTICE '   • tickets';
  RAISE NOTICE '   • ticket_config';
  RAISE NOTICE '   • ticket_messages';
  RAISE NOTICE '   • ticket_ratings';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 RLS policies: ENABLED';
  RAISE NOTICE '📊 Indexes: CREATED';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NEXT STEPS:';
  RAISE NOTICE '   1. Start your Discord bot';
  RAISE NOTICE '   2. Run: /ticket-setup';
  RAISE NOTICE '   3. Test: Click ticket button';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════';
END $$;

