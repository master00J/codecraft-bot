-- Stock Market System Schema
-- Advanced economy feature for ComCraft Discord Bot
-- Run this in Supabase SQL Editor

-- ================================================================
-- STOCK MARKET SYSTEM
-- ================================================================

-- Stocks/Companies table (managed by admins)
CREATE TABLE IF NOT EXISTS stock_market_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  
  -- Stock info
  symbol TEXT NOT NULL, -- e.g., "COMCRAFT", "GAMING", "DISCORD"
  name TEXT NOT NULL, -- Full company name
  description TEXT,
  emoji TEXT, -- Display emoji for the stock
  
  -- Pricing
  base_price DECIMAL(15,2) NOT NULL DEFAULT 100.00, -- Starting price
  current_price DECIMAL(15,2) NOT NULL DEFAULT 100.00, -- Current market price
  min_price DECIMAL(15,2) DEFAULT 1.00, -- Floor price (can't go below)
  max_price DECIMAL(15,2) DEFAULT 100000.00, -- Ceiling price
  
  -- Market mechanics
  volatility DECIMAL(5,2) DEFAULT 5.00, -- Price volatility % (1-100)
  total_shares BIGINT DEFAULT 1000000, -- Total shares available
  available_shares BIGINT DEFAULT 1000000, -- Shares available for purchase
  
  -- Dividends
  dividend_rate DECIMAL(5,2) DEFAULT 0.00, -- Annual dividend % (0-100)
  last_dividend_date TIMESTAMP WITH TIME ZONE,
  dividend_frequency TEXT DEFAULT 'monthly', -- monthly, quarterly, yearly
  
  -- Status
  status TEXT DEFAULT 'active', -- active, suspended, delisted
  ipo_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Price history tracking (for charts)
  price_history JSONB DEFAULT '[]', -- Array of {price, timestamp} objects
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_stock_market_stocks_guild ON stock_market_stocks(guild_id);
CREATE INDEX IF NOT EXISTS idx_stock_market_stocks_status ON stock_market_stocks(guild_id, status);

-- User stock portfolio (holdings)
CREATE TABLE IF NOT EXISTS stock_market_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  stock_id UUID NOT NULL REFERENCES stock_market_stocks(id) ON DELETE CASCADE,
  
  -- Holdings
  shares_owned BIGINT NOT NULL DEFAULT 0,
  average_buy_price DECIMAL(15,2) NOT NULL, -- Average price paid per share
  
  -- Statistics
  total_invested DECIMAL(15,2) DEFAULT 0, -- Total money invested in this stock
  total_profit_loss DECIMAL(15,2) DEFAULT 0, -- Total profit/loss
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id, stock_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_market_portfolio_user ON stock_market_portfolio(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_stock_market_portfolio_stock ON stock_market_portfolio(stock_id);

-- Stock transactions log
CREATE TABLE IF NOT EXISTS stock_market_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  stock_id UUID NOT NULL REFERENCES stock_market_stocks(id) ON DELETE CASCADE,
  
  -- Transaction details
  transaction_type TEXT NOT NULL, -- 'buy', 'sell'
  shares BIGINT NOT NULL,
  price_per_share DECIMAL(15,2) NOT NULL,
  total_cost DECIMAL(15,2) NOT NULL, -- shares * price_per_share
  
  -- Profit/loss (for sell transactions)
  profit_loss DECIMAL(15,2) DEFAULT 0,
  profit_loss_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Fees (optional)
  transaction_fee DECIMAL(15,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_market_transactions_user ON stock_market_transactions(guild_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_market_transactions_stock ON stock_market_transactions(stock_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_market_transactions_type ON stock_market_transactions(guild_id, transaction_type);

-- Market orders (limit orders, stop-loss, etc.)
CREATE TABLE IF NOT EXISTS stock_market_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  stock_id UUID NOT NULL REFERENCES stock_market_stocks(id) ON DELETE CASCADE,
  
  -- Order details
  order_type TEXT NOT NULL, -- 'limit_buy', 'limit_sell', 'stop_loss', 'stop_profit'
  shares BIGINT NOT NULL,
  target_price DECIMAL(15,2) NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, executed, cancelled, expired
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_stock_market_orders_pending ON stock_market_orders(guild_id, status, order_type);
CREATE INDEX IF NOT EXISTS idx_stock_market_orders_user ON stock_market_orders(guild_id, user_id);

-- Market events (IPO, splits, crashes, booms)
CREATE TABLE IF NOT EXISTS stock_market_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  stock_id UUID REFERENCES stock_market_stocks(id) ON DELETE CASCADE,
  
  -- Event details
  event_type TEXT NOT NULL, -- 'ipo', 'split', 'crash', 'boom', 'dividend', 'news'
  title TEXT NOT NULL,
  description TEXT,
  
  -- Price impact
  price_multiplier DECIMAL(5,2) DEFAULT 1.00, -- Multiply price by this (e.g., 0.5 for crash, 2.0 for boom)
  price_change_percentage DECIMAL(5,2) DEFAULT 0, -- Direct percentage change
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  duration_minutes INTEGER, -- How long the event lasts (null = permanent)
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ends_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_market_events_active ON stock_market_events(guild_id, is_active, started_at);
CREATE INDEX IF NOT EXISTS idx_stock_market_events_stock ON stock_market_events(stock_id);

-- Market configuration per guild
CREATE TABLE IF NOT EXISTS stock_market_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  
  -- Settings
  market_enabled BOOLEAN DEFAULT true,
  trading_fee_percentage DECIMAL(5,2) DEFAULT 0.00, -- Transaction fee % (0-100)
  min_order_amount DECIMAL(15,2) DEFAULT 10.00, -- Minimum order value
  max_order_amount DECIMAL(15,2) DEFAULT 1000000.00, -- Maximum order value
  
  -- Price update settings
  price_update_interval_minutes INTEGER DEFAULT 15, -- How often prices update
  auto_price_fluctuation BOOLEAN DEFAULT true, -- Random price changes
  price_fluctuation_range DECIMAL(5,2) DEFAULT 5.00, -- Max % change per update
  
  -- Market hours (optional)
  market_hours_enabled BOOLEAN DEFAULT false,
  market_open_time TIME DEFAULT '00:00:00', -- UTC time
  market_close_time TIME DEFAULT '23:59:59', -- UTC time
  timezone TEXT DEFAULT 'UTC',
  
  -- Activity-based pricing
  server_activity_affects_prices BOOLEAN DEFAULT true,
  message_count_weight DECIMAL(5,2) DEFAULT 0.10, -- How much messages affect prices
  user_count_weight DECIMAL(5,2) DEFAULT 0.05, -- How much active users affect prices
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_market_configs_guild ON stock_market_configs(guild_id);

-- Update timestamp triggers
CREATE TRIGGER update_stock_market_stocks_updated_at
  BEFORE UPDATE ON stock_market_stocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_stock_market_portfolio_updated_at
  BEFORE UPDATE ON stock_market_portfolio
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_stock_market_configs_updated_at
  BEFORE UPDATE ON stock_market_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security
ALTER TABLE stock_market_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_market_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_market_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_market_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_market_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_market_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic - adjust based on your auth requirements)
CREATE POLICY "Users can view stocks for their guilds" ON stock_market_stocks FOR SELECT USING (true);
CREATE POLICY "Users can view their portfolio" ON stock_market_portfolio FOR SELECT USING (true);
CREATE POLICY "Users can view their transactions" ON stock_market_transactions FOR SELECT USING (true);
CREATE POLICY "Users can view their orders" ON stock_market_orders FOR SELECT USING (true);
CREATE POLICY "Users can view market events" ON stock_market_events FOR SELECT USING (true);
CREATE POLICY "Users can view market config" ON stock_market_configs FOR SELECT USING (true);

-- Comments
COMMENT ON TABLE stock_market_stocks IS 'Stocks available for trading in each guild';
COMMENT ON TABLE stock_market_portfolio IS 'User holdings of stocks per guild';
COMMENT ON TABLE stock_market_transactions IS 'History of all buy/sell transactions';
COMMENT ON TABLE stock_market_orders IS 'Pending limit orders and stop-loss orders';
COMMENT ON TABLE stock_market_events IS 'Market events that affect stock prices';
COMMENT ON TABLE stock_market_configs IS 'Configuration for stock market per guild';

