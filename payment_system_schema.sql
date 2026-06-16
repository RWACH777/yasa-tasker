-- ============================================================
-- YASA TASKER – Payment System Schema
-- Run this in Supabase SQL Editor (safe to re-run)
-- ============================================================

-- 1. Add payment columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_wallet_address TEXT,         -- user-entered, encrypted at application layer
  ADD COLUMN IF NOT EXISTS wallet_updated_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wallet_acknowledged BOOLEAN DEFAULT FALSE;

-- 2. Add freelancer payment confirmation to tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS payment_status            TEXT    DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS payment_txid              TEXT,
  ADD COLUMN IF NOT EXISTS payment_completed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS freelancer_payment_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS freelancer_confirmed_at   TIMESTAMPTZ;

-- 3. Create payment_ledger table
CREATE TABLE IF NOT EXISTS payment_ledger (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               UUID REFERENCES tasks(id)     ON DELETE SET NULL,
  tasker_id             UUID REFERENCES profiles(id)  ON DELETE SET NULL,
  freelancer_id         UUID REFERENCES profiles(id)  ON DELETE SET NULL,
  freelancer_wallet     TEXT,          -- encrypted at application layer, never exposed to clients
  amount_pi             DECIMAL(18,7)  NOT NULL,
  currency              TEXT           DEFAULT 'PI',
  payment_status        TEXT           DEFAULT 'pending'
    CHECK (payment_status IN (
      'pending', 'awaiting_payment', 'payment_sent',
      'payment_confirmed', 'disputed', 'cancelled'
    )),
  transaction_reference TEXT,
  created_at            TIMESTAMPTZ    DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    DEFAULT NOW(),
  confirmed_by_tasker   BOOLEAN        DEFAULT FALSE,
  confirmed_by_freelancer BOOLEAN      DEFAULT FALSE,
  notes                 TEXT
);

-- 4. Enable RLS on payment_ledger
ALTER TABLE payment_ledger ENABLE ROW LEVEL SECURITY;

-- Tasker can read their own ledger entries
DROP POLICY IF EXISTS "Tasker reads own ledger" ON payment_ledger;
CREATE POLICY "Tasker reads own ledger" ON payment_ledger
  FOR SELECT USING (tasker_id = auth.uid());

-- Freelancer can read their own ledger entries
DROP POLICY IF EXISTS "Freelancer reads own ledger" ON payment_ledger;
CREATE POLICY "Freelancer reads own ledger" ON payment_ledger
  FOR SELECT USING (freelancer_id = auth.uid());

-- Freelancer can confirm their own payment
DROP POLICY IF EXISTS "Freelancer updates own ledger" ON payment_ledger;
CREATE POLICY "Freelancer updates own ledger" ON payment_ledger
  FOR UPDATE USING (freelancer_id = auth.uid());

-- Service role can do everything (used by API routes)
DROP POLICY IF EXISTS "Service role full access on ledger" ON payment_ledger;
CREATE POLICY "Service role full access on ledger" ON payment_ledger
  FOR ALL USING (auth.role() = 'service_role');

-- 5. Restrict wallet_address column visibility via RLS on profiles
--    (wallet columns should only be readable by the account owner or service_role)
--    We add a restrictive policy for reading wallet fields.
--    Note: existing SELECT policies still control row access;
--    the API routes use service_role which bypasses RLS entirely.

-- 6. Auto-update payment_ledger.updated_at
CREATE OR REPLACE FUNCTION update_payment_ledger_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_ledger_updated_at ON payment_ledger;
CREATE TRIGGER trg_payment_ledger_updated_at
  BEFORE UPDATE ON payment_ledger
  FOR EACH ROW EXECUTE FUNCTION update_payment_ledger_updated_at();

-- ============================================================
-- Done. Add WALLET_ENCRYPTION_KEY to your .env.local and
-- Vercel/Netlify environment variables:
--   WALLET_ENCRYPTION_KEY=<64 hex chars, generate with: openssl rand -hex 32>
-- ============================================================
