-- Fix: Add foreign key constraint between game_news_configs and game_news_sources
-- This allows Supabase to understand the relationship for JOINs

-- Add foreign key constraint
ALTER TABLE game_news_configs 
ADD CONSTRAINT fk_game_news_configs_game_id 
FOREIGN KEY (game_id) 
REFERENCES game_news_sources(game_id) 
ON DELETE RESTRICT;

-- Verify the constraint was created
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'game_news_configs' 
  AND tc.constraint_type = 'FOREIGN KEY';

