-- Add AI image moderation toggle to moderation_configs (OpenAI Moderation API – free).
-- Run once on your Supabase project.

ALTER TABLE moderation_configs
  ADD COLUMN IF NOT EXISTS ai_image_moderation_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN moderation_configs.ai_image_moderation_enabled IS 'When true, images in messages are checked with OpenAI Moderation API (omni-moderation-latest). Flagged images cause the message to be removed. Requires OPENAI_API_KEY. Free.';
