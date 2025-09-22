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
  duration: number;
  notes?: string;
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
  isPaused: boolean;
  pausedAt: number | null;
  accumulatedTime: number;
  isSaving: boolean;
  saveError: string | null;
  workoutSettings: WorkoutSettings;
  
  startWorkout: (routineId?: string, routineName?: string) => void;
  endWorkout: () => void;
  saveWorkoutToDatabase: () => Promise<boolean>;
  updateActiveWorkout: (data: Partial<Workout>) => void;
  updateWorkoutTime: (reset?: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  startNewWorkout: (workoutData: { name?: string, routineId?: string, exercises?: WorkoutExercise[] }) => void;
  
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

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  activeWorkout: null,
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
        name: routineName || (routineId ? "Routine Workout" : "New Workout"),
        exercises: [],
        duration: 0,
      },
      // Auto-start timer based on settings
      isPaused: !workoutSettings.autoStartTimer,
      pausedAt: workoutSettings.autoStartTimer ? null : now,
      accumulatedTime: 0,
      saveError: null
    });
  },
  
  endWorkout: () => set({ 
    activeWorkout: null,
    isPaused: false,
    pausedAt: null,
    accumulatedTime: 0
  }),
  
  saveWorkoutToDatabase: async () => {
    const { activeWorkout } = get();
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
          duration: activeWorkout.duration,
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
      
      // 4. Create all exercises
      for (const exercise of activeWorkout.exercises) {
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
        
        // 4. Create all sets for this exercise (only include sets with weight AND reps)
        if (exercise.sets.length > 0) {
          const validSets = exercise.sets.filter(set => 
            set.weight !== null && set.weight !== undefined && set.weight !== 0 &&
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
      
      // Success - workout is saved
      return true;
    } catch (error) {
      console.error("Error saving workout:", error);
      set({ saveError: error.message });
      return false;
    } finally {
      set({ isSaving: false });
    }
  },
  
  updateActiveWorkout: (data) => set((state) => ({
    activeWorkout: state.activeWorkout ? {...state.activeWorkout, ...data} : null
  })),
  
  pauseTimer: () => set((state) => {
    if (!state.activeWorkout || state.isPaused) return state;
    return {
      isPaused: true,
      pausedAt: new Date().getTime(),
    };
  }),
  
  resumeTimer: () => set((state) => {
    if (!state.activeWorkout || !state.isPaused) return state;
    
    // Add the paused duration to accumulated time
    const additionalTime = state.pausedAt ? 
      (new Date().getTime() - state.pausedAt) / 1000 : 0;
    
    return {
      isPaused: false,
      pausedAt: null,
      accumulatedTime: state.accumulatedTime + additionalTime
    };
  }),
  
  updateWorkoutTime: (reset) => set((state) => {
    if (!state.activeWorkout) return state;
    
    // If reset is provided, set duration to that value
    if (reset !== undefined) {
      const now = new Date().getTime();
      
      return {
        activeWorkout: {
          ...state.activeWorkout,
          duration: reset,
          startTime: new Date(now - (reset * 1000)), // Adjust start time to match the duration
        },
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
    const duration = Math.floor(rawDuration - state.accumulatedTime);
    
    return {
      activeWorkout: {
        ...state.activeWorkout,
        duration
      }
    };
  }),
  
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
              weight: setData.weight !== undefined ? setData.weight : (lastSet?.weight || null),
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
    const { name, routineId, exercises } = workoutData;
    const { workoutSettings } = get();
    const now = new Date().getTime();
    
    set({
      activeWorkout: {
        id: Date.now().toString(),
        startTime: new Date(),
        routineId,
        name: name || "Routine Workout",
        exercises: exercises || [],
        duration: 0,
        notes: ""
      },
      // Auto-start timer based on settings
      isPaused: !workoutSettings.autoStartTimer,
      pausedAt: workoutSettings.autoStartTimer ? null : now,
      accumulatedTime: 0,
      saveError: null
    });
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
}));