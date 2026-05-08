-- Membership System SQL

-- 1. Create memberships table
CREATE TABLE IF NOT EXISTS memberships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_paid_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending_review', 'expired')),
    payment_txid TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);

-- Create index on status for quick filtering
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);

-- Enable RLS
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for memberships
CREATE POLICY "Users can view own membership" 
    ON memberships FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own membership" 
    ON memberships FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all memberships" 
    ON memberships FOR SELECT 
    USING (
        EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
    );

CREATE POLICY "Admins can update all memberships" 
    ON memberships FOR UPDATE 
    USING (
        EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
    );

CREATE POLICY "System can insert memberships" 
    ON memberships FOR INSERT 
    WITH CHECK (true);

-- 2. Add payment_memo column to tasks table if not exists
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_memo TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_txid TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS freelancer_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS resolved_by UUID;

-- 3. Create payout_disputes table if not exists
CREATE TABLE IF NOT EXISTS payout_disputes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    freelancer_uid UUID REFERENCES users(id),
    freelancer_username TEXT,
    tasker_id UUID REFERENCES users(id),
    amount DECIMAL(10, 2),
    txid TEXT,
    memo TEXT,
    status TEXT DEFAULT 'pending_review',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id)
);

-- Enable RLS on payout_disputes
ALTER TABLE payout_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all disputes" 
    ON payout_disputes FOR SELECT 
    USING (
        EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
    );

CREATE POLICY "Admins can update disputes" 
    ON payout_disputes FOR UPDATE 
    USING (
        EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create disputes" 
    ON payout_disputes FOR INSERT 
    WITH CHECK (freelancer_uid = auth.uid());

-- 4. Create payment_errors table for logging
CREATE TABLE IF NOT EXISTS payment_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id TEXT,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Add pi_username column to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pi_username TEXT;

-- 6. Ensure admin_users has correct entries
-- Your user_id: fc0bbbbb-e8d0-411c-8abd-556a66152ba3
-- Team member user_id: 43f3c79f-ed30-4808-8273-41e382039f3a

-- Insert or update your admin record
INSERT INTO admin_users (user_id, username, role, created_at)
VALUES ('fc0bbbbb-e8d0-411c-8abd-556a66152ba3', 'yair777', 'admin', NOW())
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', username = 'yair777';

-- Insert or update team member admin record  
INSERT INTO admin_users (user_id, username, role, created_at)
VALUES ('43f3c79f-ed30-4808-8273-41e382039f3a', 'team_admin', 'admin', NOW())
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', username = 'team_admin';

-- 7. Create function to auto-create membership on user signup
CREATE OR REPLACE FUNCTION create_membership_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO memberships (user_id, username, started_at, status)
    VALUES (NEW.id, NEW.username, NOW(), 'active')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists and recreate trigger
DROP TRIGGER IF EXISTS on_user_signup_membership ON users;
CREATE TRIGGER on_user_signup_membership
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_membership_on_signup();

-- 8. Create function to check if user is admin (for exemptions)
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql;
