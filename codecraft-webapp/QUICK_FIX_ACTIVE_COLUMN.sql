-- ================================================================
-- QUICK FIX: Add missing 'active' column to moderation_logs
-- ================================================================
-- Run dit in Supabase SQL Editor als je de error krijgt:
-- "ERROR: 42703: column "active" does not exist"
-- ================================================================

-- Optie 1: Voeg alleen de ontbrekende kolom toe (AANBEVOLEN)
-- Dit behoudt je bestaande data
ALTER TABLE moderation_logs 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Update bestaande records
UPDATE moderation_logs 
SET active = true 
WHERE active IS NULL;

-- Optie 2: Drop en recreate de hele table (WAARSCHUWING: verliest data!)
-- Uncomment dit ALLEEN als je geen data wilt behouden:

-- DROP TABLE IF EXISTS moderation_logs CASCADE;
-- 
-- CREATE TABLE moderation_logs (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   guild_id TEXT NOT NULL,
--   case_id INTEGER NOT NULL,
--   
--   user_id TEXT NOT NULL,
--   username TEXT,
--   
--   moderator_id TEXT NOT NULL,
--   moderator_name TEXT,
--   
--   action TEXT NOT NULL,
--   reason TEXT,
--   duration INTEGER,
--   expires_at TIMESTAMP WITH TIME ZONE,
--   
--   active BOOLEAN DEFAULT true,
--   
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   
--   UNIQUE(guild_id, case_id)
-- );
-- 
-- CREATE INDEX idx_mod_logs_guild ON moderation_logs(guild_id);
-- CREATE INDEX idx_mod_logs_user ON moderation_logs(guild_id, user_id);
-- CREATE INDEX idx_mod_logs_active ON moderation_logs(guild_id, active, expires_at);

-- ================================================================
-- KLAAR! Je kunt nu het volledige schema opnieuw runnen
-- ================================================================

