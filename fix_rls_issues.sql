-- ==========================================
-- FIX RLS POLICY ISSUES
-- ==========================================

-- ==========================================
-- 1. FIX TRANSACTIONS TABLE (Critical!)
-- ==========================================

-- Drop all bad deny policies
DROP POLICY IF EXISTS "deny delete" ON transactions;
DROP POLICY IF EXISTS "deny insert" ON transactions;
DROP POLICY IF EXISTS "deny select" ON transactions;
DROP POLICY IF EXISTS "deny update" ON transactions;

-- Drop any other conflicting policies
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can create transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "view_transactions" ON transactions;
DROP POLICY IF EXISTS "insert_transactions" ON transactions;

-- Create correct policies for transactions
CREATE POLICY "transactions_select_own" ON transactions
    FOR SELECT TO authenticated
    USING (sender_uid = auth.uid()::text OR receiver_uid = auth.uid()::text);

CREATE POLICY "transactions_insert_own" ON transactions
    FOR INSERT TO authenticated
    WITH CHECK (sender_uid = auth.uid()::text);

CREATE POLICY "transactions_update_own" ON transactions
    FOR UPDATE TO authenticated
    USING (sender_uid = auth.uid()::text)
    WITH CHECK (sender_uid = auth.uid()::text);

-- ==========================================
-- 2. FIX PLATFORM_CONFIG TABLE (Critical!)
-- ==========================================

-- Drop any existing policies
DROP POLICY IF EXISTS "view_config" ON platform_config;
DROP POLICY IF EXISTS "Anyone can view platform config" ON platform_config;

-- Create policy - anyone can view config (needed for payment)
CREATE POLICY "platform_config_select" ON platform_config
    FOR SELECT TO authenticated, anon
    USING (true);

-- ==========================================
-- 3. CLEAN UP MESSAGES TABLE (Remove duplicates)
-- ==========================================

-- List all message policies to see what's duplicate
-- Keep only the essential ones and remove conflicting ones

-- Drop conflicting policies (keep only the {public} ones)
DROP POLICY IF EXISTS "Insert own messages" ON messages;
DROP POLICY IF EXISTS "Receiver can update message read status" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
DROP POLICY IF EXISTS "Users can read own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update cleared_by_user_id" ON messages;
DROP POLICY IF EXISTS "Users can view messages" ON messages;

-- Keep these {public} policies (they're correct):
-- - "Select own messages" 
-- - "Sender can delete messages"
-- - "Sender can update messages"
-- - "Update own messages"
-- - "Delete own messages"

-- Add back a simple insert policy
CREATE POLICY "messages_insert_own" ON messages
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid()::text = sender_id);

-- ==========================================
-- 4. FIX PROFILES TABLE (Remove overly permissive policy)
-- ==========================================

-- Drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;

-- ==========================================
-- 5. VERIFY FIXES
-- ==========================================

-- Check transactions table is now accessible
SELECT 'Transactions policies fixed' as status;

-- Show current policies on transactions
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'transactions';

-- Show current policies on platform_config
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'platform_config';
