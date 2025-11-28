-- ================================================================
-- QUICK FIX: Add missing 'guild_icon_url' column to guild_configs
-- ================================================================

-- Voeg ontbrekende kolom toe
ALTER TABLE guild_configs 
ADD COLUMN IF NOT EXISTS guild_icon_url TEXT;

-- ================================================================
-- KLAAR! Restart ComCraft bot daarna
-- ================================================================

