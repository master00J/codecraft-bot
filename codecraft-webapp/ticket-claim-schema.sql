-- ================================================================
-- TICKET CLAIM FEATURE
-- Adds support for support members to claim tickets
-- ================================================================

-- Add claimed_by and claimed_at columns to tickets table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'claimed_by'
  ) THEN
    ALTER TABLE tickets ADD COLUMN claimed_by TEXT; -- Discord user ID
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'claimed_at'
  ) THEN
    ALTER TABLE tickets ADD COLUMN claimed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_claimed_by ON tickets(claimed_by);

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Ticket Claim Feature installed successfully!';
  RAISE NOTICE '📋 Added claimed_by and claimed_at columns to tickets table';
  RAISE NOTICE '📊 Indexes created';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next steps:';
  RAISE NOTICE '1. Support members can now claim tickets';
  RAISE NOTICE '2. Use the Claim button in ticket channels';
  RAISE NOTICE '3. View claimed tickets in the dashboard';
END $$;

