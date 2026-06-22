-- Add location fields to tasks table
-- Run this in Supabase SQL Editor

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS location_continent TEXT,
  ADD COLUMN IF NOT EXISTS location_country TEXT,
  ADD COLUMN IF NOT EXISTS location_region TEXT,
  ADD COLUMN IF NOT EXISTS location_city TEXT,
  ADD COLUMN IF NOT EXISTS location_suburb TEXT;
