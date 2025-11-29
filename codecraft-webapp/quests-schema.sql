-- Quests & Missions System Schema
-- Allows server owners to create custom quests that users can complete for rewards

-- Quest definitions per guild
CREATE TABLE IF NOT EXISTS quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  
  -- Quest Basic Info
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '📋',
  category TEXT DEFAULT 'general', -- daily, weekly, special, event, general
  
  -- Quest Type & Requirements
  quest_type TEXT NOT NULL, -- message_count, voice_minutes, coin_spend, coin_earn, xp_gain, 
                            -- level_reach, command_use, invite_count, reaction_count,
                            -- channel_visit, role_obtain, duel_win, stock_profit, custom
  
  -- Quest Requirements (JSONB for flexibility)
  requirements JSONB NOT NULL DEFAULT '{}',
  -- Example: { "target": 10, "channel_ids": ["123"], "role_ids": ["456"] }
  
  -- Quest Rewards (JSONB - can give multiple rewards)
  rewards JSONB NOT NULL DEFAULT '{}',
  -- Example: { "coins": 100, "xp": 50, "role_id": "789", "item_id": "abc" }
  
  -- Quest Settings
  reset_type TEXT DEFAULT 'never', -- never, daily, weekly, monthly
  reset_time TIME, -- Time of day to reset (for daily/weekly)
  reset_day_of_week INTEGER, -- 0-6 (0 = Sunday) for weekly reset
  
  -- Quest Availability
  enabled BOOLEAN DEFAULT true,
  visible BOOLEAN DEFAULT true, -- Hide from users but still track
  
  -- Quest Prerequisites
  prerequisite_quest_ids UUID[] DEFAULT '{}', -- Must complete these first
  required_level INTEGER, -- Minimum level to see/accept quest
  required_roles TEXT[] DEFAULT '{}', -- Roles required to see/accept
  
  -- Quest Limits
  max_completions INTEGER, -- null = unlimited
  completion_cooldown_hours INTEGER, -- Cooldown between completions
  
  -- Quest Chain
  chain_id UUID, -- For quest chains
  chain_position INTEGER, -- Position in chain (1, 2, 3...)
  
  -- Metadata
  created_by TEXT, -- User ID who created
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quests_guild ON quests(guild_id);
CREATE INDEX IF NOT EXISTS idx_quests_type ON quests(guild_id, quest_type);
CREATE INDEX IF NOT EXISTS idx_quests_category ON quests(guild_id, category);
CREATE INDEX IF NOT EXISTS idx_quests_chain ON quests(chain_id);
CREATE INDEX IF NOT EXISTS idx_quests_reset ON quests(guild_id, reset_type, enabled);
CREATE INDEX IF NOT EXISTS idx_quests_enabled ON quests(guild_id, enabled, visible);

-- Quest progress tracking per user
CREATE TABLE IF NOT EXISTS quest_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Progress Tracking
  current_progress INTEGER DEFAULT 0, -- Current progress toward target
  target_progress INTEGER NOT NULL, -- Target to complete (copied from quest)
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  
  -- Completion Tracking
  completion_count INTEGER DEFAULT 0, -- How many times completed (for repeatable)
  last_completed_at TIMESTAMPTZ, -- Last completion time (for cooldowns)
  
  -- Reset Tracking
  reset_at TIMESTAMPTZ, -- When this quest will reset (for daily/weekly)
  
  -- Metadata
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(quest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_progress_quest ON quest_progress(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_user ON quest_progress(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_completed ON quest_progress(guild_id, user_id, completed);
CREATE INDEX IF NOT EXISTS idx_quest_progress_reset ON quest_progress(reset_at) WHERE reset_at IS NOT NULL;

-- Quest completion history/logs
CREATE TABLE IF NOT EXISTS quest_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Completion Info
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  progress_achieved INTEGER, -- Final progress value
  rewards_given JSONB, -- What rewards were given
  
  -- Metadata
  completion_number INTEGER -- Which completion (1st, 2nd, 3rd...)
);

CREATE INDEX IF NOT EXISTS idx_quest_completions_quest ON quest_completions(quest_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_quest_completions_user ON quest_completions(guild_id, user_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_quest_completions_date ON quest_completions(completed_at);

-- Quest chains (series of quests)
CREATE TABLE IF NOT EXISTS quest_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '🔗',
  
  -- Chain Settings
  reward_bonus DECIMAL(5,2) DEFAULT 1.0, -- Bonus multiplier for completing entire chain
  
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quest_chains_guild ON quest_chains(guild_id);

-- RLS Policies
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_chains ENABLE ROW LEVEL SECURITY;

-- Policies (allow service role full access)
CREATE POLICY "Service role can manage quests" ON quests FOR ALL USING (true);
CREATE POLICY "Service role can manage quest_progress" ON quest_progress FOR ALL USING (true);
CREATE POLICY "Service role can manage quest_completions" ON quest_completions FOR ALL USING (true);
CREATE POLICY "Service role can manage quest_chains" ON quest_chains FOR ALL USING (true);

