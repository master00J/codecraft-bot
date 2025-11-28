-- ================================================================
-- TICKET ARCHIVE & DELETE FUNCTIONALITY
-- Voegt archive en delete mogelijkheden toe aan tickets
-- ================================================================

-- Voeg archived kolom toe aan tickets tabel
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'archived') THEN
    ALTER TABLE tickets ADD COLUMN archived BOOLEAN DEFAULT FALSE;
    CREATE INDEX IF NOT EXISTS idx_tickets_archived ON tickets(archived);
  END IF;
END $$;

-- Voeg deleted_at kolom toe aan tickets tabel
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'deleted_at') THEN
    ALTER TABLE tickets ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON tickets(deleted_at);
  END IF;
END $$;

-- Voeg category_id kolom toe aan tickets tabel (als die er nog niet is)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'category_id') THEN
    ALTER TABLE tickets ADD COLUMN category_id UUID REFERENCES ticket_categories(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
  END IF;
END $$;

-- Voeg archived_by kolom toe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'archived_by') THEN
    ALTER TABLE tickets ADD COLUMN archived_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Voeg archived_at kolom toe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'archived_at') THEN
    ALTER TABLE tickets ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Voeg deleted_by kolom toe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'deleted_by') THEN
    ALTER TABLE tickets ADD COLUMN deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  
  RAISE NOTICE '✅ Ticket archive & delete columns added successfully!';
END $$;

