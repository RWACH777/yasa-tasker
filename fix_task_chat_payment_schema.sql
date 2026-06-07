ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS transaction_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_txid TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS freelancer_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tasker_rated BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS freelancer_rated BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS task_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS rated_user_id UUID;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS rating_type VARCHAR(20) DEFAULT 'freelancer';
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS task_id UUID;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

CREATE TABLE IF NOT EXISTS presence (
  user_id UUID PRIMARY KEY,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_task_id_fkey'
  ) THEN
    ALTER TABLE messages
    ADD CONSTRAINT messages_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_messages_task_id ON messages(task_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_read ON messages(receiver_id, read);
CREATE INDEX IF NOT EXISTS idx_applications_task_applicant_status ON applications(task_id, applicant_id, status);

UPDATE tasks t
SET assignee_id = a.applicant_id
FROM applications a
WHERE a.task_id = t.id
AND a.status = 'approved'
AND t.assignee_id IS NULL;

DROP POLICY IF EXISTS "Poster can update own tasks" ON tasks;
CREATE POLICY "Poster can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = poster_id)
  WITH CHECK (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Assignee can update assigned tasks" ON tasks;
CREATE POLICY "Assignee can update assigned tasks" ON tasks
  FOR UPDATE USING (
    auth.uid() = assignee_id
    OR EXISTS (
      SELECT 1 FROM applications a
      WHERE a.task_id = tasks.id
      AND a.applicant_id = auth.uid()
      AND a.status = 'approved'
    )
  )
  WITH CHECK (
    auth.uid() = assignee_id
    OR EXISTS (
      SELECT 1 FROM applications a
      WHERE a.task_id = tasks.id
      AND a.applicant_id = auth.uid()
      AND a.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Participants can update task transactions" ON transactions;
CREATE POLICY "Participants can update task transactions" ON transactions
  FOR UPDATE USING (
    sender_uid = auth.uid()::text OR receiver_uid = auth.uid()::text
  )
  WITH CHECK (
    sender_uid = auth.uid()::text OR receiver_uid = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read own messages" ON messages;
CREATE POLICY "Users can read own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Receiver can update message read status" ON messages;
CREATE POLICY "Receiver can update message read status" ON messages
  FOR UPDATE USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Sender can delete own messages" ON messages;
CREATE POLICY "Sender can delete own messages" ON messages
  FOR DELETE USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can delete messages" ON messages;

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND (
      task_id IS NULL
      OR EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id = task_id
        AND (
          t.poster_id = auth.uid()
          OR t.assignee_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM applications a
            WHERE a.task_id = t.id
            AND a.applicant_id = auth.uid()
            AND a.status = 'approved'
          )
        )
      )
    )
  );

ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read presence" ON presence;
CREATE POLICY "Users can read presence" ON presence
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can upsert own presence" ON presence;
CREATE POLICY "Users can upsert own presence" ON presence
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own presence" ON presence;
CREATE POLICY "Users can update own presence" ON presence
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

SELECT 'task/chat/payment schema fixed' AS status;
