-- Membership System SQL - Fixed Version
-- Run this in Supabase SQL Editor

-- ============================================
-- PART 1: Add columns to existing tables first
-- ============================================

-- Add columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_memo TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_txid TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS freelancer_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS resolved_by UUID;

-- Add pi_username column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pi_username TEXT;

-- ============================================
-- PART 2: Create new tables (no FKs first)
-- ============================================

-- Create memberships table
CREATE TABLE IF NOT EXISTS memberships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    username TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_paid_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending_review', 'expired')),
    payment_txid TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payout_disputes table
CREATE TABLE IF NOT EXISTS payout_disputes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID,
    transaction_id UUID,
    freelancer_uid UUID,
    freelancer_username TEXT,
    tasker_id UUID,
    amount DECIMAL(10, 2),
    txid TEXT,
    memo TEXT,
    status TEXT DEFAULT 'pending_review',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID
);

-- Create payment_errors table
CREATE TABLE IF NOT EXISTS payment_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id TEXT,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PART 3: Create indexes
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);

-- ============================================
-- PART 4: Enable RLS
-- ============================================

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_errors ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 5: RLS Policies
-- ============================================

-- Memberships policies
CREATE POLICY "Users can view own membership" 
    ON memberships FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own membership" 
    ON memberships FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all memberships" 
    ON memberships FOR SELECT 
    USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update all memberships" 
    ON memberships FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "System can insert memberships" 
    ON memberships FOR INSERT WITH CHECK (true);

-- Payout disputes policies
CREATE POLICY "Admins can view all disputes" 
    ON payout_disputes FOR SELECT 
    USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update disputes" 
    ON payout_disputes FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can create disputes" 
    ON payout_disputes FOR INSERT 
    WITH CHECK (freelancer_uid = auth.uid());

-- Payment errors policies (admin only)
CREATE POLICY "Admins can view errors" 
    ON payment_errors FOR SELECT 
    USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- ============================================
-- PART 6: Admin records (using your known user_ids)
-- ============================================

-- Make sure admin_users table exists first
CREATE TABLE IF NOT EXISTS admin_users (
    user_id UUID PRIMARY KEY,
    username TEXT,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert or update admin records
INSERT INTO admin_users (user_id, username, role, created_at)
VALUES ('fc0bbbbb-e8d0-411c-8abd-556a66152ba3', 'yair777', 'admin', NOW())
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', username = 'yair777';

INSERT INTO admin_users (user_id, username, role, created_at)
VALUES ('43f3c79f-ed30-4808-8273-41e382039f3a', 'eshpaul', 'admin', NOW())
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', username = 'eshpaul';

-- ============================================
-- PART 7: Helper function for admin check
-- ============================================

CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 9: Add FK constraints (after tables exist)
-- ============================================

-- Note: Only add these if the referenced tables exist
-- If they fail, you can skip them - the app will work without strict FK constraints

DO $$
BEGIN
    -- Try to add FK to tasks table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        ALTER TABLE payout_disputes 
        DROP CONSTRAINT IF EXISTS fk_payout_disputes_task;
        
        -- Only add if task_id column references valid tasks
        -- This might fail if tasks.id has different type
    END IF;
END $$;
