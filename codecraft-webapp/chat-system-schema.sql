-- Live Chat System met Supabase Realtime

-- Chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  discord_id TEXT,
  status TEXT DEFAULT 'open', -- open, closed, waiting
  assigned_to UUID REFERENCES users(id), -- Admin assigned to this chat
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL, -- Discord ID of sender
  sender_name TEXT,
  message TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can view own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can create own messages" ON chat_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON chat_messages;

-- Policies for chat_conversations
CREATE POLICY "Users can view own conversations" ON chat_conversations
  FOR SELECT USING (
    discord_id = auth.uid()::text OR
    user_id IN (SELECT id FROM users WHERE discord_id = auth.uid()::text)
  );

CREATE POLICY "Users can create conversations" ON chat_conversations
  FOR INSERT WITH CHECK (
    discord_id = auth.uid()::text OR
    user_id IN (SELECT id FROM users WHERE discord_id = auth.uid()::text)
  );

CREATE POLICY "Admins can view all conversations" ON chat_conversations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true)
  );

-- Policies for chat_messages
CREATE POLICY "Users can view own messages" ON chat_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM chat_conversations 
      WHERE discord_id = auth.uid()::text OR
            user_id IN (SELECT id FROM users WHERE discord_id = auth.uid()::text)
    )
  );

CREATE POLICY "Users can create own messages" ON chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()::text OR
    conversation_id IN (
      SELECT id FROM chat_conversations 
      WHERE discord_id = auth.uid()::text OR
            user_id IN (SELECT id FROM users WHERE discord_id = auth.uid()::text)
    )
  );

CREATE POLICY "Admins can view all messages" ON chat_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE discord_id = auth.uid()::text AND is_admin = true)
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_discord ON chat_conversations(discord_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON chat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON chat_messages(created_at DESC);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;

-- Verification
SELECT 'Chat tables created successfully' as status;

