-- Add missing columns to existing orders table (safe - won't delete data!)

-- Add discord_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='discord_id') THEN
        ALTER TABLE orders ADD COLUMN discord_id TEXT;
    END IF;
END $$;

-- Add service_name if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='service_name') THEN
        ALTER TABLE orders ADD COLUMN service_name TEXT;
    END IF;
END $$;

-- Add project_name if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='project_name') THEN
        ALTER TABLE orders ADD COLUMN project_name TEXT;
    END IF;
END $$;

-- Add description if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='description') THEN
        ALTER TABLE orders ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add additional_info if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='additional_info') THEN
        ALTER TABLE orders ADD COLUMN additional_info TEXT;
    END IF;
END $$;

-- Add budget if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='budget') THEN
        ALTER TABLE orders ADD COLUMN budget TEXT;
    END IF;
END $$;

-- Add timeline if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='timeline') THEN
        ALTER TABLE orders ADD COLUMN timeline TEXT;
    END IF;
END $$;

-- Add contact_method if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='contact_method') THEN
        ALTER TABLE orders ADD COLUMN contact_method TEXT;
    END IF;
END $$;

-- Add discord_channel_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='discord_channel_id') THEN
        ALTER TABLE orders ADD COLUMN discord_channel_id TEXT;
    END IF;
END $$;

-- Add updated_at if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='updated_at') THEN
        ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Ensure completed_at exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='completed_at') THEN
        ALTER TABLE orders ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add indexes for performance (IF NOT EXISTS is built into CREATE INDEX)
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_discord_id ON orders(discord_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Show final structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'orders'
    AND table_schema = 'public'
ORDER BY 
    ordinal_position;

