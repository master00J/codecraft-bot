-- Discount Codes & Coupons System
-- Drop existing tables if they exist
DROP TABLE IF EXISTS discount_code_usage CASCADE;
DROP TABLE IF EXISTS discount_codes CASCADE;

-- Discount Codes table
CREATE TABLE discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  
  -- Usage limits
  max_uses INTEGER, -- NULL = unlimited
  current_uses INTEGER DEFAULT 0,
  max_uses_per_user INTEGER DEFAULT 1,
  
  -- Restrictions
  min_order_value DECIMAL(10, 2),
  applicable_tiers TEXT[], -- ['starter', 'pro', 'business'] or NULL for all
  first_time_only BOOLEAN DEFAULT false,
  
  -- Validity
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discount Code Usage tracking
CREATE TABLE discount_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID REFERENCES discount_codes(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_discord_id VARCHAR(255) NOT NULL,
  
  discount_applied DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2) NOT NULL,
  final_price DECIMAL(10, 2) NOT NULL,
  
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(discount_code_id, order_id)
);

-- Indexes for performance
CREATE INDEX idx_discount_codes_code ON discount_codes(code) WHERE is_active = true;
CREATE INDEX idx_discount_codes_active ON discount_codes(is_active, valid_from, valid_until);
CREATE INDEX idx_discount_usage_user ON discount_code_usage(user_discord_id);
CREATE INDEX idx_discount_usage_code ON discount_code_usage(discount_code_id);

-- Function to update current_uses counter
CREATE OR REPLACE FUNCTION update_discount_code_uses()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE discount_codes
  SET current_uses = current_uses + 1
  WHERE id = NEW.discount_code_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update uses
CREATE TRIGGER trigger_update_discount_uses
AFTER INSERT ON discount_code_usage
FOR EACH ROW
EXECUTE FUNCTION update_discount_code_uses();

-- Row Level Security
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_code_usage ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage discount codes"
ON discount_codes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);

-- Users can view active codes (for validation)
CREATE POLICY "Users can view active discount codes"
ON discount_codes
FOR SELECT
TO authenticated
USING (is_active = true AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until >= NOW()));

-- Users can view their own usage
CREATE POLICY "Users can view their own discount usage"
ON discount_code_usage
FOR SELECT
TO authenticated
USING (
  user_discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())
);

-- Insert some example discount codes
INSERT INTO discount_codes (code, description, discount_type, discount_value, max_uses, applicable_tiers)
VALUES 
  ('WELCOME10', '10% off for new customers', 'percentage', 10, NULL, NULL),
  ('LAUNCH50', '€50 off any order', 'fixed', 50, 100, NULL),
  ('PROBUSINESS', '20% off Pro and Business tiers', 'percentage', 20, NULL, ARRAY['pro', 'business']),
  ('FIRSTORDER', '15% off first order', 'percentage', 15, NULL, NULL);

-- Update the first_time_only flag
UPDATE discount_codes SET first_time_only = true WHERE code = 'FIRSTORDER';

COMMENT ON TABLE discount_codes IS 'Stores discount codes and coupons for promotions';
COMMENT ON TABLE discount_code_usage IS 'Tracks which users used which discount codes';

