-- Test script to verify rep_mode functionality
-- Run this in your Supabase SQL editor to test the new rep_mode column

-- 1. Check that the rep_mode column exists and has the correct constraints
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'routine_exercises' AND column_name = 'rep_mode';

-- 2. Check existing data to see if rep_mode was set correctly
SELECT id, name, default_reps, default_reps_min, default_reps_max, rep_mode
FROM routine_exercises 
LIMIT 10;

-- 3. Test inserting a new routine exercise with single rep mode
-- (This would be done by your app, but you can test manually)
-- INSERT INTO routine_exercises (routine_id, name, order_position, total_sets, default_reps_min, rep_mode)
-- VALUES (1, 'Test Exercise Single', 1, 3, 10, 'single');

-- 4. Test inserting a new routine exercise with range rep mode
-- INSERT INTO routine_exercises (routine_id, name, order_position, total_sets, default_reps_min, default_reps_max, rep_mode)
-- VALUES (1, 'Test Exercise Range', 2, 3, 8, 12, 'range');

-- 5. Verify constraint works (this should fail)
-- INSERT INTO routine_exercises (routine_id, name, order_position, total_sets, rep_mode)
-- VALUES (1, 'Test Invalid Mode', 3, 3, 'invalid');

SELECT 'rep_mode column setup complete!' as status;
