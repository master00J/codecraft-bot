-- Create payment_providers table for storing automated payment provider credentials
CREATE TABLE IF NOT EXISTS payment_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    auto_verification BOOLEAN DEFAULT false,
    config JSONB DEFAULT '{}'::jsonb,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE payment_providers ENABLE ROW LEVEL SECURITY;

-- Policies (admin only)
DROP POLICY IF EXISTS "Admins can manage payment providers" ON payment_providers;
DROP POLICY IF EXISTS "Admin can read payment providers" ON payment_providers;

CREATE POLICY "Admin can read payment providers" ON payment_providers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM users 
            WHERE users.discord_id = auth.jwt() ->> 'discordId' 
              AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can manage payment providers" ON payment_providers
    FOR ALL USING (
        EXISTS (
            SELECT 1 
            FROM users 
            WHERE users.discord_id = auth.jwt() ->> 'discordId' 
              AND users.is_admin = true
        )
    );

-- Seed defaults if they do not exist
INSERT INTO payment_providers (provider, display_name, config)
VALUES
    ('paypal', 'PayPal', '{}'::jsonb),
    ('stripe', 'Stripe', '{}'::jsonb),
    ('coinpayments', 'CoinPayments', '{}'::jsonb),
    ('nowpayments', 'NOWPayments', '{}'::jsonb),
    ('direct_wallet', 'Direct Crypto Wallets', '{}'::jsonb)
ON CONFLICT (provider) DO NOTHING;
