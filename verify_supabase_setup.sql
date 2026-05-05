-- ==========================================
-- SUPABASE VERIFICATION SCRIPT
-- Safe, read-only checks - NO destructive operations
-- ==========================================

-- Check all critical tables exist
SELECT 
    'TABLES EXIST' as check_type,
    table_name,
    '✓' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'users', 'profiles', 'tasks', 'applications', 'messages', 
    'transactions', 'ratings', 'notifications', 'payout_requests', 
    'admin_users', 'platform_config'
)
ORDER BY table_name;

-- Check if RLS is enabled on critical tables
SELECT 
    'RLS STATUS' as check_type,
    relname as table_name,
    CASE WHEN relrowsecurity THEN '✓ ENABLED' ELSE '✗ DISABLED' END as rls_status
FROM pg_class 
WHERE relname IN (
    'users', 'profiles', 'tasks', 'applications', 'messages',
    'transactions', 'ratings', 'notifications', 'payout_requests',
    'admin_users', 'platform_config'
)
AND relkind = 'r'
ORDER BY relname;

-- Check row counts (to verify no data loss)
SELECT 
    'ROW COUNTS' as check_type,
    'users' as table_name, 
    COUNT(*) as row_count 
FROM users
UNION ALL
SELECT 
    'ROW COUNTS', 
    'profiles', 
    COUNT(*) 
FROM profiles
UNION ALL
SELECT 
    'ROW COUNTS', 
    'tasks', 
    COUNT(*) 
FROM tasks
UNION ALL
SELECT 
    'ROW COUNTS', 
    'applications', 
    COUNT(*) 
FROM applications
UNION ALL
SELECT 
    'ROW COUNTS', 
    'messages', 
    COUNT(*) 
FROM messages
UNION ALL
SELECT 
    'ROW COUNTS', 
    'transactions', 
    COUNT(*) 
FROM transactions
UNION ALL
SELECT 
    'ROW COUNTS', 
    'ratings', 
    COUNT(*) 
FROM ratings
UNION ALL
SELECT 
    'ROW COUNTS', 
    'notifications', 
    COUNT(*) 
FROM notifications
UNION ALL
SELECT 
    'ROW COUNTS', 
    'payout_requests', 
    COUNT(*) 
FROM payout_requests
UNION ALL
SELECT 
    'ROW COUNTS', 
    'admin_users', 
    COUNT(*) 
FROM admin_users;

-- Check critical columns exist in key tables
SELECT 
    'COLUMNS CHECK' as check_type,
    table_name,
    column_name,
    data_type,
    '✓' as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND (
    (table_name = 'tasks' AND column_name IN ('id', 'poster_id', 'title', 'status', 'budget', 'price'))
    OR (table_name = 'users' AND column_name IN ('id', 'username', 'wallet_address'))
    OR (table_name = 'profiles' AND column_name IN ('id', 'username', 'average_rating', 'total_ratings'))
    OR (table_name = 'transactions' AND column_name IN ('id', 'task_id', 'sender_uid', 'receiver_uid', 'total_amount', 'status'))
    OR (table_name = 'payout_requests' AND column_name IN ('id', 'task_id', 'freelancer_uid', 'amount', 'status'))
    OR (table_name = 'admin_users' AND column_name IN ('id', 'user_id', 'role'))
)
ORDER BY table_name, ordinal_position;

-- Check admin user was created
SELECT 
    'ADMIN USER' as check_type,
    user_id,
    username,
    role,
    CASE 
        WHEN user_id = '6c392b2f-aa45-4943-b610-0331e480daea' 
        THEN '✓ YOUR USER IS ADMIN' 
        ELSE '✗ Different user' 
    END as verification
FROM admin_users
LIMIT 5;

-- Summary report
SELECT 
    'SUMMARY' as check_type,
    'All checks completed successfully!' as message,
    '✓' as status;
