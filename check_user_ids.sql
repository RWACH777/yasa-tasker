-- ============================================
-- CHECK USER IDs - Find the correct ID for eshpaul
-- ============================================

-- Check all users in auth.users table
SELECT 
    id,
    email,
    created_at,
    raw_user_meta_data
FROM auth.users 
WHERE raw_user_meta_data->>'username' = 'eshpaul'
   OR email LIKE '%eshpaul%'
   OR id = '43f3c79f-ed30-4808-8273-41e382039f3a'
   OR id = '0cd0044d-8711-402c-9f16-1fd7d415a559';

-- Check profiles table
SELECT 
    id,
    username,
    pi_username,
    email,
    created_at
FROM profiles 
WHERE username = 'eshpaul'
   OR pi_username = 'eshpaul'
   OR id = '43f3c79f-ed30-4808-8273-41e382039f3a'
   OR id = '0cd0044d-8711-402c-9f16-1fd7d415a559';

-- Check admin_users table
SELECT 
    user_id,
    username,
    role,
    created_at
FROM admin_users 
WHERE username = 'eshpaul'
   OR user_id = '43f3c79f-ed30-4808-8273-41e382039f3a'
   OR user_id = '0cd0044d-8711-402c-9f16-1fd7d415a559';

-- Check all admin users to see what we have
SELECT 
    au.user_id,
    au.username as admin_username,
    p.username as profile_username,
    p.pi_username,
    a.email as auth_email
FROM admin_users au
LEFT JOIN profiles p ON au.user_id::text = p.id::text
LEFT JOIN auth.users a ON au.user_id::text = a.id::text
ORDER BY au.created_at;
