-- Diagnostics for Comcraft Stats API
-- Run this in Supabase SQL Editor to check what data exists

-- 1. Check guild_configs table exists and has data
SELECT 
    COUNT(*) as total_guilds,
    COUNT(*) FILTER (WHERE is_active = true) as active_guilds,
    SUM(member_count) as total_members
FROM guild_configs;

-- 2. Show all guild data
SELECT 
    guild_id,
    guild_name,
    is_active,
    member_count,
    subscription_tier,
    created_at
FROM guild_configs
ORDER BY created_at DESC;

-- 3. Check if is_active column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'guild_configs';

-- 4. Check tickets count
SELECT COUNT(*) as total_tickets FROM tickets;

-- 5. Check user levels
SELECT COUNT(*) as total_leveling_users FROM user_levels;

