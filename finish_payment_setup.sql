-- Finish Payment Setup
-- Tables already exist, just add config

-- Create config table if not exists
CREATE TABLE IF NOT EXISTS platform_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert/Update your wallet address
-- REPLACE 'YOUR_WALLET_ADDRESS' with your real Pi wallet address
INSERT INTO platform_config (key, value, description)
VALUES (
    'platform_fee_wallet', 
    'YOUR_WALLET_ADDRESS', 
    'Platform fee recipient (5%)'
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

-- Insert fee percentage
INSERT INTO platform_config (key, value, description)
VALUES (
    'platform_fee_percent', 
    '5.00', 
    'Platform fee percentage'
)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Create policy (drop first if exists)
DROP POLICY IF EXISTS view_config ON platform_config;

CREATE POLICY view_config ON platform_config
    FOR SELECT TO authenticated, anon
    USING (true);

-- Verify setup
SELECT * FROM platform_config;
