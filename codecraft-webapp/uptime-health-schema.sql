-- Uptime & Health Monitoring System
DROP TABLE IF EXISTS bot_health_checks CASCADE;
DROP TABLE IF EXISTS bot_incidents CASCADE;

-- Health Checks table (periodic status checks)
CREATE TABLE bot_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID REFERENCES bot_deployments(id) ON DELETE CASCADE,
  
  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN ('online', 'offline', 'degraded')),
  response_time_ms INTEGER,
  
  -- Resources
  cpu_percent DECIMAL(5, 2),
  memory_mb INTEGER,
  disk_mb INTEGER,
  
  -- Timestamp
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Incidents table (downtime tracking)
CREATE TABLE bot_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID REFERENCES bot_deployments(id) ON DELETE CASCADE,
  
  -- Incident details
  type VARCHAR(50) NOT NULL, -- 'downtime', 'high_cpu', 'high_memory', 'crash'
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
  
  -- Timeline
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- Metadata
  auto_detected BOOLEAN DEFAULT true,
  notified BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_health_checks_deployment ON bot_health_checks(deployment_id, checked_at DESC);
CREATE INDEX idx_health_checks_status ON bot_health_checks(status, checked_at DESC);
CREATE INDEX idx_incidents_deployment ON bot_incidents(deployment_id, started_at DESC);
CREATE INDEX idx_incidents_status ON bot_incidents(status);

-- Function to calculate uptime percentage
CREATE OR REPLACE FUNCTION calculate_uptime(p_deployment_id UUID, p_days INTEGER DEFAULT 30)
RETURNS DECIMAL(5, 2) AS $$
DECLARE
  total_checks INTEGER;
  online_checks INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'online')
  INTO total_checks, online_checks
  FROM bot_health_checks
  WHERE deployment_id = p_deployment_id
    AND checked_at >= NOW() - (p_days || ' days')::INTERVAL;
  
  IF total_checks = 0 THEN
    RETURN 100.00;
  END IF;
  
  RETURN (online_checks::DECIMAL / total_checks * 100)::DECIMAL(5, 2);
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE bot_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_incidents ENABLE ROW LEVEL SECURITY;

-- Users can view their own bot's health
CREATE POLICY "Users can view their bot health"
ON bot_health_checks FOR SELECT TO authenticated
USING (
  deployment_id IN (
    SELECT bd.id FROM bot_deployments bd
    INNER JOIN orders o ON o.id = bd.order_id
    WHERE o.discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())
  )
);

CREATE POLICY "Users can view their bot incidents"
ON bot_incidents FOR SELECT TO authenticated
USING (
  deployment_id IN (
    SELECT bd.id FROM bot_deployments bd
    INNER JOIN orders o ON o.id = bd.order_id
    WHERE o.discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())
  )
);

-- Admins can do everything
CREATE POLICY "Admins can manage health checks"
ON bot_health_checks FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));

CREATE POLICY "Admins can manage incidents"
ON bot_incidents FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));

COMMENT ON TABLE bot_health_checks IS 'Periodic health checks for bot monitoring';
COMMENT ON TABLE bot_incidents IS 'Tracks bot incidents and downtime';

