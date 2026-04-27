-- Fix RLS policies for messages table
-- Run this in Supabase SQL Editor

-- 1. Check current RLS policies
SELECT * FROM pg_policies WHERE tablename = 'messages';

-- 2. Enable RLS on messages table (if not already enabled)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing insert policies that might be blocking
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON messages;

-- 4. Create new insert policy that allows authenticated users to insert
-- (Adjust based on your auth setup)
CREATE POLICY "Users can insert messages" 
ON messages 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- OR if using anon/public access (less secure but works for testing):
-- CREATE POLICY "Allow all inserts" ON messages FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 5. Also ensure SELECT policy exists
DROP POLICY IF EXISTS "Users can view messages" ON messages;
CREATE POLICY "Users can view messages" 
ON messages 
FOR SELECT 
TO authenticated 
USING (true);

-- 6. Verify policies are active
SELECT * FROM pg_policies WHERE tablename = 'messages';
