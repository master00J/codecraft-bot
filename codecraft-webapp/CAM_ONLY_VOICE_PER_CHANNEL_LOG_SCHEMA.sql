-- Add per-channel log channel mapping to cam_only_voice_config
-- This allows each voice channel to have its own log channel

ALTER TABLE cam_only_voice_config 
ADD COLUMN IF NOT EXISTS channel_log_channels JSONB DEFAULT '{}';

COMMENT ON COLUMN cam_only_voice_config.channel_log_channels IS 'JSON object mapping voice channel IDs to their log channel IDs. Format: {"voice_channel_id": "log_channel_id", ...}';

-- Example: {"123456789": "987654321", "111222333": "444555666"}
-- This means voice channel 123456789 logs to channel 987654321, and voice channel 111222333 logs to channel 444555666

