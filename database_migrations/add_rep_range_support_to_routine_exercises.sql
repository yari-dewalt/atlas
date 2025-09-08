-- Update routine_exercises table to remove default values and prepare for rep ranges
-- This migration removes default values and ensures proper column setup

-- Remove default values from columns
ALTER TABLE routine_exercises 
ALTER COLUMN total_sets DROP DEFAULT,
ALTER COLUMN default_weight DROP DEFAULT,
ALTER COLUMN default_reps DROP DEFAULT,
ALTER COLUMN default_rpe DROP DEFAULT;

-- Add rep range support columns (if they don't exist)
ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS default_reps_min integer NULL,
ADD COLUMN IF NOT EXISTS default_reps_max integer NULL;

-- Update existing data: convert single default_reps to default_reps_min
UPDATE routine_exercises 
SET default_reps_min = default_reps 
WHERE default_reps IS NOT NULL AND default_reps_min IS NULL;

-- Set default_reps to NULL since we now use the range columns
UPDATE routine_exercises 
SET default_reps = NULL;

-- Add comments for clarity
COMMENT ON COLUMN routine_exercises.total_sets IS 'Number of sets for this exercise in the routine';
COMMENT ON COLUMN routine_exercises.default_weight IS 'Default weight for exercise sets (no default value)';
COMMENT ON COLUMN routine_exercises.default_reps IS 'Legacy column - use default_reps_min and default_reps_max for new records';
COMMENT ON COLUMN routine_exercises.default_rpe IS 'Default RPE (Rate of Perceived Exertion) for exercise sets (no default value)';
COMMENT ON COLUMN routine_exercises.default_reps_min IS 'Minimum reps for rep range mode, or single rep count for single mode';
COMMENT ON COLUMN routine_exercises.default_reps_max IS 'Maximum reps for rep range mode, NULL for single mode';

-- Update the updated_at timestamp for modified records
UPDATE routine_exercises SET updated_at = NOW() WHERE default_reps_min IS NOT NULL;
