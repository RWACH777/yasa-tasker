-- Create presence table for tracking online/offline status
CREATE TABLE IF NOT EXISTS presence (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

-- Allow users to read all presence data (to see who's online)
CREATE POLICY "Allow users to read presence" ON presence
  FOR SELECT USING (true);

-- Allow users to update their own presence
CREATE POLICY "Allow users to update own presence" ON presence
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to insert their own presence
CREATE POLICY "Allow users to insert own presence" ON presence
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_presence_user_id ON presence(user_id);
CREATE INDEX IF NOT EXISTS idx_presence_is_online ON presence(is_online);

-- Enable realtime for presence table
ALTER PUBLICATION supabase_realtime ADD TABLE presence;
