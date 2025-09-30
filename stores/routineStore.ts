import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useRoutineStore = create((set, get) => ({
  routines: [],
  loading: false,
  error: null,
  
  // Fetch all routines for the current user
  fetchRoutines: async (userId, showLoading = true) => {
    if (!userId) return;
    
    if (showLoading) {
      set({ loading: true, error: null });
    }
    
    try {
      const { data, error } = await supabase
        .from('routines')
.select(`
        id,
        name,
        user_id,
        original_creator_id,
        created_at,
        updated_at,
        usage_count,
        like_count,
        save_count,
        is_official,
        category,
        routine_exercises (
          id,
          exercise_id,
          name,
          order_position,
          total_sets,
          default_weight,
          default_reps,
          default_reps_min,
          default_reps_max,
          default_rpe,
          rep_mode,
          exercises (
            id,
            name,
            image_url,
            primary_muscle_group,
            equipment_required,
            difficulty_level
          )
        )
      `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Process routines to include exercise count and last used info
      const processedRoutines = data.map(routine => {
        return {
          id: routine.id,
          name: routine.name,
          exercises: routine.routine_exercises?.length || 0,
          lastUsed: "Never" // Will be updated from workout history
        };
      });
      
      set({ routines: processedRoutines, loading: false });
    } catch (error) {
      console.error("Error fetching routines:", error);
      set({ error: error.message, loading: false });
    }
  },
  
  // Get a single routine with all exercises
  getRoutine: async (routineId) => {
    set({ loading: true, error: null });
    
    try {
      const { data, error } = await supabase
.from('routines')
      .select(`
        id,
        name,
        user_id,
        original_creator_id,
        created_at,
        updated_at,
        usage_count,
        like_count,
        save_count,
        is_official,
        category,
        routine_exercises (
          id,
          exercise_id,
          name,
          order_position,
          total_sets,
          default_weight,
          default_reps,
          default_reps_min,
          default_reps_max,
          default_rpe,
          rep_mode,
          exercises (
            id,
            name,
            image_url,
            primary_muscle_group,
            equipment_required,
            difficulty_level
          )
        )
      `)
      .eq('id', routineId)
      .single();
      
      if (error) throw error;
      
      // Sort exercises by order position
      if (data.routine_exercises) {
        data.routine_exercises.sort((a, b) => a.order_position - b.order_position);
      }
      
      set({ loading: false });
      return data;
    } catch (error) {
      console.error("Error fetching routine:", error);
      set({ error: error.message, loading: false });
      return null;
    }
  },
  
  // Delete a routine
  deleteRoutine: async (routineId) => {
    try {
      const { error } = await supabase
        .from('routines')
        .delete()
        .eq('id', routineId);
      
      if (error) throw error;
      
      // Update local state
      set(state => ({
        routines: state.routines.filter(routine => routine.id !== routineId)
      }));
      
      return { success: true };
    } catch (error) {
      console.error("Error deleting routine:", error);
      return { success: false, error: error.message };
    }
  },
  
  // Update a routine's lastUsed date when starting a workout with it
  updateRoutineUsage: async (routineId) => {
    // This is more a UI update than a database update
    set(state => ({
      routines: state.routines.map(routine => 
        routine.id === routineId
          ? { ...routine, lastUsed: "Just now" }
          : routine
      )
    }));
  },

  updateLastUsedInfo: async (userId) => {
    try {
      // Check if the column exists first (optional but safer approach)
      const { data: columnCheck, error: columnError } = await supabase
        .from('workouts')
        .select('routine_id')
        .limit(1);
      
      // If we can't access routine_id, use a fallback approach
      if (columnError) {
        console.log("Routine tracking not yet set up in workouts table");
        // Just return without changing the lastUsed values
        return;
      }
      
      // Get the most recent workout for each routine
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id, 
          routine_id,
          start_time
        `)
        .eq('user_id', userId)
        .not('routine_id', 'is', null)
        .order('start_time', { ascending: false });
      
      if (error) throw error;
      
      // Create a map of routine_id to last used date
      const lastUsedMap = {};
      data.forEach(workout => {
        if (workout.routine_id && !lastUsedMap[workout.routine_id]) {
          // Calculate time difference
          const workoutDate = new Date(workout.start_time);
          const now = new Date();
          const diffDays = Math.floor((now.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));
          
          let lastUsed;
          if (diffDays === 0) {
            lastUsed = "Today";
          } else if (diffDays === 1) {
            lastUsed = "Yesterday";
          } else if (diffDays < 7) {
            lastUsed = `${diffDays} days ago`;
          } else if (diffDays < 30) {
            lastUsed = `${Math.floor(diffDays/7)} weeks ago`;
          } else {
            lastUsed = `${Math.floor(diffDays/30)} months ago`;
          }
          
          lastUsedMap[workout.routine_id] = lastUsed;
        }
      });
      
      // Update the routines with this info
      set(state => ({
        routines: state.routines.map(routine => ({
          ...routine,
          lastUsed: lastUsedMap[routine.id] || "Never"
        }))
      }));
    } catch (error) {
      console.error("Error updating last used info:", error);
    }
  }
}));