-- Add roulette statistics columns to casino_stats table
-- This migration adds roulette-specific stats columns

ALTER TABLE casino_stats
  ADD COLUMN IF NOT EXISTS roulette_games INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS roulette_wins INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS roulette_profit BIGINT DEFAULT 0;

-- Update all existing casino_stats records to set roulette columns to default values
UPDATE casino_stats
SET 
  roulette_games = COALESCE(roulette_games, 0),
  roulette_wins = COALESCE(roulette_wins, 0),
  roulette_profit = COALESCE(roulette_profit, 0)
WHERE roulette_games IS NULL OR roulette_wins IS NULL OR roulette_profit IS NULL;

