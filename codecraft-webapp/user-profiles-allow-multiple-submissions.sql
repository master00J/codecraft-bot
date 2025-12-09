-- Allow multiple submissions per user per form
-- Remove UNIQUE constraint to allow users to submit multiple times

-- Drop the unique constraint
ALTER TABLE user_profiles_responses 
DROP CONSTRAINT IF EXISTS user_profiles_responses_form_id_user_id_key;

-- Add an index for performance (non-unique)
CREATE INDEX IF NOT EXISTS idx_user_profiles_responses_form_user 
ON user_profiles_responses(form_id, user_id, created_at DESC);

