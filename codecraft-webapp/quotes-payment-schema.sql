-- Add quotes table for sending price quotes to customers
CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  timeline TEXT,
  notes TEXT,
  payment_methods JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add payment_methods table for admin-configured payment options
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- e.g., "Bitcoin", "USDT (TRC20)", "Bank Transfer NL"
  type TEXT NOT NULL, -- crypto, bank_transfer, paypal, etc.
  address TEXT, -- wallet address or bank account number
  instructions TEXT, -- additional instructions for customers
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add payments table to track customer payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES payment_methods(id),
  amount DECIMAL(10, 2) NOT NULL,
  transaction_id TEXT, -- customer-provided transaction ID or proof
  proof_url TEXT, -- URL to payment proof screenshot/document
  status TEXT DEFAULT 'pending', -- pending, verifying, confirmed, rejected
  notes TEXT, -- customer notes or admin notes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES users(id)
);

-- Enable RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policies for quotes
CREATE POLICY "Users can view own quotes" ON quotes
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id IN (
        SELECT id FROM users WHERE discord_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "Admins can manage all quotes" ON quotes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true
    )
  );

-- Policies for payment_methods (public can view active ones)
CREATE POLICY "Public can view active payment methods" ON payment_methods
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage payment methods" ON payment_methods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true
    )
  );

-- Policies for payments
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id IN (
        SELECT id FROM users WHERE discord_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "Users can create own payments" ON payments
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT id FROM orders WHERE user_id IN (
        SELECT id FROM users WHERE discord_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "Admins can manage all payments" ON payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true
    )
  );

-- Indexes for performance
CREATE INDEX idx_quotes_order_id ON quotes(order_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payment_methods_active ON payment_methods(is_active);

