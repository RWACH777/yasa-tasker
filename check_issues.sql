-- Check for issues in database setup

-- 1. Why users table shows 0 rows but you have profiles?
SELECT 'USERS TABLE CHECK' as check_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'PROFILES TABLE', COUNT(*) FROM profiles;

-- 2. Check if there are duplicate table entries (why exists_check=2)
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'messages')
ORDER BY table_name, table_type;

-- 3. Check if users table has RLS preventing reads
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'users';

-- 4. Sample data from profiles to verify
SELECT id, username, email 
FROM profiles 
LIMIT 3;

-- 5. Check foreign key relationships
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('profiles', 'tasks', 'applications', 'messages', 'transactions');
