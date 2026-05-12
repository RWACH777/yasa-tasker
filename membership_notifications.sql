-- ============================================
-- MEMBERSHIP EXPIRATION NOTIFICATION SYSTEM
-- ============================================

-- 1. Create notifications table for membership expiration (if not exists)
-- Note: This assumes you already have a notifications table
-- If not, uncomment below:

/*
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications" 
ON notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON notifications FOR UPDATE 
USING (auth.uid() = user_id);
*/

-- 2. Create function to check and notify about membership expiration
CREATE OR REPLACE FUNCTION check_membership_expiration()
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    membership_status TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    days_until_expiry INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.user_id,
        COALESCE(p.username, p.email) as username,
        m.status as membership_status,
        CASE 
            WHEN m.last_paid_at IS NOT NULL THEN m.last_paid_at + INTERVAL '30 days'
            ELSE m.started_at + INTERVAL '30 days'
        END as expires_at,
        EXTRACT(DAY FROM 
            CASE 
                WHEN m.last_paid_at IS NOT NULL THEN m.last_paid_at + INTERVAL '30 days'
                ELSE m.started_at + INTERVAL '30 days'
            END - NOW()
        )::INTEGER as days_until_expiry
    FROM memberships m
    JOIN profiles p ON m.user_id = p.id
    WHERE m.status = 'active'
    AND (
        -- Expires in 7 days or less
        CASE 
            WHEN m.last_paid_at IS NOT NULL THEN m.last_paid_at + INTERVAL '30 days'
            ELSE m.started_at + INTERVAL '30 days'
        END <= NOW() + INTERVAL '7 days'
    )
    AND NOT EXISTS (
        -- Don't notify if already notified in last 3 days
        SELECT 1 FROM notifications n 
        WHERE n.user_id = m.user_id 
        AND n.type = 'membership_expiring'
        AND n.created_at > NOW() - INTERVAL '3 days'
    )
    AND NOT EXISTS (
        -- Check if user is admin (admins are exempt)
        SELECT 1 FROM admin_users au 
        WHERE au.user_id = m.user_id
    );
END;
$$ LANGUAGE plpgsql;

-- 3. Create function to send membership expiration notifications
CREATE OR REPLACE FUNCTION send_membership_expiration_notifications()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER := 0;
    rec RECORD;
BEGIN
    -- Get expiring memberships
    FOR rec IN 
        SELECT * FROM check_membership_expiration()
    LOOP
        -- Insert notification
        INSERT INTO notifications (user_id, type, message, created_at)
        VALUES (
            rec.user_id,
            'membership_expiring',
            CASE 
                WHEN rec.days_until_expiry <= 0 THEN 
                    '⏰ Your YASA Tasker membership has EXPIRED. Renew now to continue accessing the platform. Your access will be denied until payment is received.'
                WHEN rec.days_until_expiry = 1 THEN 
                    '⏰ Your YASA Tasker membership expires TOMORROW. Renew now to avoid losing access to the platform.'
                ELSE 
                    '⏰ Your YASA Tasker membership expires in ' || rec.days_until_expiry || ' days. Renew now to maintain uninterrupted access.'
                END,
            NOW()
        );
        
        expired_count := expired_count + 1;
    END LOOP;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to auto-expire memberships and deny access
CREATE OR REPLACE FUNCTION process_expired_memberships()
RETURNS INTEGER AS $$
DECLARE
    processed_count INTEGER := 0;
    rec RECORD;
BEGIN
    -- Find memberships that have expired (30+ days since last payment)
    FOR rec IN 
        SELECT 
            m.user_id,
            COALESCE(p.username, p.email) as username
        FROM memberships m
        JOIN profiles p ON m.user_id = p.id
        WHERE m.status = 'active'
        AND (
            CASE 
                WHEN m.last_paid_at IS NOT NULL THEN m.last_paid_at + INTERVAL '30 days'
                ELSE m.started_at + INTERVAL '30 days'
            END < NOW()
        )
        AND NOT EXISTS (
            -- Don't expire admins
            SELECT 1 FROM admin_users au 
            WHERE au.user_id = m.user_id
        )
    LOOP
        -- Update membership to expired
        UPDATE memberships 
        SET status = 'expired', 
            expired_at = NOW()
        WHERE user_id = rec.user_id;
        
        -- Send expiration notification
        INSERT INTO notifications (user_id, type, message, created_at)
        VALUES (
            rec.user_id,
            'membership_expired',
            '🚫 Your YASA Tasker membership has expired. Your access to the platform is now DENIED. Please go to the Membership page and pay 1 Pi to renew your membership and restore access.',
            NOW()
        );
        
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Create a cron job extension setup (manual setup required)
-- You need to enable pg_cron extension in Supabase and schedule these functions

-- Example cron setup (run these in Supabase SQL Editor after enabling pg_cron):
/*
-- Run every day at midnight to check for expiring memberships
SELECT cron.schedule('membership-expiration-check', '0 0 * * *', 'SELECT send_membership_expiration_notifications();');

-- Run every hour to process expired memberships and deny access
SELECT cron.schedule('membership-expiry-process', '0 * * * *', 'SELECT process_expired_memberships();');
*/

-- 6. Manual test functions
-- Test: Check who's expiring soon
-- SELECT * FROM check_membership_expiration();

-- Test: Send expiration notifications
-- SELECT send_membership_expiration_notifications();

-- Test: Process expired memberships
-- SELECT process_expired_memberships();

-- 7. View recent membership notifications
SELECT 
    n.created_at,
    n.user_id,
    p.username,
    n.type,
    n.message,
    n.read
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.type LIKE 'membership%'
ORDER BY n.created_at DESC
LIMIT 20;
