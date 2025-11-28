-- Add discord_guild_id to orders table (if not exists)

-- Check if column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'discord_guild_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN discord_guild_id TEXT;
    RAISE NOTICE 'Column discord_guild_id added to orders table';
  ELSE
    RAISE NOTICE 'Column discord_guild_id already exists';
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_orders_discord_guild ON orders(discord_guild_id);

SELECT 'discord_guild_id column added to orders table' as status;

