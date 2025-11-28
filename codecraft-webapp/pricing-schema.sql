-- Pricing management tables

-- Service categories (Discord Bots, Websites, E-Commerce, etc.)
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- emoji or icon name
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pricing tiers within each category
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES service_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Basic Bot", "Advanced Bot"
  price DECIMAL(10, 2) NOT NULL,
  timeline TEXT, -- e.g., "2 days", "2-3 weeks"
  features TEXT[], -- Array of feature strings
  is_popular BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pricing extras/add-ons
CREATE TABLE IF NOT EXISTS pricing_extras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_extras ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view active categories" ON service_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON service_categories;
DROP POLICY IF EXISTS "Public can view active tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Admins can manage tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Public can view active extras" ON pricing_extras;
DROP POLICY IF EXISTS "Admins can manage extras" ON pricing_extras;

-- Policies for service_categories
CREATE POLICY "Public can view active categories" ON service_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage categories" ON service_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true
    )
  );

-- Policies for pricing_tiers
CREATE POLICY "Public can view active tiers" ON pricing_tiers
  FOR SELECT USING (
    is_active = true AND
    category_id IN (SELECT id FROM service_categories WHERE is_active = true)
  );

CREATE POLICY "Admins can manage tiers" ON pricing_tiers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true
    )
  );

-- Policies for pricing_extras
CREATE POLICY "Public can view active extras" ON pricing_extras
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage extras" ON pricing_extras
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON service_categories(display_order);
CREATE INDEX IF NOT EXISTS idx_tiers_category_id ON pricing_tiers(category_id);
CREATE INDEX IF NOT EXISTS idx_tiers_display_order ON pricing_tiers(display_order);

-- Insert default data (from your current pricing)
INSERT INTO service_categories (name, description, icon, display_order, is_active) VALUES
  ('Discord Bots', 'Custom Discord bot development', '🤖', 1, true),
  ('Websites', 'Professional website development', '🌐', 2, true),
  ('E-Commerce', 'Online stores and shops', '🛒', 3, true)
ON CONFLICT DO NOTHING;

-- Get category IDs for inserting tiers
DO $$
DECLARE
  discord_bots_id UUID;
  websites_id UUID;
  ecommerce_id UUID;
BEGIN
  SELECT id INTO discord_bots_id FROM service_categories WHERE name = 'Discord Bots' LIMIT 1;
  SELECT id INTO websites_id FROM service_categories WHERE name = 'Websites' LIMIT 1;
  SELECT id INTO ecommerce_id FROM service_categories WHERE name = 'E-Commerce' LIMIT 1;

  -- Discord Bots tiers
  IF discord_bots_id IS NOT NULL THEN
    INSERT INTO pricing_tiers (category_id, name, price, timeline, features, is_popular, display_order) VALUES
      (discord_bots_id, 'Basic Bot', 25, '2 days', ARRAY['Up to 10 custom commands', 'Basic moderation', 'Role management', 'Simple database', '7 days support'], false, 1),
      (discord_bots_id, 'Advanced Bot', 50, '2-3 weeks', ARRAY['Unlimited commands', 'Advanced moderation', 'Economy system', 'Leveling system', 'Full database', '30 days support', 'Dashboard included'], true, 2),
      (discord_bots_id, 'AI-Powered Bot', 350, '2-3 weeks', ARRAY['Everything in Advanced', 'AI integration (ChatGPT/Gemini)', 'Smart responses', 'Context awareness', 'Learning capabilities', '90 days support', 'Priority updates'], false, 3)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Websites tiers
  IF websites_id IS NOT NULL THEN
    INSERT INTO pricing_tiers (category_id, name, price, timeline, features, is_popular, display_order) VALUES
      (websites_id, 'Landing Page', 150, '1-5 days', ARRAY['Single page design', 'Contact form', 'Responsive design', 'SEO basics', '1 revision round'], false, 1),
      (websites_id, 'Business Website', 300, '2-3 weeks', ARRAY['5-10 pages', 'CMS integration', 'Blog functionality', 'Advanced SEO', 'Analytics setup', '3 revision rounds', '30 days support'], true, 2),
      (websites_id, 'Web Application', 650, '4-6 weeks', ARRAY['Custom functionality', 'User authentication', 'Database integration', 'API development', 'Admin panel', 'Unlimited revisions', '90 days support'], false, 3)
    ON CONFLICT DO NOTHING;
  END IF;

  -- E-Commerce tiers
  IF ecommerce_id IS NOT NULL THEN
    INSERT INTO pricing_tiers (category_id, name, price, timeline, features, is_popular, display_order) VALUES
      (ecommerce_id, 'Starter Shop', 150, '1-2 weeks', ARRAY['Up to 100 products', 'Basic payment gateway', 'Order management', 'Customer accounts', 'Mobile responsive'], false, 1),
      (ecommerce_id, 'Professional Shop', 750, '3-5 weeks', ARRAY['Unlimited products', 'Multiple payment gateways', 'Advanced order management', 'Inventory tracking', 'Admin dashboard', 'Email automation', 'Analytics'], true, 2),
      (ecommerce_id, 'Enterprise Shop', 1500, '6-8 weeks', ARRAY['Everything in Professional', 'Multi-vendor support', 'Advanced analytics', 'Custom integrations', 'Dedicated support', 'Priority updates'], false, 3)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

