-- ================================================================
-- TICKET CATEGORIES SCHEMA EXTENSION
-- Adds support for multiple ticket categories with custom settings
-- ================================================================

-- Create ticket_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS ticket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  category_channel_id TEXT, -- Discord category ID for this ticket type
  support_role_id TEXT, -- Role that gets notified for this category
  auto_response TEXT, -- Automatic response when ticket is created
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, name)
);

-- Add category_id to tickets table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN category_id UUID REFERENCES ticket_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_ticket_categories_guild_id ON ticket_categories(guild_id);
CREATE INDEX IF NOT EXISTS idx_ticket_categories_active ON ticket_categories(guild_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);

-- Enable RLS
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Service role has full access to ticket_categories" ON ticket_categories;

-- Create policy for service role
CREATE POLICY "Service role has full access to ticket_categories"
  ON ticket_categories FOR ALL
  USING (true)
  WITH CHECK (true);

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Ticket Categories Schema installed successfully!';
  RAISE NOTICE '📋 Table: ticket_categories';
  RAISE NOTICE '🔗 Added category_id column to tickets table';
  RAISE NOTICE '📊 Indexes created';
  RAISE NOTICE '🔐 RLS policies enabled';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next steps:';
  RAISE NOTICE '1. Create categories via dashboard or API';
  RAISE NOTICE '2. Run /ticket-setup to update panel with category buttons';
  RAISE NOTICE '3. Users can now select ticket type when creating tickets';
END $$;

