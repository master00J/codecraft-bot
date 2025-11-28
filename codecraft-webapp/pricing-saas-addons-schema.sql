-- SaaS + Add-ons Pricing System
-- Implementatie van het "Antwerps no-nonsense" pricing model

-- Drop oude pricing tables eerst (safe restart)
DROP TABLE IF EXISTS pricing_addons CASCADE;
DROP TABLE IF EXISTS tier_allowed_addons CASCADE;

-- Update pricing_tiers met billing support
ALTER TABLE pricing_tiers 
  DROP COLUMN IF EXISTS billing_type,
  DROP COLUMN IF EXISTS billing_interval,
  DROP COLUMN IF EXISTS currency;

ALTER TABLE pricing_tiers
  ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'monthly', -- monthly, yearly, one_time
  ADD COLUMN IF NOT EXISTS billing_interval TEXT, -- 'month', 'year', null for one_time
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';

-- Add-ons table (max 5 clean add-ons)
CREATE TABLE pricing_addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  billing_type TEXT DEFAULT 'monthly', -- monthly, yearly, one_time
  billing_interval TEXT, -- 'month', 'year', null
  currency TEXT DEFAULT 'EUR',
  icon TEXT,
  restrictions TEXT[], -- e.g., ['requires_pro', 'requires_priority_support']
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table: which add-ons are available for which tiers
CREATE TABLE tier_allowed_addons (
  tier_id UUID REFERENCES pricing_tiers(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES pricing_addons(id) ON DELETE CASCADE,
  PRIMARY KEY (tier_id, addon_id)
);

-- RLS for new tables
ALTER TABLE pricing_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_allowed_addons ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Public can view active addons" ON pricing_addons;
DROP POLICY IF EXISTS "Admins can manage addons" ON pricing_addons;
DROP POLICY IF EXISTS "Public can view tier addons" ON tier_allowed_addons;
DROP POLICY IF EXISTS "Admins can manage tier addons" ON tier_allowed_addons;

CREATE POLICY "Public can view active addons" ON pricing_addons
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage addons" ON pricing_addons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true)
  );

CREATE POLICY "Public can view tier addons" ON tier_allowed_addons
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage tier addons" ON tier_allowed_addons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true)
  );

-- Insert default add-ons (max 5, zoals gevraagd)
INSERT INTO pricing_addons (name, description, price, billing_type, billing_interval, icon, restrictions, display_order) VALUES
  (
    'Priority Support',
    '24/7 priority support with <2h response time. Included in Business tier.',
    25,
    'monthly',
    'month',
    '⚡',
    ARRAY['not_included_in_business'],
    1
  ),
  (
    'White-label',
    'Remove CodeCraft branding, use your own logo and colors. Requires Priority Support.',
    49,
    'monthly',
    'month',
    '🎨',
    ARRAY['requires_priority_support'],
    2
  ),
  (
    'Custom Domain',
    'Use your own domain (e.g., bot.yourdomain.com)',
    5,
    'monthly',
    'month',
    '🌐',
    ARRAY[]::TEXT[],
    3
  ),
  (
    'Private Instance',
    'Dedicated bot/container, not shared. Better performance and uptime SLA.',
    99,
    'monthly',
    'month',
    '🔒',
    ARRAY['requires_pro_or_higher'],
    4
  ),
  (
    'Source Code License',
    'Full source code access with 1 year maintenance. Enterprise only. Non-transferable, no resale.',
    1500,
    'one_time',
    null,
    '💻',
    ARRAY['requires_pro_or_higher', 'requires_intake'],
    5
  )
ON CONFLICT DO NOTHING;

-- Update bestaande tiers met billing info
UPDATE pricing_tiers 
SET 
  billing_type = 'monthly',
  billing_interval = 'month',
  currency = 'EUR'
WHERE billing_type IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_addons_display_order ON pricing_addons(display_order);
CREATE INDEX IF NOT EXISTS idx_addons_active ON pricing_addons(is_active);
CREATE INDEX IF NOT EXISTS idx_tier_addons_tier ON tier_allowed_addons(tier_id);
CREATE INDEX IF NOT EXISTS idx_tier_addons_addon ON tier_allowed_addons(addon_id);

-- Verification query
SELECT 'Add-ons created:' as info, COUNT(*) as count FROM pricing_addons;
SELECT * FROM pricing_addons ORDER BY display_order;

