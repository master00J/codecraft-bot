-- Employee Time Clock System Schema
-- Tracks clock-in/clock-out sessions for staff members

CREATE TABLE IF NOT EXISTS employee_time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    clock_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clock_out_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    source TEXT DEFAULT 'bot', -- bot, dashboard, api
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active entry per user per guild
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_time_entries_active
ON employee_time_entries (guild_id, user_id)
WHERE status = 'active';

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_employee_time_entries_guild ON employee_time_entries(guild_id);
CREATE INDEX IF NOT EXISTS idx_employee_time_entries_user ON employee_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_time_entries_clock_in ON employee_time_entries(clock_in_at);
