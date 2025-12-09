-- User Profile Builder System Schema
-- Allows admins to create forms with checkboxes, users select options, results posted in threads

-- Profile forms configuration per guild
CREATE TABLE IF NOT EXISTS user_profiles_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    form_name TEXT NOT NULL,
    description TEXT,
    channel_id TEXT NOT NULL, -- Channel where form is posted
    message_id TEXT, -- Discord message ID of the form
    questions JSONB NOT NULL DEFAULT '[]', -- Array of questions: [{"id": "q1", "text": "Question?", "options": [{"id": "opt1", "text": "Option 1"}, ...]}]
    thread_name_template TEXT DEFAULT '{username} Profile', -- Template for thread name
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User responses to profile forms
CREATE TABLE IF NOT EXISTS user_profiles_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES user_profiles_forms(id) ON DELETE CASCADE,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    responses JSONB NOT NULL DEFAULT '{}', -- {"q1": ["opt1", "opt2"], "q2": ["opt3"]}
    thread_id TEXT, -- Discord thread ID where results are posted
    thread_message_id TEXT, -- Message ID in the thread
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(form_id, user_id) -- One response per user per form
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_forms_guild ON user_profiles_forms(guild_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_forms_channel ON user_profiles_forms(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_responses_form ON user_profiles_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_responses_guild_user ON user_profiles_responses(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_responses_status ON user_profiles_responses(status);

-- RLS Policies (if using RLS)
ALTER TABLE user_profiles_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles_responses ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles_forms
CREATE POLICY "Guild owners can manage user_profiles_forms" ON user_profiles_forms
    FOR ALL USING (EXISTS (SELECT 1 FROM guild_configs WHERE guild_id = user_profiles_forms.guild_id AND owner_discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())))
    WITH CHECK (EXISTS (SELECT 1 FROM guild_configs WHERE guild_id = user_profiles_forms.guild_id AND owner_discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())));

-- Policies for user_profiles_responses
CREATE POLICY "Users can view their own user_profiles_responses" ON user_profiles_responses
    FOR SELECT USING (user_id = (SELECT discord_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can create/update their own user_profiles_responses" ON user_profiles_responses
    FOR INSERT WITH CHECK (user_id = (SELECT discord_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can update their own user_profiles_responses" ON user_profiles_responses
    FOR UPDATE USING (user_id = (SELECT discord_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Guild owners can view all user_profiles_responses" ON user_profiles_responses
    FOR SELECT USING (EXISTS (SELECT 1 FROM guild_configs WHERE guild_id = user_profiles_responses.guild_id AND owner_discord_id = (SELECT discord_id FROM users WHERE id = auth.uid())));

