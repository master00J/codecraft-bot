-- Add DeepSeek AI support and model selection
-- This migration adds support for DeepSeek provider and per-guild model selection

-- First, ensure ai_settings table exists (create if not exists)
CREATE TABLE IF NOT EXISTS ai_settings (
  guild_id TEXT PRIMARY KEY,
  allow_question_command BOOLEAN DEFAULT true,
  allow_moderation BOOLEAN DEFAULT false,
  default_provider TEXT DEFAULT 'gemini',
  chat_enabled BOOLEAN DEFAULT false,
  chat_channel_id TEXT,
  chat_reply_in_thread BOOLEAN DEFAULT true,
  memory_enabled BOOLEAN DEFAULT true,
  memory_max_entries INTEGER DEFAULT 200,
  memory_retention_days INTEGER DEFAULT 90,
  web_search_enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add allowed_channel_ids column if it doesn't exist (from previous migration)
ALTER TABLE ai_settings 
  ADD COLUMN IF NOT EXISTS allowed_channel_ids TEXT[] DEFAULT '{}';

-- Add ai_model column to ai_settings table
ALTER TABLE ai_settings 
  ADD COLUMN IF NOT EXISTS ai_model TEXT;

-- Update default_provider to support 'deepseek'
-- Note: The constraint is enforced in application code, not at database level

COMMENT ON COLUMN ai_settings.ai_model IS 'Specific AI model to use (e.g., deepseek-chat, deepseek-reasoner). If null, uses provider default.';

-- Example values for ai_model:
-- For DeepSeek: 'deepseek-chat' or 'deepseek-reasoner'
-- For Gemini: 'gemini-1.5-pro', 'gemini-1.5-flash', etc.
-- For Claude: 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', etc.

