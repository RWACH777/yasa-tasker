-- ============================================================
-- YASA Tasker - AI Workspace Schema Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add AI fields to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_allowed BOOLEAN DEFAULT true;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_type TEXT DEFAULT 'ai_plus_human'
  CHECK (completion_type IN ('human_only', 'ai_plus_human'));

-- 2. Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  freelancer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  file_urls TEXT[] DEFAULT '{}',
  used_ai BOOLEAN DEFAULT false,
  reviewed_by_human BOOLEAN DEFAULT false,
  revision_count INTEGER DEFAULT 0,
  max_revisions INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revision_requested', 'disputed')),
  revision_note TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS on submissions
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Freelancer can insert/update their own submissions
CREATE POLICY "Freelancer can manage own submissions" ON submissions
  FOR ALL USING (freelancer_id = auth.uid());

-- Tasker can read submissions for their tasks
CREATE POLICY "Tasker can read submissions for their tasks" ON submissions
  FOR SELECT USING (
    task_id IN (SELECT id FROM tasks WHERE poster_id = auth.uid())
  );

-- Tasker can update submission status (accept/revision/dispute)
CREATE POLICY "Tasker can update submission status" ON submissions
  FOR UPDATE USING (
    task_id IN (SELECT id FROM tasks WHERE poster_id = auth.uid())
  );

-- 4. Create disputes table
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can raise disputes for their tasks" ON disputes
  FOR INSERT WITH CHECK (raised_by = auth.uid());

CREATE POLICY "Users can view their own disputes" ON disputes
  FOR SELECT USING (
    raised_by = auth.uid() OR
    task_id IN (SELECT id FROM tasks WHERE poster_id = auth.uid())
  );

-- Admins can see all disputes (if you have an admin role)
CREATE POLICY "Admins can manage disputes" ON disputes
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  );

-- 5. Storage bucket for submission files (run separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', true)
-- ON CONFLICT DO NOTHING;
