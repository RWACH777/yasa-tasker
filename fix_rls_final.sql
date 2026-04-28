-- ==========================================
-- FIX RLS POLICIES - FINAL VERSION
-- ==========================================

-- 1. First, drop ALL bad policies on transactions
DROP POLICY IF EXISTS "deny delete" ON transactions;
DROP POLICY IF EXISTS "deny insert" ON transactions;
DROP POLICY IF EXISTS "deny select" ON transactions;
DROP POLICY IF EXISTS "deny update" ON transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can create transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "view_transactions" ON transactions;
DROP POLICY IF EXISTS "insert_transactions" ON transactions;
DROP POLICY IF EXISTS "update_transactions" ON transactions;
DROP POLICY IF EXISTS "transactions_select_own" ON transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON transactions;
DROP POLICY IF EXISTS "transactions_update_own" ON transactions;

-- 2. Create working policies for transactions
-- Allow users to view transactions where they are sender OR receiver
CREATE POLICY "transactions_select" ON transactions
    FOR SELECT TO authenticated
    USING (
        (sender_uid IS NOT NULL AND sender_uid = auth.uid()::text) OR 
        (receiver_uid IS NOT NULL AND receiver_uid = auth.uid()::text)
    );

-- Allow users to insert their own transactions
CREATE POLICY "transactions_insert" ON transactions
    FOR INSERT TO authenticated
    WITH CHECK (sender_uid = auth.uid()::text);

-- 3. Fix platform_config
DROP POLICY IF EXISTS "view_config" ON platform_config;
DROP POLICY IF EXISTS "Anyone can view platform config" ON platform_config;
DROP POLICY IF EXISTS "platform_config_select" ON platform_config;

CREATE POLICY "config_select" ON platform_config
    FOR SELECT TO authenticated, anon
    USING (true);

-- 4. Verify
SELECT 'RLS policies fixed!' as status;

-- Show current policies on transactions
SELECT policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'transactions';
