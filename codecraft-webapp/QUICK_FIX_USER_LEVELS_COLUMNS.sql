-- Add missing columns to user_levels table
-- Run this in Supabase SQL Editor

-- Add avatar_url column if missing
ALTER TABLE user_levels 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add username column if missing
ALTER TABLE user_levels 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Add discriminator column if missing
ALTER TABLE user_levels 
ADD COLUMN IF NOT EXISTS discriminator TEXT;

-- Success message
SELECT 
  'User levels columns added successfully!' as status,
  COUNT(*) as total_users
FROM user_levels;

