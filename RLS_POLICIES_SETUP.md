# RLS Policies Setup Guide

This document provides the SQL commands to set up Row Level Security (RLS) policies for your Pi Network marketplace.

## Prerequisites
- Go to your Supabase project dashboard
- Navigate to SQL Editor
- Run each SQL block below

---

## 1. Enable RLS on All Tables

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
```

---

## 2. PROFILES Table Policies

```sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role can insert profiles (for signup)
CREATE POLICY "Service role can insert profiles" ON profiles
  FOR INSERT WITH CHECK (true);
```

---

## 3. TASKS Table Policies

```sql
-- Anyone logged in can read tasks
CREATE POLICY "Logged in users can read tasks" ON tasks
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can insert tasks (poster_id must be their own uid)
CREATE POLICY "Users can insert tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = poster_id);

-- Only poster can update their own tasks
CREATE POLICY "Poster can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = poster_id);

-- Only poster can delete their own tasks
CREATE POLICY "Poster can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = poster_id);
```

---

## 4. APPLICATIONS Table Policies

```sql
-- Logged in users can insert applications
CREATE POLICY "Logged in users can apply" ON applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

-- Users can view their own applications
CREATE POLICY "Users can view own applications" ON applications
  FOR SELECT USING (auth.uid() = applicant_id OR auth.uid() = (
    SELECT poster_id FROM tasks WHERE id = applications.task_id
  ));

-- Applicant can update/delete their own applications
CREATE POLICY "Applicant can update own applications" ON applications
  FOR UPDATE USING (auth.uid() = applicant_id);

CREATE POLICY "Applicant can delete own applications" ON applications
  FOR DELETE USING (auth.uid() = applicant_id);
```

---

## 5. MESSAGES Table Policies

```sql
-- Users can insert messages (sender must be their own uid)
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can read messages they sent or received
CREATE POLICY "Users can read own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Only sender can update/delete their messages
CREATE POLICY "Sender can update messages" ON messages
  FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Sender can delete messages" ON messages
  FOR DELETE USING (auth.uid() = sender_id);
```

---

## 6. RATINGS Table Policies

```sql
-- Users can insert ratings (rater must be their own uid)
CREATE POLICY "Users can rate others" ON ratings
  FOR INSERT WITH CHECK (auth.uid() = rater_id);

-- Anyone can read ratings
CREATE POLICY "Anyone can read ratings" ON ratings
  FOR SELECT USING (true);

-- Only rater can update/delete their own ratings
CREATE POLICY "Rater can update own ratings" ON ratings
  FOR UPDATE USING (auth.uid() = rater_id);

CREATE POLICY "Rater can delete own ratings" ON ratings
  FOR DELETE USING (auth.uid() = rater_id);
```

---

## 7. TRANSACTIONS Table Policies

```sql
-- Enable RLS but no policies yet (for future use)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
```

---

## Verification Steps

1. Go to Supabase Dashboard → Authentication → Policies
2. For each table, verify that policies are listed
3. Test by:
   - Logging in on localhost
   - Checking the DEBUG PANEL for session info
   - Attempting to post a task
   - Checking browser console for any errors

---

## Troubleshooting

If you get "Failed to save task" error:

1. **Check the error message** in the UI (now shows detailed error)
2. **Check browser console** for Supabase errors
3. **Verify session** in DEBUG PANEL - should show valid access_token
4. **Verify profile** in DEBUG PANEL - should show loaded profile with id
5. **Check RLS policies** - ensure INSERT policy exists for tasks table

---

## Common Issues

### Issue: "new row violates row-level security policy"
**Cause**: RLS policy doesn't allow the insert
**Fix**: Ensure `poster_id = auth.uid()` in the INSERT policy

### Issue: "permission denied for schema public"
**Cause**: RLS is enabled but no policies exist
**Fix**: Run the policy creation SQL above

### Issue: Profile not loading after login
**Cause**: Profile wasn't created or RLS blocks reading it
**Fix**: Check that profile exists in Supabase and RLS allows SELECT
