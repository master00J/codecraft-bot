-- Add bot presence/status configuration to custom_bot_tokens table
-- Run this in Supabase SQL Editor

ALTER TABLE custom_bot_tokens
ADD COLUMN IF NOT EXISTS bot_presence_type TEXT DEFAULT 'watching', -- 'playing', 'watching', 'streaming', 'listening', 'competing'
ADD COLUMN IF NOT EXISTS bot_presence_text TEXT DEFAULT 'codecraft-solutions.com | /help';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_custom_bot_tokens_presence ON custom_bot_tokens(guild_id) WHERE bot_presence_text IS NOT NULL;

