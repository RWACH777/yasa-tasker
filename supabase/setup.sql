-- Supabase Setup for Yasa Tasker Pi Testnet
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE TABLES
-- ============================================

-- Users table (if not exists)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Payments table for tracking transactions
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id TEXT NOT NULL,
    amount DECIMAL(10, 8) NOT NULL,
    receiver TEXT NOT NULL,
    sender TEXT,
    status TEXT DEFAULT 'pending',
    txid TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Unique receivers table for Testnet requirement tracking
CREATE TABLE IF NOT EXISTS public.unique_receivers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    first_payment_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_payment_at TIMESTAMP WITH TIME ZONE,
    total_payments INTEGER DEFAULT 1
);

-- ============================================
-- 2. ENABLE RLS
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unique_receivers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. CREATE RLS POLICIES
-- ============================================

-- Users table policies
CREATE POLICY "Allow all users to select" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Allow all users to insert" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to update their own data" ON public.users
    FOR UPDATE USING (true);

-- Payments table policies
CREATE POLICY "Allow all users to select payments" ON public.payments
    FOR SELECT USING (true);

CREATE POLICY "Allow all users to insert payments" ON public.payments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all users to update payments" ON public.payments
    FOR UPDATE USING (true);

-- Unique receivers table policies
CREATE POLICY "Allow all users to select receivers" ON public.unique_receivers
    FOR SELECT USING (true);

CREATE POLICY "Allow all users to insert receivers" ON public.unique_receivers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all users to update receivers" ON public.unique_receivers
    FOR UPDATE USING (true);

-- ============================================
-- 4. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON public.payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_receiver ON public.payments(receiver);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_unique_receivers_wallet ON public.unique_receivers(wallet_address);

-- ============================================
-- 5. UPDATE PROFILES TABLE (if exists)
-- ============================================

-- Ensure profiles table has pi_uid column
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS pi_uid TEXT,
    ADD COLUMN IF NOT EXISTS username TEXT;

-- Create index on pi_uid for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_pi_uid ON public.profiles(pi_uid);

-- Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Allow all users to select profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Allow all users to insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to update profiles" ON public.profiles
    FOR UPDATE USING (true);

-- ============================================
-- 6. VERIFY SETUP
-- ============================================

SELECT 'Tables created successfully' as status;
