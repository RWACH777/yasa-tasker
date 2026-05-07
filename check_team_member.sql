-- Check team member's current admin status
SELECT user_id, username, role, created_at 
FROM admin_users 
WHERE user_id = '43f3c79f-ed30-4808-8273-41e382039f3a';
