-- Add team member as admin
-- First, check current admins
SELECT * FROM admin_users;

-- To add a new admin, you need their Pi UID
-- Get their UID from the error message they'll see, then run:

-- INSERT INTO admin_users (user_id, username, role, created_at) 
-- VALUES ('THEIR_PI_UID_HERE', 'their_username', 'admin', NOW());

-- Or if you want to make an existing user an admin:
-- First find their UID in the users table or from the admin panel error message
-- Then:
-- INSERT INTO admin_users (user_id, username, role, created_at)
-- SELECT id, username, 'admin', NOW()
-- FROM users
-- WHERE username = 'team_member_username'
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
