-- Add thread_id column to user_profiles_forms to store the shared thread for all profiles
ALTER TABLE user_profiles_forms 
ADD COLUMN IF NOT EXISTS thread_id TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_forms_thread ON user_profiles_forms(thread_id);

