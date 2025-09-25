-- Add rep_mode column to routine_exercises table to explicitly track rep mode
-- This will make it clearer whether an exercise uses single reps or rep ranges

-- Add the rep_mode column
ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS rep_mode text CHECK (rep_mode IN ('single', 'range')) DEFAULT 'single';

-- Update existing records based on current data
-- If default_reps_max is not null, it's a range mode
-- Otherwise, it's single mode
UPDATE routine_exercises 
SET rep_mode = CASE 
    WHEN default_reps_max IS NOT NULL AND default_reps_min IS NOT NULL THEN 'range'
    ELSE 'single'
END
WHERE rep_mode IS NULL OR rep_mode = 'single';

-- Add comment for clarity
COMMENT ON COLUMN routine_exercises.rep_mode IS 'Specifies whether the exercise uses single rep count (single) or rep range (range)';

-- Update the updated_at timestamp for modified records
UPDATE routine_exercises SET updated_at = NOW() WHERE rep_mode IS NOT NULL;
