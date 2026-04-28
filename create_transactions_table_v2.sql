-- ==========================================
-- SAFE SQL - Run each section separately
-- ==========================================

-- ==========================================
-- SECTION 1: Create transactions table
-- ==========================================

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pi_transaction_id TEXT,
    task_id UUID,
    sender_uid TEXT NOT NULL,
    sender_username TEXT,
    sender_wallet_address TEXT,
    receiver_uid TEXT NOT NULL,
    receiver_username TEXT,
    receiver_wallet_address TEXT,
    platform_fee_recipient TEXT,
    total_amount DECIMAL(20, 7) NOT NULL,
    platform_fee_percent DECIMAL(5, 2) DEFAULT 5.00,
    platform_fee_amount DECIMAL(20, 7),
    net_amount DECIMAL(20, 7),
    currency VARCHAR(10) DEFAULT 'PI',
    payment_method VARCHAR(50) DEFAULT 'pi_network',
    payment_memo TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    pi_payment_id TEXT,
    pi_txid TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_task_id ON transactions(task_id);
CREATE INDEX IF NOT EXISTS idx_transactions_sender_uid ON transactions(sender_uid);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_uid ON transactions(receiver_uid);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SECTION 2: Drop existing policies (safe)
-- ==========================================

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can create transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;

-- ==========================================
-- SECTION 3: Create RLS policies
-- ==========================================

CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT TO authenticated
    USING (sender_uid = auth.uid()::text OR receiver_uid = auth.uid()::text);

CREATE POLICY "Users can create transactions" ON transactions
    FOR INSERT TO authenticated
    WITH CHECK (sender_uid = auth.uid()::text);

-- ==========================================
-- SECTION 4: Create platform config table
-- ==========================================

CREATE TABLE IF NOT EXISTS platform_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert your wallet (REPLACE with your actual address)
INSERT INTO platform_config (key, value, description)
VALUES (
    'platform_fee_wallet', 
    'YOUR_PERSONAL_WALLET_ADDRESS_HERE', 
    'Platform fee recipient wallet address for 5% commission'
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

-- Insert fee percentage
INSERT INTO platform_config (key, value, description)
VALUES (
    'platform_fee_percent', 
    '5.00', 
    'Platform fee percentage (default 5%)'
)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS on config
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view platform config" ON platform_config;

CREATE POLICY "Anyone can view platform config" ON platform_config
    FOR SELECT TO authenticated, anon
    USING (true);

-- ==========================================
-- SECTION 5: Update tasks table (optional - run if you have tasks table)
-- ==========================================

DO $$ 
BEGIN
    -- Check if tasks table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    
        -- Add payment_status column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'tasks' AND column_name = 'payment_status') THEN
            ALTER TABLE tasks ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
        END IF;
        
        -- Add transaction_id column (as plain UUID first)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'tasks' AND column_name = 'transaction_id') THEN
            ALTER TABLE tasks ADD COLUMN transaction_id UUID;
        END IF;
        
        -- Add payment_completed_at column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'tasks' AND column_name = 'payment_completed_at') THEN
            ALTER TABLE tasks ADD COLUMN payment_completed_at TIMESTAMP WITH TIME ZONE;
        END IF;
        
    END IF;
END $$;

-- ==========================================
-- SECTION 6: Create transaction status history table
-- ==========================================

CREATE TABLE IF NOT EXISTS transaction_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_txn_history_transaction_id ON transaction_status_history(transaction_id);

-- Enable RLS
ALTER TABLE transaction_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view transaction history" ON transaction_status_history;

CREATE POLICY "Users can view transaction history" ON transaction_status_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM transactions t 
            WHERE t.id = transaction_id 
            AND (t.sender_uid = auth.uid()::text OR t.receiver_uid = auth.uid()::text)
        )
    );

-- ==========================================
-- SECTION 7: Verify setup
-- ==========================================

SELECT 'Tables created successfully' as status;

-- Show platform_config to verify wallet is set
SELECT * FROM platform_config;
