-- ============================================
-- FIX ADMIN ACCESS - Remove wrong ID, ensure correct one
-- ============================================

-- 1. Remove the WRONG admin ID if it exists
DELETE FROM admin_users 
WHERE user_id = '0cd0044d-8711-402c-9f16-1fd7d415a559';

-- 2. Add the ID that your team member actually has (from the error message)
INSERT INTO admin_users (user_id, username, role, created_at)
VALUES ('0cd0044d-8711-402c-9f16-1fd7d415a559', 'eshpaul', 'admin', NOW())
ON CONFLICT (user_id) DO UPDATE SET 
    role = 'admin', 
    username = 'eshpaul';

-- 3. Also ensure the expected ID has access (in case it's a different account)
INSERT INTO admin_users (user_id, username, role, created_at)
VALUES ('43f3c79f-ed30-4808-8273-41e382039f3a', 'eshpaul', 'admin', NOW())
ON CONFLICT (user_id) DO UPDATE SET 
    role = 'admin', 
    username = 'eshpaul';

-- 3. Ensure first admin (yair777) also has access
INSERT INTO admin_users (user_id, username, role, created_at)
VALUES ('fc0bbbbb-e8d0-411c-8abd-556a66152ba3', 'yair777', 'admin', NOW())
ON CONFLICT (user_id) DO UPDATE SET 
    role = 'admin', 
    username = 'yair777',
    created_at = COALESCE(admin_users.created_at, NOW());

-- 4. Verify current admins
SELECT user_id, username, role, created_at 
FROM admin_users 
ORDER BY created_at;
