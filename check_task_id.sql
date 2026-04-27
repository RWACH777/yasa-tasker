-- Check if task_id column exists and if it's required
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND table_schema = 'public';

-- Also check if there are any NOT NULL constraints causing the issue
