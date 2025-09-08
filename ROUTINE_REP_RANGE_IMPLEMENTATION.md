# Routine Exercise Rep Range Support Implementation

This document outlines the changes made to add support for rep ranges and enhanced routine editing features.

## Database Migration Required

**File**: `/database_migrations/add_rep_range_support_to_routine_exercises.sql`

Run this migration to add the required columns to your `routine_exercises` table:

```sql
-- Add support for rep ranges and enhanced weight tracking in routine_exercises
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
```

## Code Changes Made

### 1. Type Definitions Updated
- `Exercise` interface updated to allow `null` values for `defaultRepsMin` and `defaultRepsMax`
- Proper typing for rep range support

### 2. Data Loading (`loadRoutineData`)
- Enhanced to handle migration from old schema (`default_reps`) to new schema (`default_reps_min`, `default_reps_max`)
- Uses nullish coalescing (`??`) for proper fallback handling
- Correctly determines rep mode based on presence of both min and max values

### 3. Data Saving (`updateRoutine` & `createNewRoutine`)
- Properly handles null values when converting string inputs to numbers
- Saves `default_reps_min` and `default_reps_max` to database
- Maintains backward compatibility with existing data

### 4. UI Display Updates
- Reorder exercise stats now correctly shows:
  - `"8-12 reps"` for range mode (when both min and max exist)
  - `"10 reps"` for single mode (when only min exists)
  - `"- reps"` when no rep data is available

### 5. Rep Mode Handling
- Single to Range conversion: Uses current reps as minimum, sets maximum to null
- Range to Single conversion: Uses minimum as single value, clears range values
- Proper state management during mode transitions

## Features Supported

### ✅ Single Rep Mode
- Users can set a specific number of reps (e.g., 10 reps)
- Stored in `default_reps_min` column
- `default_reps_max` remains null

### ✅ Rep Range Mode  
- Users can set a range of reps (e.g., 8-12 reps)
- Minimum stored in `default_reps_min`
- Maximum stored in `default_reps_max`

### ✅ Rep Mode Switching
- Seamless conversion between single and range modes
- Preserves existing data when switching modes
- No unwanted default values inserted

### ✅ Database Compatibility
- Backward compatible with existing routines using old `default_reps` column
- Migration handles existing data gracefully
- New routines use the enhanced schema

### ✅ UI Consistency
- Proper display of rep information in reorder list
- Consistent styling matching newWorkout.tsx
- RPE support maintained
- Weight unit support maintained

## Database Schema After Migration

```sql
routine_exercises:
- id (uuid, primary key)
- routine_id (uuid, foreign key)
- exercise_id (uuid, foreign key, nullable for custom exercises)  
- name (text)
- order_position (integer)
- total_sets (integer, default 3)
- default_weight (numeric, nullable)
- default_reps (integer, nullable) -- Legacy, kept for compatibility
- default_reps_min (integer, nullable) -- New: minimum reps or single rep count
- default_reps_max (integer, nullable) -- New: maximum reps for range mode
- default_rpe (integer, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

## Usage Patterns

### Creating New Routines
- New exercises start with empty values (no unwanted defaults)
- Users can choose between single and range rep modes
- Values are only set based on user input

### Editing Existing Routines  
- Legacy routines automatically converted to new format
- `default_reps` values migrated to `default_reps_min`
- Rep mode determined based on presence of range values

### Rep Mode Conversion
- **Single → Range**: Current reps becomes minimum, maximum starts empty
- **Range → Single**: Minimum becomes single value, maximum cleared
- No fallback to unwanted default values

This implementation provides full support for the enhanced routine editing features while maintaining backward compatibility with existing data.
