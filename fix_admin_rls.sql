-- Fix RLS so users can check their own admin status

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Admins can view admin list" ON admin_users;

-- Create new policy: Anyone can check if they are admin (but only see their own row)
CREATE POLICY "Anyone can check own admin status" ON admin_users
    FOR SELECT TO authenticated
    USING (user_id = auth.uid()::text);

-- Policy for admins to see all admin_users (for admin panel management)
CREATE POLICY "Admins can manage admin users" ON admin_users
    FOR ALL TO authenticated
    USING (is_admin(auth.uid()::text))
    WITH CHECK (is_admin(auth.uid()::text));

-- Also fix payout_requests RLS to allow admins to view all
DROP POLICY IF EXISTS "Admin can view all payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Admin can update payout requests" ON payout_requests;

-- Admin can do everything on payout_requests
CREATE POLICY "Admin full access on payouts" ON payout_requests
    FOR ALL TO authenticated
    USING (is_admin(auth.uid()::text))
    WITH CHECK (is_admin(auth.uid()::text));

-- Freelancers can still view their own payouts
CREATE POLICY "Freelancers view own payouts" ON payout_requests
    FOR SELECT TO authenticated
    USING (freelancer_uid = auth.uid()::text);

-- Verify the fix
SELECT 'RLS policies updated' as status;

-- Check if your user is in admin table
SELECT user_id, username, role, 
    CASE 
        WHEN user_id = '6c392b2f-aa45-4943-b610-0331e480daea' 
        THEN '✓ YES - YOU ARE ADMIN' 
        ELSE '✗ NO' 
    END as verification
FROM admin_users;
