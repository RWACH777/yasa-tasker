-- Simplified Membership System SQL
-- Run this in Supabase SQL Editor

-- ============================================
-- PART 1: Add columns to existing tables
-- ============================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_memo TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_txid TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS freelancer_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS resolved_by UUID;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pi_username TEXT;

-- ============================================
-- PART 2: Create memberships table
-- ============================================

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

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Simple RLS: users can only see their own
CREATE POLICY "memberships_select" ON memberships FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "memberships_update" ON memberships FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "memberships_insert" ON memberships FOR INSERT WITH CHECK (true);

-- ============================================
-- PART 3: Create payout_disputes table
-- ============================================

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

ALTER TABLE payout_disputes ENABLE ROW LEVEL SECURITY;

-- Simple RLS for disputes
CREATE POLICY "disputes_select" ON payout_disputes FOR SELECT USING (true);
CREATE POLICY "disputes_insert" ON payout_disputes FOR INSERT WITH CHECK (true);
CREATE POLICY "disputes_update" ON payout_disputes FOR UPDATE USING (true);

-- ============================================
-- PART 4: Create payment_errors table
-- ============================================

CREATE TABLE IF NOT EXISTS payment_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id TEXT,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE payment_errors ENABLE ROW LEVEL SECURITY;

-- Allow all access to payment_errors (admin only via app logic)
CREATE POLICY "errors_all" ON payment_errors FOR ALL USING (true);

-- ============================================
-- PART 5: Create admin_users table
-- ============================================

CREATE TABLE IF NOT EXISTS admin_users (
    user_id UUID PRIMARY KEY,
    username TEXT,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Allow all access to admin_users (checked in app code)
CREATE POLICY "admin_all" ON admin_users FOR ALL USING (true);

-- Insert admin records
INSERT INTO admin_users (user_id, username, role, created_at)
VALUES ('fc0bbbbb-e8d0-411c-8abd-556a66152ba3', 'yair777', 'admin', NOW())
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', username = 'yair777';

INSERT INTO admin_users (user_id, username, role, created_at)
VALUES ('43f3c79f-ed30-4808-8273-41e382039f3a', 'eshpaul', 'admin', NOW())
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', username = 'eshpaul';

-- ============================================
-- PART 6: Create indexes
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);
