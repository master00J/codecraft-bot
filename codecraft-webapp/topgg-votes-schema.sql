-- ================================================================
-- TOP.GG VOTES TABLE
-- Stores vote records from Top.gg webhooks
-- ================================================================

-- Create topgg_votes table if it doesn't exist
CREATE TABLE IF NOT EXISTS topgg_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  is_weekend BOOLEAN DEFAULT FALSE,
  voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_topgg_votes_user_id ON topgg_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_topgg_votes_discord_user_id ON topgg_votes(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_topgg_votes_voted_at ON topgg_votes(voted_at DESC);

-- RLS Policies
ALTER TABLE topgg_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topgg_votes_service_access" ON topgg_votes;
CREATE POLICY "topgg_votes_service_access" 
  ON topgg_votes FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role') 
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '';
  RAISE NOTICE '✅ Top.gg votes table created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Table: topgg_votes';
  RAISE NOTICE '📊 Indexes: user_id, discord_user_id, voted_at';
  RAISE NOTICE '';
END $$;

