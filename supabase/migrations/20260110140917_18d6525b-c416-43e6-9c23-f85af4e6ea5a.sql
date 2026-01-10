-- Create chat_logs table for storing conversations
CREATE TABLE chat_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Who's chatting
  user_id UUID,
  session_id UUID,
  player_id UUID,
  
  -- Conversation
  messages JSONB NOT NULL DEFAULT '[]',
  
  -- Context
  page_url TEXT,
  user_agent TEXT,
  
  -- Feedback flags
  is_feedback BOOLEAN DEFAULT false,
  feedback_type TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Chat logs insertable by anyone"
ON chat_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Chat logs viewable by service role"
ON chat_logs FOR SELECT
USING (auth.role() = 'service_role');

CREATE POLICY "Chat logs updatable by service role"
ON chat_logs FOR UPDATE
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view chat logs"
ON chat_logs FOR SELECT
USING (is_admin());

-- Index for finding feedback
CREATE INDEX idx_chat_logs_feedback ON chat_logs(is_feedback) WHERE is_feedback = true;

-- Index for user lookups
CREATE INDEX idx_chat_logs_user_id ON chat_logs(user_id);
CREATE INDEX idx_chat_logs_created_at ON chat_logs(created_at DESC);