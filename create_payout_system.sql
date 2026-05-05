-- ==========================================
-- CREATE PAYOUT REQUESTS SYSTEM
-- ==========================================

-- Create payout_requests table
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Task relationship
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    
    -- Freelancer (recipient)
    freelancer_uid TEXT NOT NULL,
    freelancer_username TEXT,
    freelancer_wallet_address TEXT,
    
    -- Amount details
    amount DECIMAL(20, 7) NOT NULL, -- Net amount to pay (95% of task amount)
    fee_amount DECIMAL(20, 7) DEFAULT 0, -- 5% fee already deducted
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, cancelled
    
    -- Admin tracking
    processed_by TEXT, -- Admin UID who processed the payout
    processed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT, -- Admin notes about the payout
    
    -- Pi transaction details (when completed)
    pi_txid TEXT, -- Pi Network transaction ID from admin
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_task_id ON payout_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_freelancer_uid ON payout_requests(freelancer_uid);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created_at ON payout_requests(created_at);

-- Enable RLS
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Freelancers can view their own payout requests
CREATE POLICY "Freelancers can view own payout requests" ON payout_requests
    FOR SELECT TO authenticated
    USING (freelancer_uid = auth.uid()::text);

-- Freelancers can create their own payout requests
CREATE POLICY "Freelancers can create payout requests" ON payout_requests
    FOR INSERT TO authenticated
    WITH CHECK (freelancer_uid = auth.uid()::text);

-- Only admin can update payout status (we'll handle admin check in application layer)
-- For now, allow updates to own records (freelancer can only update pending ones)
CREATE POLICY "Freelancers can update own pending requests" ON payout_requests
    FOR UPDATE TO authenticated
    USING (freelancer_uid = auth.uid()::text AND status = 'pending')
    WITH CHECK (freelancer_uid = auth.uid()::text);

-- ==========================================
-- CREATE ADMIN USERS TABLE
-- ==========================================

-- Track admin users
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT UNIQUE NOT NULL,
    username TEXT,
    email TEXT,
    role VARCHAR(50) DEFAULT 'admin', -- admin, super_admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view admin list
CREATE POLICY "Admins can view admin list" ON admin_users
    FOR SELECT TO authenticated
    USING (user_id = auth.uid()::text);

-- ==========================================
-- ADD FUNCTIONS FOR CHECKING ADMIN STATUS
-- ==========================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users 
        WHERE user_id = user_uuid 
        AND (role = 'admin' OR role = 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- UPDATE RLS FOR ADMIN ACCESS
-- ==========================================

-- Allow admins to view all payout requests
DROP POLICY IF EXISTS "Admin can view all payout requests" ON payout_requests;

CREATE POLICY "Admin can view all payout requests" ON payout_requests
    FOR SELECT TO authenticated
    USING (is_admin(auth.uid()::text));

-- Allow admins to update payout requests
DROP POLICY IF EXISTS "Admin can update payout requests" ON payout_requests;

CREATE POLICY "Admin can update payout requests" ON payout_requests
    FOR UPDATE TO authenticated
    USING (is_admin(auth.uid()::text))
    WITH CHECK (is_admin(auth.uid()::text));

-- ==========================================
-- ADD TRIGGER FOR UPDATED_AT
-- ==========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for payout_requests
DROP TRIGGER IF EXISTS update_payout_requests_updated_at ON payout_requests;
CREATE TRIGGER update_payout_requests_updated_at
    BEFORE UPDATE ON payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for admin_users
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- VERIFY SETUP
-- ==========================================

SELECT 'Payout system tables created successfully' as status;

-- Show all payout-related tables
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('payout_requests', 'admin_users')
ORDER BY table_name, ordinal_position;
