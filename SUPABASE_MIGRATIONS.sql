-- SUPABASE MIGRATIONS
-- Run these SQL commands in your Supabase SQL Editor

-- 0. Add freelancer_username column to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS freelancer_username TEXT;

-- 0.5. Add all missing columns to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sender_id UUID;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS receiver_id UUID;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS file_url TEXT;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS voice_url TEXT;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 0.6. Add all missing columns to ratings table
ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS rater_id UUID;

ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS rated_user_id UUID;

ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS rating INTEGER;

ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS comment TEXT;

ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 1. Fix tasks table - add UUID generation for id column
ALTER TABLE tasks
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. Fix applications table - add UUID generation for id column
ALTER TABLE applications
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2.5. Add missing columns to applications table
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS applicant_name TEXT;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS applicant_skills TEXT;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS applicant_experience TEXT;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS applicant_description TEXT;

-- 3. Fix messages table - add UUID generation for id column
ALTER TABLE messages
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 4. Fix ratings table - add UUID generation for id column
ALTER TABLE ratings
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 5. Add created_at default for tasks if not exists
ALTER TABLE tasks
  ALTER COLUMN created_at SET DEFAULT now();

-- 6. Add created_at default for applications if not exists
ALTER TABLE applications
  ALTER COLUMN created_at SET DEFAULT now();

-- 7. Messages created_at default already set in section 0.5

-- 8. Ratings created_at default already set in section 0.6

-- 9. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies for profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
CREATE POLICY "Service role can insert profiles" ON profiles
  FOR INSERT WITH CHECK (true);

-- 11. Create RLS policies for tasks
DROP POLICY IF EXISTS "Logged in users can read tasks" ON tasks;
CREATE POLICY "Logged in users can read tasks" ON tasks
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert tasks" ON tasks;
CREATE POLICY "Users can insert tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Poster can update own tasks" ON tasks;
CREATE POLICY "Poster can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Poster can delete own tasks" ON tasks;
CREATE POLICY "Poster can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = poster_id);

-- 12. Create RLS policies for applications
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

-- 13. Create RLS policies for messages
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

-- 14. Create RLS policies for ratings
DROP POLICY IF EXISTS "Users can rate others" ON ratings;
CREATE POLICY "Users can rate others" ON ratings
  FOR INSERT WITH CHECK (auth.uid() = rater_id);

DROP POLICY IF EXISTS "Anyone can read ratings" ON ratings;
CREATE POLICY "Anyone can read ratings" ON ratings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Rater can update own ratings" ON ratings;
CREATE POLICY "Rater can update own ratings" ON ratings
  FOR UPDATE USING (auth.uid() = rater_id);

DROP POLICY IF EXISTS "Rater can delete own ratings" ON ratings;
CREATE POLICY "Rater can delete own ratings" ON ratings
  FOR DELETE USING (auth.uid() = rater_id);

-- 15. Allow users to read all profiles (needed for chat and messaging)
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
CREATE POLICY "Users can read all profiles" ON profiles
  FOR SELECT USING (true);

-- 16. Create storage bucket for message files (run in Supabase Dashboard)
-- Note: This must be created via Supabase Dashboard:
-- 1. Go to Storage > Buckets
-- 2. Create a new bucket named "message-files"
-- 3. Make it PUBLIC

-- 17. Storage RLS policies for message-files bucket
-- Run these in SQL Editor after creating the bucket:
DROP POLICY IF EXISTS "Users can upload message files" ON storage.objects;
CREATE POLICY "Users can upload message files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'message-files' AND
    auth.uid()::text = (string_to_array(name, '/'))[1]
  );

DROP POLICY IF EXISTS "Users can read message files" ON storage.objects;
CREATE POLICY "Users can read message files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'message-files'
  );

DROP POLICY IF EXISTS "Users can delete own message files" ON storage.objects;
CREATE POLICY "Users can delete own message files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'message-files' AND
    auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- 16. Add rating columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;

-- 17. Add mutual rating tracking to tasks table
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS tasker_rated BOOLEAN DEFAULT false;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS freelancer_rated BOOLEAN DEFAULT false;

-- 18. Add read field to messages table for tracking unread messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- 19. Update RLS policy for messages to allow receiver to mark as read
DROP POLICY IF EXISTS "Receiver can update message read status" ON messages;
CREATE POLICY "Receiver can update message read status" ON messages
  FOR UPDATE USING (auth.uid() = receiver_id);
