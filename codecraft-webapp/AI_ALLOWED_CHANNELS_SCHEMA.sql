-- Add allowed_channel_ids array to ai_settings table
-- This allows restricting AI Assistant to specific channels

ALTER TABLE ai_settings 
ADD COLUMN IF NOT EXISTS allowed_channel_ids TEXT[] DEFAULT '{}';

COMMENT ON COLUMN ai_settings.allowed_channel_ids IS 'Array of channel IDs where AI Assistant is allowed to respond. Empty array means all channels (if chat_enabled is true).';

-- Example: {"123456789", "987654321", "111222333"}
-- This means AI Assistant will only respond in channels 123456789, 987654321, and 111222333
-- If empty array and chat_enabled is true, AI will respond in all channels (unless chat_channel_id is set for backward compatibility)

