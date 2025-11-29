-- Advanced Stock Market Features Schema
-- Run this after stock-market-schema.sql

-- Price Alerts (users get notified when stock reaches target price)
CREATE TABLE IF NOT EXISTS stock_market_price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  stock_id UUID NOT NULL REFERENCES stock_market_stocks(id) ON DELETE CASCADE,
  
  -- Alert details
  alert_type TEXT NOT NULL, -- 'above', 'below', 'change_percent'
  target_price DECIMAL(15,2), -- For above/below alerts
  change_percent DECIMAL(5,2), -- For change_percent alerts
  is_active BOOLEAN DEFAULT true,
  
  -- Notification
  notified BOOLEAN DEFAULT false,
  notified_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id, stock_id, alert_type, target_price)
);

CREATE INDEX IF NOT EXISTS idx_stock_market_price_alerts_active ON stock_market_price_alerts(guild_id, is_active, stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_market_price_alerts_user ON stock_market_price_alerts(guild_id, user_id);

-- Portfolio Analytics (cached performance metrics)
CREATE TABLE IF NOT EXISTS stock_market_portfolio_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Performance metrics
  total_return_percent DECIMAL(10,2) DEFAULT 0,
  total_return_absolute DECIMAL(15,2) DEFAULT 0,
  best_performer_stock_id UUID REFERENCES stock_market_stocks(id),
  worst_performer_stock_id UUID REFERENCES stock_market_stocks(id),
  risk_score DECIMAL(5,2) DEFAULT 0, -- 0-100 risk score
  diversification_score DECIMAL(5,2) DEFAULT 0, -- 0-100 diversification
  
  -- Time-based metrics
  daily_return DECIMAL(10,2) DEFAULT 0,
  weekly_return DECIMAL(10,2) DEFAULT 0,
  monthly_return DECIMAL(10,2) DEFAULT 0,
  
  -- Calculated at
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_market_portfolio_analytics_user ON stock_market_portfolio_analytics(guild_id, user_id);

-- Market Statistics (aggregated market data)
CREATE TABLE IF NOT EXISTS stock_market_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  stock_id UUID REFERENCES stock_market_stocks(id) ON DELETE CASCADE,
  
  -- Trading statistics
  total_volume BIGINT DEFAULT 0, -- Total shares traded
  total_value DECIMAL(15,2) DEFAULT 0, -- Total value traded
  buy_volume BIGINT DEFAULT 0,
  sell_volume BIGINT DEFAULT 0,
  
  -- Price statistics
  day_high DECIMAL(15,2),
  day_low DECIMAL(15,2),
  day_open DECIMAL(15,2),
  day_close DECIMAL(15,2),
  
  -- Time period
  period_date DATE NOT NULL, -- The date these stats are for
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(guild_id, stock_id, period_date)
);

CREATE INDEX IF NOT EXISTS idx_stock_market_statistics_date ON stock_market_statistics(guild_id, period_date);
CREATE INDEX IF NOT EXISTS idx_stock_market_statistics_stock ON stock_market_statistics(stock_id, period_date);

-- Enable Row Level Security
ALTER TABLE stock_market_price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_market_portfolio_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_market_statistics ENABLE ROW LEVEL SECURITY;

-- Policies for price alerts
DROP POLICY IF EXISTS "Public read access for stock_market_price_alerts" ON stock_market_price_alerts;
CREATE POLICY "Public read access for stock_market_price_alerts"
  ON stock_market_price_alerts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage their own price alerts" ON stock_market_price_alerts;
CREATE POLICY "Users can manage their own price alerts"
  ON stock_market_price_alerts FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policies for portfolio analytics
DROP POLICY IF EXISTS "Public read access for stock_market_portfolio_analytics" ON stock_market_portfolio_analytics;
CREATE POLICY "Public read access for stock_market_portfolio_analytics"
  ON stock_market_portfolio_analytics FOR SELECT
  USING (true);

-- Policies for market statistics
DROP POLICY IF EXISTS "Public read access for stock_market_statistics" ON stock_market_statistics;
CREATE POLICY "Public read access for stock_market_statistics"
  ON stock_market_statistics FOR SELECT
  USING (true);

