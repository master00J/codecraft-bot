-- Rank Nickname Prefix Schema
-- When a member has a configured role, their server nickname is set to [PREFIX] (Username)
-- e.g. role "Cadet" with prefix "CDT" -> nickname "[CDT] (Jantje)"

CREATE TABLE IF NOT EXISTS rank_nickname_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_rank_nickname_config_guild ON rank_nickname_config(guild_id);

ALTER TABLE rank_nickname_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage rank_nickname_config"
  ON rank_nickname_config
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can read rank_nickname_config"
  ON rank_nickname_config
  FOR SELECT
  USING (true);

COMMENT ON TABLE rank_nickname_config IS 'Maps Discord roles to nickname prefixes; when a member has the role, nickname becomes [prefix] (display name)';
