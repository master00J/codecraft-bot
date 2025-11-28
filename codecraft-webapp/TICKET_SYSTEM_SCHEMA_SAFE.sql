-- ================================================================
-- COMCRAFT TICKET SYSTEM SCHEMA - SAFE VERSION
-- Support ticket systeem voor Discord communities
-- Deze versie heeft GEEN dependencies op andere tabellen
-- ================================================================

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
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'closed', 'resolved')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
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

-- Ticket messages (voor analytics en transcripts)
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

-- Ticket ratings (feedback van users)
CREATE TABLE IF NOT EXISTS ticket_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ticket_id)
);

-- Ticket categories (voor organisatie)
CREATE TABLE IF NOT EXISTS ticket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  category_channel_id TEXT, -- Discord category ID
  support_role_id TEXT, -- Role die notificaties krijgt
  auto_response TEXT, -- Automatisch antwoord bij ticket creatie
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, name)
);

-- Ticket config per guild
CREATE TABLE IF NOT EXISTS ticket_config (
  guild_id TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT TRUE,
  support_category_id TEXT, -- Discord category voor tickets
  log_channel_id TEXT, -- Channel voor ticket logs
  transcript_channel_id TEXT, -- Channel voor transcripts
  panel_channel_id TEXT, -- Channel waar het ticket panel staat
  panel_message_id TEXT, -- Message ID van het panel
  support_role_id TEXT, -- Role voor support staff
  auto_close_hours INTEGER DEFAULT 24, -- Auto-close na X uur inactiviteit
  max_open_tickets_per_user INTEGER DEFAULT 3,
  ticket_counter INTEGER DEFAULT 0, -- Voor ticket nummering
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

-- Indexes voor betere performance
CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_discord_user_id ON tickets(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_categories_guild_id ON ticket_categories(guild_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trigger_update_tickets_updated_at ON tickets;
CREATE TRIGGER trigger_update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_tickets_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ticket_config_updated_at ON ticket_config;
CREATE TRIGGER trigger_update_ticket_config_updated_at
  BEFORE UPDATE ON ticket_config
  FOR EACH ROW
  EXECUTE FUNCTION update_tickets_updated_at();

-- Views voor analytics

-- Active tickets per guild
CREATE OR REPLACE VIEW v_active_tickets AS
SELECT 
  guild_id,
  COUNT(*) as open_tickets,
  COUNT(CASE WHEN claimed_by_discord_id IS NOT NULL THEN 1 END) as claimed_tickets,
  AVG(EXTRACT(EPOCH FROM (COALESCE(claimed_at, NOW()) - created_at))/60) as avg_response_time_minutes
FROM tickets
WHERE status IN ('open', 'claimed')
GROUP BY guild_id;

-- Ticket statistics per guild (afgelopen 30 dagen)
CREATE OR REPLACE VIEW v_ticket_stats_30d AS
SELECT 
  guild_id,
  COUNT(*) as total_tickets,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
  COUNT(CASE WHEN status IN ('open', 'claimed') THEN 1 END) as open_tickets,
  AVG(CASE 
    WHEN closed_at IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (closed_at - created_at))/3600 
    END) as avg_resolution_time_hours,
  AVG(tr.rating) as avg_rating
FROM tickets t
LEFT JOIN ticket_ratings tr ON t.id = tr.ticket_id
WHERE t.created_at > NOW() - INTERVAL '30 days'
GROUP BY guild_id;

-- Staff performance (aantal tickets afgehandeld)
CREATE OR REPLACE VIEW v_staff_performance AS
SELECT 
  claimed_by_discord_id,
  claimed_by_username,
  guild_id,
  COUNT(*) as tickets_handled,
  AVG(EXTRACT(EPOCH FROM (closed_at - claimed_at))/3600) as avg_handling_time_hours,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as tickets_closed,
  AVG(tr.rating) as avg_rating
FROM tickets t
LEFT JOIN ticket_ratings tr ON t.id = tr.ticket_id
WHERE claimed_by_discord_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY claimed_by_discord_id, claimed_by_username, guild_id;

-- Comments
COMMENT ON TABLE tickets IS 'Support tickets created by Discord users';
COMMENT ON TABLE ticket_messages IS 'Messages within tickets for transcripts and analytics';
COMMENT ON TABLE ticket_ratings IS 'User satisfaction ratings for closed tickets';
COMMENT ON TABLE ticket_categories IS 'Ticket categories for organization';
COMMENT ON TABLE ticket_config IS 'Ticket system configuration per guild';

-- RLS Policies (Row Level Security)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role has full access to tickets" ON tickets;
DROP POLICY IF EXISTS "Service role has full access to ticket_messages" ON ticket_messages;
DROP POLICY IF EXISTS "Service role has full access to ticket_ratings" ON ticket_ratings;
DROP POLICY IF EXISTS "Service role has full access to ticket_categories" ON ticket_categories;
DROP POLICY IF EXISTS "Service role has full access to ticket_config" ON ticket_config;

-- Policy: Service role can do everything (belangrijkste voor de bot)
CREATE POLICY "Service role has full access to tickets"
  ON tickets FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to ticket_messages"
  ON ticket_messages FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to ticket_ratings"
  ON ticket_ratings FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to ticket_categories"
  ON ticket_categories FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to ticket_config"
  ON ticket_config FOR ALL
  USING (true)
  WITH CHECK (true);

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Ticket System Schema successfully installed!';
  RAISE NOTICE '📋 Tables created: tickets, ticket_messages, ticket_ratings, ticket_categories, ticket_config';
  RAISE NOTICE '📊 Views created: v_active_tickets, v_ticket_stats_30d, v_staff_performance';
  RAISE NOTICE '🔐 RLS policies enabled';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next steps:';
  RAISE NOTICE '1. Run /ticket-setup in your Discord server';
  RAISE NOTICE '2. Test ticket creation via the button';
  RAISE NOTICE '3. Check /ticket-stats for analytics';
END $$;

