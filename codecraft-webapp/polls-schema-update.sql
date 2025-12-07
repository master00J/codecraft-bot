-- Polls System Schema Updates
-- Add vote_weight column to poll_votes table for weighted voting support

-- Add vote_weight column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'poll_votes' 
        AND column_name = 'vote_weight'
    ) THEN
        ALTER TABLE poll_votes 
        ADD COLUMN vote_weight DECIMAL(10, 2) DEFAULT 1.0;
    END IF;
END $$;

-- Update existing votes to have weight 1.0 if NULL
UPDATE poll_votes 
SET vote_weight = 1.0 
WHERE vote_weight IS NULL;

-- Add index on vote_weight for performance
CREATE INDEX IF NOT EXISTS idx_poll_votes_weight ON poll_votes(vote_weight);

-- Update the vote count functions to support weighted voting
CREATE OR REPLACE FUNCTION update_option_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE poll_options
    SET vote_count = (
        SELECT COALESCE(SUM(vote_weight), 0)
        FROM poll_votes
        WHERE poll_id = NEW.poll_id
        AND NEW.option_ids && ARRAY[id]
    )
    WHERE poll_id = NEW.poll_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

