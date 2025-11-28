-- Make your Discord account an admin
-- Replace 'YOUR_DISCORD_ID' with your actual Discord user ID

-- Method 1: If you already have a user record
UPDATE public.users 
SET is_admin = true 
WHERE discord_id = 'YOUR_DISCORD_ID';

-- Method 2: If you don't have a user record yet, create one
-- Replace the values with your actual Discord information
INSERT INTO public.users (discord_id, discord_tag, email, is_admin)
VALUES (
  'YOUR_DISCORD_ID',           -- Your Discord user ID (numbers only)
  'YourUsername#1234',          -- Your Discord tag
  'your-email@example.com',     -- Your email (optional)
  true                          -- Make admin
)
ON CONFLICT (discord_id) 
DO UPDATE SET is_admin = true;

-- Verify admin status
SELECT discord_id, discord_tag, is_admin, created_at 
FROM public.users 
WHERE is_admin = true;

