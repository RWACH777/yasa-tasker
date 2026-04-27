-- ==========================================
-- CREATE TRANSACTIONS TABLE FOR PI PAYMENTS
-- ==========================================

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Transaction identifiers
    pi_transaction_id TEXT, -- Pi Network transaction ID
    
    -- Task relationship
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    
    -- Sender (Tasker/Payer)
    sender_uid TEXT NOT NULL,
    sender_username TEXT,
    sender_wallet_address TEXT,
    
    -- Receiver (Freelancer)
    receiver_uid TEXT NOT NULL,
    receiver_username TEXT,
    receiver_wallet_address TEXT,
    
    -- Platform fee recipient (temporary - your wallet)
    platform_fee_recipient TEXT,
    
    -- Amount details
    total_amount DECIMAL(20, 7) NOT NULL, -- Total Pi amount
    platform_fee_percent DECIMAL(5, 2) DEFAULT 5.00, -- 5% fee
    platform_fee_amount DECIMAL(20, 7), -- Calculated fee
    net_amount DECIMAL(20, 7), -- Amount freelancer receives
    
    -- Currency
    currency VARCHAR(10) DEFAULT 'PI',
    
    -- Payment details
    payment_method VARCHAR(50) DEFAULT 'pi_network',
    payment_memo TEXT,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, success, failed, cancelled
    
    -- Pi SDK payment data
    pi_payment_id TEXT,
    pi_txid TEXT, -- Blockchain transaction ID
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_task_id ON transactions(task_id);
CREATE INDEX IF NOT EXISTS idx_transactions_sender_uid ON transactions(sender_uid);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_uid ON transactions(receiver_uid);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own transactions (as sender or receiver)
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT TO authenticated
    USING (
        sender_uid = auth.uid()::text OR 
        receiver_uid = auth.uid()::text
    );

-- Users can insert their own transactions
CREATE POLICY "Users can create transactions" ON transactions
    FOR INSERT TO authenticated
    WITH CHECK (sender_uid = auth.uid()::text);

-- Users can update their own transactions (for status updates)
CREATE POLICY "Users can update own transactions" ON transactions
    FOR UPDATE TO authenticated
    USING (sender_uid = auth.uid()::text)
    WITH CHECK (sender_uid = auth.uid()::text);

-- ==========================================
-- CREATE PLATFORM_FEE_WALLET CONFIG TABLE
-- ==========================================

-- Store platform fee recipient wallet (your personal wallet)
CREATE TABLE IF NOT EXISTS platform_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default platform fee wallet (replace with your actual wallet)
INSERT INTO platform_config (key, value, description)
VALUES (
    'platform_fee_wallet', 
    'YOUR_PERSONAL_WALLET_ADDRESS_HERE', 
    'Platform fee recipient wallet address for 5% commission'
)
ON CONFLICT (key) DO NOTHING;

-- Insert platform fee percentage
INSERT INTO platform_config (key, value, description)
VALUES (
    'platform_fee_percent', 
    '5.00', 
    'Platform fee percentage (default 5%)'
)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS on config (admin only)
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view platform config" ON platform_config
    FOR SELECT TO authenticated, anon
    USING (true);

-- ==========================================
-- UPDATE TASKS TABLE - ADD PAYMENT TRACKING
-- ==========================================

-- Add payment status to tasks if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tasks' AND column_name = 'payment_status') THEN
        ALTER TABLE tasks ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tasks' AND column_name = 'transaction_id') THEN
        ALTER TABLE tasks ADD COLUMN transaction_id UUID REFERENCES transactions(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tasks' AND column_name = 'payment_completed_at') THEN
        ALTER TABLE tasks ADD COLUMN payment_completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- ==========================================
-- CREATE TRANSACTION STATUS HISTORY TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS transaction_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_txn_history_transaction_id ON transaction_status_history(transaction_id);

ALTER TABLE transaction_status_history ENABLE ROW LEVEL SECURITY;

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
-- VERIFY SETUP
-- ==========================================

SELECT 'Tables created successfully' as status;

-- Show all tables related to payments
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('transactions', 'platform_config', 'transaction_status_history')
ORDER BY table_name, ordinal_position;
