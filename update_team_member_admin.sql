-- Update team member's role to admin (if not already)
UPDATE admin_users 
SET role = 'admin'
WHERE user_id = '43f3c79f-ed30-4808-8273-41e382039f3a';

-- Verify the update
SELECT user_id, username, role 
FROM admin_users 
WHERE user_id = '43f3c79f-ed30-4808-8273-41e382039f3a';
