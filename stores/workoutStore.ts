import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { convertWeightForStorage, WeightUnit } from "../utils/weightUtils";
import * as Crypto from "expo-crypto";

interface WorkoutSet {
  id: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  isCompleted: boolean;
}

interface WorkoutExercise {
  id: string; // Unique workout instance ID  
  exercise_id: string; // Reference to the original exercise in exercises table
  name: string;
  notes: string;
  sets: WorkoutSet[];
  image_url?: string | null;
  superset_id?: string | null; // Groups exercises into supersets
}

interface Workout {
  id: string;
  startTime: Date;
  routineId?: string;
  name: string;
  exercises: WorkoutExercise[];
  notes?: string;
  isEditing?: boolean;
  editingWorkoutId?: string;
}

interface WorkoutSettings {
  // Timer Settings
  defaultRestMinutes: number;
  defaultRestSeconds: number;
  timerSound: string;
  timerVolume: number;
  vibrationEnabled: boolean;
  autoStartTimer: boolean;
  
  // Display Settings
  showElapsedTime: boolean;
  showRestTimer: boolean;
  keepScreenOn: boolean;
  largeTimerDisplay: boolean;
  
  // Workout Behavior
  autoSaveEnabled: boolean;
  confirmSetCompletion: boolean;
  swipeToDelete: boolean;
  quickAddSets: boolean;
  rpeEnabled: boolean;
  
  // Units
  weightUnit: string;
  distanceUnit: string;
}

interface WorkoutState {
  activeWorkout: Workout | null;
  currentDuration: number; // Separate duration field to prevent workout object recreation
  isPaused: boolean;
  pausedAt: number | null;
  accumulatedTime: number;
  isSaving: boolean;
  saveError: string | null;
  workoutSettings: WorkoutSettings;
  
  startWorkout: (routineId?: string, routineName?: string) => void;
  endWorkout: () => void;
  saveWorkoutToDatabase: () => Promise<string | false>;
  updateWorkoutToDatabase: () => Promise<boolean>;
  deleteWorkout: (workoutId: string) => Promise<boolean>;
  updateActiveWorkout: (data: Partial<Workout>) => void;
  updateWorkoutTime: (reset?: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  startNewWorkout: (workoutData: { name?: string, routineId?: string, exercises?: WorkoutExercise[], isEditing?: boolean, editingWorkoutId?: string, startTime?: Date, duration?: number }) => void;
  cancelEditWorkout: () => void;
  
  // Auto-save functionality
  saveWorkoutState: () => Promise<void>;
  loadWorkoutState: () => Promise<boolean>;
  clearSavedWorkoutState: () => Promise<void>;
  
  // Exercise management
  addExercise: (exercise: { id: string, name: string, defaultSets?: number, image_url?: string, exercise_id?: string, superset_id?: string }) => string;
  updateExercise: (exerciseId: string, data: Partial<WorkoutExercise>) => void;
  removeExercise: (exerciseId: string) => void;
  
  // Set management
  addSet: (exerciseId: string, set?: Partial<WorkoutSet>) => string;
  updateSet: (exerciseId: string, setId: string, data: Partial<WorkoutSet>) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  toggleSetCompletion: (exerciseId: string, setId: string) => void;
  
  // Settings management
  updateWorkoutSettings: (newSettings: Partial<WorkoutSettings>) => Promise<void>;
  loadWorkoutSettings: () => Promise<void>;
  getDefaultRestTime: () => number;
}

// Debounced auto-save timer
let autoSaveTimer: any = null;

const debouncedAutoSave = (saveFunction: () => void) => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  autoSaveTimer = setTimeout(saveFunction, 1000); // Debounce for 1 second
};

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  activeWorkout: null,
  currentDuration: 0, // Separate duration tracking
  isPaused: true, // Start paused by default
  pausedAt: null,
  accumulatedTime: 0,
  isSaving: false,
  saveError: null,
  workoutSettings: {
    // Timer Settings
    defaultRestMinutes: 2,
    defaultRestSeconds: 0,
    timerSound: 'bell',
    timerVolume: 0.8,
    vibrationEnabled: false,
    autoStartTimer: true,
    
    // Display Settings
    showElapsedTime: true,
    showRestTimer: true,
    keepScreenOn: false,
    largeTimerDisplay: false,
    
    // Workout Behavior
    autoSaveEnabled: true,
    confirmSetCompletion: false,
    swipeToDelete: true,
    quickAddSets: true,
    rpeEnabled: true,
    
    // Units
    weightUnit: 'kg',
    distanceUnit: 'km',
  },
  
  startWorkout: (routineId, routineName) => {
    const { workoutSettings } = get();
    const now = new Date().getTime();
    
    set({
      activeWorkout: {
        id: Date.now().toString(),
        startTime: new Date(),
        routineId,
        name: routineName + " Workout",
        exercises: [],
      },
      currentDuration: 0,
      // Auto-start timer based on settings
      isPaused: !workoutSettings.autoStartTimer,
      pausedAt: workoutSettings.autoStartTimer ? null : now,
      accumulatedTime: 0,
      saveError: null
    });
    
    // Auto-save the new workout state
    setTimeout(() => get().saveWorkoutState(), 100);
  },
  
  endWorkout: () => {
    set({ 
      activeWorkout: null,
      currentDuration: 0,
      isPaused: false,
      pausedAt: null,
      accumulatedTime: 0
    });
    
    // Clear saved workout state when ending workout
    setTimeout(() => get().clearSavedWorkoutState(), 100);
  },
  
  saveWorkoutToDatabase: async () => {
    const { activeWorkout, currentDuration } = get();
    if (!activeWorkout) return false;
    
    set({ isSaving: true, saveError: null });
    
    try {
      // 1. Get user session
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      
      if (!userId) {
        throw new Error("User not authenticated");
      }
      
      // 2. Get user's weight unit preference
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('weight_unit')
        .eq('id', userId)
        .single();
      
      const userWeightUnit: WeightUnit = userProfile?.weight_unit || 'lbs';
      
      // 3. Create the workout record
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          user_id: userId,
          name: activeWorkout.name,
          start_time: new Date(activeWorkout.startTime).toISOString(),
          end_time: new Date().toISOString(), // Use current time for end time
          duration: currentDuration, // Use separate duration field
          notes: activeWorkout.notes || "",
          routine_id: activeWorkout.routineId, // This will trigger the usage count increment
        })
        .select('id')
        .single();
      
      if (workoutError) throw workoutError;
      
      // Log routine usage tracking
      if (activeWorkout.routineId) {
        console.log(`Workout saved with routine_id: ${activeWorkout.routineId} - Usage count should be incremented by database trigger`);
      } else {
        console.log('Workout saved without routine_id - No usage count increment');
      }
      
      // 3. Create superset ID mapping (convert local numeric IDs to UUIDs)
      const supersetIdMap = new Map();
      
      // First pass: identify unique superset IDs and create UUID mapping
      for (const exercise of activeWorkout.exercises) {
        if (exercise.superset_id !== null && exercise.superset_id !== undefined) {
          if (!supersetIdMap.has(exercise.superset_id)) {
            // Generate a proper UUID v4 for this superset
            const supersetUuid = Crypto.randomUUID();
            supersetIdMap.set(exercise.superset_id, supersetUuid);
          }
        }
      }
      
      // 4. Filter exercises that have completed sets
      const exercisesWithCompletedSets = activeWorkout.exercises.filter(exercise => {
        return exercise.sets.some(set => set.isCompleted === true);
      });
      
      // 5. Create all exercises (only those with completed sets)
      for (const exercise of exercisesWithCompletedSets) {
        // Convert local superset ID to UUID if it exists
        const databaseSupersetId = exercise.superset_id !== null && exercise.superset_id !== undefined
          ? supersetIdMap.get(exercise.superset_id) || null
          : null;
        
        // Handle custom exercises vs. database exercises
        let exerciseInsertData;
        
        if (exercise.exercise_id && exercise.exercise_id.startsWith('custom-')) {
          // This is a custom exercise - don't include exercise_id
          exerciseInsertData = {
            workout_id: workoutData.id,
            name: exercise.name,
            notes: exercise.notes || "",
            superset_id: databaseSupersetId,
            // exercise_id is intentionally omitted for custom exercises
          };
        } else {
          // This is a database exercise - include exercise_id
          exerciseInsertData = {
            workout_id: workoutData.id,
            exercise_id: exercise.exercise_id, // Use exercise_id to maintain relationship with exercises table
            name: exercise.name,
            notes: exercise.notes || "",
            superset_id: databaseSupersetId,
          };
        }
        
        const { data: exerciseData, error: exerciseError } = await supabase
          .from('workout_exercises')
          .insert(exerciseInsertData)
          .select('id')
          .single();
        
        if (exerciseError) {
          console.error('Error inserting exercise:', exerciseError);
          throw exerciseError;
        }
        
        console.log('Successfully saved exercise:', exerciseData.id);
        
        // 6. Create all sets for this exercise
        if (exercise.sets.length > 0) {
          const validSets = exercise.sets.filter(set => 
            set.weight !== null && set.weight !== undefined &&
            set.reps !== null && set.reps !== undefined && set.reps !== 0 &&
            set.isCompleted === true // Only save completed sets
          );
          
          if (validSets.length > 0) {
            const setsToInsert = validSets.map((set, index) => ({
              exercise_id: exerciseData.id,
              weight: convertWeightForStorage(set.weight, userWeightUnit, 'kg'),
              reps: set.reps,
              rpe: set.rpe,
              is_completed: set.isCompleted,
              order_index: index
            }));
            
            const { error: setsError } = await supabase
              .from('workout_sets')
              .insert(setsToInsert);
            
            if (setsError) throw setsError;
          }
        }
      }
      
      // Success - workout is saved, clear the auto-saved state and active workout
      await get().clearSavedWorkoutState();
      set({ activeWorkout: null, currentDuration: 0, isPaused: true, pausedAt: null, accumulatedTime: 0 });
      return workoutData.id;
    } catch (error) {
      console.error("Error saving workout:", error);
      set({ saveError: error.message });
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  updateWorkoutToDatabase: async () => {
    const { activeWorkout, currentDuration } = get();
    if (!activeWorkout || !activeWorkout.editingWorkoutId) return false;
    
    set({ isSaving: true, saveError: null });
    
    try {
      // 1. Get user session
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      
      if (!userId) {
        throw new Error("User not authenticated");
      }
      
      // 2. Get user's weight unit preference
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('weight_unit')
        .eq('id', userId)
        .single();
      
      const userWeightUnit: WeightUnit = userProfile?.weight_unit || 'lbs';
      
      // 3. Update the workout record
      const { error: workoutError } = await supabase
        .from('workouts')
        .update({
          name: activeWorkout.name,
          notes: activeWorkout.notes || "",
          // Keep original start_time, update end_time to now and duration
          end_time: new Date().toISOString(),
          duration: currentDuration, // Use separate duration field
        })
        .eq('id', activeWorkout.editingWorkoutId)
        .eq('user_id', userId); // Ensure user can only edit their own workouts
      
      if (workoutError) throw workoutError;
      
      // 4. Delete existing workout exercises and sets
      const { error: deleteError } = await supabase
        .from('workout_exercises')
        .delete()
        .eq('workout_id', activeWorkout.editingWorkoutId);
      
      if (deleteError) throw deleteError;
      
      // 5. Create superset ID mapping (convert local numeric IDs to UUIDs)
      const supersetIdMap = new Map();
      
      // First pass: identify unique superset IDs and create UUID mapping
      for (const exercise of activeWorkout.exercises) {
        if (exercise.superset_id !== null && exercise.superset_id !== undefined) {
          if (!supersetIdMap.has(exercise.superset_id)) {
            // Generate a proper UUID v4 for this superset
            const supersetUuid = Crypto.randomUUID();
            supersetIdMap.set(exercise.superset_id, supersetUuid);
          }
        }
      }
      
      // 6. Filter exercises that have completed sets
      const exercisesWithCompletedSets = activeWorkout.exercises.filter(exercise => {
        return exercise.sets.some(set => set.isCompleted === true);
      });
      
      // 7. Create all exercises (only those with completed sets)
      for (const exercise of exercisesWithCompletedSets) {
        // Convert local superset ID to UUID if it exists
        const databaseSupersetId = exercise.superset_id !== null && exercise.superset_id !== undefined
          ? supersetIdMap.get(exercise.superset_id) || null
          : null;
        
        // Handle custom exercises vs. database exercises
        let exerciseInsertData;
        
        if (exercise.exercise_id && exercise.exercise_id.startsWith('custom-')) {
          // This is a custom exercise - don't include exercise_id
          exerciseInsertData = {
            workout_id: activeWorkout.editingWorkoutId,
            name: exercise.name,
            notes: exercise.notes || "",
            superset_id: databaseSupersetId,
          };
        } else {
          // This is a regular exercise from the database
          exerciseInsertData = {
            workout_id: activeWorkout.editingWorkoutId,
            exercise_id: exercise.exercise_id,
            name: exercise.name,
            notes: exercise.notes || "",
            superset_id: databaseSupersetId,
          };
        }
        
        const { data: exerciseData, error: exerciseError } = await supabase
          .from('workout_exercises')
          .insert(exerciseInsertData)
          .select('id')
          .single();
        
        if (exerciseError) throw exerciseError;
        
        // Create sets for this exercise
        if (exercise.sets && exercise.sets.length > 0) {
          const setsToCreate = exercise.sets.map((set, index) => ({
            exercise_id: exerciseData.id,
            weight: set.weight ? convertWeightForStorage(set.weight, userWeightUnit) : null,
            reps: set.reps,
            rpe: set.rpe,
            is_completed: set.isCompleted,
            order_index: index + 1
          }));
          
          const { error: setsError } = await supabase
            .from('workout_sets')
            .insert(setsToCreate);
          
          if (setsError) throw setsError;
        }
      }
      
      // Success - workout is updated, clear the auto-saved state and active workout
      await get().clearSavedWorkoutState();
      set({ activeWorkout: null, currentDuration: 0, isPaused: true, pausedAt: null, accumulatedTime: 0 });
      console.log(activeWorkout);
      return true;
    } catch (error) {
      console.error("Error updating workout:", error);
      set({ saveError: error.message });
      return false;
    } finally {
      set({ isSaving: false });
    }
  },
  
  updateActiveWorkout: (data) => {
    set((state) => ({
      activeWorkout: state.activeWorkout ? {...state.activeWorkout, ...data} : null
    }));
    
    // Don't auto-save if we're currently saving the workout to database
    const { isSaving } = get();
    if (!isSaving) {
      setTimeout(() => get().saveWorkoutState(), 100);
    }
  },
  
  pauseTimer: () => {
    set((state) => {
      if (!state.activeWorkout || state.isPaused) return state;
      return {
        isPaused: true,
        pausedAt: new Date().getTime(),
      };
    });
    
    // Auto-save timer state
    setTimeout(() => get().saveWorkoutState(), 100);
  },
  
  resumeTimer: () => {
    set((state) => {
      if (!state.activeWorkout || !state.isPaused) return state;
      
      // Add the paused duration to accumulated time
      const additionalTime = state.pausedAt ? 
        (new Date().getTime() - state.pausedAt) / 1000 : 0;
      
      return {
        isPaused: false,
        pausedAt: null,
        accumulatedTime: state.accumulatedTime + additionalTime
      };
    });
    
    // Auto-save timer state
    setTimeout(() => get().saveWorkoutState(), 100);
  },
  
  updateWorkoutTime: (reset) => {
    set((state) => {
      if (!state.activeWorkout) return state;
      
      // If reset is provided, set duration to that value
      if (reset !== undefined) {
        const now = new Date().getTime();
        
        return {
          activeWorkout: {
            ...state.activeWorkout,
            startTime: new Date(now - (reset * 1000)), // Adjust start time to match the duration
          },
          currentDuration: reset, // Update separate duration field
          // Reset timer state
          isPaused: true, // Keep paused after manual input
          pausedAt: now,
          accumulatedTime: 0, // Reset accumulated time
        };
      }
      
      // Rest of the function for regular timer updates
      // If paused, don't update duration
      if (state.isPaused) return state;
      
      // Calculate new duration: (current time - start time) - accumulated paused time
      const rawDuration = (new Date().getTime() - state.activeWorkout.startTime.getTime()) / 1000;
      const newDuration = Math.floor(rawDuration - state.accumulatedTime);
      
      // OPTIMIZATION: Only update separate duration field, never touch activeWorkout for timer updates
      // This prevents activeWorkout object recreation and subsequent re-renders
      if (state.currentDuration === newDuration) {
        return state; // No change, return existing state
      }
      
      return {
        currentDuration: newDuration // Only update duration, leave activeWorkout unchanged
      };
    });
    
    // Auto-save after time update (but only for manual resets, not regular timer ticks)
    if (reset !== undefined) {
      setTimeout(() => get().saveWorkoutState(), 100);
    } else {
      // For regular timer ticks, use debounced auto-save to prevent excessive saves
      debouncedAutoSave(() => get().saveWorkoutState());
    }
  },
  
  // Exercise management
  addExercise: (exercise) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return "";
    
    const exerciseId = exercise.id;
    const defaultSets = exercise.defaultSets || 1;
    
    // Create sets
    const sets: WorkoutSet[] = [];
    for (let i = 0; i < defaultSets; i++) {
      sets.push({
        id: `set-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        weight: null,
        reps: null,
        rpe: null,
        isCompleted: false
      });
    }
    
    // Determine exercise_id - for custom exercises, use the custom ID, for database exercises use exercise_id
    const finalExerciseId = exercise.exercise_id || exercise.id;
    
    // Add the exercise
    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: [
          ...activeWorkout.exercises,
          {
            id: exerciseId,
            exercise_id: finalExerciseId, // This will be either a UUID (database) or custom-* (custom exercise)
            name: exercise.name,
            notes: "",
            sets: sets,
            image_url: exercise.image_url || null,
            superset_id: exercise.superset_id || null,
          }
        ]
      }
    });
    
    // Auto-save after adding exercise
    setTimeout(() => get().saveWorkoutState(), 100);
    
    return exerciseId;
  },
  
  updateExercise: (exerciseId, data) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    
    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: activeWorkout.exercises.map(exercise => 
          exercise.id === exerciseId 
            ? { ...exercise, ...data } 
            : exercise
        )
      }
    });
    
    // Auto-save after updating exercise
    setTimeout(() => get().saveWorkoutState(), 100);
  },
  
  removeExercise: (exerciseId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    
    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: activeWorkout.exercises.filter(exercise => exercise.id !== exerciseId)
      }
    });
    
    // Auto-save after removing exercise
    setTimeout(() => get().saveWorkoutState(), 100);
  },
  
  // Set management
  addSet: (exerciseId, setData = {}) => {
    const { activeWorkout, workoutSettings } = get();
    if (!activeWorkout) return "";
    
    const setId = `set-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: activeWorkout.exercises.map(exercise => {
          if (exercise.id === exerciseId) {
            // Get values from last set if Quick Add Sets is enabled
            const lastSet = workoutSettings.quickAddSets && exercise.sets.length > 0 
              ? exercise.sets[exercise.sets.length - 1] 
              : null;
              
            const newSet: WorkoutSet = {
              id: setId,
              weight: setData.weight !== undefined ? setData.weight : (lastSet ? lastSet.weight : null),
              reps: setData.reps !== undefined ? setData.reps : (lastSet?.reps || null),
              rpe: setData.rpe !== undefined ? setData.rpe : (lastSet?.rpe || null),
              isCompleted: setData.isCompleted || false
            };
            
            return {
              ...exercise,
              sets: [...exercise.sets, newSet]
            };
          }
          return exercise;
        })
      }
    });
    
    // Auto-save after adding set
    setTimeout(() => get().saveWorkoutState(), 100);
    
    return setId;
  },
  
  updateSet: (exerciseId, setId, data) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    
    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: activeWorkout.exercises.map(exercise => {
          if (exercise.id === exerciseId) {
            return {
              ...exercise,
              sets: exercise.sets.map(set => 
                set.id === setId 
                  ? { ...set, ...data } 
                  : set
              )
            };
          }
          return exercise;
        })
      }
    });
    
    // Auto-save after updating set
    setTimeout(() => get().saveWorkoutState(), 100);
  },
  
  removeSet: (exerciseId, setId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    
    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: activeWorkout.exercises.map(exercise => {
          if (exercise.id === exerciseId) {
            return {
              ...exercise,
              sets: exercise.sets.filter(set => set.id !== setId)
            };
          }
          return exercise;
        })
      }
    });
    
    // Auto-save after removing set
    setTimeout(() => get().saveWorkoutState(), 100);
  },
  
  toggleSetCompletion: (exerciseId, setId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    
    // Find the exercise and set
    const exercise = activeWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    const set = exercise.sets.find(s => s.id === setId);
    if (!set) return;
    
    // Update the set
    get().updateSet(exerciseId, setId, { isCompleted: !set.isCompleted });
  },

  startNewWorkout: (workoutData) => {
    const { name, routineId, exercises, isEditing, editingWorkoutId, startTime, duration } = workoutData;
    const { workoutSettings } = get();
    const now = new Date().getTime();
    
    set({
      activeWorkout: {
        id: isEditing && editingWorkoutId ? editingWorkoutId : Date.now().toString(),
        startTime: startTime || new Date(),
        routineId,
        name: name,
        exercises: exercises || [],
        notes: "",
        isEditing: isEditing || false,
        editingWorkoutId: editingWorkoutId
      },
      currentDuration: duration || 0,
      // For editing mode, start paused with the accumulated time
      isPaused: isEditing ? true : !workoutSettings.autoStartTimer,
      pausedAt: isEditing ? now : (workoutSettings.autoStartTimer ? null : now),
      accumulatedTime: isEditing && duration ? duration * 1000 : 0, // Convert seconds to milliseconds
      saveError: null
    });
    
    // Auto-save the new workout state
    setTimeout(() => get().saveWorkoutState(), 100);
  },

  updateWorkoutSettings: async (newSettings: Partial<WorkoutSettings>) => {
    const { workoutSettings } = get();
    const updatedSettings = { ...workoutSettings, ...newSettings };
    
    try {
      // Save to AsyncStorage for persistence
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('workoutSettings', JSON.stringify(updatedSettings));
      
      // Update state
      set({ workoutSettings: updatedSettings });
    } catch (error) {
      console.error('Error saving workout settings:', error);
    }
  },
  
  loadWorkoutSettings: async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const savedSettings = await AsyncStorage.getItem('workoutSettings');
      
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        set({ workoutSettings: { ...get().workoutSettings, ...parsedSettings } });
      }
    } catch (error) {
      console.error('Error loading workout settings:', error);
    }
  },
  
  getDefaultRestTime: () => {
    const { workoutSettings } = get();
    return (workoutSettings.defaultRestMinutes * 60) + workoutSettings.defaultRestSeconds;
  },

  // Auto-save functionality
  saveWorkoutState: async () => {
    const { activeWorkout, currentDuration, isPaused, pausedAt, accumulatedTime } = get();
    
    if (!activeWorkout) {
      // No active workout, clear any saved state
      await get().clearSavedWorkoutState();
      return;
    }

    // Don't auto-save when editing a workout - editing sessions shouldn't persist across app restarts
    if (activeWorkout.isEditing) {
      console.log('Skipping auto-save for workout editing session');
      return;
    }

    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const workoutState = {
        activeWorkout: {
          ...activeWorkout,
          startTime: activeWorkout.startTime.toISOString(), // Convert Date to string for storage
        },
        currentDuration,
        isPaused,
        pausedAt,
        accumulatedTime,
        savedAt: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem('savedWorkoutState', JSON.stringify(workoutState));
      console.log('Workout state auto-saved');
    } catch (error) {
      console.error('Error saving workout state:', error);
    }
  },

  loadWorkoutState: async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const savedState = await AsyncStorage.getItem('savedWorkoutState');
      
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        // Check if saved state is not too old (e.g., older than 24 hours)
        const savedAt = new Date(parsedState.savedAt);
        const now = new Date();
        const hoursDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
          console.log('Saved workout state is too old, clearing it');
          await get().clearSavedWorkoutState();
          return false;
        }
        
        // Restore the workout state
        set({
          activeWorkout: {
            ...parsedState.activeWorkout,
            startTime: new Date(parsedState.activeWorkout.startTime), // Convert string back to Date
          },
          currentDuration: parsedState.currentDuration || 0,
          isPaused: parsedState.isPaused,
          pausedAt: parsedState.pausedAt,
          accumulatedTime: parsedState.accumulatedTime,
        });
        
        console.log('Workout state loaded from auto-save');
        return true;
      }
    } catch (error) {
      console.error('Error loading workout state:', error);
    }
    
    return false;
  },

  clearSavedWorkoutState: async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem('savedWorkoutState');
      console.log('Saved workout state cleared');
    } catch (error) {
      console.error('Error clearing saved workout state:', error);
    }
  },

  deleteWorkout: async (workoutId: string): Promise<boolean> => {
    if (!workoutId) {
      console.error('No workout ID provided for deletion');
      return false;
    }

    set({ isSaving: true, saveError: null });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // First verify that the user owns this workout
      const { data: workout, error: verifyError } = await supabase
        .from('workouts')
        .select('user_id')
        .eq('id', workoutId)
        .single();

      if (verifyError) throw verifyError;

      if (workout.user_id !== user.id) {
        throw new Error('Unauthorized: Cannot delete workout that does not belong to you');
      }

      // Remove workout references from posts (set workout_id to null)
      const { error: updatePostsError } = await supabase
        .from('posts')
        .update({ workout_id: null })
        .eq('workout_id', workoutId);

      if (updatePostsError) {
        console.warn('Warning: Could not update posts referencing this workout:', updatePostsError);
        // Continue with deletion even if posts update fails
      }

      // Delete workout exercises and sets first (foreign key constraints)
      const { error: deleteExercisesError } = await supabase
        .from('workout_exercises')
        .delete()
        .eq('workout_id', workoutId);

      if (deleteExercisesError) throw deleteExercisesError;

      // Delete the workout itself
      const { error: deleteWorkoutError } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workoutId)
        .eq('user_id', user.id); // Additional safety check

      if (deleteWorkoutError) throw deleteWorkoutError;

      set({ isSaving: false });
      console.log('Workout deleted successfully');
      return true;

    } catch (error) {
      console.error('Error deleting workout:', error);
      set({ 
        isSaving: false, 
        saveError: error instanceof Error ? error.message : 'Failed to delete workout' 
      });
      return false;
    }
  },

  cancelEditWorkout: () => {
    set({
      activeWorkout: null,
      currentDuration: 0,
      isPaused: true,
      pausedAt: null,
      accumulatedTime: 0,
    });
    
    // Clear any saved workout state when canceling edit
    setTimeout(() => get().clearSavedWorkoutState(), 100);
  },
}));