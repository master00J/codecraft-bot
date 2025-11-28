-- Add add-ons support to orders table

-- Add column for selected add-ons
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS selected_addons JSONB DEFAULT '[]';

-- Comment for clarity
COMMENT ON COLUMN orders.selected_addons IS 'Array of selected add-on objects: [{id, name, price, billing_type}]';

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'selected_addons';

