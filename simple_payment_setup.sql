-- ==========================================
-- SIMPLE PAYMENT SETUP - Run this entire file
-- ==========================================

-- 1. Create transactions table
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

-- 2. Create indexes
CREATE INDEX idx_transactions_task_id ON transactions(task_id);
CREATE INDEX idx_transactions_sender_uid ON transactions(sender_uid);
CREATE INDEX idx_transactions_receiver_uid ON transactions(receiver_uid);
CREATE INDEX idx_transactions_status ON transactions(status);

-- 3. Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 4. Create policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "view_transactions" ON transactions;
DROP POLICY IF EXISTS "insert_transactions" ON transactions;

CREATE POLICY "view_transactions" ON transactions
    FOR SELECT TO authenticated
    USING (sender_uid = auth.uid()::text OR receiver_uid = auth.uid()::text);

CREATE POLICY "insert_transactions" ON transactions
    FOR INSERT TO authenticated
    WITH CHECK (sender_uid = auth.uid()::text);

-- 5. Create platform config table
CREATE TABLE IF NOT EXISTS platform_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Insert your fee wallet (REPLACE THIS ADDRESS)
INSERT INTO platform_config (key, value, description)
VALUES (
    'platform_fee_wallet', 
    'YOUR_PERSONAL_WALLET_ADDRESS_HERE', 
    'Platform fee recipient wallet address for 5% commission'
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

-- 7. Insert fee percentage
INSERT INTO platform_config (key, value, description)
VALUES (
    'platform_fee_percent', 
    '5.00', 
    'Platform fee percentage (default 5%)'
)
ON CONFLICT (key) DO NOTHING;

-- 8. Enable RLS on config
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_config" ON platform_config;

CREATE POLICY "view_config" ON platform_config
    FOR SELECT TO authenticated, anon
    USING (true);

-- 9. Create transaction history table
CREATE TABLE IF NOT EXISTS transaction_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_txn_history_transaction_id ON transaction_status_history(transaction_id);

-- 10. Enable RLS on history
ALTER TABLE transaction_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_history" ON transaction_status_history;

CREATE POLICY "view_history" ON transaction_status_history
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
SELECT 'Setup complete!' as status;
SELECT * FROM platform_config;
