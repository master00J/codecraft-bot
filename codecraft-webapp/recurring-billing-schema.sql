-- Recurring Billing & Subscriptions System
DROP TABLE IF EXISTS subscription_invoices CASCADE;
DROP TABLE IF EXISTS subscription_payments CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer info
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  discord_id VARCHAR(255) NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  deployment_id UUID REFERENCES bot_deployments(id) ON DELETE SET NULL,
  
  -- Subscription details
  plan_name VARCHAR(100) NOT NULL,
  tier VARCHAR(50) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'suspended', 'expired')),
  
  -- Billing dates
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  next_billing_date TIMESTAMP WITH TIME ZONE NOT NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  
  -- Grace period
  grace_period_days INTEGER DEFAULT 7,
  grace_period_end TIMESTAMP WITH TIME ZONE,
  
  -- Payment info
  payment_method VARCHAR(50),
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  
  -- Metadata
  auto_renew BOOLEAN DEFAULT true,
  failed_payment_count INTEGER DEFAULT 0,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription Payments table (payment history)
CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  
  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  
  -- Period covered
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Payment method
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255),
  
  -- Error handling
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  attempted_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription Invoices table
CREATE TABLE subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  subscription_payment_id UUID REFERENCES subscription_payments(id) ON DELETE SET NULL,
  
  -- Invoice details
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  
  -- Dates
  issue_date TIMESTAMP WITH TIME ZONE NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Files
  pdf_url TEXT,
  
  -- Stripe
  stripe_invoice_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_user ON subscriptions(discord_id, status);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing_date) WHERE status = 'active';
CREATE INDEX idx_subscription_payments_subscription ON subscription_payments(subscription_id, created_at DESC);
CREATE INDEX idx_subscription_payments_status ON subscription_payments(status);
CREATE INDEX idx_invoices_subscription ON subscription_invoices(subscription_id, issue_date DESC);

-- Function to check for due renewals
CREATE OR REPLACE FUNCTION get_subscriptions_due_for_renewal()
RETURNS TABLE (
  subscription_id UUID,
  discord_id VARCHAR,
  amount DECIMAL,
  next_billing_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    subscriptions.discord_id,
    subscriptions.amount,
    subscriptions.next_billing_date
  FROM subscriptions
  WHERE status = 'active'
    AND auto_renew = true
    AND next_billing_date <= NOW() + INTERVAL '1 day'
    AND next_billing_date > NOW() - INTERVAL '1 hour' -- Don't process old ones
  ORDER BY next_billing_date ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to handle failed payments
CREATE OR REPLACE FUNCTION handle_failed_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'failed' AND OLD.status != 'failed' THEN
    -- Increment failed payment count
    UPDATE subscriptions
    SET 
      failed_payment_count = failed_payment_count + 1,
      status = CASE 
        WHEN failed_payment_count + 1 >= 3 THEN 'past_due'
        ELSE status
      END,
      grace_period_end = CASE
        WHEN failed_payment_count + 1 >= 3 AND grace_period_end IS NULL 
        THEN NOW() + (grace_period_days || ' days')::INTERVAL
        ELSE grace_period_end
      END,
      updated_at = NOW()
    WHERE id = NEW.subscription_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_failed_payment
AFTER UPDATE ON subscription_payments
FOR EACH ROW
WHEN (NEW.status != OLD.status)
EXECUTE FUNCTION handle_failed_payment();

-- Function to suspend subscriptions after grace period
CREATE OR REPLACE FUNCTION suspend_overdue_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  suspended_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE subscriptions
    SET 
      status = 'suspended',
      updated_at = NOW()
    WHERE status = 'past_due'
      AND grace_period_end IS NOT NULL
      AND grace_period_end < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO suspended_count FROM updated;
  
  -- Also suspend related deployments
  UPDATE bot_deployments
  SET 
    status = 'suspended',
    health_status = 'suspended'
  WHERE deployment_id IN (
    SELECT deployment_id 
    FROM subscriptions 
    WHERE status = 'suspended'
      AND updated_at > NOW() - INTERVAL '1 minute'
  );
  
  RETURN suspended_count;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view their subscriptions"
ON subscriptions FOR SELECT TO authenticated
USING (discord_id = (SELECT discord_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can view their payments"
ON subscription_payments FOR SELECT TO authenticated
USING (
  subscription_id IN (
    SELECT id FROM subscriptions 
    WHERE discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())
  )
);

CREATE POLICY "Users can view their invoices"
ON subscription_invoices FOR SELECT TO authenticated
USING (
  subscription_id IN (
    SELECT id FROM subscriptions 
    WHERE discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())
  )
);

-- Admins can do everything
CREATE POLICY "Admins can manage subscriptions"
ON subscriptions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));

CREATE POLICY "Admins can manage payments"
ON subscription_payments FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));

CREATE POLICY "Admins can manage invoices"
ON subscription_invoices FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));

COMMENT ON TABLE subscriptions IS 'Manages recurring billing subscriptions';
COMMENT ON TABLE subscription_payments IS 'Tracks subscription payment attempts';
COMMENT ON TABLE subscription_invoices IS 'Stores subscription invoices';

