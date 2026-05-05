-- Add second admin team member
INSERT INTO admin_users (user_id, username, role)
VALUES ('43f3c79f-ed30-4808-8273-41e382039f3a', 'team_admin', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Verify both admins
SELECT user_id, username, role, created_at 
FROM admin_users 
ORDER BY created_at;
