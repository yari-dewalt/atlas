import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable, 
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  FlatList,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard,
  TouchableOpacity,
} from "react-native";
import Svg, { Circle } from 'react-native-svg';
import { Vibration, Animated } from "react-native";
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons as IonIcon } from '@expo/vector-icons';
import { colors } from "../../../constants/colors";
import { useAuthStore } from "../../../stores/authStore";
import { useWorkoutStore } from "../../../stores/workoutStore";
import { getUserWeightUnit, displayWeightForUser } from "../../../utils/weightUtils";
import ExerciseSelectionModal from "./exerciseSelection";
import { supabase } from "../../../lib/supabase";
import { SwipeRow } from 'react-native-swipe-list-view';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { GestureHandlerRootView, PanGestureHandler } from "react-native-gesture-handler";
import DraggableFlatList from "react-native-draggable-flatlist";
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Audio } from 'expo-av';

export default function NewWorkout() {
  const { routineId } = useLocalSearchParams();
  const router = useRouter();
  const { session, profile } = useAuthStore();
  const { 
    startWorkout, 
    activeWorkout, 
    endWorkout, 
    saveWorkoutToDatabase,
    updateWorkoutTime,
    pauseTimer,
    resumeTimer,
    isPaused,
    addExercise,
    updateExercise,
    removeExercise,
    addSet,
    updateSet,
    removeSet,
    toggleSetCompletion,
    isSaving,
    updateActiveWorkout,
    workoutSettings,
    loadWorkoutSettings,
  } = useWorkoutStore();
  
  // Get user's preferred weight unit
  const userWeightUnit = getUserWeightUnit(profile);
  
  const params = useLocalSearchParams();
  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(false);
  const timerIntervalRef = useRef(null);
  const [workoutStats, setWorkoutStats] = useState({ exercises: 0, volume: 0, sets: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [restTimerModalVisible, setRestTimerModalVisible] = useState(false);
  const [restTimerMode, setRestTimerMode] = useState('timer'); // 'timer' or 'stopwatch'
  const restTimerRef = useRef(null);
  const [completionAnimations, setCompletionAnimations] = useState({});
  const [completionRibbonAnimations, setCompletionRibbonAnimations] = useState({});
  const [workoutName, setWorkoutName] = useState(activeWorkout?.name || "Empty Workout");
  const [timeInputModalVisible, setTimeInputModalVisible] = useState(false);
  const [manualHours, setManualHours] = useState('00');
  const [manualMinutes, setManualMinutes] = useState('00');
  const [manualSeconds, setManualSeconds] = useState('00');
  const [focusedInput, setFocusedInput] = useState(null);
  const [showRpeTooltip, setShowRpeTooltip] = useState(false);
  const [rpeTooltipPosition, setRpeTooltipPosition] = useState({ x: 0, y: 0 });
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimerInterval, setRestTimerInterval] = useState(null);
  const [stopwatchActive, setStopwatchActive] = useState(false);
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [stopwatchInterval, setStopwatchInterval] = useState(null);
  const [errorFlashAnimations, setErrorFlashAnimations] = useState({});
  const swipeableRefs = useRef({});
  const [deletionAnimations, setDeletionAnimations] = useState({});
  const [minimizedExercises, setMinimizedExercises] = useState(new Set());
  const [supersets, setSupersets] = useState(new Map()); // Map of supersetId -> Set of exerciseIds
  const [exerciseToSuperset, setExerciseToSuperset] = useState(new Map()); // Map of exerciseId -> supersetId
  const [supersetModalVisible, setSupersetModalVisible] = useState(false);
  const [selectedExerciseForSuperset, setSelectedExerciseForSuperset] = useState(null);
  const [supersetCounter, setSupersetCounter] = useState(0);
  const [reorderModalVisible, setReorderModalVisible] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [restTime, setRestTime] = useState(() => {
    const defaultTime = (workoutSettings.defaultRestMinutes * 60) + workoutSettings.defaultRestSeconds;
    return defaultTime || 120; // Fallback to 2 minutes if no settings
  });
  const [initialRestTime, setInitialRestTime] = useState(() => {
    const defaultTime = (workoutSettings.defaultRestMinutes * 60) + workoutSettings.defaultRestSeconds;
    return defaultTime || 120;
  });
  const [rpeModalVisible, setRpeModalVisible] = useState(false);
  const [selectedExerciseForRpe, setSelectedExerciseForRpe] = useState(null);
  const [selectedSetForRpe, setSelectedSetForRpe] = useState(null);
  const [currentRpeIndex, setCurrentRpeIndex] = useState(5); // Default to RPE 6 (index 5)
  const [isConfirmingRpe, setIsConfirmingRpe] = useState(false); // Track if we're confirming RPE selection
  const [cameFromSetEdit, setCameFromSetEdit] = useState(false); // Track if RPE modal was opened from set edit
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
  const [selectedExercisesForSuperset, setSelectedExercisesForSuperset] = useState(new Set());
  const [showFloatingTimer, setShowFloatingTimer] = useState(false);
  const scrollViewRef = useRef(null);
  const [exerciseOptionsModalVisible, setExerciseOptionsModalVisible] = useState(false);
  const [selectedExerciseForOptions, setSelectedExerciseForOptions] = useState(null);
  
  // Set editing popup state
  const [setEditModalVisible, setSetEditModalVisible] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState(null);
  const [editingSetIndex, setEditingSetIndex] = useState(null);
  const [tempWeight, setTempWeight] = useState('');
  const [tempReps, setTempReps] = useState('');
  const [tempRpe, setTempRpe] = useState('');
  // Bottom Sheet refs
  const restTimerBottomSheetRef = useRef(null);
  const supersetBottomSheetRef = useRef(null);
  const reorderBottomSheetRef = useRef(null);
  const rpeBottomSheetRef = useRef(null);
  const rpeFlatListRef = useRef(null);
  const timeInputBottomSheetRef = useRef(null);
  const exerciseOptionsBottomSheetRef = useRef(null);
  const setEditBottomSheetRef = useRef(null);
  
  // Animation refs for pulse effect
  const stopwatchPulseAnimation = useRef(new Animated.Value(1)).current;
  const floatingTimerPulseAnimation = useRef(new Animated.Value(1)).current;

  // Bottom Sheet snap points
  const supersetSnapPoints = useMemo(() => ['50%'], []);
  const reorderSnapPoints = useMemo(() => ['30%'], []);
  const rpeSnapPoints = useMemo(() => ['50%'], []);
  const exerciseOptionsSnapPoints = useMemo(() => ['50%'], []);
  const setEditSnapPoints = useMemo(() => ['25%'], []);

  // Function to dismiss keyboard
  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setFocusedInput(null);
  };

  // Bottom Sheet callbacks
  const handleExerciseOptionsSheetChanges = useCallback((index) => {
    if (index === -1) {
      setExerciseOptionsModalVisible(false);
      setSelectedExerciseForOptions(null);
    }
  }, []);

  const handleSupersetSheetChanges = useCallback((index) => {
    if (index === -1) {
      setSupersetModalVisible(false);
      setSelectedExercisesForSuperset(new Set());
    }
  }, []);

  const handleReorderSheetChanges = useCallback((index) => {
    if (index === -1) {
      setReorderModalVisible(false);
    }
  }, []);

  const handleRpeSheetChanges = useCallback((index) => {
    if (index === -1) {
      setRpeModalVisible(false);
      setSetEditModalVisible(true);
    }
  }, [cameFromSetEdit, isConfirmingRpe]);

  const handleSetEditSheetChanges = useCallback((index) => {
    if (index === -1) {
      setSetEditModalVisible(false);
      
      // Only reset editing state if we're not going to/coming from RPE modal
      if (!cameFromSetEdit && !isConfirmingRpe) {
        setEditingSet(null);
        setEditingExerciseIndex(null);
        setEditingSetIndex(null);
        setTempWeight('');
        setTempReps('');
        setTempRpe('');
      }
      
      // Dismiss keyboard when BottomSheet closes
      Keyboard.dismiss();
    }
  }, [cameFromSetEdit, isConfirmingRpe]);

  // Functions to open/close bottom sheets
  const toggleRestTimerModal = () => {
    if (restTimerModalVisible) {
      restTimerBottomSheetRef.current?.close();
      setRestTimerModalVisible(false);
    } else {
      setRestTimerModalVisible(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      restTimerBottomSheetRef.current?.expand();
    }
  };

  const openTimeInputModal = () => {
    // Pre-fill with current workout time
    if (activeWorkout) {
      const seconds = activeWorkout.duration;
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      setManualHours(hours.toString().padStart(2, '0'));
      setManualMinutes(minutes.toString().padStart(2, '0'));
      setManualSeconds(secs.toString().padStart(2, '0'));
    }
    
    setTimeInputModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    timeInputBottomSheetRef.current?.expand();
  };

  const openRpeModal = (exerciseId, setId, currentRpe) => {
    Keyboard.dismiss();
    setSelectedExerciseForRpe(exerciseId);
    setSelectedSetForRpe(setId);
    
    // Set the RPE index based on current value (default to index 5 for RPE 6 if no current value)
    let targetIndex = 5; // Default to RPE 6
    if (currentRpe !== null && currentRpe !== undefined) {
      const rpeIndex = rpeData.findIndex(item => item.value === currentRpe);
      targetIndex = rpeIndex >= 0 ? rpeIndex : 5;
    }
    setCurrentRpeIndex(targetIndex);
    
    // Track if we're coming from set edit mode
    setCameFromSetEdit(setEditModalVisible);
    
    // If we're in set edit mode, close it temporarily
    if (setEditModalVisible) {
      setEditBottomSheetRef.current?.close();
    }
    
    setRpeModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rpeBottomSheetRef.current?.expand();
    
    rpeFlatListRef.current?.scrollToIndex({ 
      index: targetIndex, 
      animated: false 
    });
  };

  const showExerciseOptions = (exercise) => {
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

const handleAddToSuperset = () => {
  exerciseOptionsBottomSheetRef.current?.close();
  setTimeout(() => {
    setSelectedExerciseForSuperset(selectedExerciseForOptions);
    setSupersetModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    supersetBottomSheetRef.current?.expand();
  }, 200);
};

const handleRemoveFromSuperset = () => {
  removeFromSuperset(selectedExerciseForOptions.id);
  exerciseOptionsBottomSheetRef.current?.close();
};

const handleRemoveExercise = () => {
  const isInSuperset = exerciseToSuperset.has(selectedExerciseForOptions.id);
  
  Alert.alert(
    "Remove Exercise",
    `Are you sure you want to remove "${selectedExerciseForOptions.name}" from your workout?`,
    [
      {
        text: "Cancel",
        style: "cancel"
      },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          if (isInSuperset) {
            removeFromSuperset(selectedExerciseForOptions.id);
          }
          removeExercise(selectedExerciseForOptions.id);
          exerciseOptionsBottomSheetRef.current?.close();
        }
      }
    ]
  );
};

  // Close functions for bottom sheets
  const applyManualTime = () => {
    const hours = parseInt(manualHours) || 0;
    const minutes = parseInt(manualMinutes) || 0;
    const seconds = parseInt(manualSeconds) || 0;
    
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    updateWorkoutTime(totalSeconds);
    pauseTimer();
    clearInterval(timerIntervalRef.current);
    setTimeInputModalVisible(false);
    
    timeInputBottomSheetRef.current?.close();
  };

  const applyRpeSelection = () => {
    const selectedRpe = rpeData[currentRpeIndex].value;
    const exerciseIndex = activeWorkout.exercises.findIndex(ex => ex.id === selectedExerciseForRpe);
    const setIndex = activeWorkout.exercises[exerciseIndex].sets.findIndex(s => s.id === selectedSetForRpe);
    
    updateSetValue(exerciseIndex, setIndex, 'rpe', selectedRpe);
    
    // If we're in set edit mode, also update the temp RPE value
    if (cameFromSetEdit && selectedExerciseForRpe && selectedSetForRpe) {
      setTempRpe(selectedRpe.toString());
    }
    
    // Mark that we're confirming the RPE selection (this prevents handleRpeSheetChanges from reopening)
    setIsConfirmingRpe(true);
    
    rpeBottomSheetRef.current?.close();
    
    // If we came from set edit mode, reopen it after confirming RPE
    if (cameFromSetEdit) {
      setTimeout(() => {
        // Reopen with the same editing indices we had before
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditBottomSheetRef.current?.expand();
        setIsConfirmingRpe(false); // Reset the flag
        setCameFromSetEdit(false); // Reset the flag
      }, 100);
    } else {
      setIsConfirmingRpe(false); // Reset the flag
      setCameFromSetEdit(false); // Reset the flag
    }
  };

  const handleCreateSuperset = () => {
    if (selectedExercisesForSuperset.size > 0) {
      addMultipleToSuperset(Array.from(selectedExercisesForSuperset), selectedExerciseForSuperset.id);
      supersetBottomSheetRef.current?.close();
      setSelectedExerciseForSuperset(null);
      setSelectedExercisesForSuperset(new Set());
    }
  };

  const handleScroll = (event) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    // Show floating timer when scrolled down more than 100 pixels
    setShowFloatingTimer(scrollY > 100 && workoutSettings.showElapsedTime);
  };

 useEffect(() => {
    // Handle single exercise from custom creation or exercise selection
    if (params?.selectedExercise && params.selectedExercise !== 'undefined' && params.selectedExercise !== 'null') {
      try {
        const exercise = JSON.parse(params.selectedExercise);
        if (exercise && exercise.id) { // Add null check
          addExerciseToWorkout(exercise);
        }
        // Clear the parameter
        router.setParams({ selectedExercise: undefined });
      } catch (error) {
        console.error('Error parsing selected exercise:', error);
      }
    }
    
    // Handle multiple exercises from exercise selection
    if (params?.selectedExercises && params.selectedExercises !== 'undefined' && params.selectedExercises !== 'null' && params?.isMultiple === 'true') {
      try {
        const exercises = JSON.parse(params.selectedExercises);
        if (exercises && Array.isArray(exercises)) { // Add null and array checks
          exercises.forEach(exercise => {
            if (exercise && exercise.id) { // Add null check for each exercise
              addExerciseToWorkout(exercise);
            }
          });
        }
        // Clear the parameters
        router.setParams({ 
          selectedExercises: undefined, 
          isMultiple: undefined 
        });
      } catch (error) {
        console.error('Error parsing selected exercises:', error);
      }
    }
  }, [params?.selectedExercise, params?.selectedExercises, params?.isMultiple]);

  useEffect(() => {
    loadWorkoutSettings();
  }, []);

  // Keep Screen On functionality
  useEffect(() => {
    if (workoutSettings.keepScreenOn && activeWorkout) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
    
    // Cleanup when component unmounts
    return () => {
      deactivateKeepAwake();
    };
  }, [workoutSettings.keepScreenOn, activeWorkout]);

  useEffect(() => {
    if (activeWorkout?.exercises) {
      setExercises(activeWorkout.exercises.map((ex, index) => ({ ...ex, order: index })));
    }
  }, [activeWorkout?.exercises]);

  useEffect(() => {
    if (workoutSettings) {
      const defaultTime = (workoutSettings.defaultRestMinutes * 60) + workoutSettings.defaultRestSeconds;
      if (!restTimerActive) {
        setRestTime(defaultTime);
        setInitialRestTime(defaultTime);
      }
    }
  }, [workoutSettings.defaultRestMinutes, workoutSettings.defaultRestSeconds, restTimerActive]);

  // Pulse animation for stopwatch outer circle
  useEffect(() => {
    if (stopwatchActive) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(stopwatchPulseAnimation, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(stopwatchPulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      
      // Also animate floating timer if visible
      const floatingPulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(floatingTimerPulseAnimation, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(floatingTimerPulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      floatingPulseAnimation.start();
      
      return () => {
        pulseAnimation.stop();
        floatingPulseAnimation.stop();
      };
    } else {
      // Reset animation values when not active
      stopwatchPulseAnimation.setValue(1);
      floatingTimerPulseAnimation.setValue(1);
    }
  }, [stopwatchActive, restTimerMode, restTimerModalVisible]);

  // Function to add multiple exercises to superset
  const addMultipleToSuperset = (exerciseIds, targetExerciseId) => {
    const allExerciseIds = [...exerciseIds, targetExerciseId];
    const currentSuperset = exerciseToSuperset.get(targetExerciseId);
    
    if (currentSuperset !== undefined) {
      // Target exercise is already in a superset, add all selected exercises to it
      const updatedSuperset = new Set(supersets.get(currentSuperset));
      allExerciseIds.forEach(id => updatedSuperset.add(id));
      
      setSupersets(prev => new Map(prev.set(currentSuperset, updatedSuperset)));
      
      // Update exercise to superset mapping for all selected exercises
      setExerciseToSuperset(prev => {
        const newMap = new Map(prev);
        allExerciseIds.forEach(id => newMap.set(id, currentSuperset));
        return newMap;
      });
      activeWorkout.exercises.forEach(exercise => {
        if (allExerciseIds.includes(exercise.id)) {
          // Update the exercise to include the new superset ID
          updateExercise(exercise.id, { superset_id: currentSuperset.toString() });
        }
     });
    } else {
      // Create new superset with all exercises
      const newSupersetId = supersetCounter + 1;
      const newSuperset = new Set(allExerciseIds);
      
      setSupersets(prev => new Map(prev.set(newSupersetId, newSuperset)));
      setExerciseToSuperset(prev => {
        const newMap = new Map(prev);
        allExerciseIds.forEach(id => newMap.set(id, newSupersetId));
        return newMap;
      });
      setSupersetCounter(prev => prev + 1);
      activeWorkout.exercises.forEach(exercise => {
        if (allExerciseIds.includes(exercise.id)) {
          // Update the exercise to include the new superset ID
          updateExercise(exercise.id, { superset_id: newSupersetId.toString() });
        }
     });
    }
  };

  const toggleExerciseSelection = (exerciseId) => {
    setSelectedExercisesForSuperset(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) {
        newSet.delete(exerciseId);
      } else {
        newSet.add(exerciseId);
      }
      return newSet;
    });
  };

  const showExerciseDetails = (exercise) => {
    // Navigate to exercise details screen with exercise data
    router.push({
      pathname: '(app)/(modals)/exerciseDetails',
      params: { 
        exerciseId: exercise.exercise_id || exercise.id, // Use exercise_id if available, fallback to id
        exerciseName: exercise.name,
        fromWorkout: 'true'
      }
    });
  };
  
  // Function to reorder exercises
  const reorderExercises = (newOrder) => {
    // Update the workout store with new exercise order
    const reorderedExercises = newOrder.map(ex => {
      const originalExercise = activeWorkout.exercises.find(orig => orig.id === ex.id);
      return originalExercise;
    });
    
    // Update the active workout with reordered exercises
    updateActiveWorkout({ exercises: reorderedExercises });
    setExercises(newOrder);
  };

  // Superset colors - cycle through these
  const supersetColors = [
    'rgba(255, 107, 107, 0.3)', // Red
    'rgba(54, 162, 235, 0.3)',  // Blue
    'rgba(255, 206, 84, 0.3)',  // Yellow
    'rgba(75, 192, 192, 0.3)',  // Teal
    'rgba(153, 102, 255, 0.3)', // Purple
    'rgba(255, 159, 64, 0.3)',  // Orange
    'rgba(199, 199, 199, 0.3)', // Grey
    'rgba(83, 102, 255, 0.3)',  // Indigo
  ];

  // Function to get superset color
  const getSupersetColor = (supersetId) => {
    return supersetColors[supersetId % supersetColors.length];
  };

  const getTargetSupersetColor = () => {
    const currentSuperset = exerciseToSuperset.get(selectedExerciseForSuperset?.id);
    if (currentSuperset !== undefined) {
      // If the target exercise is already in a superset, use that superset's color
      return getSupersetColor(currentSuperset);
    } else {
      // If creating a new superset, use the color for the next superset ID
      return getSupersetColor(supersetCounter);
    }
  };

  // Function to remove exercise from superset
  const removeFromSuperset = (exerciseId) => {
    const supersetId = exerciseToSuperset.get(exerciseId);
    if (supersetId === undefined) return;
    
    const superset = supersets.get(supersetId);
    if (!superset) return;
    
    const updatedSuperset = new Set(superset);
    updatedSuperset.delete(exerciseId);
    
    if (updatedSuperset.size <= 1) {
      // If only one exercise left, remove the superset entirely
      const remainingExercise = Array.from(updatedSuperset)[0];
      setSupersets(prev => {
        const newMap = new Map(prev);
        newMap.delete(supersetId);
        return newMap;
      });
      setExerciseToSuperset(prev => {
        const newMap = new Map(prev);
        newMap.delete(exerciseId);
        if (remainingExercise) {
          newMap.delete(remainingExercise);
        }
        return newMap;
      });
    } else {
      // Update superset and remove exercise mapping
      setSupersets(prev => new Map(prev.set(supersetId, updatedSuperset)));
      setExerciseToSuperset(prev => {
        const newMap = new Map(prev);
        newMap.delete(exerciseId);
        return newMap;
      });
    }
  };

  const toggleExerciseMinimized = (exerciseId) => {
    setMinimizedExercises(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) {
        newSet.delete(exerciseId);
      } else {
        newSet.add(exerciseId);
      }
      return newSet;
    });
  };

  // Function to close all open swipeables
  const closeAllSwipeables = () => {
    Object.values(swipeableRefs.current).forEach(ref => {
      if (ref && ref.closeRow) {
        ref.closeRow();
      }
    });
  };

  const addExerciseToWorkout = (exercise) => {
    // Generate a unique workout exercise ID
    const workoutExerciseId = `${exercise.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Add the exercise to the workout with unique ID
    addExercise({
      id: workoutExerciseId, // Use unique ID for workout instance
      exercise_id: exercise.id, // Original exercise ID for database relationship
      name: exercise.name,
      defaultSets: exercise.defaultSets || 1,
      image_url: exercise.image_url || null,
      superset_id: exercise.superset_id || null,
    });
  };

  const handleAddExercise = () => {
    router.push({
      pathname: '/(app)/(modals)/exerciseSelection',
      params: { fromNewWorkout: 'true' }
    });
  };
  
  // Add function to update set values
  const updateSetValue = (exerciseIndex, setIndex, field, value) => {
    const exercise = activeWorkout?.exercises[exerciseIndex];
    if (!exercise) return;
    
    const set = exercise.sets[setIndex];
    if (!set) return;
    
    // Create update object
    const update = {};
    update[field] = value;
    
    // Update the set
    updateSet(exercise.id, set.id, update);
  };

  // Set editing popup functions
  const openSetEditModal = (exerciseIndex, setIndex) => {
    const exercise = activeWorkout?.exercises[exerciseIndex];
    const set = exercise?.sets[setIndex];
    
    if (!exercise || !set || set.isCompleted) return;
    
    setEditingExerciseIndex(exerciseIndex);
    setEditingSetIndex(setIndex);
    setEditingSet(set);
    setTempWeight(set.weight !== null ? String(set.weight) : '');
    setTempReps(set.reps !== null ? String(set.reps) : '');
    setTempRpe(set.rpe ? String(set.rpe) : '');
    setSetEditModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditBottomSheetRef.current?.expand();
  };

  const closeSetEditModal = () => {
    setEditBottomSheetRef.current?.close();
  };

  const saveSetEdit = () => {
    if (editingExerciseIndex === null || editingSetIndex === null) return;
    
    // Parse values
    const weightValue = tempWeight === '' ? null : parseFloat(tempWeight);
    const repsValue = tempReps === '' ? null : parseInt(tempReps);
    const rpeValue = tempRpe === '' ? null : parseInt(tempRpe);
    
    // Update weight
    if (weightValue !== editingSet?.weight) {
      updateSetValue(editingExerciseIndex, editingSetIndex, 'weight', isNaN(weightValue) ? null : weightValue);
    }
    
    // Update reps
    if (repsValue !== editingSet?.reps) {
      updateSetValue(editingExerciseIndex, editingSetIndex, 'reps', isNaN(repsValue) ? null : repsValue);
    }
    
    // Update RPE if enabled
    if (workoutSettings.rpeEnabled && rpeValue !== editingSet?.rpe) {
      updateSetValue(editingExerciseIndex, editingSetIndex, 'rpe', isNaN(rpeValue) ? null : rpeValue);
    }
  };

  const toggleTimer = () => {
    if (isPaused) {
      // Resume the timer
      resumeTimer();
      timerIntervalRef.current = setInterval(() => {
        updateWorkoutTime();
      }, 1000);
    } else {
      // Pause the timer
      pauseTimer();
      clearInterval(timerIntervalRef.current);
    }
  };

  const restartTimer = () => {
    // Stop any existing timer
    clearInterval(timerIntervalRef.current);
    
    // Reset the workout time and timer state
    updateWorkoutTime(0);
    
    // Pause the timer (can change to start immediately if needed)
    pauseTimer();
    
    // Start the interval
    timerIntervalRef.current = setInterval(() => {
      updateWorkoutTime();
    }, 1000);
  };

  useEffect(() => {
    if (activeWorkout) {
      // Calculate workout stats - only count completed sets
      let totalCompletedSets = 0;
      let totalVolume = 0;
      
      activeWorkout.exercises.forEach(exercise => {
        exercise.sets.forEach(set => {
          // Only count completed sets
          if (set.isCompleted) {
            totalCompletedSets += 1;
            
            // Only calculate volume for completed sets with valid weight and reps
            if (set.weight && set.reps) {
              totalVolume += set.weight * set.reps;
            }
          }
        });
      });
      
      setWorkoutStats({
        exercises: activeWorkout.exercises.length,
        volume: Math.round(totalVolume),
        sets: totalCompletedSets // Now shows completed sets only
      });
    }
  }, [activeWorkout]);

  useEffect(() => {
    if (activeWorkout?.name) {
      setWorkoutName(activeWorkout.name);
    }
  }, [activeWorkout?.name]);

  useEffect(() => {
    const loadRoutineInfo = async () => {
      if (activeWorkout?.routineId) {
        const routineDetails = await fetchRoutineDetails(activeWorkout.routineId);
        if (routineDetails) {
          setRoutine(routineDetails);
        }
      }
    };
    
    loadRoutineInfo();
  }, [activeWorkout?.routineId]);
  
  // Format duration for display
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };
  
  const stopAnimations = () => {
  };

  const startRestTimer = () => {
  if (restTime > 0) {
    setInitialRestTime(restTime);
    setRestTimerActive(true);
    const interval = setInterval(() => {
      setRestTime(prev => {
        if (prev <= 0) {
          setRestTimerActive(false);
          stopAnimations();
          
          // Clear the interval when timer finishes
          clearInterval(interval);
          setRestTimerInterval(null);
          
          // Handle timer completion feedback with 3 alerts and reset
          handleTimerCompletion();
          
          return 0; // Return 0 briefly, then handleTimerCompletion will reset it
        }
        return prev - 1;
      });
    }, 1000);
    setRestTimerInterval(interval);
  }
};

// Add this new function to handle timer completion feedback
const handleTimerCompletion = async () => {
  let completionCount = 0;
  const maxAlerts = 3; // Alert 3 times then stop
  
  // Play the first alert immediately
  const playAlert = async () => {
    try {
      completionCount++;
      
      // Get user preferences - timer sound and vibration are separate settings
      const timerSoundSetting = workoutSettings.timerSound || 'bell';
      const vibrationEnabled = workoutSettings.vibrationEnabled;
      
      // Handle timer sound (independent of vibration)
      if (timerSoundSetting === 'bell') {
        try {
          const { sound } = await Audio.Sound.createAsync(
            require('../../../assets/sounds/timercomplete.mp3'),
            { shouldPlay: true, volume: 0.8 }
          );
          // Unload after playing
          setTimeout(() => {
            sound.unloadAsync();
          }, 3000);
        } catch (error) {
          console.log('Error playing timer sound:', error);
        }
      }
      // If timerSound is 'none', no sound is played
      
      // Handle vibration (independent of sound setting)
      if (vibrationEnabled) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          // Fallback to basic vibration if Haptics fails
          Vibration.vibrate([500, 200, 500, 200, 500]);
        }
      }
      
      // Reset timer back to original time after the first alert
      if (completionCount === 1) {
        const defaultTime = (workoutSettings.defaultRestMinutes * 60) + workoutSettings.defaultRestSeconds;
        setRestTime(defaultTime);
        setInitialRestTime(defaultTime);
      }
    } catch (error) {
      console.log('Error with timer alert:', error);
      // Only vibrate as fallback if vibration is enabled
      if (workoutSettings.vibrationEnabled) {
        Vibration.vibrate([500, 200, 500]);
      }
    }
  };
  
  // Play first alert immediately
  await playAlert();
  
  // Set up interval for remaining alerts (if any)
  if (completionCount < maxAlerts) {
    const alertInterval = setInterval(async () => {
      await playAlert();
      
      // Stop after maxAlerts
      if (completionCount >= maxAlerts) {
        clearInterval(alertInterval);
      }
    }, 1000); // Alert every 1.0 seconds for remaining alerts
    
    // Safety cleanup after 10 seconds
    setTimeout(() => {
      clearInterval(alertInterval);
    }, 10000);
  }
};
  
  // Update the pauseRestTimer function to reset initial time when cancelled
  const pauseRestTimer = () => {
    setRestTimerActive(false);
    stopAnimations();
    if (restTimerInterval) {
      clearInterval(restTimerInterval);
      setRestTimerInterval(null);
    }
  };
  
  const startStopwatch = () => {
    setStopwatchActive(true);
    const interval = setInterval(() => {
      setStopwatchTime(prev => prev + 1);
    }, 1000);
    setStopwatchInterval(interval);
  };
  
  const pauseStopwatch = () => {
    setStopwatchActive(false);
    stopAnimations();
    if (stopwatchInterval) {
      clearInterval(stopwatchInterval);
      setStopwatchInterval(null);
    }
  };
  
  const resetStopwatch = () => {
    setStopwatchActive(false);
    if (stopwatchInterval) {
      clearInterval(stopwatchInterval);
      setStopwatchInterval(null);
    }
    setStopwatchTime(0);
  };
  
  const adjustRestTimeAndInitial = (seconds) => {
    setRestTime(prev => {
      const newTime = Math.max(0, prev + seconds);
      if (!restTimerActive) {
        setInitialRestTime(newTime);
      }
      return newTime;
    });
  };
  
  const resetToDefaultTime = () => {
    const defaultTime = (workoutSettings.defaultRestMinutes * 60) + workoutSettings.defaultRestSeconds;
    setRestTime(defaultTime);
    setInitialRestTime(defaultTime);
  };
  
  // Format rest timer display
  const formatRestTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const CircularProgress = ({ percentage, size = 200, strokeWidth = 8, color = colors.brand }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference + (percentage / 100) * circumference;
  
    return (
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    );
  };
  
  // Clean up the timer when component unmounts
  useEffect(() => {
    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Initialize the workout
    if (!activeWorkout) {
      startWorkout(routineId, 'routineName');
    }
    
    // Start timer to update workout duration
    if (!isPaused) {
      timerIntervalRef.current = setInterval(() => {
        updateWorkoutTime();
      }, 1000);
    }
    
    // Cleanup when component unmounts
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [routineId, isPaused]);
  
  useEffect(() => {
    const loadRoutineData = async () => {
      if (routineId) {
        setLoading(true);
        try {
          // In a real app, fetch the routine from your API
          // For now, using mock data
          const mockRoutine = mockRoutines.find(r => r.id === Number(routineId));
          setRoutine(mockRoutine);
          
          if (mockRoutine) {
            // Start workout with the routine name
            startWorkout(routineId as string, mockRoutine.name);
            
            // Initialize exercises from the routine
            const routineExercises = mockRoutine.exercises.map(ex => ({
              ...ex,
              sets: Array(ex.totalSets).fill({
                weight: ex.defaultWeight,
                reps: ex.defaultReps,
                isCompleted: false
              })
            }));
            
            setExercises(routineExercises);
          }
        } catch (error) {
          console.error("Error loading routine:", error);
        } finally {
          setLoading(false);
        }
      } else if (!activeWorkout){
        // Start an empty workout
        startWorkout();
      }
    };
    
    loadRoutineData();
    
    // Start timer to update workout duration
    if (!isPaused) {
      timerIntervalRef.current = setInterval(() => {
        updateWorkoutTime();
      }, 1000);
    }
    
    // Cleanup when component unmounts
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [routineId]);
  
  const handleSaveWorkout = () => {
    // Check for uncompleted sets
    let uncompletedSetsCount = 0;
    let exercisesWithUncompletedSets = [];
    
    activeWorkout?.exercises.forEach(exercise => {
      const uncompletedInExercise = exercise.sets.filter(set => !set.isCompleted).length;
      if (uncompletedInExercise > 0) {
        uncompletedSetsCount += uncompletedInExercise;
        exercisesWithUncompletedSets.push({
          name: exercise.name,
          count: uncompletedInExercise
        });
      }
    });
    
    if (uncompletedSetsCount > 0) {
      // Create a detailed message about uncompleted sets
      const exerciseDetails = exercisesWithUncompletedSets
        .map(ex => `• ${ex.name}: ${ex.count} set${ex.count > 1 ? 's' : ''}`)
        .join('\n');
      
      Alert.alert(
        "Uncompleted Sets Found",
        `You have ${uncompletedSetsCount} uncompleted set${uncompletedSetsCount > 1 ? 's' : ''} that won't be counted in your workout:\n\n${exerciseDetails}\n\nWould you like to continue finishing your workout? Only completed sets will be saved.`,
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Continue",
            style: "default",
            onPress: () => {
              router.push('/saveWorkout');
            }
          }
        ]
      );
    } else {
      // No uncompleted sets, proceed normally
      router.push('/saveWorkout');
    }
  };
  
  const fetchRoutineDetails = async (routineId) => {
    if (!routineId) return null;
    
    try {
      const { data, error } = await supabase
        .from('routines')
        .select('id, name')
        .eq('id', routineId)
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching routine details:', error);
      return null;
    }
  };

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        enableTouchThrough={false} // Prevents touches from passing through
        onPress={() => {
          // Dismiss keyboard when backdrop is pressed
          Keyboard.dismiss();
          
          // Close the bottom sheet when backdrop is pressed
          // You'll need to determine which sheet is open and close it
          if (restTimerModalVisible) {
            restTimerBottomSheetRef.current?.close();
          }
          if (supersetModalVisible) {
            supersetBottomSheetRef.current?.close();
          }
          if (reorderModalVisible) {
            reorderBottomSheetRef.current?.close();
          }
          if (rpeModalVisible) {
            rpeBottomSheetRef.current?.close();
          }
          if (timeInputModalVisible) {
            timeInputBottomSheetRef.current?.close();
          }
          if (setEditModalVisible) {
            setEditBottomSheetRef.current?.close();
          }
        }}
      />
    ),
    [restTimerModalVisible, supersetModalVisible, reorderModalVisible, rpeModalVisible, timeInputModalVisible, setEditModalVisible]
  );
  
  return (
    <GestureHandlerRootView>
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 20}
    >
      <View style={styles.header}>
        <TouchableOpacity
                activeOpacity={0.5} 
          onPress={() => {
            closeAllSwipeables();
            router.back();
          }} 
          style={styles.headerButton}
        >
          <IonIcon name="chevron-down" size={24} color={colors.primaryText} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
  {!restTimerModalVisible && (restTimerActive || stopwatchActive) ? (
    // Make timer display pressable when modal is closed and timers are active
    <TouchableOpacity
                activeOpacity={0.5} 
      onPress={() => {
        closeAllSwipeables();
        // Set appropriate mode based on which timer is active
        if (restTimerActive && stopwatchActive) {
          // If both are active, prioritize rest timer
          setRestTimerMode('timer');
        } else if (restTimerActive) {
          setRestTimerMode('timer');
        } else if (stopwatchActive) {
          setRestTimerMode('stopwatch');
        }
        toggleRestTimerModal();
      }}
      style={styles.headerTitleContainer}
    >
      <Text style={styles.headerTitle}>
        {restTimerActive && stopwatchActive ? (
          // Both timers active - show both
          `Rest: ${formatRestTime(restTime)} | SW: ${formatRestTime(stopwatchTime)}`
        ) : restTimerActive ? (
          // Only rest timer active
          `Rest: ${formatRestTime(restTime)}`
        ) : (
          // Only stopwatch active
          `Stopwatch: ${formatRestTime(stopwatchTime)}`
        )}
      </Text>
    </TouchableOpacity>
  ) : (
    // Default title when modal is open or no timers active
    <Text style={styles.headerTitle}>Log workout</Text>
  )}
  
  <TouchableOpacity
                activeOpacity={0.5} 
    onPress={() => {
      closeAllSwipeables();
      router.push('/(app)/(modals)/workoutSettings');
    }} 
    style={styles.settingsButton}
  >
    <IonIcon name="settings-outline" size={22} color={colors.secondaryText} />
  </TouchableOpacity>
</View>

  <View style={styles.headerActions}>
    <TouchableOpacity
                activeOpacity={0.5} 
      onPress={() => {
        closeAllSwipeables();
        toggleRestTimerModal();
      }} 
      style={styles.timerButton}
    >
      <IonIcon name="timer-outline" size={26} color={colors.primaryText} />
    </TouchableOpacity>
    <TouchableOpacity
                activeOpacity={0.5} 
      onPress={() => {
        closeAllSwipeables();
        handleSaveWorkout();
      }} 
      style={styles.finishButton}
    >
      <Text style={styles.finishButtonText}>Finish</Text>
    </TouchableOpacity>
  </View>
</View>

{/* Floating Timer Ribbon */}
      {showFloatingTimer && (
        <Animated.View 
          style={[
            styles.floatingTimerRibbon,
            {
              opacity: showFloatingTimer ? 1 : 0,
            }
          ]}
        >
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.floatingTimerContent}
            onPress={() => {
              // Scroll back to top to show main timer
              scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            }}
          >
            <View style={styles.floatingTimerLeft}>
              <IonIcon name="time-outline" size={20} color={colors.secondaryText} />
              <Text style={[
                styles.floatingTimerText,
                workoutSettings.largeTimerDisplay && styles.largeFloatingTimerText
              ]}>
                {activeWorkout ? formatDuration(activeWorkout.duration) : "00:00:00"}
              </Text>
            </View>

            <View style={styles.floatingTimerRight}>
              <TouchableOpacity
                activeOpacity={0.5} 
                onPress={(e) => {
                  e.stopPropagation(); // Prevent scroll to top
                  toggleTimer();
                }}
                style={styles.floatingTimerButton}
              >
                <IonIcon
                  name={isPaused ? "play-outline" : "pause-outline"}
                  size={20}
                  color={colors.brand}
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      <ScrollView 
        ref={scrollViewRef}
        style={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }} // Add extra padding at bottom
        onScrollBeginDrag={closeAllSwipeables} // Close swipeables when scrolling
        onScroll={handleScroll}
        scrollEventThrottle={16} // Improve scroll performance
        nestedScrollEnabled={false} // Prevent nested scroll conflicts
      >
                <View style={styles.timerContainer}>
          <IonIcon name="time-outline" size={26} color={colors.secondaryText} />
          <TouchableOpacity
                activeOpacity={0.5} 
            onPress={() => {
              closeAllSwipeables();
              openTimeInputModal();
            }} 
            style={styles.timerTextContainer}
          >
            <Text style={[
              styles.timerText,
              workoutSettings.largeTimerDisplay && styles.largeTimerText
            ]}>
              {activeWorkout ? formatDuration(activeWorkout.duration) : "00:00:00"}
            </Text>
          </TouchableOpacity>
          <View style={styles.durationTimerControls}>
          <TouchableOpacity
                activeOpacity={0.5} 
            onPress={() => {
              closeAllSwipeables();
              toggleTimer();
            }} 
            style={styles.timerControlButton}
          >
              <IonIcon
                name={isPaused ? "play-outline" : "pause-outline"}
                size={26}
                color={colors.brand}
              />
            </TouchableOpacity>
            <TouchableOpacity
                activeOpacity={0.5} 
              onPress={() => {
                closeAllSwipeables();
                restartTimer();
              }} 
              style={styles.timerControlButton}
            >
              <IonIcon name="refresh-outline" size={26} color={colors.brand} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.routineAndStatsContainer}>
          {routine && (
            <View style={styles.routineBadge}>
              <IonIcon name="barbell-outline" size={14} color={colors.brand} />
              <Text style={styles.routineText}>{routine.name}</Text>
            </View>
          )}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Exercises</Text>
              <Text style={styles.statValue}>{workoutStats.exercises}</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Volume</Text>
              <Text style={styles.statValue}>
                {workoutStats.volume > 0 ? `${workoutStats.volume} ${userWeightUnit}` : `0 ${userWeightUnit}`}
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Sets</Text>
              <Text style={styles.statValue}>{workoutStats.sets}</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
          </View>
        ) : activeWorkout?.exercises.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <IonIcon name="barbell-outline" size={60} color={colors.secondaryText} />
            <Text style={styles.emptyStateTitle}>No exercises yet</Text>
            <Text style={styles.emptyStateText}>
              Start adding exercises to your workout to track your progress
            </Text>
            <TouchableOpacity
                activeOpacity={0.5}
              style={styles.emptyStateButton}
              onPress={handleAddExercise}
            >
              <IonIcon name="add-circle-outline" size={24} color={colors.primaryText} />
              <Text style={styles.emptyStateButtonText}>Add Your First Exercise</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.exercisesContainer}>
            {activeWorkout?.exercises.map((exercise, exerciseIndex) => {
  const isMinimized = minimizedExercises.has(exercise.id);
  
  return (
    <View key={exercise.id} style={[
      styles.exerciseCard,
    ]}>
      {/* Exercise header with name, minimize button, and options */}
      <View style={styles.exerciseHeader}>
    <View style={styles.exerciseNameContainer}>
    <View style={styles.exerciseTitleRow}>
  {/* Make the entire left side (name + minimize button) pressable */}
  <TouchableOpacity
                activeOpacity={0.5} 
    style={styles.exerciseTitlePressable}
    onPress={() => {
      closeAllSwipeables();
      toggleExerciseMinimized(exercise.id);
    }}
  >
    <View style={styles.exerciseNameAndBadgeContainer}>
  <TouchableOpacity
                activeOpacity={0.5} 
    onPress={() => {
      closeAllSwipeables();
      showExerciseDetails(exercise);
    }}
    style={styles.exerciseNamePressable}
  >
    <View style={styles.exerciseNameRow}>
      {/* Exercise Image */}
      {exercise.image_url ? (
        <Image 
          source={{ uri: exercise.image_url }}
          style={styles.exerciseImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.exerciseImagePlaceholder}>
          <IonIcon 
            name={(!exercise.exercise_id || exercise.exercise_id.startsWith('custom-')) ? "construct-outline" : "barbell-outline"} 
            size={18} 
            color={colors.secondaryText} 
          />
        </View>
      )}
      
      {/* Exercise Name */}
      <Text style={styles.exerciseName}>{exercise.name}</Text>
      
      {/* Custom Exercise Badge */}
      {(!exercise.exercise_id || exercise.exercise_id.startsWith('custom-')) && (
        <View style={styles.customBadge}>
          <Text style={styles.customBadgeText}>Custom</Text>
        </View>
      )}
    </View>
  </TouchableOpacity>
  
  {/* Add superset badge */}
  {exerciseToSuperset.has(exercise.id) && (
    <View style={[
      styles.supersetBadge,
      { backgroundColor: getSupersetColor(exerciseToSuperset.get(exercise.id)) }
    ]}>
      <Text style={styles.supersetBadgeText}>Superset</Text>
    </View>
  )}
</View>
    <IonIcon 
      name={isMinimized ? "chevron-down" : "chevron-up"} 
      size={20} 
      color={colors.secondaryText} 
      style={styles.minimizeIcon}
    />
  </TouchableOpacity>
  
  {/* Keep the options button separate */}
  <TouchableOpacity
                activeOpacity={0.5} 
    style={styles.exerciseOptionsButton}
    onPress={() => {
      closeAllSwipeables();
      showExerciseOptions(exercise);
    }}
  >
    <IonIcon name="ellipsis-horizontal" size={20} color={colors.secondaryText} />
  </TouchableOpacity>
</View>
      
      {/* Show notes input only when not minimized */}
      {!isMinimized && (
        <TextInput
          style={styles.notesInput}
          value={exercise.notes || ''}
          onChangeText={(text) => updateExercise(exercise.id, { notes: text })}
          placeholder="Add notes here..."
          placeholderTextColor={colors.secondaryText}
          multiline={true}
          maxLength={200}
          scrollEnabled={false}
          onFocus={closeAllSwipeables}
        />
      )}
    </View>
  </View>
      
      {/* Show exercise summary when minimized */}
      {isMinimized ? (
        <View style={styles.exerciseSummary}>
          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${(exercise.sets.filter(set => set.isCompleted).length / exercise.sets.length) * 100}%` 
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {exercise.sets.filter(set => set.isCompleted).length}/{exercise.sets.length} sets completed
            </Text>
          </View>
        </View>
      ) : (
        // Show full exercise details when not minimized
        <>
          {/* Set headers */}
          <View style={styles.setHeader}>
            <Text style={[styles.setHeaderLabel, styles.setNumberColumn]}>SET</Text>
            <Text style={[styles.setHeaderLabel, styles.setInputColumn]}>
              WEIGHT
            </Text>
            <Text style={[styles.setHeaderLabel, styles.setInputColumn]}>REPS</Text>
            {workoutSettings.rpeEnabled && (
              <View style={[styles.setHeaderLabel, styles.setInputColumn]}>
                <TouchableOpacity
                activeOpacity={0.5} 
                  onPress={(event) => {
                    closeAllSwipeables();
                    event.target.measure((x, y, width, height, pageX, pageY) => {
                      setRpeTooltipPosition({ x: pageX, y: pageY + height });
                      setShowRpeTooltip(true);
                    });
                  }}
                  style={styles.rpeHeaderContainer}
                >
                  <Text style={styles.setHeaderLabel}>RPE</Text>
                  <IonIcon name="help-circle" size={16} color={colors.secondaryText} style={styles.rpeQuestionIcon} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.checkboxColumn}>
              <IonIcon name="checkmark" size={16} color={colors.secondaryText} />
            </View>
          </View>
          
          {/* Sets - your existing sets mapping code goes here */}
          {exercise.sets.map((set, setIndex) => {
  const setKey = `${exercise.id}-${set.id}`;
  const swipeableKey = setKey;
  const animation = completionAnimations[setKey] || new Animated.Value(set.isCompleted ? 0.8 : 0);
  const ribbonAnimation = completionRibbonAnimations[setKey] || new Animated.Value(set.isCompleted ? 1 : 0);
  const deletionAnim = deletionAnimations[setKey] || new Animated.Value(1);
  
  // Get or create error flash animations for individual fields
  const weightErrorKey = `${setKey}-weight`;
  const repsErrorKey = `${setKey}-reps`;
  const rpeErrorKey = `${setKey}-rpe`;
  
  const weightErrorFlash = errorFlashAnimations[weightErrorKey] || new Animated.Value(0);
  const repsErrorFlash = errorFlashAnimations[repsErrorKey] || new Animated.Value(0);
  const rpeErrorFlash = errorFlashAnimations[rpeErrorKey] || new Animated.Value(0);
  
  // Validation: check if required fields are filled
  const hasWeight = set.weight !== null && set.weight !== undefined && set.weight !== 0;
  const hasReps = set.reps !== null && set.reps !== undefined && set.reps !== 0;
  const isValid = hasWeight && hasReps;
  
  // Ensure we have animation objects for this set
  if (!completionAnimations[setKey]) {
    setCompletionAnimations(prev => ({...prev, [setKey]: animation}));
  }
  if (!completionRibbonAnimations[setKey]) {
    setCompletionRibbonAnimations(prev => ({...prev, [setKey]: ribbonAnimation}));
  }
  if (!errorFlashAnimations[weightErrorKey]) {
    setErrorFlashAnimations(prev => ({...prev, [weightErrorKey]: weightErrorFlash}));
  }
  if (!errorFlashAnimations[repsErrorKey]) {
    setErrorFlashAnimations(prev => ({...prev, [repsErrorKey]: repsErrorFlash}));
  }
  if (!errorFlashAnimations[rpeErrorKey]) {
    setErrorFlashAnimations(prev => ({...prev, [rpeErrorKey]: rpeErrorFlash}));
  }
  
  // Flash error animation function for specific input fields
  const flashError = (exerciseId, setId, missingFields) => {
    const setKey = `${exerciseId}-${setId}`;
    
    // Create animation promises for each missing field
    const animations = [];
    
    missingFields.forEach(field => {
      const fieldErrorKey = `${setKey}-${field}`;
      const fieldErrorFlash = errorFlashAnimations[fieldErrorKey];
      
      if (fieldErrorFlash) {
        const fieldAnimation = Animated.sequence([
          Animated.timing(fieldErrorFlash, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(fieldErrorFlash, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(fieldErrorFlash, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(fieldErrorFlash, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
        ]);
        animations.push(fieldAnimation);
      }
    });
    
    // Run all field animations in parallel
    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }
  };
  
  
  return (
    <Animated.View
      key={set.id}
      style={{
        opacity: deletionAnim, // Only fade opacity
      }}
    >
      <SwipeRow
        rightOpenValue={-80}
        disableRightSwipe={true}
        disableLeftSwipe={exercise.sets.length === 1} // Disable swipe if only one set
        
        // Sensitivity adjustments
        friction={100}
        tension={40}
        directionalDistanceChangeThreshold={10}
        swipeToOpenPercent={30}
        swipeToClosePercent={30}
        
        // Gesture handling
        stopLeftSwipe={-1}
        stopRightSwipe={-80}
        
        // Close behavior
        closeOnRowPress={true}
        closeOnScroll={true}
        
        onRowDidOpen={() => {
          // Close other swipeables
          Object.keys(swipeableRefs.current).forEach(key => {
            if (key !== swipeableKey && swipeableRefs.current[key]) {
              swipeableRefs.current[key].closeRow();
            }
          });
        }}
        
        ref={ref => {
          if (ref) {
            swipeableRefs.current[swipeableKey] = ref;
          }
        }}
      >
        {/* Hidden item (shows when swiped) */}
        <View style={styles.hiddenItem}>
          <TouchableOpacity
                activeOpacity={0.5}
            style={[styles.deleteButton, Platform.OS === 'ios' ? {} : { bottom: 1, right: 2 }]}
            onPress={() => {
              // Start simple fade out animation
              Animated.timing(deletionAnim, {
                toValue: 0,
                duration: 250, // Slightly faster
                useNativeDriver: false,
              }).start(() => {
                // Remove the set after animation completes
                removeSet(exercise.id, set.id);
                
                // Clean up the animation
                setDeletionAnimations(prev => {
                  const newAnims = { ...prev };
                  delete newAnims[setKey];
                  return newAnims;
                });
              });
            }}
          >
            <IonIcon name="trash-outline" size={20} color="white" />
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
        
        <Pressable
          style={[
            styles.setRow,
            set.isCompleted && styles.completedSetRow,
          ]}
          onPress={() => {
            if (!set.isCompleted) {
              closeAllSwipeables();
              openSetEditModal(exerciseIndex, setIndex);
            }
          }}
          disabled={set.isCompleted}
        >
          {({ pressed }) => (
            <>
              {/* Press feedback overlay - only show when pressed and not completed */}
              {pressed && !set.isCompleted && (
                <View style={styles.setPressOverlay} />
              )}          
          {/* Add green completion ribbon */}
          <Animated.View
            style={[
              styles.setRowCompletionRibbon,
              {
                opacity: ribbonAnimation,
                transform: [{
                  translateX: ribbonAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-100, 0],
                  })
                }]
              }
            ]}
          />
          
          {/* Set number */}
          <Text style={[styles.setText, styles.setNumberColumn]}>{setIndex + 1}</Text>
          
          {/* Weight display */}
          <View style={[styles.setInputColumn, styles.setValueDisplay]}>
            {/* Weight error overlay */}
            <Animated.View
              style={[
                styles.setFieldErrorOverlay,
                {
                  opacity: weightErrorFlash.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                }
              ]}
            />
            <Text style={[
              styles.setValueText,
              set.isCompleted && styles.completedSetText,
              (!set.weight && !set.isCompleted) && styles.placeholderSetText
            ]}>
              {set.weight !== null && set.weight !== undefined && set.weight !== 0 ? `${String(set.weight)} ${userWeightUnit}` : "-"}
            </Text>
          </View>

          {/* Reps display */}
          <View style={[styles.setInputColumn, styles.setValueDisplay]}>
            {/* Reps error overlay */}
            <Animated.View
              style={[
                styles.setFieldErrorOverlay,
                {
                  opacity: repsErrorFlash.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                }
              ]}
            />
            <Text style={[
              styles.setValueText,
              set.isCompleted && styles.completedSetText,
              (!set.reps && !set.isCompleted) && styles.placeholderSetText
            ]}>
              {set.reps !== null && set.reps !== undefined && set.reps !== 0 ? String(set.reps) : "-"}
            </Text>
          </View>

          {/* RPE display */}
          {workoutSettings.rpeEnabled && (
            <View style={[styles.setInputColumn, styles.setValueDisplay]}>
              {/* RPE error overlay */}
              <Animated.View
                style={[
                  styles.setFieldErrorOverlay,
                  {
                    opacity: rpeErrorFlash.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  }
                ]}
              />
              <Text style={[
                styles.setValueText,
                set.isCompleted && styles.completedSetText,
                (!set.rpe && !set.isCompleted) && styles.placeholderSetText
              ]}>
                {set.rpe !== null && set.rpe !== undefined && set.rpe !== 0 ? String(set.rpe) : "-"}
              </Text>
            </View>
          )}
          
          {/* Completion checkbox */}
          <TouchableOpacity
            activeOpacity={0.5}
            onPress={(e) => {
              e.stopPropagation(); // Prevent the set row press from firing
              closeAllSwipeables();
              
              // Validation: check if required fields are filled
              const hasWeight = set.weight !== null && set.weight !== undefined && set.weight !== 0;
              const hasReps = set.reps !== null && set.reps !== undefined && set.reps !== 0;
              const isValid = hasWeight && hasReps;
              
              if (!isValid && !set.isCompleted) {
                try {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                } catch (error) {
                  Vibration.vibrate([100, 50, 100]);
                }
                
                // Get missing fields for error highlighting
                const missingFields = [];
                if (!hasWeight) missingFields.push('weight');
                if (!hasReps) missingFields.push('reps');
                
                flashError(exercise.id, set.id, missingFields);
                return;
              }
              
              const newValue = !set.isCompleted;
              
              if (newValue) {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch (error) {
                  Vibration.vibrate(40);
                }
                
                // Animate both the checkbox bounce and the ribbon slide-in
                Animated.parallel([
                  Animated.sequence([
                    Animated.timing(animation, {
                      toValue: 1,
                      duration: 300,
                      useNativeDriver: true,
                    }),
                    Animated.timing(animation, {
                      toValue: 0.8,
                      duration: 200,
                      useNativeDriver: true,
                    }),
                  ]),
                  Animated.timing(ribbonAnimation, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                  })
                ]).start();
              } else {
                // Animate both out
                Animated.parallel([
                  Animated.timing(animation, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                  }),
                  Animated.timing(ribbonAnimation, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                  })
                ]).start();
              }
              
              toggleSetCompletion(exercise.id, set.id);
            }}
            style={[
              styles.checkboxColumn,
              !isValid && !set.isCompleted && styles.disabledCheckbox
            ]}
          >
            <Animated.View
              style={[
                styles.customCheckbox,
                set.isCompleted && styles.customCheckboxCompleted,
                {
                  transform: [
                    { scale: animation.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 1.2, 1]
                    }) }
                  ]
                }
              ]}
            >
              {set.isCompleted && (
                <IonIcon 
                  name="checkmark" 
                  size={16} 
                  color="white" 
                />
              )}
            </Animated.View>
          </TouchableOpacity>
            </>
          )}
        </Pressable>
      </SwipeRow>
    </Animated.View>
  );
})}
          
          {/* Add set button */}
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.addSetButton}
            onPress={() => {
              closeAllSwipeables();
              addSet(exercise.id);
            }}
          >
            <IonIcon name="add" size={18} color={colors.primaryText} />
            <Text style={styles.addSetButtonText}>Add Set</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
})}     
          </View>
        )}

        {activeWorkout?.exercises.length > 0 && (
          <TouchableOpacity
                activeOpacity={0.5}
            style={styles.addExerciseButton}
            onPress={() => {
              closeAllSwipeables();
              handleAddExercise();
            }}
          >
            <IonIcon name="add" size={18} color={colors.primaryText} />
            <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View>
      <Modal
        animationType="fade"
        transparent={true}
        visible={timeInputModalVisible}
        onRequestClose={() => setTimeInputModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay} 
          onPress={() => setTimeInputModalVisible(false)}
        >
          <View style={styles.timeInputContainer}>
            <Pressable
              style={{flex: 1}}
              onPress={() => {}}
            >
              <View style={styles.timeInputContent}>
                <Text style={styles.timeInputTitle}>Set Workout Duration</Text>
                <Text style={styles.timeInputSubtitle}>
                  Select hours, minutes, and seconds
                </Text>
                
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Hours</Text>
                    {Platform.OS === 'ios' ? (
                      <Picker
                        selectedValue={manualHours}
                        onValueChange={(value) => setManualHours(value)}
                        style={styles.picker}
                        itemStyle={styles.pickerItem}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <Picker.Item 
                            key={i} 
                            label={i.toString().padStart(2, '0')} 
                            value={i.toString().padStart(2, '0')} 
                          />
                        ))}
                      </Picker>
                    ) : (
                      <FlatList
                        data={Array.from({ length: 24 }, (_, i) => ({
                          value: i.toString().padStart(2, '0'),
                          label: i.toString().padStart(2, '0')
                        }))}
                        keyExtractor={(item) => item.value}
                        style={styles.androidInlinePicker}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[
                              styles.androidInlinePickerItem,
                              item.value === manualHours && styles.androidInlinePickerItemSelected
                            ]}
                            onPress={() => setManualHours(item.value)}
                          >
                            <Text style={[
                              styles.androidInlinePickerText,
                              item.value === manualHours && styles.androidInlinePickerTextSelected
                            ]}>
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        )}
                        getItemLayout={(data, index) => ({
                          length: 40,
                          offset: 40 * index,
                          index,
                        })}
                        onScrollToIndexFailed={() => {}}
                      />
                    )}
                  </View>
                  
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Minutes</Text>
                    {Platform.OS === 'ios' ? (
                      <Picker
                        selectedValue={manualMinutes}
                        onValueChange={(value) => setManualMinutes(value)}
                        style={styles.picker}
                        itemStyle={styles.pickerItem}
                      >
                        {Array.from({ length: 60 }, (_, i) => (
                          <Picker.Item 
                            key={i} 
                            label={i.toString().padStart(2, '0')} 
                            value={i.toString().padStart(2, '0')} 
                          />
                        ))}
                      </Picker>
                    ) : (
                      <FlatList
                        data={Array.from({ length: 60 }, (_, i) => ({
                          value: i.toString().padStart(2, '0'),
                          label: i.toString().padStart(2, '0')
                        }))}
                        keyExtractor={(item) => item.value}
                        style={styles.androidInlinePicker}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[
                              styles.androidInlinePickerItem,
                              item.value === manualMinutes && styles.androidInlinePickerItemSelected
                            ]}
                            onPress={() => setManualMinutes(item.value)}
                          >
                            <Text style={[
                              styles.androidInlinePickerText,
                              item.value === manualMinutes && styles.androidInlinePickerTextSelected
                            ]}>
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        )}
                        getItemLayout={(data, index) => ({
                          length: 40,
                          offset: 40 * index,
                          index,
                        })}
                        onScrollToIndexFailed={() => {}}
                      />
                    )}
                  </View>
                  
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Seconds</Text>
                    {Platform.OS === 'ios' ? (
                      <Picker
                        selectedValue={manualSeconds}
                        onValueChange={(value) => setManualSeconds(value)}
                        style={styles.picker}
                        itemStyle={styles.pickerItem}
                        mode="dialog"
                      >
                        {Array.from({ length: 60 }, (_, i) => (
                          <Picker.Item 
                            key={i} 
                            label={i.toString().padStart(2, '0')} 
                            value={i.toString().padStart(2, '0')} 
                            style={{ fontSize: 18}}
                          />
                        ))}
                      </Picker>
                    ) : (
                      <FlatList
                        data={Array.from({ length: 60 }, (_, i) => ({
                          value: i.toString().padStart(2, '0'),
                          label: i.toString().padStart(2, '0')
                        }))}
                        keyExtractor={(item) => item.value}
                        style={styles.androidInlinePicker}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[
                              styles.androidInlinePickerItem,
                              item.value === manualSeconds && styles.androidInlinePickerItemSelected
                            ]}
                            onPress={() => setManualSeconds(item.value)}
                          >
                            <Text style={[
                              styles.androidInlinePickerText,
                              item.value === manualSeconds && styles.androidInlinePickerTextSelected
                            ]}>
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        )}
                        getItemLayout={(data, index) => ({
                          length: 40,
                          offset: 40 * index,
                          index,
                        })}
                        onScrollToIndexFailed={() => {}}
                      />
                    )}
                  </View>
                </View>
                
                <View style={styles.timeInputButtons}>
                  <TouchableOpacity
                activeOpacity={0.5} 
                    style={styles.cancelTimeButton}
                    onPress={() => setTimeInputModalVisible(false)}
                  >
                    <Text style={styles.cancelTimeButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                activeOpacity={0.5} 
                    style={styles.applyTimeButton}
                    onPress={applyManualTime}
                  >
                    <Text style={styles.applyTimeButtonText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
      </View>

      <View>
      <Modal
        animationType="fade"
        transparent={true}
        visible={restTimerModalVisible}
        onRequestClose={toggleRestTimerModal}
      >
        <Pressable
          style={styles.modalOverlay} 
          onPress={toggleRestTimerModal}
        >
          <View style={styles.restTimerContainer}>
            <Pressable onPress={() => {}}>
              <View style={styles.restTimerContent}>
                {/* Mode selector */}
                <View style={styles.modalTimerModeSelector}>
                  <TouchableOpacity
                activeOpacity={0.5} 
                    style={[
                      styles.modalTimerModeButton, 
                      restTimerMode === 'timer' && styles.modalTimerModeButtonActive
                    ]}
                    onPress={() => setRestTimerMode('timer')}
                  >
                    <Text style={[
                      styles.modalTimerModeText,
                      restTimerMode === 'timer' ? styles.modalTimerModeTextActive : styles.modalTimerModeTextInactive
                    ]}>Timer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                activeOpacity={0.5} 
                    style={[
                      styles.modalTimerModeButton, 
                      restTimerMode === 'stopwatch' && styles.modalTimerModeButtonActive
                    ]}
                    onPress={() => setRestTimerMode('stopwatch')}
                  >
                    <Text style={[
                      styles.modalTimerModeText,
                      restTimerMode === 'stopwatch' ? styles.modalTimerModeTextActive : styles.modalTimerModeTextInactive
                    ]}>Stopwatch</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Circular Timer Display */}
                <View style={styles.circularTimerContainer}>
                  {restTimerMode === 'timer' ? (
                    <Animated.View 
                      style={[
                        styles.circularTimer,
                      ]}
                    >
                      <CircularProgress 
                        percentage={restTime > 0 && initialRestTime > 0 ? (restTime / initialRestTime) * 100 : 0}
                        size={200}
                        strokeWidth={12}
                        color={restTimerActive ? colors.brand : colors.secondaryText}
                      />
                      <View style={styles.timerTextOverlay}>
                        <Text style={styles.circularTimerText}>
                          {formatRestTime(restTime)}
                        </Text>
                        <Text style={styles.circularTimerLabel}>REST</Text>
                      </View>
                    </Animated.View>
                  ) : (
                    <Animated.View 
                      style={[
                        styles.circularTimer,
                        {
                          transform: [{ scale: stopwatchPulseAnimation }]
                        }
                      ]}
                    >
                      <CircularProgress 
                        percentage={100}
                        size={200}
                        strokeWidth={12}
                        color={stopwatchActive ? colors.brand : colors.secondaryText}
                      />
                      <View style={styles.timerTextOverlay}>
                        <Text style={styles.circularTimerText}>
                          {formatRestTime(stopwatchTime)}
                        </Text>
                        <Text style={styles.circularTimerLabel}>STOPWATCH</Text>
                      </View>
                    </Animated.View>
                  )}
                </View>
                
                {/* Controls */}
                {restTimerMode === 'timer' ? (
                  <View style={styles.timerControls}>
                    {/* Time adjustment buttons */}
                    <View style={styles.timeAdjustmentRow}>
                      <TouchableOpacity
                activeOpacity={0.5} 
                        style={[styles.timeAdjustButton, { backgroundColor: 'transparent' }]}
                        onPress={() => adjustRestTimeAndInitial(-15)}
                        disabled={restTimerActive || initialRestTime <= 15} // Disable adjustment when timer is running
                      >
                        <Text style={[
                          styles.timeAdjustButtonText,
                          { color: colors.brand },
                          (restTimerActive || initialRestTime <= 15) && { opacity: 0.5 }
                        ]}>-15s</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                activeOpacity={0.5} 
                        style={styles.timeAdjustButton}
                        onPress={resetToDefaultTime}
                        disabled={restTimerActive}
                      >
                        <Text style={[
                          styles.timeAdjustButtonText,
                          restTimerActive && { opacity: 0.5 }
                        ]}>Default</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                activeOpacity={0.5} 
                        style={[styles.timeAdjustButton, { backgroundColor: 'transparent' }]}
                        onPress={() => adjustRestTimeAndInitial(15)}
                        disabled={restTimerActive} // Disable adjustment when timer is running
                      >
                        <Text style={[
                          styles.timeAdjustButtonText,
                          { color: colors.brand },
                          restTimerActive && { opacity: 0.5 }
                        ]}>+15s</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* Start/Cancel buttons */}
                    <View style={styles.primaryControlsRow}>
                      {restTimerActive ? (
                        <TouchableOpacity
                activeOpacity={0.5} 
                          style={[styles.primaryControlButton, styles.cancelButton, styles.fullWidthButton]}
                          onPress={() => {
                            pauseRestTimer();
                          }}
                        >
                          <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                activeOpacity={0.5} 
                          style={[styles.primaryControlButton, styles.startButton, styles.fullWidthButton]}
                          onPress={startRestTimer}
                          disabled={restTime === 0}
                        >
                          <Text style={styles.startButtonText}>Start</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.timerControls}>
                    <View style={styles.primaryControlsRow}>
                      {!stopwatchActive && stopwatchTime > 0 ? (
                        // Show both Reset and Start buttons when stopwatch is stopped and has time
                        <>
                          <TouchableOpacity
                activeOpacity={0.5} 
                            style={[styles.primaryControlButton, styles.resetButton, styles.halfWidthButton]}
                            onPress={resetStopwatch}
                          >
                            <Text style={styles.resetButtonText}>Reset</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                activeOpacity={0.5} 
                            style={[styles.primaryControlButton, styles.startButton, styles.halfWidthButton]}
                            onPress={startStopwatch}
                          >
                            <Text style={styles.startButtonText}>Start</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        // Show only Start/Stop button when stopwatch is running or at zero
                        <TouchableOpacity
                activeOpacity={0.5} 
                          style={[styles.primaryControlButton, styles.startButton, styles.fullWidthButton]}
                          onPress={() => {
                            stopwatchActive ? pauseStopwatch() : startStopwatch();
                          }}
                        >
                          <Text style={styles.startButtonText}>
                            {stopwatchActive ? 'Stop' : 'Start'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
      </View>

      {/* Exercise Options Bottom Sheet */}
<BottomSheet
  ref={exerciseOptionsBottomSheetRef}
  index={-1}
  snapPoints={exerciseOptionsSnapPoints}
  onChange={handleExerciseOptionsSheetChanges}
  enablePanDownToClose={true}
  backgroundStyle={styles.bottomSheetBackground}
  handleIndicatorStyle={styles.bottomSheetIndicator}
  backdropComponent={renderBackdrop}
>
  <BottomSheetView style={styles.exerciseOptionsModalContent}>
      <Text style={styles.exerciseOptionsTitle}>
        {selectedExerciseForOptions?.name}
      </Text>
      <Text style={styles.exerciseOptionsSubtitle}>
        Choose an action for this exercise
      </Text>
    
    <View style={styles.exerciseOptionsContent}>
      {/* Reorder Option */}
      <TouchableOpacity
                activeOpacity={0.5} style={styles.exerciseOptionItem} onPress={handleReorderExercises}>
        <View style={styles.exerciseOptionIcon}>
          <IonIcon name="reorder-three-outline" size={24} color={colors.primaryText} />
        </View> 
        <View style={styles.exerciseOptionTextContainer}>
          <Text style={styles.exerciseOptionTitle}>Reorder Exercises</Text>
          <Text style={styles.exerciseOptionSubtitle}>Change the order of exercises in your workout</Text>
        </View>
        <IonIcon name="chevron-forward" size={20} color={colors.secondaryText} />
      </TouchableOpacity>

      {/* Superset Option */}
      <TouchableOpacity
                activeOpacity={0.5} style={styles.exerciseOptionItem} onPress={
        exerciseToSuperset.has(selectedExerciseForOptions?.id) 
          ? handleRemoveFromSuperset 
          : handleAddToSuperset
      }>
        <View style={styles.exerciseOptionIcon}>
          <IonIcon 
            name={exerciseToSuperset.has(selectedExerciseForOptions?.id) 
              ? "remove-circle-outline" 
              : "add-circle-outline"
            } 
            size={24} 
            color={colors.primaryText} 
          />
        </View>
        <View style={styles.exerciseOptionTextContainer}>
          <Text style={styles.exerciseOptionTitle}>
            {exerciseToSuperset.has(selectedExerciseForOptions?.id) 
              ? "Remove from Superset" 
              : "Add to Superset"
            }
          </Text>
          <Text style={styles.exerciseOptionSubtitle}>
            {exerciseToSuperset.has(selectedExerciseForOptions?.id)
              ? "Remove this exercise from its current superset"
              : "Group this exercise with others for back-to-back sets"
            }
          </Text>
        </View>
        <IonIcon name="chevron-forward" size={20} color={colors.secondaryText} />
      </TouchableOpacity>

      {/* Remove Exercise Option */}
      <TouchableOpacity
                activeOpacity={0.5} style={[styles.exerciseOptionItem, styles.destructiveOption]} onPress={handleRemoveExercise}>
        <View style={styles.exerciseOptionIcon}>
          <IonIcon name="trash-outline" size={24} color="#dc3545" />
        </View>
        <View style={styles.exerciseOptionTextContainer}>
          <Text style={[styles.exerciseOptionTitle, styles.destructiveText]}>Remove Exercise</Text>
          <Text style={styles.exerciseOptionSubtitle}>Permanently remove this exercise from your workout</Text>
        </View>
        <IonIcon name="chevron-forward" size={20} color="#dc3545" />
      </TouchableOpacity>
    </View>
  </BottomSheetView>
</BottomSheet>

{/* Superset Bottom Sheet */}
        <BottomSheet
          ref={supersetBottomSheetRef}
          index={-1}
          snapPoints={supersetSnapPoints}
          onChange={handleSupersetSheetChanges}
          enablePanDownToClose={true}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetIndicator}
          backdropComponent={renderBackdrop}
        >
          <BottomSheetView style={styles.supersetModalContent}>
            <Text style={styles.supersetModalTitle}>Superset</Text>
            
            <Text style={styles.supersetModalSubtitle}>
              Select exercises to superset with "{selectedExerciseForSuperset?.name}".
            </Text>
            
            <BottomSheetScrollView style={styles.supersetExerciseList} showsVerticalScrollIndicator={false}>
              {activeWorkout?.exercises.map(exercise => {
                const isInDifferentSuperset = exerciseToSuperset.has(exercise.id) && 
                  exerciseToSuperset.get(exercise.id) !== exerciseToSuperset.get(selectedExerciseForSuperset?.id);
                const isCurrentExercise = exercise.id === selectedExerciseForSuperset?.id;
                const isSelected = selectedExercisesForSuperset.has(exercise.id);
                const targetSupersetColor = getTargetSupersetColor();
                
                let backgroundColor = 'rgba(255,255,255,0.05)';
                
                if (isCurrentExercise || isSelected) {
                  backgroundColor = targetSupersetColor;
                } else if (isInDifferentSuperset) {
                  const currentSupersetId = exerciseToSuperset.get(exercise.id);
                  const currentColor = getSupersetColor(currentSupersetId);
                  backgroundColor = currentColor.replace('0.2)', '0.1)');
                }
                
                return (
                  <TouchableOpacity
                activeOpacity={0.5}
                    key={exercise.id}
                    style={[
                      styles.supersetExerciseItem,
                      {
                        backgroundColor,
                        borderLeftWidth: 0,
                      },
                      isCurrentExercise && styles.currentExerciseItem
                    ]}
                    onPress={() => {
                      if (!isCurrentExercise) {
                        toggleExerciseSelection(exercise.id);
                      }
                    }}
                    disabled={isCurrentExercise}
                  >
                    {/* Exercise Image */}
                    {exercise.image_url ? (
                      <Image 
                        source={{ uri: exercise.image_url }}
                        style={styles.supersetExerciseImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.supersetExerciseImagePlaceholder}>
                        <IonIcon 
                          name={(!exercise.exercise_id || exercise.exercise_id.startsWith('custom-')) ? "construct-outline" : "barbell-outline"} 
                          size={16} 
                          color={colors.secondaryText} 
                        />
                      </View>
                    )}
                    
                    <View style={styles.supersetExerciseInfo}>
                      <View style={styles.supersetExerciseNameRow}>
                        <Text style={[
                          styles.supersetExerciseName,
                          isCurrentExercise && styles.currentExerciseName
                        ]}>
                          {exercise.name}
                        </Text>
                        {/* Custom Exercise Badge */}
                        {(!exercise.exercise_id || exercise.exercise_id.startsWith('custom-')) && (
                          <View style={styles.supersetCustomBadge}>
                            <Text style={styles.supersetCustomBadgeText}>Custom</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </BottomSheetScrollView>
            
            <View style={styles.supersetModalFooter}>    
              <View style={styles.supersetModalButtons}>
                <TouchableOpacity
                activeOpacity={0.5} 
                  style={[
                    styles.supersetCreateButton,
                    selectedExercisesForSuperset.size === 0 && styles.supersetCreateButtonDisabled
                  ]}
                  onPress={handleCreateSuperset}
                  disabled={selectedExercisesForSuperset.size === 0}
                >
                  <Text style={[
                    styles.supersetCreateButtonText,
                    selectedExercisesForSuperset.size === 0 && styles.supersetCreateButtonTextDisabled
                  ]}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </BottomSheetView>
        </BottomSheet>

{/* Reorder Bottom Sheet */}
        <BottomSheet
          ref={reorderBottomSheetRef}
          index={-1}
          snapPoints={reorderSnapPoints}
          onChange={handleReorderSheetChanges}
          enablePanDownToClose={true}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetIndicator}
          backdropComponent={renderBackdrop}
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
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                onDragEnd={({ data }) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  reorderExercises(data);
                }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: exercise, drag, isActive }) => (
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
                    {(exercise as any).image_url ? (
                      <Image 
                        source={{ uri: (exercise as any).image_url }}
                        style={styles.reorderExerciseImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.reorderExerciseImagePlaceholder}>
                        <IonIcon 
                          name={(!((exercise as any).exercise_id) || ((exercise as any).exercise_id).startsWith('custom-')) ? "construct-outline" : "barbell-outline"} 
                          size={18} 
                          color={colors.secondaryText} 
                        />
                      </View>
                    )}
                    
                    <View style={styles.reorderExerciseInfo}>
                      <View style={styles.reorderExerciseNameRow}>
                        <Text style={styles.reorderExerciseName}>{(exercise as any).name}</Text>
                        {/* Custom Exercise Badge */}
                        {(!((exercise as any).exercise_id) || ((exercise as any).exercise_id).startsWith('custom-')) && (
                          <View style={styles.reorderCustomBadge}>
                            <Text style={styles.reorderCustomBadgeText}>Custom</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.reorderExerciseStats}>
                        {(exercise as any).sets.length} sets • {(exercise as any).sets.filter((s: any) => s.isCompleted).length} completed
                      </Text>
                      {exerciseToSuperset.has((exercise as any).id) && (
                        <View style={[
                          styles.reorderSupersetBadge,
                          { backgroundColor: getSupersetColor(exerciseToSuperset.get((exercise as any).id)) }
                        ]}>
                          <Text style={styles.reorderSupersetBadgeText}>Superset</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.reorderDragHandle}>
                      <IonIcon name="reorder-three-outline" size={24} color={colors.secondaryText} />
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

      {showRpeTooltip && (
        <View 
          style={[
            styles.rpeTooltip, 
            { top: rpeTooltipPosition.y + 10, left: rpeTooltipPosition.x - 210 }
          ]}
        >
          <View style={styles.tooltipArrow} />
          <Text style={styles.tooltipTitle}>Rate of Perceived Exertion (RPE)</Text>
          <Text style={styles.tooltipText}>
            A scale from 1-10 that measures how hard an exercise felt.
          </Text>
          <Text style={styles.tooltipText}>
            • RPE 10: Maximal effort, couldn't do more reps
            {"\n"}• RPE 8: Could do 2 more reps
            {"\n"}• RPE 6: Moderate effort, could do several more reps
          </Text>
          <Text style={styles.tooltipText}>
            This field is optional and helps track workout intensity and can be toggled on or off in the workout settings.
          </Text>
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.tooltipCloseButton}
            onPress={() => setShowRpeTooltip(false)}
          >
            <Text style={styles.tooltipCloseText}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}

      {showRpeTooltip && (
        <TouchableOpacity
                activeOpacity={0.5} 
          style={styles.tooltipOverlay}
          onPress={() => setShowRpeTooltip(false)}
        />
      )}

{/* RPE Bottom Sheet */}
        <BottomSheet
          ref={rpeBottomSheetRef}
          index={-1}
          snapPoints={rpeSnapPoints}
          onChange={handleRpeSheetChanges}
          enablePanDownToClose={true}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetIndicator}
          backdropComponent={renderBackdrop}
          enableContentPanningGesture={false}
        >
          <BottomSheetView style={styles.rpeModalContent}>
            <Text style={styles.rpeModalTitle}>RPE</Text>
            
            <Text style={styles.rpeModalSubtitle}>
              Swipe left or right to select your RPE
            </Text>
            
            <View style={styles.rpeSelector}>
              <View style={styles.rpeArrowContainer}>
                <IonIcon name="chevron-down" size={24} color={colors.primaryText} />
              </View>

              <FlatList
                ref={rpeFlatListRef}
                data={rpeData}
                keyExtractor={(item) => item.value.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={120}
                snapToAlignment="center"
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 120 }}
                getItemLayout={(data, index) => ({
                  length: 120,
                  offset: 120 * index,
                  index,
                })}
                initialScrollIndex={currentRpeIndex}
                onScrollToIndexFailed={(info) => {
                  console.log('Scroll to index failed:', info);
                }}
                onScroll={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const index = Math.round(offsetX / 120);
                  const newIndex = Math.max(0, Math.min(index, rpeData.length - 1));
                  
                  if (newIndex !== currentRpeIndex) {
                    setCurrentRpeIndex(newIndex);
                    try {
                      Haptics.selectionAsync();
                    } catch (error) {
                      // Fallback for devices without haptics
                    }
                  }
                }}
                renderItem={({ item, index }) => (
                  <View style={styles.rpeScrollItem}>
                    <View style={[
                      styles.rpeNumberContainer,
                      index === currentRpeIndex ? styles.rpeNumberContainerActive : styles.rpeNumberContainerInactive
                    ]}>
                      <Text style={[
                        styles.rpeNumber,
                        index === currentRpeIndex ? styles.rpeNumberActive : styles.rpeNumberInactive
                      ]}>
                        {item.value}
                      </Text>
                    </View>
                  </View>
                )}
              />

              <View style={styles.rpeArrowContainer}>
                <IonIcon name="chevron-up" size={24} color={colors.primaryText} />
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

        {/* Set Edit Bottom Sheet */}
        <BottomSheet
          ref={setEditBottomSheetRef}
          index={-1}
          snapPoints={setEditSnapPoints}
          onChange={handleSetEditSheetChanges}
          enablePanDownToClose={true}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetIndicator}
          backdropComponent={renderBackdrop}
          android_keyboardInputMode="adjustResize"
        >
          <BottomSheetView style={[styles.setEditBottomSheetContent, Platform.OS === 'android' && { height: 300 }]}>
            <View style={styles.setEditHeader}>
              <Text style={styles.setEditTitle}>
                {editingExerciseIndex !== null && activeWorkout?.exercises[editingExerciseIndex] 
                  ? activeWorkout.exercises[editingExerciseIndex].name 
                  : 'Edit Set'
                }
              </Text>
              <Text style={styles.setEditSubtitle}>
                Set {editingSetIndex !== null ? editingSetIndex + 1 : ''}
              </Text>
            </View>
            
            <View style={styles.setEditInputsHorizontal}>
              <View style={styles.setEditInputGroupHorizontal}>
                <Text style={styles.setEditInputLabelHorizontal}>Weight ({userWeightUnit})</Text>
                <BottomSheetTextInput
                  style={styles.setEditInputHorizontal}
                  value={tempWeight}
                  onChangeText={(text) => {
                    setTempWeight(text);
                  }}
                  onEndEditing={() => {
                    // Auto-save when user finishes editing
                    saveSetEdit();
                  }}
                  placeholder="-"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.setEditInputGroupHorizontal}>
                <Text style={styles.setEditInputLabelHorizontal}>Reps</Text>
                <BottomSheetTextInput
                  style={styles.setEditInputHorizontal}
                  value={tempReps}
                  onChangeText={(text) => {
                    setTempReps(text);
                  }}
                  onEndEditing={() => {
                    // Auto-save when user finishes editing
                    saveSetEdit();
                  }}
                  placeholder="-"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                />
              </View>
              
              {workoutSettings.rpeEnabled && (
                <View style={styles.setEditInputGroupHorizontal}>
                  <Text style={styles.setEditInputLabelHorizontal}>RPE</Text>
                  <TouchableOpacity
                    style={[styles.setEditInputHorizontal, styles.setEditRpeSelector]}
                    onPress={() => {
                      if (editingExerciseIndex !== null && editingSetIndex !== null && activeWorkout?.exercises[editingExerciseIndex]) {
                        const exercise = activeWorkout.exercises[editingExerciseIndex];
                        const set = exercise.sets[editingSetIndex];
                        openRpeModal(exercise.id, set.id, set.rpe);
                      }
                    }}
                  >
                    <Text style={[
                      styles.setEditRpeSelectorText,
                      !tempRpe && styles.setEditRpePlaceholderText
                    ]}>
                      {tempRpe || "-"}
                    </Text>
                    <IonIcon name="chevron-forward" size={16} color={colors.secondaryText} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </BottomSheetView>
        </BottomSheet>

    </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

// Mock data
const mockRoutines = [
  {
    id: 1,
    name: "Upper Body Split",
    exercises: [
      { id: 1, name: "Bench Press", totalSets: 3, defaultWeight: 135, defaultReps: 10 },
      { id: 2, name: "Pull-ups", totalSets: 3, defaultWeight: 0, defaultReps: 8 },
      { id: 3, name: "Shoulder Press", totalSets: 3, defaultWeight: 95, defaultReps: 10 }
    ]
  },
  // Other mock routines...
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  contentContainer: {
    paddingTop: 12,
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
  },
  headerTitle: {
    fontSize: 16,
    color: colors.primaryText,
    flex: 1,
    marginLeft: 8,
  },
  timerButton: {
    marginHorizontal: 16,
  },
  finishButton: {
    backgroundColor: colors.brand,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  finishButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  timerControlButton: {
    marginHorizontal: 8,
  },
  statsContainer: {
    width: '100%',
    flexDirection: "row",
    justifyContent: "space-evenly",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: colors.secondaryText,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addExerciseButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  exercisesContainer: {
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  exerciseCard: {
    padding: 16,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseSets: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondaryAccent,
    paddingVertical: 16,
    paddingHorizontal: 12,
    paddingTop: 50, // Account for status bar
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryAccent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    color: colors.primaryText,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  categoryScroll: {
    padding: 16,
    backgroundColor: colors.secondaryAccent,
  },
  categoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  selectedCategoryBadge: {
    backgroundColor: colors.brand,
  },
  categoryText: {
    color: colors.secondaryText,
    fontWeight: '500',
  },
  selectedCategoryText: {
    color: colors.primaryText,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  exerciseItemName: {
    fontSize: 16,
    color: colors.primaryText,
  },
  emptyListContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyListText: {
    color: colors.secondaryText,
    fontSize: 16,
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: colors.primaryAccent,
    borderRadius: 8,
  },
  setInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    color: colors.primaryText,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 32,
  },
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
  notesContainer: {
    marginTop: 16,
  },
  notesLabel: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 6,
  },
  setHeaderIcon: {
    flex: 1,
    textAlign: 'center',
  },
  checkboxContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTimerButton: {
    marginRight: 16,
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restTimerContainer: {
    height: '60%',
    width: '90%',
    backgroundColor: colors.secondaryAccent,
    borderRadius: 12,
    overflow: 'hidden',
  },
  restTimerContent: {
    padding: 20,
    alignItems: 'center',
  },
  modalTimerModeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
  },
  modalTimerModeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTimerModeButtonActive: {
    backgroundColor: colors.brand,
  },
  modalTimerModeText: {
    color: colors.secondaryText,
    fontWeight: '500',
  },
  restTimerDisplay: {
    fontSize: 46,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginVertical: 20,
  },
  modalTimerAdjustButtons: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  modalTimerAdjustButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginHorizontal: 8,
  },
  modalTimerAdjustButtonText: {
    color: colors.primaryText,
    fontWeight: '500',
  },
  modalTimerControlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  modalTimerControlButton: {
    padding: 12,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalTimerStartButton: {
    backgroundColor: colors.brand,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedSetInput: {
    backgroundColor: 'rgba(38, 194, 129, 0.05)',
    borderColor: 'rgba(38, 194, 129, 0.3)',
    borderWidth: 1,
    color: colors.primaryText,
    opacity: 0.5,
  },
  setNumberColumn: {
    width: 40,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  setInputColumn: {
    flex: 1,
    marginHorizontal: 4,
    textAlign: 'center',
  },
  checkboxColumn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setText: {
    fontSize: 14,
    color: colors.secondaryText,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  setHeaderLabel: {
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: 'center',
  },
  nameInputContainer: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  nameInput: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: 'bold',
    paddingVertical: 6,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 0,
  },
  editIcon: {
    marginLeft: 6,
    opacity: 0.7,
  },
  routineAndStatsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
    minWidth: 150,
    justifyContent: 'center',
  },
  routineText: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: '500',
    marginLeft: 4,
    textAlign: 'center',
  },
  timerTextContainer: {
    marginLeft: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.brand,
  },
  largeTimerText: {
    fontSize: 24,
  },
  editTimerIcon: {
    marginLeft: 8,
    opacity: 0.7,
  },
  timeInputContainer: {
    height: '50%',
    width: '80%',
    backgroundColor: colors.secondaryAccent,
    borderRadius: 12,
    overflow: 'hidden',
  },
  timeInputContent: {
    padding: 20,
    alignItems: 'center',
  },
  timeInputTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 8,
  },
  timeInputSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 20,
  },
  timeInputFields: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    width: '100%',
  },
  timeInputField: {
    alignItems: 'center',
    width: 60,
  },
  timeInputValue: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: colors.primaryText,
    fontSize: 24,
    fontWeight: 'bold',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    width: 60,
    textAlign: 'center',
  },
  timeInputLabel: {
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 4,
  },
  timeInputSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginHorizontal: 8,
  },
  timeInputButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 32,
  },
  cancelTimeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    marginRight: 8,
  },
  cancelTimeButtonText: {
    color: colors.primaryText,
    fontWeight: '500',
  },
  applyTimeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.brand,
    alignItems: 'center',
    marginLeft: 8,
  },
  applyTimeButtonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
  },
  focusedInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  rpeHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 26,
  },
  rpeQuestionIcon: {
    marginLeft: 4,
  },
  tooltipOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 9,
  },
  rpeTooltip: {
    position: 'absolute',
    width: 280,
    backgroundColor: colors.secondaryAccent,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  tooltipArrow: {
    position: 'absolute',
    top: -10,
    right: '22%',
    marginLeft: -10,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.secondaryAccent,
  },
  tooltipTitle: {
    color: colors.primaryText,
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  tooltipText: {
    color: colors.secondaryText,
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  tooltipCloseButton: {
    backgroundColor: colors.brand,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  tooltipCloseText: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  circularTimerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 30,
  },
  circularTimer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerTextOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularTimerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 4,
  },
  circularTimerLabel: {
    fontSize: 12,
    color: colors.secondaryText,
    fontWeight: '500',
    letterSpacing: 1,
  },
  durationTimerControls: {
    flexDirection: 'row',
    marginLeft: 'auto',
  },
  timerControls: {
    width: '100%',
    alignItems: 'center',
  },
  timeAdjustmentRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 20,
  },
  timeAdjustButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  timeAdjustButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 16,
  },
  primaryControlsRow: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
    justifyContent: 'center',
  },
  primaryControlButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    flex: 1,
    maxWidth: 120,
  },
  startButton: {
    backgroundColor: colors.brand,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cancelButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 16,
  },
  resetButton: {
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(220, 53, 69, 0.4)',
  },
  resetButtonText: {
    color: '#dc3545',
    fontWeight: '600',
    fontSize: 16,
  },
  fullWidthButton: {
    flex: 1,
    maxWidth: '100%',
  },
  halfWidthButton: {
    flex: 1,
    maxWidth: '48%',
  },
  modalTimerModeTextActive: {
    color: colors.primaryText,
  },
  modalTimerModeTextInactive: {
    color: colors.secondaryText,
  },
  startButtonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
    fontSize: 16,
  },
  exerciseNameContainer: {
    flex: 1,
  },
  notesInput: {
    color: colors.primaryText,
    fontSize: 13,
    fontStyle: 'italic',
    textAlignVertical: 'top',
    minHeight: 32,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  errorSetRow: {
    borderLeftWidth: 3,
    borderLeftColor: '#dc3545',
  },
  completedSetRow: {
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(38, 194, 129, 0.7)', // Green ribbon for completed sets
  },
  errorSetInput: {
    borderColor: 'rgba(220, 53, 69, 0.5)',
    borderWidth: 1,
    backgroundColor: 'rgba(220, 53, 69, 0.05)',
  },
  disabledCheckbox: {
    opacity: 0.4,
  },
  hiddenItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingRight: 0,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    marginRight: 2,
  },
  deleteText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  
  exerciseTitlePressable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    paddingVertical: 8,
    paddingRight: 16,
  },

  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  exerciseImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: colors.primaryText,
  },
  
  exerciseImagePlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  
  exerciseNamePressable: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  
  exerciseName: {
    fontSize: 16,
    fontWeight: 500,
    color: colors.brand, // Brand color indicates it's pressable
    flex: 1, // Allow name to take remaining space
  },
  
  customBadge: {
    backgroundColor: colors.customBadgeBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.customBadgeBorder,
    marginLeft: 8,
  },
  
  customBadgeText: {
    fontSize: 10,
    color: colors.customBadgeText,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  
  minimizeIcon: {
    marginTop: 10,
    marginLeft: 8,
  },
  
  exerciseOptionsButton: {
    marginTop: 10,
    padding: 8,
  },
  
  exerciseSummary: {
    marginTop: 4,
    padding: 16,
    borderRadius: 8,
  },
  
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  
  summaryStatItem: {
    alignItems: 'center',
  },
  
  summaryStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 4,
  },
  
  summaryStatLabel: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  
  progressContainer: {
    alignItems: 'center',
  },
  
  progressBarBackground: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  
  progressBarFill: {
    height: '100%',
    backgroundColor: 'rgba(38, 194, 129, 0.7)',
    borderRadius: 3,
  },
  
  progressText: {
    fontSize: 12,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  
  supersetModalContent: {
    flex: 1,
    padding: 10,
    paddingBottom: 30,
  },
  
  supersetModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  
  supersetModalTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  
  supersetModalSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 12,
  },
  
  supersetExerciseList: {
    flex: 1,
    marginBottom: 20,
  },
  
  supersetExerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderLeftWidth: 0, // Default no border
  },

  currentExerciseItem: {
    opacity: 0.8,
  },

  currentExerciseName: {
    color: colors.secondaryText,
    fontStyle: 'italic',
  },
  
  currentSupersetItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 0, // Will be set dynamically
  },
  
  supersetExerciseInfo: {
    flex: 1,
    marginLeft: 12,
  },
  
  supersetExerciseImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryText,
  },
  
  supersetExerciseImagePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.whiteOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.whiteOverlayLight,
  },
  
  supersetExerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  
  supersetExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  
  supersetCustomBadge: {
    backgroundColor: colors.customBadgeBg,
    borderColor: colors.customBadgeBorder,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6,
  },
  
  supersetCustomBadgeText: {
    color: colors.customBadgeText,
    fontSize: 8,
    fontWeight: '600',
  },
  
  supersetLabel: {
    fontSize: 12,
    color: colors.secondaryText,
    fontStyle: 'italic',
  },
  
  currentSupersetsContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  
  currentSupersetsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 12,
  },
  
  currentSupersetExercises: {
    fontSize: 14,
    color: colors.primaryText,
    fontWeight: '500',
  },

  exerciseNameAndBadgeContainer: {
    flex: 1,
  },
  
  supersetBadge: {
    alignSelf: 'flex-start', // Make badge only as wide as needed
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
  },
  
  supersetBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  reorderModalContainer: {
    height: '70%',
    width: '100%',
    backgroundColor: colors.secondaryAccent,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 'auto',
  },
  
  reorderModalContent: {
    flex: 1,
    padding: 10,
  },
  
  reorderModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  
  reorderModalTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  
  reorderModalSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    paddingBottom: 12,
  },
  
  reorderExerciseList: {
    flex: 1,
    marginBottom: 20,
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
    marginBottom: 4,
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
    fontSize: 12,
    color: colors.secondaryText,
    marginBottom: 6,
  },
  
  reorderSupersetBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  
  reorderSupersetBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  reorderDragHandle: {
    padding: 8,
    marginLeft: 12,
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

  settingsButton: {
    marginLeft: 8,
    padding: 4,
  },
  rpeButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rpeButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  rpeModalContainer: {
    backgroundColor: colors.secondaryAccent,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '50%',
    width: '100%',
    marginTop: 'auto',
  },
  rpeModalContent: {
    padding: 10,
    flex: 1,
  },
  rpeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
    shadowColor: '#000',
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
  rpeDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 20,
    gap: 8,
  },
  rpeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  rpeActiveDot: {
    backgroundColor: colors.brand,
    width: 24,
    borderRadius: 4,
  },
  rpeModalButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  rpeCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  rpeCancelButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 16,
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
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 16,
  },
pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    height: 200,
    marginVertical: 20,
  },
  
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  
  pickerLabel: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 8,
    fontWeight: '500',
  },
  
  picker: {
    width: 80,
    height: 150,
    flex: 1,
  },
  
  pickerItem: {
    fontSize: 18,
    color: colors.primaryText,
  },
  
  // Android Inline Picker Styles
  androidInlinePicker: {
    height: 150,
    width: '100%',
    backgroundColor: colors.secondaryAccent,
  },
  
  androidInlinePickerItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  
  androidInlinePickerItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  
  androidInlinePickerText: {
    fontSize: 16,
    color: colors.primaryText,
    textAlign: 'center',
  },
  
  androidInlinePickerTextSelected: {
    color: colors.brand,
    fontWeight: '600',
  },
    keyboardDismissOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 5, // Above content but below modals
  },
  supersetExerciseNote: {
    fontSize: 12,
    color: colors.secondaryText,
    fontStyle: 'italic',
    marginTop: 4,
  },
  
  supersetModalFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  
  selectedCountText: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 16,
  },
  
  supersetModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  
  supersetCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  
  supersetCancelButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 16,
  },
  
  supersetCreateButton: {
    flex: 2,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.brand,
    alignItems: 'center',
  },
  
  supersetCreateButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  
  supersetCreateButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 16,
  },
  
  supersetCreateButtonTextDisabled: {
    color: colors.secondaryText,
  },

  floatingTimerRibbon: {
    position: 'absolute',
    top: 98, // Below the header
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 8,
  },

  floatingTimerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingLeft: 24,
    paddingVertical: 12,
  },

  floatingTimerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  floatingTimerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.brand,
    marginLeft: 8,
  },
  largeFloatingTimerText: {
    fontSize: 20,
  },

  pausedIndicator: {
    marginLeft: 8,
    padding: 2,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 10,
  },

  floatingActiveTimers: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
    justifyContent: 'center',
  },

  floatingActiveTimer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  floatingActiveTimerLabel: {
    fontSize: 10,
    color: colors.secondaryText,
    fontWeight: '500',
    marginBottom: 2,
  },

  floatingActiveTimerValue: {
    fontSize: 12,
    color: colors.primaryText,
    fontWeight: '600',
  },

  floatingTimerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  floatingTimerButton: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

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

exerciseOptionsHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
  paddingBottom: 16,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(255,255,255,0.1)',
},

exerciseOptionsTitle: {
  fontSize: 16,
  fontWeight: 600,
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
  borderBottomColor: 'rgba(255,255,255,0.1)',
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
  borderBottomColor: 'rgba(255,255,255,0.05)',
},

exerciseOptionIcon: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: 'rgba(255,255,255,0.1)',
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
  color: '#dc3545',
},

// Set display styles (replacing input styles)
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

// Set edit modal styles
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

setEditCloseButton: {
  padding: 4,
},

setEditInputs: {
  gap: 16,
  marginBottom: 24,
},

setEditInputGroup: {
  gap: 8,
},

setEditInputLabel: {
  fontSize: 14,
  fontWeight: '500',
  color: colors.secondaryText,
},

setEditInput: {
  backgroundColor: colors.secondaryAccent,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 16,
  color: colors.primaryText,
  minHeight: 48,
},

setEditButtons: {
  flexDirection: 'row',
  gap: 12,
},

setEditCancelButton: {
  flex: 1,
  backgroundColor: 'rgba(255,255,255,0.1)',
  borderRadius: 8,
  paddingVertical: 12,
  alignItems: 'center',
},

setEditCancelButtonText: {
  fontSize: 16,
  fontWeight: '500',
  color: colors.secondaryText,
},

setEditSaveButton: {
  flex: 1,
  backgroundColor: colors.brand,
  borderRadius: 8,
  paddingVertical: 12,
  alignItems: 'center',
},

setEditSaveButtonText: {
  fontSize: 16,
  fontWeight: '600',
  color: colors.background,
},

// Bottom sheet specific styles for set edit
setEditBottomSheetContent: {
  flex: 1,
  padding: 10,
  backgroundColor: colors.primaryAccent,
},

headerButton: {
  padding: 8,
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
},

// Custom checkbox styles
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

// Horizontal set edit input styles
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

setEditInputUnit: {
  fontSize: 12,
  color: colors.secondaryText,
  opacity: 0.7,
  textAlign: 'center',
},

setEditInputHorizontal: {
  backgroundColor: colors.secondaryAccent,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
  paddingHorizontal: 12,
  paddingVertical: 12,
  fontSize: 18,
  color: colors.primaryText,
  textAlign: 'center',
  minWidth: 80,
  fontWeight: '600',
},

setEditRpeSelector: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},

setEditRpeSelectorText: {
  fontSize: 18,
  color: colors.primaryText,
  fontWeight: '600',
  textAlign: 'center',
  flex: 1,
},

setEditRpePlaceholderText: {
  color: 'rgba(255,255,255,0.3)',
},

setRowErrorOverlay: {
  position: 'absolute',
  top: 4,
  left: 4,
  right: 4,
  bottom: 4,
  backgroundColor: 'rgba(220, 53, 69, 0.15)',
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

setPressOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  borderRadius: 8,
  pointerEvents: 'none',
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
});