# Setup Notifications Table on Supabase

## Steps to Create the Notifications Table

### 1. Go to Supabase Dashboard
- Open https://app.supabase.com
- Select your project (YASA-TASKER)

### 2. Open SQL Editor
- Click on **SQL Editor** in the left sidebar
- Click **New Query**

### 3. Copy and Paste the SQL
Copy the entire content below and paste it into the SQL editor:

```sql
-- Create notifications table for tasker/freelancer workflow
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('application_approved', 'application_denied', 'task_completed')),
  related_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  related_application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Only the system (via API) can insert notifications
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);
```

### 4. Run the Query
- Click the **Run** button (or press Ctrl+Enter)
- You should see "Success" message

### 5. Verify the Table
- Go to **Table Editor** in the left sidebar
- You should see `notifications` table in the list
- Click on it to verify the columns are created

## After Setup
Once the table is created, the app should work properly:
- Approving/denying applications will create notifications
- Freelancers will see notifications in the Notifications modal
- Taskers will see pending applications

## Troubleshooting
If you get an error:
- **"relation 'profiles' does not exist"** → Make sure the `profiles` table exists first
- **"relation 'tasks' does not exist"** → Make sure the `tasks` table exists first
- **"relation 'applications' does not exist"** → Make sure the `applications` table exists first

All these tables should already exist from previous migrations.
