-- NEW FEATURES MIGRATIONS
-- Run these SQL commands in your Supabase SQL Editor

-- 1. Add status column to applications if not exists
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_applications_task_id ON applications(task_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_poster_id ON tasks(poster_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);

-- 3. Update profiles table to ensure all columns exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_tasks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0;

-- 4. Verify RLS policies exist for applications
DROP POLICY IF EXISTS "Logged in users can apply" ON applications;
CREATE POLICY "Logged in users can apply" ON applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Users can view own applications" ON applications;
CREATE POLICY "Users can view own applications" ON applications
  FOR SELECT USING (auth.uid() = applicant_id OR auth.uid() = (
    SELECT poster_id FROM tasks WHERE id = applications.task_id
  ));

DROP POLICY IF EXISTS "Applicant can update own applications" ON applications;
CREATE POLICY "Applicant can update own applications" ON applications
  FOR UPDATE USING (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Applicant can delete own applications" ON applications;
CREATE POLICY "Applicant can delete own applications" ON applications
  FOR DELETE USING (auth.uid() = applicant_id);

-- 5. Verify RLS policies for messages
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can read own messages" ON messages;
CREATE POLICY "Users can read own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Sender can update messages" ON messages;
CREATE POLICY "Sender can update messages" ON messages
  FOR UPDATE USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Sender can delete messages" ON messages;
CREATE POLICY "Sender can delete messages" ON messages
  FOR DELETE USING (auth.uid() = sender_id);
