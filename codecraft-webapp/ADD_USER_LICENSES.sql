-- Comcraft user license schema

-- 1. Create licenses table (one per user per active subscription)
CREATE TABLE IF NOT EXISTS comcraft_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL,
    max_guilds INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active', -- active, cancelled, expired
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    payment_id UUID REFERENCES payments(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Mapping table for guild assignments
CREATE TABLE IF NOT EXISTS comcraft_license_guilds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID REFERENCES comcraft_licenses(id) ON DELETE CASCADE,
    guild_id TEXT NOT NULL,
    guild_name TEXT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (license_id, guild_id)
);

-- 3. Update guild_configs to reference license (optional)
ALTER TABLE guild_configs
ADD COLUMN IF NOT EXISTS license_id UUID REFERENCES comcraft_licenses(id);
ALTER TABLE comcraft_license_guilds
ADD COLUMN IF NOT EXISTS guild_name TEXT;

-- 4. Views or helper indexes
CREATE INDEX IF NOT EXISTS idx_comcraft_licenses_user ON comcraft_licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_comcraft_license_guilds_license ON comcraft_license_guilds(license_id);
CREATE INDEX IF NOT EXISTS idx_comcraft_license_guilds_guild ON comcraft_license_guilds(guild_id);
