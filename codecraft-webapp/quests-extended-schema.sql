-- Extended Quests & Missions System Schema
-- Adds: milestones, timers/deadlines, difficulty/rarity, and quest chains

-- Add new columns to quests table
ALTER TABLE quests 
  ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'normal', -- easy, normal, hard, expert
  ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'common', -- common, rare, epic, legendary
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ, -- Deadline for completing quest
  ADD COLUMN IF NOT EXISTS time_limit_hours INTEGER, -- Time limit in hours (alternative to deadline_at)
  ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '[]', -- [{ "progress": 25, "rewards": {...}, "message": "..." }, ...]
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ, -- When quest becomes available
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ; -- When quest expires

-- Create index for difficulty/rarity filtering
CREATE INDEX IF NOT EXISTS idx_quests_difficulty ON quests(guild_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_quests_rarity ON quests(guild_id, rarity);
CREATE INDEX IF NOT EXISTS idx_quests_deadline ON quests(deadline_at) WHERE deadline_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quests_active_period ON quests(guild_id, start_date, end_date) WHERE start_date IS NOT NULL OR end_date IS NOT NULL;

-- Quest milestones tracking
CREATE TABLE IF NOT EXISTS quest_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_progress_id UUID NOT NULL REFERENCES quest_progress(id) ON DELETE CASCADE,
  milestone_progress INTEGER NOT NULL, -- Progress value when milestone was reached (e.g., 25, 50, 75)
  rewards_given JSONB, -- What rewards were given
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quest_milestones_progress ON quest_milestones(quest_progress_id);

-- Quest chains improvements
ALTER TABLE quest_chains 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS total_quests INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chain_rewards JSONB DEFAULT '{}'; -- Bonus rewards for completing entire chain

-- User quest chain progress
CREATE TABLE IF NOT EXISTS quest_chain_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES quest_chains(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  completed_quest_ids UUID[] DEFAULT '{}', -- Array of completed quest IDs in this chain
  current_quest_id UUID, -- Current active quest in chain
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  chain_rewards_given BOOLEAN DEFAULT false,
  
  UNIQUE(chain_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_chain_progress_chain ON quest_chain_progress(chain_id);
CREATE INDEX IF NOT EXISTS idx_quest_chain_progress_user ON quest_chain_progress(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quest_chain_progress_completed ON quest_chain_progress(chain_id, user_id, completed_at) WHERE completed_at IS NOT NULL;

-- RLS Policies
ALTER TABLE quest_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_chain_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage quest_milestones" ON quest_milestones FOR ALL USING (true);
CREATE POLICY "Service role can manage quest_chain_progress" ON quest_chain_progress FOR ALL USING (true);

