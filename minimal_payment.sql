-- MINIMAL PAYMENT SETUP
-- Run each block separately if needed

-- Block 1: Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_uid TEXT NOT NULL,
    receiver_uid TEXT NOT NULL,
    total_amount DECIMAL(20, 7) NOT NULL,
    platform_fee_amount DECIMAL(20, 7),
    net_amount DECIMAL(20, 7),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Block 2: Config table  
CREATE TABLE IF NOT EXISTS platform_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT
);

-- Block 3: Insert your wallet (REPLACE THE ADDRESS)
INSERT INTO platform_config (key, value)
VALUES ('platform_fee_wallet', 'YOUR_WALLET_HERE')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Block 4: Verify
SELECT * FROM platform_config;
