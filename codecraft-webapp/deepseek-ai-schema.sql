-- Add DeepSeek AI support and model selection
-- This migration adds support for DeepSeek provider and per-guild model selection

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

