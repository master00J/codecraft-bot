-- Add reply_channel_id to channel_moderation_rules
-- This allows media posts in a channel to have a reply button that routes replies to another channel

ALTER TABLE channel_moderation_rules 
ADD COLUMN IF NOT EXISTS reply_channel_id TEXT;

COMMENT ON COLUMN channel_moderation_rules.reply_channel_id IS 'Channel ID where replies to media posts in this channel should be sent. If set, a reply button will be automatically added to messages with attachments/embeds.';
