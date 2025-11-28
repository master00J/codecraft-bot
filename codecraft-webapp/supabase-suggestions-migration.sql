-- Create suggestions table for ComCraft user feedback
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL,
  discord_tag TEXT NOT NULL,
  guild_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'improvement', 'other')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'planned', 'in_progress', 'completed', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_discord_id ON suggestions(discord_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_category ON suggestions(category);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON suggestions(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON suggestions
  FOR SELECT
  USING (auth.uid()::text = user_id::text OR discord_id = auth.uid()::text);

-- Users can insert their own suggestions
CREATE POLICY "Users can create suggestions"
  ON suggestions
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text OR discord_id = auth.uid()::text);

-- Admin users can view all suggestions
CREATE POLICY "Admins can view all suggestions"
  ON suggestions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Admin users can update any suggestion
CREATE POLICY "Admins can update suggestions"
  ON suggestions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Admin users can delete any suggestion
CREATE POLICY "Admins can delete suggestions"
  ON suggestions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
CREATE TRIGGER suggestions_updated_at_trigger
  BEFORE UPDATE ON suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_suggestions_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT ON suggestions TO authenticated;
GRANT UPDATE, DELETE ON suggestions TO authenticated;

COMMENT ON TABLE suggestions IS 'User suggestions and feedback for ComCraft bot improvements';
COMMENT ON COLUMN suggestions.category IS 'Type of suggestion: bug, feature, improvement, or other';
COMMENT ON COLUMN suggestions.status IS 'Current status of the suggestion';
COMMENT ON COLUMN suggestions.priority IS 'Priority level set by admins';
COMMENT ON COLUMN suggestions.admin_notes IS 'Internal notes or response from administrators';

