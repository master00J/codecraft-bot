-- Bot Deployments Schema for Pterodactyl Integration

-- Bot deployments tracking table
CREATE TABLE IF NOT EXISTS bot_deployments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  
  -- Discord & Customer Info
  discord_guild_id TEXT NOT NULL,
  customer_discord_id TEXT NOT NULL,
  
  -- Tier & Configuration
  tier TEXT NOT NULL, -- starter, pro, business
  enabled_features TEXT[] DEFAULT ARRAY[]::TEXT[],
  selected_addons JSONB DEFAULT '[]'::JSONB,
  
  -- Pterodactyl Server Info
  pterodactyl_server_id TEXT UNIQUE,
  pterodactyl_identifier TEXT,
  server_uuid TEXT,
  
  -- Resource Allocation
  memory_mb INTEGER NOT NULL,
  cpu_percent INTEGER NOT NULL,
  disk_mb INTEGER NOT NULL,
  databases INTEGER DEFAULT 0,
  backups INTEGER DEFAULT 1,
  
  -- Access Info
  server_ip TEXT,
  server_port INTEGER,
  sftp_details JSONB,
  
  -- Status & Health
  status TEXT DEFAULT 'pending', -- pending, provisioning, active, suspended, failed, terminated
  health_status TEXT DEFAULT 'unknown', -- unknown, online, offline, starting, stopping
  last_health_check TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Lifecycle
  provisioned_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  terminated_at TIMESTAMP WITH TIME ZONE,
  last_restart_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  deployment_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deployment logs for audit trail
CREATE TABLE IF NOT EXISTS deployment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deployment_id UUID REFERENCES bot_deployments(id) ON DELETE CASCADE,
  
  action TEXT NOT NULL, -- provision, start, stop, suspend, terminate, update_resources, health_check
  status TEXT NOT NULL, -- success, failed, pending
  details JSONB,
  error TEXT,
  
  performed_by TEXT, -- system, admin, customer
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deployments_order ON bot_deployments(order_id);
CREATE INDEX IF NOT EXISTS idx_deployments_guild ON bot_deployments(discord_guild_id);
CREATE INDEX IF NOT EXISTS idx_deployments_customer ON bot_deployments(customer_discord_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON bot_deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_pterodactyl ON bot_deployments(pterodactyl_server_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_deployment ON deployment_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_created ON deployment_logs(created_at DESC);

-- Enable RLS
ALTER TABLE bot_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bot_deployments
DROP POLICY IF EXISTS "Customers can view own deployments" ON bot_deployments;
CREATE POLICY "Customers can view own deployments" ON bot_deployments
  FOR SELECT USING (
    customer_discord_id = auth.uid()::text OR
    customer_discord_id IN (SELECT discord_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can view all deployments" ON bot_deployments;
CREATE POLICY "Admins can view all deployments" ON bot_deployments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true)
  );

-- RLS Policies for deployment_logs
DROP POLICY IF EXISTS "Customers can view own deployment logs" ON deployment_logs;
CREATE POLICY "Customers can view own deployment logs" ON deployment_logs
  FOR SELECT USING (
    deployment_id IN (
      SELECT id FROM bot_deployments 
      WHERE customer_discord_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Admins can view all deployment logs" ON deployment_logs;
CREATE POLICY "Admins can view all deployment logs" ON deployment_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true)
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deployment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_update_deployment_timestamp ON bot_deployments;
CREATE TRIGGER trigger_update_deployment_timestamp
  BEFORE UPDATE ON bot_deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_deployment_updated_at();

SELECT 'Bot deployments schema created successfully' as status;

