import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from "../../../../../constants/colors";
import { supabase } from "../../../../../lib/supabase";
import { useAuthStore } from "../../../../../stores/authStore";
import { progressUtils, PROGRESS_LABELS, useProgressStore } from "../../../../../stores/progressStore";
import { useBannerStore, BANNER_MESSAGES } from "../../../../../stores/bannerStore";
import { useWorkoutStore } from "../../../../../stores/workoutStore";
import { useRoutineStore } from "../../../../../stores/routineStore";
import { useSubscriptionStore } from "../../../../../stores/subscriptionStore";
import { FREE_TIER_LIMITS } from "../../../../../constants/subscription";
import DraggableFlatList from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import * as Haptics from 'expo-haptics';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Animated } from 'react-native';
import { useAnimatedStyle } from "react-native-reanimated";
import { getUserWeightUnit, convertWeightForStorage, convertWeightForDisplay, type WeightUnit } from "../../../../../utils/weightUtils";
import SetItem from "../../../../../components/SetItem";
import RpeSelector from "../../../../../components/RpeSelector";

// Create a simple exercise selection interface since the main one might have complex dependencies
interface ExerciseSelectionProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: ExerciseData) => void;
}

interface ExerciseSet {
  id: string;
  weight: number | string | null;
  reps: number | string | null;
  repsMin?: number | string | null;
  repsMax?: number | string | null;
  isRange: boolean;
  rpe: number | string | null;
}

interface Exercise {
  id: number;
  exerciseId: string;
  name: string;
  sets: ExerciseSet[];
  defaultWeight: number | string | null;
  defaultRepsMin: number | string | null;
  defaultRepsMax: number | string | null;
  defaultRPE: number | string | null;
  image_url?: string | null;
  isNew?: boolean;
  repMode: 'single' | 'range'; // New property to track rep mode for the exercise
}

interface ExerciseData {
  id: string;
  name: string;
  default_reps?: number;
  default_rpe?: number;
  image_url?: string | null;
}

export default function EditRoutine() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { routineId } = params;
  const { session, profile } = useAuthStore();
  const { isPro } = useSubscriptionStore();
  const { activeWorkout } = useWorkoutStore();
  
  // Progress bar state
  const { progress, isVisible } = useProgressStore();
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);
  
  const [routineName, setRoutineName] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [userWeightUnit, setUserWeightUnit] = useState<WeightUnit>('lbs');
  const [originalRoutineName, setOriginalRoutineName] = useState("");
  const [originalRoutineData, setOriginalRoutineData] = useState<any>(null);
  const nameInputRef = useRef<TextInput>(null);
  const [failedImages, setFailedImages] = useState(new Set<string>());
  
  // Get user's preferred weight unit
  const weightUnit = getUserWeightUnit(profile);
  
  // Bottom sheet state
  const [exerciseOptionsModalVisible, setExerciseOptionsModalVisible] = useState(false);
  const [selectedExerciseForOptions, setSelectedExerciseForOptions] = useState<Exercise | null>(null);
  const [reorderModalVisible, setReorderModalVisible] = useState(false);
  const [repSelectionModalVisible, setRepSelectionModalVisible] = useState(false);
  const [selectedSetForReps, setSelectedSetForReps] = useState<{exerciseId: number, setId: string} | null>(null);

  const [selectedSetForEdit, setSelectedSetForEdit] = useState<{exerciseId: number, setId: string} | null>(null);
  
  // RPE related state
  const [selectedSetForRpe, setSelectedSetForRpe] = useState<{exerciseId: number, setId: string} | null>(null);
  const [currentRpeIndex, setCurrentRpeIndex] = useState(2); // Default to RPE 7
  const [showRpeTooltip, setShowRpeTooltip] = useState(false);
  const [rpeTooltipPosition, setRpeTooltipPosition] = useState({ x: 0, y: 0 });
  const [isGoingToRpe, setIsGoingToRpe] = useState(false);
  
  // Bottom Sheet refs
  const exerciseOptionsBottomSheetRef = useRef<BottomSheet>(null);
  const reorderBottomSheetRef = useRef<BottomSheet>(null);
  const repSelectionBottomSheetRef = useRef<BottomSheet>(null);
  const setEditBottomSheetRef = useRef<BottomSheet>(null);
  const rpeBottomSheetRef = useRef<BottomSheet>(null);
  
  // Bottom Sheet snap points
  const exerciseOptionsSnapPoints = useMemo(() => ['40%'], []);
  const reorderSnapPoints = useMemo(() => ['30%'], []);
  const repSelectionSnapPoints = useMemo(() => ['45%'], []);
  const setEditSnapPoints = useMemo(() => ['22%'], []);
  const rpeSnapPoints = useMemo(() => ['50%'], []);
  
  // RPE data array
  const rpeData = [
    { value: 1, label: "Very Easy", description: "Could have done 9+ more reps" },
    { value: 2, label: "Easy", description: "Could have done 8+ more reps" },
    { value: 3, label: "Light", description: "Could have done 7+ more reps" },
    { value: 4, label: "Light to Moderate", description: "Could have done 6+ more reps" },
    { value: 5, label: "Moderate", description: "Could have done 5+ more reps" },
    { value: 6, label: "Moderate", description: "Could have done 4+ more reps" },
    { value: 7, label: "Somewhat Hard", description: "Could have done 3 more reps" },
    { value: 8, label: "Hard", description: "Could have done 2 more reps" },
    { value: 9, label: "Very Hard", description: "Could have done 1 more rep" },
    { value: 10, label: "Maximal", description: "Could not have done any more reps" },
  ];
  


  // Swipe state for SetItem
  const swipeableRefs = useRef({});

  useEffect(() => {
    if (routineId && routineId !== 'new') {
      loadRoutineData();
    } else if (routineId === 'new') {
      // For new routines, set initial state
      setRoutineName("New Routine");
      setOriginalRoutineName("");
      setExercises([]);
      setInitialLoading(false);
    }
  }, [routineId]);

  // Load user's weight preference
  useEffect(() => {
    const loadUserWeightUnit = async () => {
      if (session?.user?.id) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('weight_unit')
            .eq('id', session.user.id)
            .single();
          
          if (profile) {
            setUserWeightUnit(getUserWeightUnit(profile));
          }
        } catch (error) {
          console.log('Could not load user weight preference:', error);
          // Keep default 'lbs'
        }
      }
    };
    
    loadUserWeightUnit();
  }, [session?.user?.id]);

  // Handle exercise selection from the exercise selection screen
  useEffect(() => {
    const handleExerciseSelection = () => {
      // Handle exercise replacement
      if (params?.selectedExercises && params?.fromRoutineEdit && params?.replaceExerciseId) {
        try {
          const selectedExercises = JSON.parse(params.selectedExercises as string);
          if (Array.isArray(selectedExercises) && selectedExercises.length > 0) {
            const newExercise = selectedExercises[0]; // Take the first selected exercise for replacement
            const exerciseIdToReplace = parseFloat(
              Array.isArray(params.replaceExerciseId) 
                ? params.replaceExerciseId[0] 
                : params.replaceExerciseId as string
            );
            
            setExercises(prevExercises => {
              const updatedExercises = prevExercises.map(exercise => {
                if (exercise.id === exerciseIdToReplace) {
                  console.log("Found exercise to replace:", exercise.name, "->", newExercise.name);
                  // Replace the exercise while preserving sets and other data
                  return {
                    ...exercise,
                    exerciseId: newExercise.id,
                    name: newExercise.name,
                    image_url: newExercise.image_url || null,
                    // Keep existing sets, defaultWeight, defaultRepsMin, defaultRepsMax, defaultRPE
                    // Keep existing repMode
                  };
                }
                return exercise;
              });
              console.log("Updated exercises:", updatedExercises.map(e => ({ id: e.id, name: e.name })));
              return updatedExercises;
            });
            
            // Clear the params
            router.setParams({ 
              selectedExercises: undefined, 
              fromRoutineEdit: undefined,
              replaceExerciseId: undefined
            });
          }
        } catch (error) {
          console.error('Error parsing replacement exercise:', error);
        }
      }
      // Check if we returned from exercise selection with selected exercises (regular add)
      else if (params?.selectedExercises && params?.fromRoutineEdit) {
        try {
          const selectedExercises = JSON.parse(params.selectedExercises as string);
          if (Array.isArray(selectedExercises) && selectedExercises.length > 0) {
            // Add all selected exercises at once
            const newExercises = selectedExercises.map(exercise => ({
              id: Date.now() + Math.random(), // Unique temporary ID for new exercises
              exerciseId: exercise.id,
              name: exercise.name,
              sets: [{
                id: `${Date.now()}-${Math.random()}-0`,
                weight: null,
                reps: exercise.default_reps || null,
                repsMin: null,
                repsMax: null,
                isRange: false,
                rpe: exercise.default_rpe || null,
              }],
              defaultWeight: null,
              defaultRepsMin: exercise.default_reps || null,
              defaultRepsMax: null, // Start with no max for new exercises
              defaultRPE: exercise.default_rpe || null,
              image_url: exercise.image_url || null,
              isNew: true, // Flag to identify new exercises
              repMode: 'single' as 'single' | 'range', // Default to single rep mode
            }));
            
            setExercises(prevExercises => {
              const updated = [...prevExercises, ...newExercises];
              return updated;
            });
            
            // Clear the params to prevent this effect from running again
            router.setParams({ selectedExercises: undefined, fromRoutineEdit: undefined });
          }
        } catch (error) {
          //console.error('Error parsing selected exercises:', error);
        }
      }
    };

    handleExerciseSelection();
  }, [params?.selectedExercises, params?.fromRoutineEdit, params?.replaceExerciseId]);



  const loadRoutineData = async () => {
    try {
      setInitialLoading(true);
      
      // Fetch routine details
      const { data: routineData, error: routineError } = await supabase
        .from('routines')
        .select('*')
        .eq('id', routineId)
        .single();

      if (routineError) throw routineError;

      // Check if user is the original creator of this routine
      // Only the original creator can edit the routine
      const isOriginalCreator = routineData.original_creator_id 
        ? routineData.original_creator_id === session?.user?.id
        : routineData.user_id === session?.user?.id;

      if (!isOriginalCreator) {
        const { showError } = useBannerStore.getState();
        showError("You can only edit routines that you originally created. This routine was created by someone else.");
        router.back();
        return;
      }

      // Also check if user owns this routine (current user_id)
      if (routineData.user_id !== session?.user?.id) {
        const { showError } = useBannerStore.getState();
        showError("You don't have permission to edit this routine");
        router.back();
        return;
      }

      setRoutineName(routineData.name);
      setOriginalRoutineName(routineData.name);
      setOriginalRoutineData(routineData);

      // Fetch routine exercises with exercise details including image and sets
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('routine_exercises')
        .select(`
          *,
          exercises (
            image_url
          ),
          routine_sets (
            id,
            set_number,
            weight,
            reps,
            reps_min,
            reps_max,
            rpe
          )
        `)
        .eq('routine_id', routineId)
        .order('order_position');

      if (exercisesError) throw exercisesError;

      // Transform exercises data to match the state structure
      const transformedExercises = exercisesData.map((exercise) => {
        // Handle migration: use default_reps_min/max if available, fallback to legacy default_reps
        const repsMin = exercise.default_reps_min ?? exercise.default_reps ?? null;
        const repsMax = exercise.default_reps_max ?? null;
        
        // Use explicit rep_mode if available, otherwise determine based on data
        const repMode = exercise.rep_mode || (repsMin && repsMax ? 'range' : 'single');
        const isRangeMode = repMode === 'range';
        
        // Load sets from routine_sets table if available, otherwise create default sets
        let sets: ExerciseSet[] = [];
        
        if (exercise.routine_sets && exercise.routine_sets.length > 0) {
          // Sort sets by set_number and create set objects
          sets = exercise.routine_sets
            .sort((a, b) => a.set_number - b.set_number)
            .map((routineSet) => ({
              id: `${exercise.id}-${routineSet.set_number}`,
              weight: routineSet.weight ? convertWeightForDisplay(routineSet.weight, 'kg', userWeightUnit) : null,
              reps: isRangeMode ? null : routineSet.reps,
              repsMin: isRangeMode ? routineSet.reps_min : null,
              repsMax: isRangeMode ? routineSet.reps_max : null,
              isRange: isRangeMode,
              rpe: routineSet.rpe,
            }));
        } else {
          // Fallback: create sets based on total_sets and default values (for migration compatibility)
          const totalSets = exercise.total_sets || 1;
          for (let i = 0; i < totalSets; i++) {
            sets.push({
              id: `${exercise.id}-${i + 1}`,
              weight: exercise.default_weight ? convertWeightForDisplay(exercise.default_weight, 'kg', userWeightUnit) : null,
              reps: isRangeMode ? null : repsMin,
              repsMin: isRangeMode ? repsMin : null,
              repsMax: isRangeMode ? repsMax : null,
              isRange: isRangeMode,
              rpe: exercise.default_rpe || null,
            });
          }
        }
        
        return {
          id: exercise.id, // Use the routine_exercise ID
          exerciseId: exercise.exercise_id,
          name: exercise.name,
          sets,
          defaultWeight: exercise.default_weight ? convertWeightForDisplay(exercise.default_weight, 'kg', userWeightUnit) : null,
          defaultRepsMin: repsMin,
          defaultRepsMax: repsMax,
          defaultRPE: exercise.default_rpe || null,
          image_url: exercise.exercises?.image_url || null,
          repMode: repMode as 'single' | 'range',
        };
      });

      setExercises(transformedExercises);
    } catch (error) {
      console.error("Error loading routine:", error);
      
      const { showError } = useBannerStore.getState();
      showError("Failed to load routine data");
      router.back();
    } finally {
      setInitialLoading(false);
    }
  };

  const addExerciseToRoutine = (exercise: ExerciseData) => {
    // Create a new exercise object with one empty set (no default values)
    const newExercise: Exercise = {
      id: Date.now(), // Temporary ID for new exercises
      exerciseId: exercise.id,
      name: exercise.name,
      sets: [{
        id: `${Date.now()}-0`,
        weight: null,
        reps: null, // Start with no default reps
        repsMin: null,
        repsMax: null,
        isRange: false,
        rpe: null, // Start with no default RPE
      }],
      defaultWeight: null,
      defaultRepsMin: null, // Don't use exercise defaults
      defaultRepsMax: null, // Don't use exercise defaults
      defaultRPE: null, // Don't use exercise defaults
      image_url: exercise.image_url || null,
      isNew: true, // Flag to identify new exercises
      repMode: 'single', // Default to single rep mode
    };
    
    setExercises([...exercises, newExercise]);
  };

  const removeExercise = (exerciseId: number) => {
    setExercises(exercises.filter(exercise => exercise.id !== exerciseId));
  };

  // Set management functions
  const addSet = (exerciseId: number) => {
    setExercises(exercises.map(exercise => {
      if (exercise.id === exerciseId) {
        // Get the previous set to copy its values
        const previousSet = exercise.sets[exercise.sets.length - 1];
        
        // Create new set based on exercise's rep mode, only using previous set values (no defaults)
        const newSet: ExerciseSet = {
          id: `${exerciseId}-${Date.now()}-${exercise.sets.length}`,
          weight: previousSet ? previousSet.weight : null,
          reps: exercise.repMode === 'single' ? (previousSet?.reps || null) : null,
          repsMin: exercise.repMode === 'range' ? (previousSet?.repsMin || null) : null,
          repsMax: exercise.repMode === 'range' ? (previousSet?.repsMax || null) : null,
          isRange: exercise.repMode === 'range',
          rpe: previousSet?.rpe || null,
        };
        return { ...exercise, sets: [...exercise.sets, newSet] };
      }
      return exercise;
    }));
  };

  const removeSet = (exerciseId: number, setId: string) => {
    console.log(`Removing set ${setId} from exercise ${exerciseId}`);
    setExercises(exercises.map(exercise => {
      console.log(exercise.id);
      if (exercise.id === exerciseId) {
        return { 
          ...exercise, 
          sets: exercise.sets.filter(set => set.id !== setId)
        };
      }
      return exercise;
    }));
    
    // Clean up swipeable refs for the removed set
    const setKey = `${exerciseId}-${setId}`;
    if (swipeableRefs.current[setKey]) {
      delete swipeableRefs.current[setKey];
    }
    if (swipeableRefs.current[setKey + '_swiping']) {
      delete swipeableRefs.current[setKey + '_swiping'];
    }
  };

  const updateSet = (exerciseId: number, setId: string, field: keyof ExerciseSet, value: any) => {
    console.log(`Updating set ${setId} of exercise ${exerciseId}: ${field} = ${value}`);
    setExercises(prevExercises => prevExercises.map(exercise => {
      if (exercise.id === exerciseId) {
        return {
          ...exercise,
          sets: exercise.sets.map(set => 
            set.id === setId ? { ...set, [field]: value } : set
          )
        };
      }
      return exercise;
    }));
  };  // Function to close all swipeables
  const closeAllSwipeables = () => {
    Object.keys(swipeableRefs.current).forEach(key => {
      const ref = swipeableRefs.current[key];
      if (key.endsWith('_swiping')) {
        // Skip swiping state tracking keys
        return;
      }
      if (ref && ref.close) {
        ref.close();
      }
    });
  };



  // Validation function for required fields
  const validateExercises = () => {
    for (const exercise of exercises) {
      if (exercise.sets.length === 0) {
        const { showError } = useBannerStore.getState();
        showError(`Exercise "${exercise.name}" must have at least 1 set.`);
        return false;
      }

      // Validate each set
      for (let i = 0; i < exercise.sets.length; i++) {
        const set = exercise.sets[i];
        
        if (set.isRange) {
          // For rep ranges, both min and max must be provided and valid
          const repsMin = typeof set.repsMin === 'string' ? parseInt(set.repsMin) : set.repsMin;
          const repsMax = typeof set.repsMax === 'string' ? parseInt(set.repsMax) : set.repsMax;
          
          if (!repsMin || isNaN(repsMin) || repsMin < 1) {
            const { showError } = useBannerStore.getState();
            showError(`Exercise "${exercise.name}" set ${i + 1} must have a valid minimum reps value.`);
            return false;
          }
          if (!repsMax || isNaN(repsMax) || repsMax < 1) {
            const { showError } = useBannerStore.getState();
            showError(`Exercise "${exercise.name}" set ${i + 1} must have a valid maximum reps value.`);
            return false;
          }
          if (repsMax <= repsMin) {
            const { showError } = useBannerStore.getState();
            showError(`Exercise "${exercise.name}" set ${i + 1} maximum reps (${repsMax}) must be greater than the minimum reps (${repsMin}).`);
            return false;
          }
        } else {
          // For single rep counts, a valid rep count is required
          const reps = typeof set.reps === 'string' ? parseInt(set.reps) : set.reps;
          if (!reps || isNaN(reps) || reps < 1) {
            const { showError } = useBannerStore.getState();
            showError(`Exercise "${exercise.name}" set ${i + 1} must have a valid rep count.`);
            return false;
          }
        }
      }
    }
    return true;
  };

  // Check if minimum requirements are met to enable the Create/Save button
  const canSaveRoutine = () => {
    // Must have a routine name
    if (routineName.trim() === "") {
      return false;
    }
    
    // Must have at least one exercise
    if (exercises.length === 0) {
      return false;
    }
    
    // Each exercise must have at least one set with valid rep values
    for (const exercise of exercises) {
      if (exercise.sets.length === 0) {
        return false;
      }

      // Check each set for valid rep values
      for (const set of exercise.sets) {
        if (set.isRange) {
          // For rep ranges, both min and max must be provided and valid
          const repsMin = typeof set.repsMin === 'string' ? parseInt(set.repsMin) : set.repsMin;
          const repsMax = typeof set.repsMax === 'string' ? parseInt(set.repsMax) : set.repsMax;
          
          if (!repsMin || isNaN(repsMin) || repsMin < 1) {
            return false;
          }
          if (!repsMax || isNaN(repsMax) || repsMax < 1) {
            return false;
          }
          if (repsMax <= repsMin) {
            return false;
          }
        } else {
          // For single rep counts, a valid rep count is required
          const reps = typeof set.reps === 'string' ? parseInt(set.reps) : set.reps;
          if (!reps || isNaN(reps) || reps < 1) {
            return false;
          }
        }
      }
    }
    
    return true;
  };

  const updateExerciseDefaults = (exerciseId: number, field: keyof Exercise, value: any) => {
    setExercises(exercises.map(exercise => 
      exercise.id === exerciseId 
        ? { ...exercise, [field]: value } 
        : exercise
    ));
  };

  // Function to change rep mode for entire exercise
  const changeExerciseRepMode = (exerciseId: number, repMode: 'single' | 'range') => {
    setExercises(exercises.map(exercise => {
      if (exercise.id === exerciseId) {
        const updatedSets = exercise.sets.map(set => {
          if (repMode === 'single') {
            // Converting from range to single: use repsMin if available, otherwise use existing reps, otherwise null
            return {
              ...set,
              isRange: false,
              reps: set.repsMin || set.reps || null,
              repsMin: null,
              repsMax: null,
            };
          } else {
            // Converting from single to range: use reps as repsMin if available, repsMax starts empty
            return {
              ...set,
              isRange: true,
              reps: null,
              repsMin: set.reps || set.repsMin || null,
              repsMax: null, // Always start with empty max when converting to range
            };
          }
        });

        return {
          ...exercise,
          repMode,
          sets: updatedSets
        };
      }
      return exercise;
    }));
  };

  const handleSaveRoutine = async () => {
    // Validate routine data
    if (routineName.trim() === "") {
      const { showError } = useBannerStore.getState();
      showError("Please enter a routine name");
      return;
    }
  
    if (exercises.length === 0) {
      const { showError } = useBannerStore.getState();
      showError("Please add at least one exercise to your routine");
      return;
    }

    // Validate all exercises
    if (!validateExercises()) {
      return;
    }
  
    setLoading(true);
    let loadingInterval: any = null;
  
    try {
      // Start progress tracking
      if (routineId === 'new') {
        loadingInterval = progressUtils.startLoading(PROGRESS_LABELS.SAVING_ROUTINE);
      } else {
        loadingInterval = progressUtils.startLoading(PROGRESS_LABELS.UPDATING_ROUTINE);
      }

      // Step 1: Validating data
      progressUtils.stepProgress(1, 3, 'Validating routine data...');

      // Step 2: Saving/Updating
      progressUtils.stepProgress(2, 3, routineId === 'new' ? 'Creating routine...' : 'Updating routine...');
      
      if (routineId === 'new') {
        // Check free tier routine limit
        if (!isPro()) {
          const { count, error: countError } = await supabase
            .from('routines')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile!.id);
          if (!countError && count !== null && count >= FREE_TIER_LIMITS.maxRoutines) {
            setLoading(false);
            progressUtils.cancelLoading();
            if (loadingInterval) clearInterval(loadingInterval);
            Alert.alert(
              'Upgrade to Pro',
              'Unlock unlimited routines with Atlas Pro',
              [
                { text: 'Not now', style: 'cancel' },
                { text: 'Upgrade', onPress: () => router.push('/(app)/(modals)/pro') },
              ]
            );
            return;
          }
        }
        // Create new routine
        await createNewRoutine();
      } else {
        // Update existing routine - no need to check for duplicate names when editing
        await updateRoutine();
      }

      // Step 3: Finalizing
      progressUtils.stepProgress(3, 3, 'Finalizing...');
      
      // Complete the progress
      progressUtils.completeLoading();
      
      // Clear the loading interval
      if (loadingInterval) {
        clearInterval(loadingInterval);
      }
      
    } catch (error) {
      console.error("Error saving routine:", error);
      
      // Cancel progress on error
      progressUtils.cancelLoading();
      if (loadingInterval) {
        clearInterval(loadingInterval);
      }
      
      const { showError } = useBannerStore.getState();
      showError("Failed to save routine. Please try again.");
      setLoading(false);
    }
  };

  const promptForNewName = () => {
    Alert.prompt(
      "Duplicate Routine Name",
      "You already have a routine with this name. Please enter a different name:",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setLoading(false)
        },
        {
          text: "Save",
          onPress: (newName) => {
            if (!newName || newName.trim() === "") {
              const { showError } = useBannerStore.getState();
              showError("Please enter a valid name");
              return;
            }
            
            setRoutineName(newName.trim());
          }
        }
      ],
      "plain-text",
      routineName,
      "default"
    );
  };

  const updateRoutine = async () => {
    try {
      // Update routine name and timestamp
      const { error: routineError } = await supabase
        .from('routines')
        .update({
          name: routineName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', routineId);

      if (routineError) throw routineError;

      // Delete all existing routine exercises
      const { error: deleteError } = await supabase
        .from('routine_exercises')
        .delete()
        .eq('routine_id', routineId);

      if (deleteError) throw deleteError;

      // Insert all exercises (both existing and new)
      const exercisesData = exercises.map((exercise, index) => {
        // Handle custom exercises vs. database exercises
        const isCustomExercise = !exercise.exerciseId || exercise.exerciseId.startsWith('custom-');
        
        // Calculate default values from the first set or exercise defaults
        const firstSet = exercise.sets[0];
        let defaultRepsMin = null;
        let defaultRepsMax = null;
        let defaultWeight = null;
        let defaultRpe = null;
        
        if (exercise.repMode === 'range') {
          // For range mode, use the first set's range values or exercise defaults
          defaultRepsMin = firstSet?.repsMin || exercise.defaultRepsMin;
          defaultRepsMax = firstSet?.repsMax || exercise.defaultRepsMax;
        } else {
          // For single mode, use the first set's reps value or exercise default
          defaultRepsMin = firstSet?.reps || exercise.defaultRepsMin;
          defaultRepsMax = null; // No max for single mode
        }
        
        // Calculate default weight from first set or exercise default
        defaultWeight = firstSet?.weight || exercise.defaultWeight;
        
        // Calculate default RPE from first set or exercise default
        defaultRpe = firstSet?.rpe || exercise.defaultRPE;
        
        // Ensure values are properly converted to correct types
        defaultRepsMin = defaultRepsMin ? (typeof defaultRepsMin === 'string' ? parseInt(defaultRepsMin) || null : defaultRepsMin) : null;
        defaultRepsMax = defaultRepsMax ? (typeof defaultRepsMax === 'string' ? parseInt(defaultRepsMax) || null : defaultRepsMax) : null;
        
        // Convert default weight for storage (from user's unit to kg)
        if (defaultWeight) {
          const weightValue = typeof defaultWeight === 'string' ? parseFloat(defaultWeight) : defaultWeight;
          if (weightValue && !isNaN(weightValue)) {
            defaultWeight = convertWeightForStorage(weightValue, weightUnit);
          } else {
            defaultWeight = null;
          }
        } else {
          defaultWeight = null;
        }
        
        defaultRpe = defaultRpe ? (typeof defaultRpe === 'string' ? parseInt(defaultRpe) || null : defaultRpe) : null;
        
        if (isCustomExercise) {
          // This is a custom exercise - don't include exercise_id
          return {
            routine_id: routineId,
            name: exercise.name,
            order_position: index,
            total_sets: exercise.sets.length,
            default_weight: defaultWeight,
            default_reps_min: defaultRepsMin,
            default_reps_max: defaultRepsMax,
            default_rpe: defaultRpe,
            rep_mode: exercise.repMode || 'single',
            // exercise_id is intentionally omitted for custom exercises
          };
        } else {
          // This is a database exercise - include exercise_id
          return {
            routine_id: routineId,
            exercise_id: exercise.exerciseId,
            name: exercise.name,
            order_position: index,
            total_sets: exercise.sets.length,
            default_weight: defaultWeight,
            default_reps_min: defaultRepsMin,
            default_reps_max: defaultRepsMax,
            default_rpe: defaultRpe,
            rep_mode: exercise.repMode || 'single',
          };
        }
      });

      const { data: insertedExercises, error: exercisesError } = await supabase
        .from('routine_exercises')
        .insert(exercisesData)
        .select('id, order_position');

      if (exercisesError) throw exercisesError;

      // Now insert individual set data for each exercise
      const setsData: any[] = [];
      
      exercises.forEach((exercise, exerciseIndex) => {
        const routineExerciseId = insertedExercises.find(re => re.order_position === exerciseIndex)?.id;
        if (!routineExerciseId) return;
        
        exercise.sets.forEach((set, setIndex) => {
          // Convert set data to proper types and handle weight conversion for storage
          let weight = null;
          if (set.weight) {
            const weightValue = typeof set.weight === 'string' ? parseFloat(set.weight) : set.weight;
            if (weightValue && !isNaN(weightValue)) {
              // Convert weight from user's unit to storage unit (kg)
              weight = convertWeightForStorage(weightValue, weightUnit);
            }
          }
          
          const reps = set.reps ? (typeof set.reps === 'string' ? parseInt(set.reps) || null : set.reps) : null;
          const repsMin = set.repsMin ? (typeof set.repsMin === 'string' ? parseInt(set.repsMin) || null : set.repsMin) : null;
          const repsMax = set.repsMax ? (typeof set.repsMax === 'string' ? parseInt(set.repsMax) || null : set.repsMax) : null;
          const rpe = set.rpe ? (typeof set.rpe === 'string' ? parseInt(set.rpe) || null : set.rpe) : null;
          
          setsData.push({
            routine_exercise_id: routineExerciseId,
            set_number: setIndex + 1,
            weight: weight,
            reps: exercise.repMode === 'single' ? reps : null,
            reps_min: exercise.repMode === 'range' ? repsMin : null,
            reps_max: exercise.repMode === 'range' ? repsMax : null,
            rpe: rpe
          });
        });
      });

      if (setsData.length > 0) {
        const { error: setsError } = await supabase
          .from('routine_sets')
          .insert(setsData);

        if (setsError) throw setsError;
      }

      // Show success banner
      const { showSuccess } = useBannerStore.getState();
      showSuccess(BANNER_MESSAGES.ROUTINE_SAVED);
      
      // Navigate back
      router.back();
    } catch (error) {
      console.error("Error updating routine:", error);
      const { showError } = useBannerStore.getState();
      showError("Failed to update routine. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const createNewRoutine = async () => {
    try {
      // Check if routine with same name already exists for this user
      const { data: existingRoutines, error: checkError } = await supabase
        .from('routines')
        .select('id, name')
        .eq('user_id', session?.user?.id)
        .ilike('name', routineName.trim())
        .limit(1);
      
      if (checkError) throw checkError;
      
      if (existingRoutines && existingRoutines.length > 0) {
        setLoading(false);
        promptForNewName();
        return;
      }
      
      // Create the routine
      const { data: routineData, error: routineError } = await supabase
        .from('routines')
        .insert({
          name: routineName.trim(),
          user_id: session?.user?.id,
        })
        .select('id')
        .single();

      if (routineError) throw routineError;

      const newRoutineId = routineData.id;

      // Add exercises to the routine
      const exercisesData = exercises.map((exercise, index) => {
        // Handle custom exercises vs. database exercises
        const isCustomExercise = !exercise.exerciseId || exercise.exerciseId.startsWith('custom-');
        
        // Calculate default values from the first set or exercise defaults
        const firstSet = exercise.sets[0];
        let defaultRepsMin = null;
        let defaultRepsMax = null;
        let defaultWeight = null;
        let defaultRpe = null;
        
        if (exercise.repMode === 'range') {
          // For range mode, use the first set's range values or exercise defaults
          defaultRepsMin = firstSet?.repsMin || exercise.defaultRepsMin;
          defaultRepsMax = firstSet?.repsMax || exercise.defaultRepsMax;
        } else {
          // For single mode, use the first set's reps value or exercise default
          defaultRepsMin = firstSet?.reps || exercise.defaultRepsMin;
          defaultRepsMax = null; // No max for single mode
        }
        
        // Calculate default weight from first set or exercise default
        defaultWeight = firstSet?.weight || exercise.defaultWeight;
        
        // Calculate default RPE from first set or exercise default
        defaultRpe = firstSet?.rpe || exercise.defaultRPE;
        
        // Ensure values are properly converted to correct types
        defaultRepsMin = defaultRepsMin ? (typeof defaultRepsMin === 'string' ? parseInt(defaultRepsMin) || null : defaultRepsMin) : null;
        defaultRepsMax = defaultRepsMax ? (typeof defaultRepsMax === 'string' ? parseInt(defaultRepsMax) || null : defaultRepsMax) : null;
        
        // Convert default weight for storage (from user's unit to kg)
        if (defaultWeight) {
          const weightValue = typeof defaultWeight === 'string' ? parseFloat(defaultWeight) : defaultWeight;
          if (weightValue && !isNaN(weightValue)) {
            defaultWeight = convertWeightForStorage(weightValue, weightUnit);
          } else {
            defaultWeight = null;
          }
        } else {
          defaultWeight = null;
        }
        
        defaultRpe = defaultRpe ? (typeof defaultRpe === 'string' ? parseInt(defaultRpe) || null : defaultRpe) : null;
        
        if (isCustomExercise) {
          // This is a custom exercise - don't include exercise_id
          return {
            routine_id: newRoutineId,
            name: exercise.name,
            order_position: index,
            total_sets: exercise.sets.length,
            default_weight: defaultWeight,
            default_reps_min: defaultRepsMin,
            default_reps_max: defaultRepsMax,
            default_rpe: defaultRpe,
            rep_mode: exercise.repMode || 'single',
            // exercise_id is intentionally omitted for custom exercises
          };
        } else {
          // This is a database exercise - include exercise_id
          return {
            routine_id: newRoutineId,
            exercise_id: exercise.exerciseId,
            name: exercise.name,
            order_position: index,
            total_sets: exercise.sets.length,
            default_weight: defaultWeight,
            default_reps_min: defaultRepsMin,
            default_reps_max: defaultRepsMax,
            default_rpe: defaultRpe,
            rep_mode: exercise.repMode || 'single',
          };
        }
      });

      const { data: insertedExercises, error: exercisesError } = await supabase
        .from('routine_exercises')
        .insert(exercisesData)
        .select('id, order_position');

      if (exercisesError) throw exercisesError;

      // Now insert individual set data for each exercise
      const setsData: any[] = [];
      
      exercises.forEach((exercise, exerciseIndex) => {
        const routineExerciseId = insertedExercises.find(re => re.order_position === exerciseIndex)?.id;
        if (!routineExerciseId) return;
        
        exercise.sets.forEach((set, setIndex) => {
          // Convert set data to proper types and handle weight conversion for storage
          let weight = null;
          if (set.weight) {
            const weightValue = typeof set.weight === 'string' ? parseFloat(set.weight) : set.weight;
            if (weightValue && !isNaN(weightValue)) {
              // Convert weight from user's unit to storage unit (kg)
              weight = convertWeightForStorage(weightValue, weightUnit);
            }
          }
          
          const reps = set.reps ? (typeof set.reps === 'string' ? parseInt(set.reps) || null : set.reps) : null;
          const repsMin = set.repsMin ? (typeof set.repsMin === 'string' ? parseInt(set.repsMin) || null : set.repsMin) : null;
          const repsMax = set.repsMax ? (typeof set.repsMax === 'string' ? parseInt(set.repsMax) || null : set.repsMax) : null;
          const rpe = set.rpe ? (typeof set.rpe === 'string' ? parseInt(set.rpe) || null : set.rpe) : null;
          
          setsData.push({
            routine_exercise_id: routineExerciseId,
            set_number: setIndex + 1,
            weight: weight,
            reps: exercise.repMode === 'single' ? reps : null,
            reps_min: exercise.repMode === 'range' ? repsMin : null,
            reps_max: exercise.repMode === 'range' ? repsMax : null,
            rpe: rpe
          });
        });
      });

      if (setsData.length > 0) {
        const { error: setsError } = await supabase
          .from('routine_sets')
          .insert(setsData);

        if (setsError) throw setsError;
      }

      // Handle workout start with proper logic
      const handleStartWorkoutAfterCreate = async () => {
        try {
          // Check if there's already an active workout
          if (activeWorkout) {
            Alert.alert(
              "Workout in Progress",
              "You already have an active workout. What would you like to do?",
              [
                {
                  text: "Resume Current",
                  onPress: () => {
                    router.back();
                    router.push("/newWorkout");
                  },
                  style: "default",
                },
                {
                  text: "Discard & Start New",
                  onPress: async () => {
                    useWorkoutStore.getState().endWorkout();
                    await startNewWorkoutFromCreatedRoutine(newRoutineId);
                  },
                  style: "destructive",
                },
                {
                  text: "Cancel",
                  style: "cancel",
                },
              ]
            );
          } else {
            await startNewWorkoutFromCreatedRoutine(newRoutineId);
          }
          router.push('/newWorkout');
        } catch (error) {
          console.error("Error starting workout:", error);
          
          const { showError } = useBannerStore.getState();
          showError("Failed to start workout. Please try again.");
        }
      };

      const startNewWorkoutFromCreatedRoutine = async (routineId: string) => {
        try {
          // Start a new workout with this routine using actual set data
          useWorkoutStore.getState().startNewWorkout({
            name: routineName.trim(),
            routineId: routineId,
            exercises: exercises.map((exercise) => {
              return {
                id: `${Date.now()}_${Math.random()}`, // Temporary ID for workout instance
                exercise_id: exercise.exerciseId, // Original exercise ID for database relationship
                name: exercise.name,
                image_url: exercise.image_url || null, // Include image
                sets: exercise.sets.map((set, i) => ({
                  id: `${Date.now()}_${Math.random()}_${i}`,
                  weight: typeof set.weight === 'string' ? (Math.round(parseFloat(set.weight)) || 0) : (Math.round(set.weight) || 0), // Convert to number and round
                  reps: exercise.repMode === 'range' 
                    ? (typeof set.repsMax === 'string' ? (parseInt(set.repsMax) || 0) : (set.repsMax || 0))
                    : (typeof set.reps === 'string' ? (parseInt(set.reps) || 0) : (set.reps || 0)), // For ranges, start with maximum if available
                  repsMin: exercise.repMode === 'range' ? (typeof set.repsMin === 'string' ? (parseInt(set.repsMin) || null) : set.repsMin) : null,
                  repsMax: exercise.repMode === 'range' ? (typeof set.repsMax === 'string' ? (parseInt(set.repsMax) || null) : set.repsMax) : null,
                  isRange: exercise.repMode === 'range',
                  rpe: typeof set.rpe === 'string' ? (parseInt(set.rpe) || 0) : (set.rpe || 0), // Convert to number
                  isCompleted: false
                })),
                notes: "",
                repMode: exercise.repMode
              };
            })
          });

          // Update the routine's last used info since user is the creator
          try {
            const routineStore = useRoutineStore.getState() as any;
            if (routineStore.updateRoutineUsage) {
              routineStore.updateRoutineUsage(routineId.toString());
            }
          } catch (error) {
            console.log('Could not update routine usage:', error);
          }
        } catch (error) {
          console.error("Error starting workout from routine:", error);
          
          const { showError } = useBannerStore.getState();
          showError("Failed to start workout. Please try again.");
        }
      };

      // Show success banner with action to start workout
      const { showSuccess } = useBannerStore.getState();
      showSuccess(
        BANNER_MESSAGES.ROUTINE_SAVED,
        4000,
        {
          text: 'Start Workout',
          onPress: handleStartWorkoutAfterCreate
        }
      );
      
      // Navigate back
      router.back();
    } catch (error) {
      console.error("Error creating routine:", error);
      
      const { showError } = useBannerStore.getState();
      showError("Failed to create routine. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Check if there are any changes
    const hasChanges = routineId === 'new' 
      ? (routineName.trim() !== "New Routine" || exercises.length > 0)
      : (routineName.trim() !== originalRoutineName || 
         exercises.some(ex => ex.isNew) ||
         exercises.length === 0); // If all exercises were deleted

    if (hasChanges) {
      Alert.alert(
        "Discard Changes",
        routineId === 'new' 
          ? "Are you sure you want to discard your new routine?"
          : "Are you sure you want to discard your changes?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.back()
          }
        ]
      );
    } else {
      router.back();
    }
  };

  const handleNameChange = (newName: string) => {
    const nameToSave = newName.trim() || "New Routine";
    setRoutineName(nameToSave);
    setIsEditingName(false);
  };

  // Bottom Sheet callbacks
  const handleExerciseOptionsSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setExerciseOptionsModalVisible(false);
      setSelectedExerciseForOptions(null);
    }
  }, []);

  const handleReorderSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setReorderModalVisible(false);
    }
  }, []);

  const handleRepSelectionSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setRepSelectionModalVisible(false);
      setSelectedSetForReps(null);
    }
  }, []);

  const handleSetEditSheetChanges = useCallback((index: number) => {
    if (index === -1 && !isGoingToRpe) {
      setSelectedSetForEdit(null);
    }
  }, [isGoingToRpe]);

  const handleRpeSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setSelectedSetForRpe(null);
      setIsGoingToRpe(false);
      // Return to set edit if we came from there (only if not coming from apply button)
      if (selectedSetForEdit && !isGoingToRpe) {
        setTimeout(() => {
          setEditBottomSheetRef.current?.snapToIndex(0);
        }, 200);
      }
    }
  }, [selectedSetForEdit, isGoingToRpe]);

  // RPE Modal Functions
  const openRpeModal = (exerciseId: number, setId: string, currentRpe?: number) => {
    Keyboard.dismiss();
    setIsGoingToRpe(true);
    const rpeIndex = currentRpe ? Math.max(0, Math.min(currentRpe - 1, rpeData.length - 1)) : 5; // Default to RPE 6
    setCurrentRpeIndex(rpeIndex);
    setSelectedSetForRpe({ exerciseId, setId });
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rpeBottomSheetRef.current?.snapToIndex(0);
  };

  const applyRpeSelection = () => {
    if (selectedSetForRpe) {
      const selectedRpe = rpeData[currentRpeIndex].value;
      updateSet(selectedSetForRpe.exerciseId, selectedSetForRpe.setId, 'rpe', selectedRpe);
      
      rpeBottomSheetRef.current?.close();
      
      // Reset the flag and reopen the set edit bottom sheet after a short delay
      setTimeout(() => {
        setIsGoingToRpe(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditBottomSheetRef.current?.expand();
        setSelectedSetForEdit({ exerciseId: selectedSetForRpe.exerciseId, setId: selectedSetForRpe.setId });
      }, 100);
    }
  };

  // Functions to show exercise options
  const showExerciseOptions = (exercise: Exercise) => {
    setSelectedExerciseForOptions(exercise);
    setExerciseOptionsModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    exerciseOptionsBottomSheetRef.current?.expand();
  };

  const handleReorderExercises = () => {
    exerciseOptionsBottomSheetRef.current?.close();
    setTimeout(() => {
      setReorderModalVisible(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      reorderBottomSheetRef.current?.expand();
    }, 200);
  };

  const handleRemoveExercise = () => {
    if (!selectedExerciseForOptions) return;
    
    Alert.alert(
      "Remove Exercise",
      `Are you sure you want to remove "${selectedExerciseForOptions.name}" from your routine?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeExercise(selectedExerciseForOptions.id);
            exerciseOptionsBottomSheetRef.current?.close();
          }
        }
      ]
    );
  };

  const handleReplaceExercise = () => {
    exerciseOptionsBottomSheetRef.current?.close();
    
    // Navigate to exercise selection in replace mode for routine editing
    router.push({
      pathname: '/(app)/(modals)/exerciseSelection',
      params: { 
        replaceExerciseId: selectedExerciseForOptions.id,
        fromRoutineEdit: 'true',
        routineId: routineId
      }
    });
  };

  const showExerciseDetails = async (exercise: Exercise) => {
    // For custom exercises (exercise_id is null), we need to find the custom exercise ID
    // Custom exercises are identified by having no exercise_id and should be loaded from local storage
    let exerciseId = exercise.exerciseId;
    
    if (!exercise.exerciseId) {
      // This is a custom exercise - try to find it in local storage by name
      try {
        const customExercises = await AsyncStorage.getItem('custom_exercises');
        if (customExercises) {
          const exercises = JSON.parse(customExercises);
          const customExercise = exercises.find((ex: any) => ex.name === exercise.name);
          if (customExercise) {
            exerciseId = customExercise.id;
          } else {
            // If not found in local storage, don't navigate
            console.log('Custom exercise not found in local storage:', exercise.name);
            return;
          }
        } else {
          // If no custom exercises in storage, don't navigate
          console.log('No custom exercises found in local storage');
          return;
        }
      } catch (error) {
        console.error('Error loading custom exercises:', error);
        return;
      }
    }
    
    router.push({
      pathname: '/(app)/(modals)/exerciseDetails',
      params: { 
        exerciseId: exerciseId,
        exerciseName: exercise.name,
        fromRoutineEdit: 'true'
      }
    });
  };

  if (initialLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
                activeOpacity={0.5} onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        {isEditingName ? (
          <TextInput
            ref={nameInputRef}
            style={styles.headerTitleInput}
            value={routineName}
            onChangeText={setRoutineName}
            onBlur={() => handleNameChange(routineName)}
            onSubmitEditing={() => handleNameChange(routineName)}
            autoFocus
            selectTextOnFocus
            placeholder="Routine Name"
            placeholderTextColor={colors.secondaryText}
          />
        ) : (
          <TouchableOpacity
                activeOpacity={0.5} 
            onPress={() => {
              setIsEditingName(true);
              setTimeout(() => nameInputRef.current?.focus(), 100);
            }}
            style={styles.headerTitleContainer}
          >
            <View style={styles.editableHeaderTitle}>
              <Text style={styles.headerTitle}>
                {routineName || 'Untitled Routine'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
                activeOpacity={0.5} 
          onPress={handleSaveRoutine} 
          style={[styles.headerButton, (!canSaveRoutine() || loading) && styles.headerButtonDisabled]}
          disabled={!canSaveRoutine() || loading}
        >
            <Text style={[styles.saveText, (!canSaveRoutine() || loading) && styles.saveTextDisabled]}>
              {routineId === 'new' ? 'Create' : 'Save'}
            </Text>
        </TouchableOpacity>

        {/* Progress Bar */}
        {isVisible && (
          <Animated.View 
            style={[
              styles.progressBar, 
              { width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }) }
            ]} 
          />
        )}
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView 
          style={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => {
            // Dismiss keyboard when user starts scrolling
            closeAllSwipeables();
          }}
        >
        {exercises.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="barbell-outline" size={50} color={colors.secondaryText} />
            <Text style={styles.emptyStateTitle}>Get started</Text>
            <Text style={styles.emptyStateText}>
              Add an exercise to create your routine.
            </Text>
            <TouchableOpacity
                activeOpacity={0.5}
              style={[styles.emptyStateButton, { width: '90%' }]}
              onPress={() => router.push({
                pathname: '/(app)/(modals)/exerciseSelection',
                params: { fromRoutineEdit: 'true', routineId: routineId }
              })}
            >
              <Ionicons name="add" size={18} color={colors.primaryText} />
              <Text style={styles.emptyStateButtonText}>Add Exercise</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.exercisesContainer}>
            {exercises.map((item) => (
              <View 
                key={item.id} 
                style={[
                  styles.exerciseCard, 
                ]}
              >
                {/* Exercise header with name and options */}
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseNameContainer}>
                    <View style={styles.exerciseTitleRow}>
                      {/* Exercise name and image pressable area */}
                      <TouchableOpacity
                activeOpacity={0.5} 
                        style={styles.exerciseTitlePressable}
                      >
                        <View style={styles.exerciseNameAndBadgeContainer}>
                          <TouchableOpacity
                activeOpacity={0.5} 
                            onPress={() => showExerciseDetails(item)}
                            style={styles.exerciseNamePressable}
                          >
                            <View style={styles.exerciseNameRow}>
                              {/* Exercise Image */}
                              {item.image_url && !failedImages.has(item.id.toString()) ? (
                                <Image 
                                  source={{ uri: item.image_url }}
                                  style={styles.exerciseImage}
                                  resizeMode="cover"
                                  onError={() => {
                                    setFailedImages(prev => new Set(prev).add(item.id.toString()));
                                  }}
                                />
                              ) : (
                                <View style={styles.exerciseImagePlaceholder}>
                                  <Ionicons 
                                    name={(!item.exerciseId || item.exerciseId.startsWith('custom-')) ? "construct-outline" : "barbell-outline"} 
                                    size={20} 
                                    color={colors.secondaryText} 
                                  />
                                </View>
                              )}
                              
                              {/* Exercise Name */}
                              <Text style={styles.exerciseName}>{item.name}</Text>
                            </View>
                          </TouchableOpacity>
                          
                          {/* Custom Exercise Badge */}
                          {(!item.exerciseId || item.exerciseId.startsWith('custom-')) && (
                            <View style={styles.customBadge}>
                              <Text style={styles.customBadgeText}>Custom</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                      
                      {/* Keep the options button separate */}
                      <TouchableOpacity
                activeOpacity={0.5} 
                        style={styles.exerciseOptionsButton}
                        onPress={() => showExerciseOptions(item)}
                      >
                        <Ionicons name="ellipsis-horizontal" size={20} color={colors.secondaryText} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                
                {/* Sets section */}
                <View style={styles.setsSection}>
                  {/* Column Headers */}
                  <View style={styles.setColumnHeaders}>
                    <Text style={[styles.setHeaderLabel, styles.setNumberColumn]}>SET</Text>
                    <Text style={[styles.setHeaderLabel, styles.setInputColumn]}>WEIGHT</Text>
                    <TouchableOpacity
                      activeOpacity={0.5}
                      style={[styles.setInputColumn, { marginLeft: 36 }]}
                      onPress={() => {
                        // Open rep selection for the entire exercise
                        setSelectedSetForReps({ exerciseId: item.id, setId: 'exercise-level' });
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        repSelectionBottomSheetRef.current?.snapToIndex(0);
                      }}
                    >
                      <Text style={styles.setHeaderLabel}>REPS</Text>
                      <Ionicons style={styles.repsHeaderIcon} name="chevron-down" size={16} color={colors.secondaryText} />
                    </TouchableOpacity>
                    <View style={styles.setInputColumn}>
                      <TouchableOpacity
                        activeOpacity={0.5}
                        onPress={(event) => {
                          event.persist();
                          event.currentTarget.measure((x, y, width, height, pageX, pageY) => {
                            setRpeTooltipPosition({ x: pageX, y: pageY + height });
                            setShowRpeTooltip(true);
                          });
                        }}
                        style={styles.rpeHeaderContainer}
                      >
                        <Text style={styles.setHeaderLabel}>RPE</Text>
                        <Ionicons name="help-circle-outline" size={16} color={colors.secondaryText} style={styles.rpeQuestionIcon} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {item.sets.map((set, setIndex) => {
                    return (
                      <SetItem
                        key={set.id}
                        set={set}
                        setIndex={setIndex}
                        exercise={item}
                        userWeightUnit={weightUnit}
                        workoutSettings={{ rpeEnabled: true }}
                        styles={styles}
                        colors={colors}
                        swipeableRefs={swipeableRefs}
                        onRemoveSet={(exerciseId, setId) => removeSet(parseFloat(exerciseId), setId)}
                        onOpenSetEdit={(exerciseIndex, setIndex) => {
                          const foundExerciseIndex = exercises.findIndex(ex => ex.id === item.id);
                          setSelectedSetForEdit({ exerciseId: item.id, setId: set.id });
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEditBottomSheetRef.current?.snapToIndex(0);
                        }}
                        onCloseAllSwipeables={closeAllSwipeables}
                        exerciseIndex={exercises.findIndex(ex => ex.id === item.id)}
                        showCheckbox={false}
                      />
                    );
                  })}
                  
                  {/* Add Set Button - Full width below all sets */}
                  <TouchableOpacity
                    activeOpacity={0.5}
                    style={styles.addSetButton}
                    onPress={() => addSet(item.id)}
                  >
                    <Ionicons name="add" size={18} color={colors.primaryText} />
                    <Text style={styles.addSetButtonText}>Add Set</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <View style={styles.addExerciseContainer}>
              <TouchableOpacity
                activeOpacity={0.5}
                style={styles.addExerciseButton}
                onPress={() => router.push({
                  pathname: '/(app)/(modals)/exerciseSelection',
                  params: { fromRoutineEdit: 'true', routineId: routineId }
                })}
              >
                <Ionicons name="add" size={18} color={colors.primaryText} />
                <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Exercise Options Bottom Sheet */}
      <BottomSheet
        ref={exerciseOptionsBottomSheetRef}
        index={-1}
        snapPoints={exerciseOptionsSnapPoints}
        onChange={handleExerciseOptionsSheetChanges}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
          />
        )}
      >
        <BottomSheetView style={styles.exerciseOptionsModalContent}>
          <Text style={styles.exerciseOptionsTitle}>
            {selectedExerciseForOptions?.name}
          </Text>
          <Text style={styles.exerciseOptionsSubtitle}>
            Choose an action for this exercise
          </Text>
          
          <View style={styles.exerciseOptionsContent}>
                        {/* Replace Exercise Option */}
            <TouchableOpacity
                activeOpacity={0.5} style={styles.exerciseOptionItem} onPress={handleReplaceExercise}>
              <View style={styles.exerciseOptionIcon}>
                <Ionicons name="swap-horizontal-outline" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.exerciseOptionTextContainer}>
                <Text style={styles.exerciseOptionTitle}>Replace Exercise</Text>
                <Text style={styles.exerciseOptionSubtitle}>Choose a different exercise to replace this one</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>
            {/* Reorder Option */}
            <TouchableOpacity
                activeOpacity={0.5} style={styles.exerciseOptionItem} onPress={handleReorderExercises}>
              <View style={styles.exerciseOptionIcon}>
                <Ionicons name="reorder-three-outline" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.exerciseOptionTextContainer}>
                <Text style={styles.exerciseOptionTitle}>Reorder Exercises</Text>
                <Text style={styles.exerciseOptionSubtitle}>Change the order of exercises in your routine</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>

            {/* Remove Exercise Option */}
            <TouchableOpacity
                activeOpacity={0.5} style={[styles.exerciseOptionItem, styles.destructiveOption]} onPress={handleRemoveExercise}>
              <View style={styles.exerciseOptionIcon}>
                <Ionicons name="trash-outline" size={24} color={colors.notification} />
              </View>
              <View style={styles.exerciseOptionTextContainer}>
                <Text style={[styles.exerciseOptionTitle, styles.destructiveText]}>Remove Exercise</Text>
                <Text style={styles.exerciseOptionSubtitle}>Permanently remove this exercise from your routine</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.notification} />
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* Reorder Bottom Sheet */}
<BottomSheet
  ref={reorderBottomSheetRef}
  index={-1}
  snapPoints={reorderSnapPoints}
  onChange={handleReorderSheetChanges}
  backgroundStyle={styles.bottomSheetBackground}
  handleIndicatorStyle={styles.bottomSheetIndicator}
  backdropComponent={(props) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
    />
  )}
  enablePanDownToClose={true}
>
  <BottomSheetView style={styles.reorderModalContent}>
    <Text style={styles.reorderModalTitle}>Reorder Exercises</Text>
    <Text style={styles.reorderModalSubtitle}>
      Hold and drag exercises to change their order
    </Text>
    
    <View style={styles.reorderExerciseList}>
      <DraggableFlatList
        data={exercises}
        keyExtractor={item => item.id.toString()}
        onDragBegin={() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (error) {
            // Fallback for devices without haptics
          }
        }}
        onDragEnd={({ data }) => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (error) {
            // Fallback for devices without haptics
          }
          setExercises(data);
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, drag, isActive }) => (
          <TouchableOpacity
                activeOpacity={0.5}
            onLongPress={drag}
            delayLongPress={100}
            style={[
              styles.reorderExerciseItem,
              isActive && styles.reorderExerciseItemActive
            ]}
          >
            {/* Exercise Image */}
            {item.image_url && !failedImages.has(item.id.toString()) ? (
              <Image 
                source={{ uri: item.image_url }}
                style={styles.reorderExerciseImage}
                resizeMode="cover"
                onError={() => {
                  setFailedImages(prev => new Set(prev).add(item.id.toString()));
                }}
              />
            ) : (
              <View style={styles.reorderExerciseImagePlaceholder}>
                <Ionicons 
                  name={(!item.exerciseId || item.exerciseId.startsWith('custom-')) ? "construct-outline" : "barbell-outline"} 
                  size={18} 
                  color={colors.secondaryText} 
                />
              </View>
            )}
            
            <View style={styles.reorderExerciseInfo}>
              <View style={styles.reorderExerciseNameRow}>
                <Text style={styles.reorderExerciseName}>{item.name}</Text>
                {/* Custom Exercise Badge */}
                {(!item.exerciseId || item.exerciseId.startsWith('custom-')) && (
                  <View style={styles.reorderCustomBadge}>
                    <Text style={styles.reorderCustomBadgeText}>Custom</Text>
                  </View>
                )}
              </View>
              <Text style={styles.reorderExerciseStats}>
                {item.sets.length} sets • {
                  item.repMode === 'range' && item.defaultRepsMin !== null && item.defaultRepsMax !== null
                    ? `${item.defaultRepsMin}-${item.defaultRepsMax} reps`
                    : item.defaultRepsMin !== null
                    ? `${item.defaultRepsMin} reps`
                    : '- reps'
                }
              </Text>
            </View>
            <View style={styles.reorderDragHandle}>
              <Ionicons name="reorder-three-outline" size={24} color={colors.secondaryText} />
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
    
    <View style={styles.reorderModalFooter}>
      <TouchableOpacity
                activeOpacity={0.5} 
        style={styles.reorderDoneButton}
        onPress={() => reorderBottomSheetRef.current?.close()}
      >
        <Text style={styles.reorderDoneButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  </BottomSheetView>
</BottomSheet>

      {/* Rep Selection Bottom Sheet */}
      <BottomSheet
        ref={repSelectionBottomSheetRef}
        index={-1}
        snapPoints={repSelectionSnapPoints}
        onChange={handleRepSelectionSheetChanges}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
          />
        )}
      >
        <BottomSheetView style={styles.repSelectionModalContent}>
          <Text style={styles.repSelectionTitle}>Rep Mode</Text>
          <Text style={styles.repSelectionSubtitle}>
            Choose how to set reps for all sets in this exercise
          </Text>
          
          <View style={styles.repSelectionContent}>
            {/* Single Reps Option */}
            <TouchableOpacity
              activeOpacity={0.5}
              style={styles.repSelectionOption}
              onPress={() => {
                if (selectedSetForReps) {
                  // Change rep mode for entire exercise
                  changeExerciseRepMode(selectedSetForReps.exerciseId, 'single');
                }
                repSelectionBottomSheetRef.current?.close();
              }}
            >
              <View style={styles.repSelectionOptionIcon}>
                <Ionicons name="calculator-outline" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.repSelectionOptionTextContainer}>
                <Text style={styles.repSelectionOptionTitle}>Single Rep Count</Text>
                <Text style={styles.repSelectionOptionSubtitle}>Set a specific number of reps (e.g. 10 reps)</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>

            {/* Rep Range Option */}
            <TouchableOpacity
              activeOpacity={0.5}
              style={styles.repSelectionOptionLast}
              onPress={() => {
                if (selectedSetForReps) {
                  // Change rep mode for entire exercise
                  changeExerciseRepMode(selectedSetForReps.exerciseId, 'range');
                }
                repSelectionBottomSheetRef.current?.close();
              }}
            >
              <View style={styles.repSelectionOptionIcon}>
                <Ionicons name="resize-outline" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.repSelectionOptionTextContainer}>
                <Text style={styles.repSelectionOptionTitle}>Rep Range</Text>
                <Text style={styles.repSelectionOptionSubtitle}>Set a range of reps (e.g. 8-12 reps)</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* Set Edit Bottom Sheet */}
      <BottomSheet
        ref={setEditBottomSheetRef}
        index={-1}
        snapPoints={setEditSnapPoints}
        onChange={handleSetEditSheetChanges}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
          />
        )}
        android_keyboardInputMode="adjustResize"
      >
        <BottomSheetView style={[styles.setEditBottomSheetContent, Platform.OS === 'android' && styles.setEditAndroidHeight]}>
          {selectedSetForEdit && (() => {
            const exercise = exercises.find(ex => ex.id === selectedSetForEdit.exerciseId);
            const set = exercise?.sets.find(s => s.id === selectedSetForEdit.setId);
            const setIndex = exercise?.sets.findIndex(s => s.id === selectedSetForEdit.setId) || 0;
            
            if (!exercise || !set) return null;
            
            return (
              <>
                <View style={styles.setEditHeader}>
                  <Text style={styles.setEditTitle}>
                    {exercise.name}
                  </Text>
                  <Text style={styles.setEditSubtitle}>
                    Set {setIndex + 1}
                  </Text>
                </View>
                
                <View style={styles.setEditInputsHorizontal}>
                  <View style={styles.setEditInputGroupHorizontal}>
                    <Text style={styles.setEditInputLabelHorizontal}>Weight ({weightUnit})</Text>
                    <BottomSheetTextInput
                      style={styles.setEditInputHorizontal}
                      value={set.weight?.toString() || ''}
                      onChangeText={(text) => {
                        const value = text === '' ? null : parseFloat(text);
                        if (text === '' || (!isNaN(value!) && value! >= 0)) {
                          updateSet(selectedSetForEdit.exerciseId, selectedSetForEdit.setId, 'weight', value);
                        }
                      }}
                      placeholder="-"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      keyboardType="numeric"
                      selectTextOnFocus={true}
                    />
                  </View>
                  
                  <View style={styles.setEditInputGroupHorizontal}>
                    <Text style={styles.setEditInputLabelHorizontal}>Reps</Text>
                    {set.isRange ? (
                      <View style={styles.setEditRepRangeContainer}>
                        <BottomSheetTextInput
                          style={styles.setEditRepRangeInput}
                          value={set.repsMin?.toString() || ''}
                          onChangeText={(text) => {
                            const value = text === '' ? null : parseInt(text);
                            if (text === '' || (!isNaN(value!) && value! >= 1)) {
                              updateSet(selectedSetForEdit.exerciseId, selectedSetForEdit.setId, 'repsMin', value);
                            }
                          }}
                          placeholder="-"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          keyboardType="numeric"
                          selectTextOnFocus={true}
                        />
                        <Text style={styles.setEditRepRangeSeparator}>to</Text>
                        <BottomSheetTextInput
                          style={styles.setEditRepRangeInput}
                          value={set.repsMax?.toString() || ''}
                          onChangeText={(text) => {
                            const value = text === '' ? null : parseInt(text);
                            if (text === '' || (!isNaN(value!) && value! >= 1)) {
                              updateSet(selectedSetForEdit.exerciseId, selectedSetForEdit.setId, 'repsMax', value);
                            }
                          }}
                          placeholder="-"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          keyboardType="numeric"
                          selectTextOnFocus={true}
                        />
                      </View>
                    ) : (
                      <BottomSheetTextInput
                        style={styles.setEditInputHorizontal}
                        value={set.reps?.toString() || ''}
                        onChangeText={(text) => {
                          const value = text === '' ? null : parseInt(text);
                          if (text === '' || (!isNaN(value!) && value! >= 1)) {
                            updateSet(selectedSetForEdit.exerciseId, selectedSetForEdit.setId, 'reps', value);
                          }
                        }}
                        placeholder="-"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        keyboardType="numeric"
                        selectTextOnFocus={true}
                      />
                    )}
                  </View>
                  
                  <View style={styles.setEditInputGroupHorizontal}>
                    <Text style={styles.setEditInputLabelHorizontal}>RPE</Text>
                    <TouchableOpacity
                      style={[styles.setEditInputHorizontal, styles.setEditRpeSelector]}
                      onPress={() => {
                        openRpeModal(selectedSetForEdit.exerciseId, selectedSetForEdit.setId, set.rpe as number);
                        setEditBottomSheetRef.current?.close();
                      }}
                    >
                      <Text style={[
                        styles.setEditRpeSelectorText,
                        !set.rpe && styles.setEditRpePlaceholderText
                      ]}>
                        {set.rpe || "-"}
                      </Text>
                      <View style={styles.setEditRpeChevron}>
                        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            );
          })()}
        </BottomSheetView>
      </BottomSheet>

      {/* RPE Bottom Sheet */}
      <BottomSheet
        ref={rpeBottomSheetRef}
        index={-1}
        snapPoints={rpeSnapPoints}
        onChange={handleRpeSheetChanges}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
          />
        )}
        enableContentPanningGesture={false}
      >
        <BottomSheetView style={styles.rpeModalContent}>
          <Text style={styles.rpeModalTitle}>RPE</Text>
          
          <Text style={styles.rpeModalSubtitle}>
            Scroll or tap to select your RPE
          </Text>
          
          <View style={styles.rpeSelector}>
            <View style={styles.rpeArrowContainer}>
              <Ionicons name="chevron-down" size={24} color={colors.primaryText} />
            </View>

            <RpeSelector
              data={rpeData}
              selectedIndex={currentRpeIndex}
              onIndexChange={setCurrentRpeIndex}
              itemWidth={80}
            />

            <View style={styles.rpeArrowContainer}>
              <Ionicons name="chevron-up" size={24} color={colors.primaryText} />
            </View>
          </View>
          
          <View style={styles.rpeInfoContainer}>
            <Text style={styles.rpeInfoLabel}>{rpeData[currentRpeIndex].label}</Text>
            <Text style={styles.rpeInfoDescription}>{rpeData[currentRpeIndex].description}</Text>
          </View>
          
          <View style={styles.rpeModalButtons}>
            <TouchableOpacity
              activeOpacity={0.5} 
              style={styles.rpeApplyButton}
              onPress={applyRpeSelection}
            >
              <Text style={styles.rpeApplyButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* RPE Tooltip */}
      {showRpeTooltip && (
        <View style={[
          styles.rpeTooltip, 
          { top: rpeTooltipPosition.y + 10, left: rpeTooltipPosition.x - 210 }
        ]}>
          <View style={styles.rpeTooltipArrow} />
          <Text style={styles.rpeTooltipTitle}>RPE (Rate of Perceived Exertion)</Text>
          <Text style={styles.rpeTooltipDescription}>
            RPE is a scale from 1-10 that measures how difficult your set felt. 
            It helps track training intensity and plan progressive overload.
          </Text>
          <View style={styles.rpeTooltipExamples}>
            <Text style={styles.rpeTooltipExampleTitle}>Quick Guide:</Text>
            <Text style={styles.rpeTooltipExample}>• RPE 6-7: Moderate intensity</Text>
            <Text style={styles.rpeTooltipExample}>• RPE 8: Hard, 2 reps left</Text>
            <Text style={styles.rpeTooltipExample}>• RPE 9: Very hard, 1 rep left</Text>
            <Text style={styles.rpeTooltipExample}>• RPE 10: Maximum effort</Text>
          </View>
          <TouchableOpacity 
            style={styles.rpeTooltipCloseButton}
            onPress={() => setShowRpeTooltip(false)}
          >
            <Text style={styles.rpeTooltipCloseButtonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Backdrop for RPE Tooltip */}
      {showRpeTooltip && (
        <TouchableOpacity 
          style={styles.rpeTooltipBackdrop}
          activeOpacity={1}
          onPress={() => setShowRpeTooltip(false)}
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingTop: 53,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 1,
    backgroundColor: colors.brand,
  },

  headerButton: {
    padding: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    flex: 1,
    textAlign: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  editableHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    backgroundColor: colors.whiteOverlayLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 35,
  },
  headerTitleInput: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    backgroundColor: colors.whiteOverlayLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 16,
    color: colors.brand,
    fontWeight: '400',
  },
  saveText: {
    fontSize: 16,
    color: colors.brand,
    fontWeight: '600',
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  saveTextDisabled: {
    color: colors.secondaryText,
  },
  contentContainer: {
    flex: 1,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.primaryText,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  emptyStateButtonText: {
    color: colors.primaryText,
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 8,
  },
  exercisesContainer: {
    marginBottom: 20,
  },
  exerciseCard: {
    padding: 16,
    borderBottomColor: colors.whiteOverlay,
    borderBottomWidth: 1,
    backgroundColor: colors.background,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseTitlePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseNameAndBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseNamePressable: {
    paddingVertical: 2,
    flex: 1,
  },
  exerciseOptionsButton: {
    padding: 8,
    marginLeft: 12,
  },

  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.brand,
    flex: 1,
  },

  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  addExerciseContainer: {
    padding: 16,
  },
  addExerciseButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  // Exercise Card New Styles
  exerciseNameContainer: {
    flex: 1,
    marginLeft: 8,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: colors.primaryText,
  },
  exerciseImagePlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: colors.whiteOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.whiteOverlayLight,
  },

  // Bottom Sheet Styles
  bottomSheetBackground: {
    backgroundColor: colors.primaryAccent,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  bottomSheetIndicator: {
    backgroundColor: colors.secondaryText,
    width: 50,
  },
  exerciseOptionsModalContent: {
    flex: 1,
    padding: 10,
  },
  exerciseOptionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  exerciseOptionsSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    paddingBottom: 12,
  },
  exerciseOptionsContent: {
    flex: 1,
  },
  exerciseOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
  },
  exerciseOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.whiteOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  exerciseOptionTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  exerciseOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 4,
  },
  exerciseOptionSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    lineHeight: 20,
  },
  destructiveOption: {
    marginTop: 8,
  },
  destructiveText: {
    color: colors.notification,
  },
  reorderModalContent: {
    flex: 1,
    padding: 10,
  },
  reorderModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  reorderModalSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    paddingBottom: 12,
  },
  reorderExerciseList: {
    flex: 1,
    maxHeight: 300,
  },
  reorderExerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.overlay,
    borderRadius: 8,
    marginBottom: 8,
  },
  reorderExerciseItemActive: {
    backgroundColor: colors.whiteOverlay,
  },
  reorderExerciseImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: colors.primaryText,
  },
  reorderExerciseImagePlaceholder: {
  width: 36,
  height: 36,
  borderRadius: 18,
  marginRight: 12,
  backgroundColor: colors.whiteOverlay,
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: colors.whiteOverlayLight,
},
  reorderExerciseInfo: {
    flex: 1,
    marginLeft: 12,
  },
  reorderExerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  reorderExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  reorderCustomBadge: {
    backgroundColor: colors.customBadgeBg,
    borderColor: colors.customBadgeBorder,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6,
  },
  reorderCustomBadgeText: {
    color: colors.customBadgeText,
    fontSize: 8,
    fontWeight: '600',
  },
  reorderExerciseStats: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  reorderDragHandle: {
    padding: 8,
  },
reorderModalFooter: {
  paddingVertical: 16,
  borderTopWidth: 1,
  borderTopColor: colors.whiteOverlay,
},
  reorderDoneButton: {
    backgroundColor: colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  reorderDoneButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 16,
  },
  customBadge: {
    backgroundColor: colors.customBadgeBg,
    borderColor: colors.customBadgeBorder,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  customBadgeText: {
    color: colors.customBadgeText,
    fontSize: 10,
    fontWeight: '600',
  },

  // Sets section styles
  setsSection: {
    marginBottom: 16,
  },
  repsColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 0,
    minWidth: 20,
  },
  rpeColumnHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 4,
  },
  // Column headers
  setColumnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  setColumnHeader: {
    flex: 1,
    fontSize: 12,
    color: colors.secondaryText,
    marginRight: 12,
    minWidth: 20,
  },
  setHeaderLabel: {
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: 'center',
  },
  setNumberColumn: {
    width: 40,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  setInputColumn: {
    flex: 1,
    flexDirection: 'row',
    marginHorizontal: 4,
    textAlign: 'center',
    gap: 18,
    justifyContent: 'center',
  },
  rpeHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  rpeQuestionIcon: {
    marginLeft: 4,
  },
  
  // Add set button - full width below sets
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryAccent,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  addSetButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },

  // SwipeRow and set styles
  hiddenItem: {
    width: 80,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingRight: 0,
  },
  deleteButton: {
    backgroundColor: colors.notification,
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: 340,
    height: '100%',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    marginRight: 2,
    marginLeft: 2,
    paddingRight: 20,
  },
  deleteText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  
  // SetItem component styles (from newWorkout)
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
    backgroundColor: colors.primaryAccent,
    borderRadius: 8,
  },
  setPressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 8,
    pointerEvents: 'none',
  },
  setText: {
    fontSize: 14,
    color: colors.secondaryText,
    fontWeight: 'bold',
    textAlign: 'center',
    justifyContent: 'flex-end',
  },
  setValueDisplay: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 40,
    paddingVertical: 8,
  },
  setValueText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  completedSetText: {
    opacity: 0.7,
  },
  placeholderSetText: {
    color: colors.secondaryText,
    opacity: 0.6,
  },
  repRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  repRangeSeparator: {
    fontSize: 14,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  setRowCompletionRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(38, 194, 129, 0.2)',
    borderRadius: 8,
    pointerEvents: 'none',
  },
  setFieldErrorOverlay: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
    borderRadius: 6,
    pointerEvents: 'none',
  },
  checkboxColumn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 8,
    borderColor: colors.secondaryText,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCheckboxCompleted: {
    backgroundColor: 'rgba(38, 194, 129, 0.7)',
    borderColor: 'rgba(38, 194, 129, 0.7)',
  },
  disabledCheckbox: {
    opacity: 0.4,
  },

  // Rep Selection Modal styles - matching exercise options
  repSelectionModalContent: {
    padding: 24,
  },
  repSelectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  repSelectionSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  repSelectionContent: {
    gap: 0,
  },
  repSelectionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  repSelectionOptionIcon: {
    width: 44,
    height: 44,
    backgroundColor: colors.whiteOverlayLight,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  repSelectionOptionTextContainer: {
    flex: 1,
  },
  repSelectionOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 2,
  },
  repSelectionOptionSubtitle: {
    fontSize: 13,
    color: colors.secondaryText,
    lineHeight: 18,
  },
  repSelectionOptionLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 0,
  },
  
  // Set Edit Bottom Sheet Styles (matching newWorkout.tsx)
  setEditBottomSheetContent: {
    flex: 1,
    padding: 10,
    paddingBottom: 30,
    backgroundColor: colors.primaryAccent,
  },
  setEditHeader: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  setEditTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 6,
  },
  setEditSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 0,
  },
  setEditInputsHorizontal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
    marginBottom: 0,
  },
  setEditInputGroupHorizontal: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  setEditInputLabelHorizontal: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.secondaryText,
    textAlign: 'center',
  },
  setEditInputHorizontal: {
    backgroundColor: colors.secondaryAccent,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    color: colors.primaryText,
    textAlign: 'center',
    minWidth: 80,
    fontWeight: '600',
  },
  setEditRepRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setEditRepRangeInput: {
    backgroundColor: colors.secondaryAccent,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    color: colors.primaryText,
    textAlign: 'center',
    minWidth: 50,
    fontWeight: '600',
    flex: 1,
  },
  setEditRepRangeSeparator: {
    fontSize: 14,
    color: colors.secondaryText,
    fontWeight: '500',
  },

  rpeTooltipButton: {
    padding: 2,
    marginLeft: -20,
  },
  setEditRpeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  setEditRpeSelectorText: {
    fontSize: 18,
    color: colors.primaryText,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  setEditRpeChevron: {
    position: 'absolute',
    right: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setEditRpePlaceholderText: {
    color: 'rgba(255,255,255,0.3)',
  },

  // RPE Bottom Sheet Styles
  rpeModalContent: {
    padding: 10,
    flex: 1,
  },
  rpeModalTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  rpeModalSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    paddingBottom: 12,
  },
  rpeSelector: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rpeArrowContainer: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  rpeScrollItem: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeNumberContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.background,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  rpeNumberContainerActive: {
    transform: [{ scale: 1.1 }],
  },
  rpeNumberContainerInactive: {
    transform: [{ scale: 0.8 }],
  },
  rpeNumber: {
    fontWeight: 'bold',
  },
  rpeNumberActive: {
    color: colors.brand,
    fontSize: 60,
  },
  rpeNumberInactive: {
    color: colors.secondaryText,
    fontSize: 52,
  },
  rpeInfoContainer: {
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  rpeInfoLabel: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 8,
    textAlign: 'center',
  },
  rpeInfoDescription: {
    fontSize: 16,
    color: colors.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  rpeModalButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.whiteOverlay,
  },
  rpeApplyButton: {
    flex: 2,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.brand,
    alignItems: 'center',
  },
  rpeApplyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },

  // RPE Tooltip Styles
  rpeTooltip: {
    position: 'absolute',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    maxWidth: 280,
    minWidth: 200,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
    zIndex: 1000,
    elevation: 8,
    shadowColor: colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  rpeTooltipArrow: {
    position: 'absolute',
    top: -6,
    left: 200,
    width: 12,
    height: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.whiteOverlay,
    transform: [{ rotate: '45deg' }],
  },
  rpeTooltipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 8,
  },
  rpeTooltipDescription: {
    fontSize: 14,
    color: colors.secondaryText,
    lineHeight: 20,
    marginBottom: 12,
  },
  rpeTooltipExamples: {
    marginBottom: 16,
  },
  rpeTooltipExampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 6,
  },
  rpeTooltipExample: {
    fontSize: 13,
    color: colors.secondaryText,
    lineHeight: 18,
    marginBottom: 2,
  },
  rpeTooltipCloseButton: {
    backgroundColor: colors.brand,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  rpeTooltipCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryText,
  },
  rpeTooltipBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    opacity: 0.01,
    zIndex: 999,
  },

  // Additional helper styles
  setEditAndroidHeight: {
    height: 300,
  },
  rpeFlatListContent: {
    paddingHorizontal: 120,
  },

  // Additional inline style fixes
  deleteButtonAndroid: {
    bottom: 1,
    right: 2,
  },
  centeredContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnHeaderBold: {
    fontWeight: '600',
  },
  repsHeaderIcon: {
    marginLeft: -16,
    marginRight: 20,
  },

});
