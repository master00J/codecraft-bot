-- CodeCraft Solutions - Supabase Database Setup
-- Run this in your Supabase SQL Editor

-- 1. Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_id TEXT UNIQUE NOT NULL,
  discord_tag TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  discord_id TEXT NOT NULL,
  discord_channel_id TEXT,
  
  -- Service details
  service_type TEXT NOT NULL,
  service_name TEXT,
  project_name TEXT,
  description TEXT,
  additional_info TEXT,
  
  -- Pricing
  budget TEXT,
  price DECIMAL(10, 2),
  timeline TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'quote_sent', 'quote_accepted', 'in_progress', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_method TEXT,
  
  -- Contact
  contact_method TEXT DEFAULT 'discord',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  discord_channel_id TEXT,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_ai BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create portfolio table
CREATE TABLE IF NOT EXISTS public.portfolio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  client TEXT,
  description TEXT,
  technologies TEXT[] DEFAULT '{}',
  features TEXT[] DEFAULT '{}',
  results TEXT,
  timeline TEXT,
  budget TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Add user_id columns if they don't exist (for existing tables)
DO $$ 
BEGIN
  -- Add user_id to orders if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'user_id') THEN
    ALTER TABLE public.orders ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  
  -- Add user_id to tickets if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'user_id') THEN
    ALTER TABLE public.tickets ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON public.users(discord_id);

-- Create user_id indexes using dynamic SQL (skip if column doesn't exist)
DO $$ 
BEGIN
  -- Try to create index for orders.user_id using dynamic SQL
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'orders' 
             AND column_name = 'user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id)';
  END IF;
  
  -- Try to create index for tickets.user_id using dynamic SQL
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'tickets' 
             AND column_name = 'user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_discord_id ON public.orders(discord_id);
CREATE INDEX IF NOT EXISTS idx_messages_ticket_id ON public.messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_messages_order_id ON public.messages(order_id);

-- 9. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS Policies

-- Users: Users can read their own data, service role can do anything
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage users" ON public.users;
CREATE POLICY "Service role can manage users" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

-- Orders: Users can view their own orders, admins can view all
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (
    discord_id = current_setting('request.jwt.claims', true)::json->>'discord_id'
    OR EXISTS (
      SELECT 1 FROM public.users 
      WHERE discord_id = current_setting('request.jwt.claims', true)::json->>'discord_id' 
      AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Service role can manage orders" ON public.orders;
CREATE POLICY "Service role can manage orders" ON public.orders
  FOR ALL USING (auth.role() = 'service_role');

-- Portfolio: Everyone can read, only service role can manage
DROP POLICY IF EXISTS "Anyone can view portfolio" ON public.portfolio;
CREATE POLICY "Anyone can view portfolio" ON public.portfolio
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage portfolio" ON public.portfolio;
CREATE POLICY "Service role can manage portfolio" ON public.portfolio
  FOR ALL USING (auth.role() = 'service_role');

-- Reviews: Everyone can read, users can create for their orders
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Anyone can view reviews" ON public.reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage reviews" ON public.reviews;
CREATE POLICY "Service role can manage reviews" ON public.reviews
  FOR ALL USING (auth.role() = 'service_role');

-- 11. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.tickets;
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13. Create combat character selections table
CREATE TABLE IF NOT EXISTS public.combat_character_selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  character_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on combat_character_selections
ALTER TABLE public.combat_character_selections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running the script)
DROP POLICY IF EXISTS "Service role can manage character selections" ON public.combat_character_selections;

-- Policy: Service role can manage all character selections
CREATE POLICY "Service role can manage character selections" ON public.combat_character_selections
  FOR ALL USING (auth.role() = 'service_role');

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_combat_character_selections_updated_at ON public.combat_character_selections;
CREATE TRIGGER update_combat_character_selections_updated_at BEFORE UPDATE ON public.combat_character_selections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_combat_character_selections_user_id ON public.combat_character_selections(user_id);

-- 14. Create TikTok monitors table
CREATE TABLE IF NOT EXISTS public.tiktok_monitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  tiktok_username TEXT NOT NULL,
  notification_message TEXT DEFAULT '{username} just posted a new TikTok!',
  ping_role_id TEXT,
  custom_bot_id TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  last_video_id TEXT,
  last_checked TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, tiktok_username)
);

-- Enable RLS on tiktok_monitors
ALTER TABLE public.tiktok_monitors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage tiktok monitors" ON public.tiktok_monitors;

-- Policy: Service role can manage all TikTok monitors
CREATE POLICY "Service role can manage tiktok monitors" ON public.tiktok_monitors
  FOR ALL USING (auth.role() = 'service_role');

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_tiktok_monitors_updated_at ON public.tiktok_monitors;
CREATE TRIGGER update_tiktok_monitors_updated_at BEFORE UPDATE ON public.tiktok_monitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tiktok_monitors_guild_id ON public.tiktok_monitors(guild_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_monitors_enabled ON public.tiktok_monitors(enabled);

-- 15. Create vouches/reputation table
CREATE TABLE IF NOT EXISTS public.vouches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, from_user_id, to_user_id)
);

-- Enable RLS on vouches
ALTER TABLE public.vouches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage vouches" ON public.vouches;

-- Policy: Service role can manage all vouches
CREATE POLICY "Service role can manage vouches" ON public.vouches
  FOR ALL USING (auth.role() = 'service_role');

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_vouches_updated_at ON public.vouches;
CREATE TRIGGER update_vouches_updated_at BEFORE UPDATE ON public.vouches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_vouches_guild_id ON public.vouches(guild_id);
CREATE INDEX IF NOT EXISTS idx_vouches_to_user_id ON public.vouches(to_user_id);
CREATE INDEX IF NOT EXISTS idx_vouches_from_user_id ON public.vouches(from_user_id);
CREATE INDEX IF NOT EXISTS idx_vouches_rating ON public.vouches(rating);

-- 16. Create sticky messages table
CREATE TABLE IF NOT EXISTS public.sticky_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_content TEXT NOT NULL,
  embed_data JSONB,
  last_message_id TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, channel_id)
);

-- Enable RLS on sticky_messages
ALTER TABLE public.sticky_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage sticky messages" ON public.sticky_messages;

-- Policy: Service role can manage all sticky messages
CREATE POLICY "Service role can manage sticky messages" ON public.sticky_messages
  FOR ALL USING (auth.role() = 'service_role');

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_sticky_messages_updated_at ON public.sticky_messages;
CREATE TRIGGER update_sticky_messages_updated_at BEFORE UPDATE ON public.sticky_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sticky_messages_guild_id ON public.sticky_messages(guild_id);
CREATE INDEX IF NOT EXISTS idx_sticky_messages_channel_id ON public.sticky_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_sticky_messages_enabled ON public.sticky_messages(enabled);

-- 17. Create staff application configuration table
CREATE TABLE IF NOT EXISTS public.application_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL UNIQUE,
  channel_id TEXT NOT NULL,
  review_channel_id TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN DEFAULT true,
  min_age INTEGER DEFAULT 0,
  cooldown_days INTEGER DEFAULT 7,
  require_account_age_days INTEGER DEFAULT 0,
  auto_thread BOOLEAN DEFAULT false,
  ping_role_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 18. Create staff applications table
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  answers JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  message_id TEXT,
  thread_id TEXT,
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  voters JSONB DEFAULT '[]'::jsonb,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.application_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage application configs" ON public.application_configs;
DROP POLICY IF EXISTS "Service role can manage applications" ON public.applications;

-- Policies
CREATE POLICY "Service role can manage application configs" ON public.application_configs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage applications" ON public.applications
  FOR ALL USING (auth.role() = 'service_role');

-- Create triggers
DROP TRIGGER IF EXISTS update_application_configs_updated_at ON public.application_configs;
CREATE TRIGGER update_application_configs_updated_at BEFORE UPDATE ON public.application_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_applications_updated_at ON public.applications;
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_application_configs_guild_id ON public.application_configs(guild_id);
CREATE INDEX IF NOT EXISTS idx_applications_guild_id ON public.applications(guild_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON public.applications(created_at);

-- Success message
-- 19. Create Twitter monitors table
CREATE TABLE IF NOT EXISTS public.twitter_monitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  twitter_username TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  include_retweets BOOLEAN DEFAULT false,
  include_replies BOOLEAN DEFAULT false,
  notification_message TEXT,
  mention_role_id TEXT,
  last_tweet_at TIMESTAMP WITH TIME ZONE,
  last_check_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, twitter_username)
);

-- Enable RLS
ALTER TABLE public.twitter_monitors ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view twitter_monitors for their guilds"
  ON public.twitter_monitors FOR SELECT
  USING (true);

CREATE POLICY "Users can insert twitter_monitors"
  ON public.twitter_monitors FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update twitter_monitors"
  ON public.twitter_monitors FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete twitter_monitors"
  ON public.twitter_monitors FOR DELETE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_twitter_monitors_updated_at
  BEFORE UPDATE ON public.twitter_monitors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_twitter_monitors_guild_id ON public.twitter_monitors(guild_id);
CREATE INDEX IF NOT EXISTS idx_twitter_monitors_enabled ON public.twitter_monitors(enabled);
CREATE INDEX IF NOT EXISTS idx_twitter_monitors_username ON public.twitter_monitors(twitter_username);

DO $$
BEGIN
  RAISE NOTICE 'Database setup completed successfully!';
  RAISE NOTICE 'Next step: Make your account admin by running the admin setup query.';
END $$;

