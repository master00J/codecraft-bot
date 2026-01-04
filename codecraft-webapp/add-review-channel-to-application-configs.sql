-- Add review_channel_id column to application_configs table
-- This allows applications with vote buttons to be posted in a separate channel

ALTER TABLE public.application_configs 
ADD COLUMN IF NOT EXISTS review_channel_id TEXT;

COMMENT ON COLUMN public.application_configs.review_channel_id IS 'Channel ID where applications with vote buttons will be posted. If not set, applications will be posted in the application channel.';

