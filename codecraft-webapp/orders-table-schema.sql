-- Complete orders table schema
-- Run this if your orders table doesn't exist or needs to be updated

-- Drop existing table if needed (CAREFUL: This deletes all data!)
-- DROP TABLE IF EXISTS orders CASCADE;

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Order identification
  order_number TEXT UNIQUE NOT NULL,
  
  -- Customer references
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  discord_id TEXT, -- Discord user ID (backup if user not in users table yet)
  
  -- Service information
  service_type TEXT NOT NULL,
  service_name TEXT,
  project_name TEXT,
  description TEXT,
  additional_info TEXT,
  
  -- Pricing & Timeline
  budget TEXT, -- Customer's budget estimate
  price DECIMAL(10, 2), -- Final quoted price
  timeline TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  payment_status TEXT DEFAULT 'pending', -- pending, paid, refunded
  payment_method TEXT,
  
  -- Discord integration
  discord_channel_id TEXT, -- Channel ID for order discussion
  
  -- Contact
  contact_method TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;

-- Policies for orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE discord_id = auth.uid()::text
    ) OR
    discord_id = auth.uid()::text
  );

CREATE POLICY "Users can create own orders" ON orders
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE discord_id = auth.uid()::text
    ) OR
    discord_id = auth.uid()::text
  );

CREATE POLICY "Admins can manage all orders" ON orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_discord_id ON orders(discord_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Verify the structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'orders'
ORDER BY 
    ordinal_position;

