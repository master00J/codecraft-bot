-- Add bot_webhook_url column to custom_bot_tokens table
-- This stores the webhook URL for custom bots running in Docker containers

ALTER TABLE custom_bot_tokens
ADD COLUMN IF NOT EXISTS bot_webhook_url TEXT;

-- Add comment
COMMENT ON COLUMN custom_bot_tokens.bot_webhook_url IS 'Webhook URL for custom bot container (e.g., http://IP:PORT)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_bot_tokens_webhook_url ON custom_bot_tokens(bot_webhook_url) WHERE bot_webhook_url IS NOT NULL;

