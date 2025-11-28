-- Update chat schema voor anonieme gasten en response tracking

-- Add guest_id and guest_email for anonymous users
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS guest_id TEXT,
ADD COLUMN IF NOT EXISTS guest_email TEXT,
ADD COLUMN IF NOT EXISTS guest_name TEXT,
ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS response_time_seconds INTEGER;

-- Update RLS policies to allow anonymous users to create conversations
DROP POLICY IF EXISTS "Allow anonymous conversation creation" ON chat_conversations;
CREATE POLICY "Allow anonymous conversation creation" ON chat_conversations
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous to view own conversations" ON chat_conversations;
CREATE POLICY "Allow anonymous to view own conversations" ON chat_conversations
  FOR SELECT USING (
    guest_id = current_setting('request.jwt.claims', true)::json->>'guest_id' OR
    discord_id = auth.uid()::text OR
    user_id IN (SELECT id FROM users WHERE discord_id = auth.uid()::text)
  );

-- Update messages policies
DROP POLICY IF EXISTS "Allow anonymous messages" ON chat_messages;
CREATE POLICY "Allow anonymous messages" ON chat_messages
  FOR INSERT WITH CHECK (true);

-- Create function to calculate response time
CREATE OR REPLACE FUNCTION calculate_response_time()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first admin message in this conversation
  IF NEW.is_admin = true THEN
    -- Check if conversation doesn't have first_response_at yet
    IF NOT EXISTS (
      SELECT 1 FROM chat_conversations 
      WHERE id = NEW.conversation_id 
      AND first_response_at IS NOT NULL
    ) THEN
      -- Get the first customer message time
      DECLARE
        first_customer_msg_time TIMESTAMP WITH TIME ZONE;
      BEGIN
        SELECT created_at INTO first_customer_msg_time
        FROM chat_messages
        WHERE conversation_id = NEW.conversation_id
        AND is_admin = false
        ORDER BY created_at ASC
        LIMIT 1;
        
        IF first_customer_msg_time IS NOT NULL THEN
          -- Update conversation with first response time
          UPDATE chat_conversations
          SET 
            first_response_at = NEW.created_at,
            response_time_seconds = EXTRACT(EPOCH FROM (NEW.created_at - first_customer_msg_time))::INTEGER
          WHERE id = NEW.conversation_id;
        END IF;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for response time calculation
DROP TRIGGER IF EXISTS trigger_calculate_response_time ON chat_messages;
CREATE TRIGGER trigger_calculate_response_time
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION calculate_response_time();

-- Create view for average response times
CREATE OR REPLACE VIEW chat_response_stats AS
SELECT 
  COUNT(*) FILTER (WHERE response_time_seconds IS NOT NULL) as total_responses,
  AVG(response_time_seconds) FILTER (WHERE response_time_seconds IS NOT NULL) as avg_response_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_seconds) 
    FILTER (WHERE response_time_seconds IS NOT NULL) as median_response_seconds,
  MIN(response_time_seconds) FILTER (WHERE response_time_seconds IS NOT NULL) as min_response_seconds,
  MAX(response_time_seconds) FILTER (WHERE response_time_seconds IS NOT NULL) as max_response_seconds
FROM chat_conversations
WHERE created_at > NOW() - INTERVAL '30 days';

-- Grant access to the view
GRANT SELECT ON chat_response_stats TO anon, authenticated;

SELECT 'Chat schema v2 updated successfully - anonymous chat & response tracking enabled' as status;

