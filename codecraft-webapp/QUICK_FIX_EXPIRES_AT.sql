-- ================================================================
-- QUICK FIX: Add missing 'expires_at' column to moderation_logs
-- ================================================================
-- Run dit in Supabase SQL Editor als je de error krijgt:
-- "ERROR: 42703: column "expires_at" does not exist"
-- ================================================================

-- Voeg de ontbrekende kolom toe (behoudt bestaande data)
ALTER TABLE moderation_logs 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Verwijder oude index als die bestaat
DROP INDEX IF EXISTS idx_mod_logs_active;

-- Recreate index met de kolom
CREATE INDEX IF NOT EXISTS idx_mod_logs_active 
ON moderation_logs(guild_id, active, expires_at);

-- ================================================================
-- KLAAR! Je kunt nu het volledige comcraft-schema.sql opnieuw runnen
-- ================================================================

