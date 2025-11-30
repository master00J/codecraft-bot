-- Enable roulette for all existing casino configs
-- This migration ensures roulette is enabled for all guilds that have casino enabled

-- Add roulette_enabled column if it doesn't exist
ALTER TABLE casino_configs
  ADD COLUMN IF NOT EXISTS roulette_enabled BOOLEAN DEFAULT true;

-- Update all existing casino configs to enable roulette
UPDATE casino_configs
SET roulette_enabled = true
WHERE casino_enabled = true;

