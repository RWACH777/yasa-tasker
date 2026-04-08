-- Add wallet_address column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS wallet_address text NULL;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';
