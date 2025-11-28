-- ================================================================
-- TICKET SYSTEM - STAP VOOR STAP
-- Run elke sectie APART om te zien waar het fout gaat
-- ================================================================

-- ============================================================
-- STAP 1: Maak alleen de tickets tabel
-- ============================================================
-- UNCOMMENT EN RUN DIT EERST:

/*
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  guild_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_username TEXT,
  discord_channel_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

SELECT 'Stap 1 compleet: tickets tabel aangemaakt' as status;
*/

-- ============================================================
-- STAP 2: Maak ticket_config tabel
-- ============================================================
-- RUN DIT ALS STAP 1 WERKTE:

/*
CREATE TABLE ticket_config (
  guild_id TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT TRUE,
  support_category_id TEXT,
  log_channel_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

SELECT 'Stap 2 compleet: ticket_config tabel aangemaakt' as status;
*/

-- ============================================================
-- STAP 3: Maak simpele index
-- ============================================================
-- RUN DIT ALS STAP 2 WERKTE:

/*
CREATE INDEX idx_tickets_guild ON tickets(guild_id);

SELECT 'Stap 3 compleet: index aangemaakt' as status;
*/

-- ============================================================
-- STAP 4: Enable RLS
-- ============================================================
-- RUN DIT ALS STAP 3 WERKTE:

/*
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_all_access" ON tickets FOR ALL USING (true);
CREATE POLICY "config_all_access" ON ticket_config FOR ALL USING (true);

SELECT 'Stap 4 compleet: RLS policies ingesteld' as status;
*/

-- ============================================================
-- TEST QUERY
-- ============================================================
-- RUN DIT OM TE TESTEN:

/*
INSERT INTO tickets (ticket_number, guild_id, discord_user_id, discord_channel_id, subject)
VALUES ('TEST-001', '1234567890', '9876543210', '1111111111', 'Test ticket');

SELECT * FROM tickets WHERE guild_id = '1234567890';

DELETE FROM tickets WHERE ticket_number = 'TEST-001';

SELECT 'Alles werkt! 🎉' as status;
*/

