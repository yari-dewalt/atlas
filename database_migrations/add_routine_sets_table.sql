-- Migration: Add support for individual routine set configurations
-- This allows each set in a routine exercise to have its own weight, reps, and RPE values

-- Create the routine_sets table
CREATE TABLE public.routine_sets (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  routine_exercise_id UUID NOT NULL,
  set_number INTEGER NOT NULL,
  weight NUMERIC NULL,
  reps INTEGER NULL,
  reps_min INTEGER NULL,
  reps_max INTEGER NULL,
  rpe INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  CONSTRAINT routine_sets_pkey PRIMARY KEY (id),
  CONSTRAINT routine_sets_routine_exercise_id_fkey FOREIGN KEY (routine_exercise_id) REFERENCES routine_exercises (id) ON DELETE CASCADE,
  CONSTRAINT routine_sets_set_number_check CHECK (set_number > 0),
  CONSTRAINT routine_sets_reps_check CHECK (reps IS NULL OR reps > 0),
  CONSTRAINT routine_sets_reps_min_check CHECK (reps_min IS NULL OR reps_min > 0),
  CONSTRAINT routine_sets_reps_max_check CHECK (reps_max IS NULL OR reps_max > 0),
  CONSTRAINT routine_sets_rpe_check CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  CONSTRAINT routine_sets_rep_range_check CHECK (
    (reps_min IS NULL AND reps_max IS NULL) OR 
    (reps_min IS NOT NULL AND reps_max IS NOT NULL AND reps_max > reps_min)
  )
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS routine_sets_routine_exercise_id_idx ON public.routine_sets USING btree (routine_exercise_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS routine_sets_exercise_set_idx ON public.routine_sets USING btree (routine_exercise_id, set_number) TABLESPACE pg_default;

-- Create unique constraint to prevent duplicate set numbers for same exercise
CREATE UNIQUE INDEX routine_sets_unique_set_number_idx ON public.routine_sets (routine_exercise_id, set_number);

-- Create trigger for updated_at
CREATE TRIGGER update_routine_sets_updated_at 
BEFORE UPDATE ON routine_sets 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Migration: Populate routine_sets table from existing routine_exercises data
-- This preserves existing routines by creating sets based on total_sets and default values
INSERT INTO public.routine_sets (routine_exercise_id, set_number, weight, reps, reps_min, reps_max, rpe)
SELECT 
  re.id as routine_exercise_id,
  generate_series(1, GREATEST(re.total_sets, 1)) as set_number,
  re.default_weight as weight,
  CASE 
    WHEN re.rep_mode = 'single' THEN COALESCE(re.default_reps_min, re.default_reps)
    ELSE NULL 
  END as reps,
  CASE 
    WHEN re.rep_mode = 'range' THEN COALESCE(re.default_reps_min, re.default_reps)
    ELSE NULL 
  END as reps_min,
  CASE 
    WHEN re.rep_mode = 'range' THEN re.default_reps_max
    ELSE NULL 
  END as reps_max,
  re.default_rpe as rpe
FROM routine_exercises re
WHERE re.total_sets > 0;

-- Optional: Add comment for documentation
COMMENT ON TABLE public.routine_sets IS 'Stores individual set configurations for routine exercises, allowing each set to have unique weight, reps, and RPE values';
COMMENT ON COLUMN public.routine_sets.set_number IS 'The position/number of this set within the exercise (1-based)';
COMMENT ON COLUMN public.routine_sets.reps IS 'Single rep count (used when rep_mode is single)';
COMMENT ON COLUMN public.routine_sets.reps_min IS 'Minimum reps in range (used when rep_mode is range)';
COMMENT ON COLUMN public.routine_sets.reps_max IS 'Maximum reps in range (used when rep_mode is range)';
