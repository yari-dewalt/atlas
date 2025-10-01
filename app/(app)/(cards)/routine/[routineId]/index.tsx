import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Image, TouchableOpacity } from 'react-native';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../../../constants/colors';
import { supabase } from '../../../../../lib/supabase';
import { useAuthStore } from '../../../../../stores/authStore';
import { format } from 'date-fns';
import { useWorkoutStore } from '../../../../../stores/workoutStore';
import { useRoutineStore } from '../../../../../stores/routineStore';
import { progressUtils, PROGRESS_LABELS } from '../../../../../stores/progressStore';
import CachedAvatar from '../../../../../components/CachedAvatar';
import RoutineDetailSkeleton from '../../../../../components/RoutineDetailSkeleton';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { Ionicons as IonIcon } from '@expo/vector-icons';
import { displayWeightForUser, convertWeight, convertWeightForDisplay, getUserWeightUnit, type WeightUnit } from '../../../../../utils/weightUtils';

export default function RoutineDetail() {
  const [routine, setRoutine] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isOriginalCreator, setIsOriginalCreator] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);
  const [failedImages, setFailedImages] = useState(new Set<string>());
  const [userWeightUnit, setUserWeightUnit] = useState<WeightUnit>('lbs');
  const router = useRouter();
  const { routineId } = useLocalSearchParams();
  const { session } = useAuthStore();
  const { activeWorkout } = useWorkoutStore();

  // Bottom Sheet refs
  const optionsBottomSheetRef = useRef<BottomSheet>(null);
  
  // Bottom Sheet snap points
  const optionsSnapPoints = useMemo(() => ['30%'], []);

  // Bottom Sheet callbacks
  const handleOptionsSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setOptionsModalVisible(false);
    }
  }, []);

  useEffect(() => {
    if (routineId) {
      fetchRoutine();
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

  // Separate useEffect to handle global function updates when ownership changes
  useEffect(() => { 
    // Expose function to open options modal globally
    (global as any).openRoutineOptions = () => {
      setOptionsModalVisible(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      optionsBottomSheetRef.current?.expand();
    };

    // Expose function to check if user is owner (for nav bar visibility)
    (global as any).isRoutineOwner = () => {
      return true; // Always return true since we always show the ellipsis now
    };

    // Cleanup function
    return () => {
      (global as any).openRoutineOptions = undefined;
      (global as any).isRoutineOwner = undefined;
    };
  }, []);

  const fetchRoutine = async () => {
  setLoading(true);
  try {
    // First, get the routine data with exercises from the exercises table
    const { data: routineData, error: routineError } = await supabase
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
        )
      `)
      .eq('id', routineId)
      .single();

    console.log("ROUTINE:",routineData);

    if (routineError) throw routineError;

    // Then, get the profile data separately
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, name, avatar_url')
      .eq('id', routineData.user_id)
      .single();

    if (profileError) {
      console.warn('Could not fetch profile data:', profileError);
    }

    // Get original creator profile if different from current user
    let originalCreatorData = null;
    if (routineData.original_creator_id && routineData.original_creator_id !== routineData.user_id) {
      const { data: originalCreatorProfile, error: originalCreatorError } = await supabase
        .from('profiles')
        .select('id, username, name, avatar_url')
        .eq('id', routineData.original_creator_id)
        .single();

      if (!originalCreatorError) {
        originalCreatorData = originalCreatorProfile;
      }
    }

    // Sort exercises by order position
    const sortedExercises = routineData.routine_exercises.sort((a, b) => 
      a.order_position - b.order_position
    );

    setRoutine({
      ...routineData,
      profiles: profileData,
      original_creator_profile: originalCreatorData,
      routine_exercises: sortedExercises,
      created_at_formatted: format(new Date(routineData.created_at), 'MMM d, yyyy'),
      updated_at_formatted: format(new Date(routineData.updated_at), 'MMM d, yyyy')
    });

    // Initialize like and save counts
    setLikeCount(routineData.like_count || 0);
    setSaveCount(routineData.save_count || 0);

    // Check if current user has liked this routine
    if (session?.user?.id) {
      // Check if user has liked this routine from routine_likes table
      const { data: likeData, error: likeError } = await supabase
        .from('routine_likes')
        .select('id')
        .eq('routine_id', routineId)
        .eq('user_id', session.user.id)
        .single();
      
      if (likeError && likeError.code !== 'PGRST116') {
        console.warn('Error checking like status:', likeError);
      } else {
        setIsLiked(!!likeData);
      }

      // Check if user has saved this routine
      const { data: saveData, error: saveError } = await supabase
        .from('saved_routines')
        .select('id')
        .eq('routine_id', routineId)
        .eq('user_id', session.user.id)
        .single();

      if (saveError && saveError.code !== 'PGRST116') {
        console.warn('Error checking save status:', saveError);
      } else {
        setIsSaved(!!saveData);
      }
    }

    // Check if current user is the owner and original creator
    if (session?.user?.id && routineData.user_id) {
      const isOwner = session.user.id === routineData.user_id;
      const isOriginalCreator = routineData.original_creator_id 
        ? routineData.original_creator_id === session.user.id
        : routineData.user_id === session.user.id;
      
      setIsOwner(isOwner);
      setIsOriginalCreator(isOriginalCreator);
    }
  } catch (error) {
    console.error('Error fetching routine:', error);
    Alert.alert('Error', 'Failed to load routine details');
  } finally {
    setLoading(false);
  }
};

  const handleEditRoutine = () => {
    router.push(`/editRoutine/${routineId}`);
  };

  const handleLikeRoutine = async () => {
    if (!session?.user?.id || !routine) return;

    // Add haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (isLiked) {
        // Unlike the routine - remove from routine_likes table
        const { error } = await supabase
          .from('routine_likes')
          .delete()
          .eq('routine_id', routineId)
          .eq('user_id', session.user.id);

        if (error) throw error;

        // Update local state (the trigger will update the database count)
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        // Like the routine - add to routine_likes table
        const { error } = await supabase
          .from('routine_likes')
          .insert({
            routine_id: routineId,
            user_id: session.user.id
          });

        if (error) throw error;

        // Update local state (the trigger will update the database count)
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like status');
    }
  };

  const handleSaveRoutine = async () => {
    if (!session?.user?.id || !routine) return;

    // Add haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (isSaved) {
        // Step 1: Start unsaving process
        progressUtils.stepProgress(1, 3, 'Removing from saved...');

        // Remove from saved routines
        const { error: deleteError } = await supabase
          .from('saved_routines')
          .delete()
          .eq('routine_id', routineId)
          .eq('user_id', session.user.id);

        if (deleteError) throw deleteError;

        // Step 2: Updating statistics
        progressUtils.stepProgress(2, 3, 'Updating statistics...');

        // Decrement the save count on the original routine using the safer function
        const { error: updateError } = await supabase
          .rpc('update_routine_statistics', {
            routine_id_param: routineId,
            save_count_delta: -1
          });

        if (updateError) throw updateError;

        // Step 3: Complete
        progressUtils.stepProgress(3, 3, 'Removed from saved!');
        progressUtils.completeLoading();

        setIsSaved(false);
        setSaveCount(prev => Math.max(0, prev - 1));
        Alert.alert("Success", "Routine removed from saved!");
        return;
      }

      // Step 1: Start saving process
      progressUtils.stepProgress(1, 3, 'Saving routine...');

      // Save the routine to saved_routines table
      const { error: saveError } = await supabase
        .from('saved_routines')
        .insert({
          routine_id: routineId,
          user_id: session.user.id
        });

      if (saveError) throw saveError;

      // Step 2: Updating statistics
      progressUtils.stepProgress(2, 3, 'Updating statistics...');

      // Increment the save count on the original routine using the safer function
      const { error: updateError } = await supabase
        .rpc('update_routine_statistics', {
          routine_id_param: routineId,
          save_count_delta: 1
        });

      if (updateError) throw updateError;

      // Step 3: Complete
      progressUtils.stepProgress(3, 3, 'Routine saved!');
      progressUtils.completeLoading();

      setIsSaved(true);
      setSaveCount(prev => prev + 1);
      Alert.alert("Success", "Routine saved to your collection!");
    } catch (error) {
      console.error('Error saving routine:', error);
      progressUtils.cancelLoading();
      Alert.alert("Error", "Failed to save routine");
    }
  };

  const handleCopyRoutine = async () => {
    try {
      if (!routine || !session?.user?.id) return;

      // Step 1: Start copying process
      progressUtils.stepProgress(1, 3, 'Creating copy...');

      // Create a copy of the routine for the current user
      const { data: newRoutine, error: routineError } = await supabase
        .from('routines')
        .insert({
          name: `${routine.name} (Copy)`,
          user_id: session.user.id,
          category: routine.category,
          original_creator_id: session.user.id, // User becomes the original creator of the copy
        })
        .select('id')
        .single();

      if (routineError) throw routineError;

      // Step 2: Copying exercises
      progressUtils.stepProgress(2, 3, 'Copying exercises...');

      // Copy all exercises (excluding personal defaults like weight)
      const exercisesToCopy = routine.routine_exercises.map((exercise: any) => ({
        routine_id: newRoutine.id,
        exercise_id: exercise.exercise_id, // Include exercise_id to maintain relationship with exercises table
        name: exercise.name,
        order_position: exercise.order_position,
        total_sets: exercise.total_sets,
        default_weight: null, // Don't copy personal weight defaults
        default_reps: exercise.default_reps,
        default_reps_min: exercise.default_reps_min,
        default_reps_max: exercise.default_reps_max,
        default_rpe: exercise.default_rpe, // Copy RPE as it's part of the routine design
        rep_mode: exercise.rep_mode || 'single', // Copy the rep mode
      }));

      const { data: insertedExercises, error: exercisesError } = await supabase
        .from('routine_exercises')
        .insert(exercisesToCopy)
        .select('id, order_position');

      if (exercisesError) throw exercisesError;

      // Step 3: Copying individual sets
      progressUtils.stepProgress(3, 4, 'Copying set configurations...');

      // Copy individual sets for each exercise (excluding personal weight data)
      const allSetsToCopy: any[] = [];
      
      routine.routine_exercises.forEach((originalExercise: any, exerciseIndex: number) => {
        const correspondingInsertedExercise = insertedExercises.find(
          (inserted: any) => inserted.order_position === originalExercise.order_position
        );
        
        if (correspondingInsertedExercise && originalExercise.routine_sets && originalExercise.routine_sets.length > 0) {
          const setsToCopy = originalExercise.routine_sets.map((set: any) => ({
            routine_exercise_id: correspondingInsertedExercise.id,
            set_number: set.set_number,
            weight: null, // Don't copy personal weight data
            reps: set.reps,
            reps_min: set.reps_min,
            reps_max: set.reps_max,
            rpe: set.rpe, // Copy RPE as it's part of the routine design
          }));
          
          allSetsToCopy.push(...setsToCopy);
        }
      });

      // Insert all sets if there are any to copy
      if (allSetsToCopy.length > 0) {
        const { error: setsError } = await supabase
          .from('routine_sets')
          .insert(allSetsToCopy);

        if (setsError) throw setsError;
      }

      // Step 4: Complete
      progressUtils.stepProgress(4, 4, 'Copy created!');
      progressUtils.completeLoading();

      Alert.alert("Success", "Routine copied to your collection!");
      // Close the bottom sheet
      optionsBottomSheetRef.current?.close();
    } catch (error) {
      console.error('Error copying routine:', error);
      progressUtils.cancelLoading();
      Alert.alert("Error", "Failed to copy routine");
    }
  };

  const handleViewCreatorProfile = () => {
    const creatorId = routine.original_creator_profile?.id || routine.profiles?.id;
    console.warn(creatorId);
    if (creatorId) {
      router.push({
        pathname: '/(app)/(cards)/profile/[userId]',
        params: { userId: creatorId }
      });
    }
  };

  const handleViewExerciseDetails = async (exercise: any) => {
    const exerciseId = exercise.exercise_id || exercise.exercises?.id;
    const isCustomExercise = !exerciseId || exerciseId.startsWith('custom-');
    
    if (isCustomExercise) {
      // For custom exercises, we need to find them by name in local storage
      try {
        const customExercisesStr = await AsyncStorage.getItem('custom_exercises');
        if (customExercisesStr) {
          const customExercises = JSON.parse(customExercisesStr);
          const exerciseName = exercise.exercises?.name || exercise.name;
          const customExercise = customExercises.find((ex: any) => ex.name === exerciseName);
          
          if (!customExercise) {
            // Show modal about custom exercise not in library
            const creatorUsername = routine.profiles?.username || 'Unknown User';
            Alert.alert(
              "Custom Exercise", 
              `This custom exercise was created by ${creatorUsername} and is not in your exercise library.`,
              [
                { text: "OK", style: "default" }
              ]
            );
            return;
          }
          
          // Use the custom exercise ID for navigation
          router.push({
            pathname: '/(app)/(modals)/exerciseDetails',
            params: { 
              exerciseId: customExercise.id,
              exerciseName: exerciseName,
              fromRoutine: 'true'
            }
          });
          return;
        } else {
          // Show modal about custom exercise not in library
          const creatorUsername = routine.profiles?.username || 'Unknown User';
          Alert.alert(
            "Custom Exercise", 
            `This custom exercise was created by ${creatorUsername} and is not in your exercise library.`,
            [
              { text: "OK", style: "default" }
            ]
          );
          return;
        }
      } catch (error) {
        console.error('Error checking custom exercise:', error);
        Alert.alert("Error", "Could not load exercise details.");
        return;
      }
    }
    
    router.push({
      pathname: '/(app)/(modals)/exerciseDetails',
      params: { 
        exerciseId: exerciseId,
        exerciseName: exercise.exercises?.name || exercise.name,
        fromRoutine: 'true'
      }
    });
  };

  const confirmDeleteRoutine = () => {
    Alert.alert(
      "Delete Routine",
      "Are you sure you want to delete this routine? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: deleteRoutine }
      ]
    );
  };

  const deleteRoutine = async () => {
    try {
      // Step 1: Start deletion process
      progressUtils.stepProgress(1, 3, PROGRESS_LABELS.DELETING_ROUTINE);

      // First, remove the routine reference from any workouts that use it
      // This preserves workout history while removing the foreign key constraint
      const { error: updateError } = await supabase
        .from('workouts')
        .update({ routine_id: null })
        .eq('routine_id', routineId);

      if (updateError) {
        console.warn('Error updating workout references:', updateError);
        // Continue with deletion even if this fails - the main delete might still work
      }

      // Step 2: Removing routine data
      progressUtils.stepProgress(2, 3, 'Removing routine data...');

      // Now delete the routine
      const { error } = await supabase
        .from('routines')
        .delete()
        .eq('id', routineId);

      if (error) throw error;

      // Step 3: Complete
      progressUtils.stepProgress(3, 3, 'Routine deleted!');
      progressUtils.completeLoading();

      Alert.alert("Success", "Routine deleted successfully", [
        {
          text: "OK",
          onPress: () => {
            // Navigate back and the focus effect will refresh the data
            router.back();
          }
        }
      ]);
    } catch (error) {
      console.error('Error deleting routine:', error);
      progressUtils.cancelLoading();
      Alert.alert("Error", "Failed to delete routine");
    }
  };

  const handleStartWorkout = async () => {
    if (!routine || !session?.user?.id) return;

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
                router.push("/newWorkout");
              },
              style: "default",
            },
            {
              text: "Discard & Start New",
              onPress: async () => {
                useWorkoutStore.getState().endWorkout();
                await startNewWorkoutFromRoutine();
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
        await startNewWorkoutFromRoutine();
      }
    } catch (error) {
      console.error("Error starting workout:", error);
      Alert.alert("Error", "Failed to start workout. Please try again.");
    }
  };

  const startNewWorkoutFromRoutine = async () => {
    try {
      // Start a new workout with this routine
      useWorkoutStore.getState().startNewWorkout({
        name: routine.name,
        routineId: routine.id,
        exercises: routine.routine_exercises.map((exercise: any) => {
          // Use explicit rep_mode if available, otherwise determine based on data
          const repMode = exercise.rep_mode || (exercise.default_reps_min && exercise.default_reps_max ? 'range' : 'single');
          
          // Use individual set data if available, otherwise fall back to default generation
          let workoutSets;
          if (exercise.routine_sets && exercise.routine_sets.length > 0) {
            // Use individual set data from routine_sets table
            workoutSets = exercise.routine_sets
              .sort((a: any, b: any) => a.set_number - b.set_number)
              .map((routineSet: any, i: number) => {
                // Convert stored weight from kg to user's preferred unit (rounded to whole number)
                let convertedWeight = 0;
                if (isOwner && routineSet.weight) {
                  convertedWeight = convertWeightForDisplay(routineSet.weight, 'kg', userWeightUnit);
                }
                
                return {
                  id: `${Date.now()}_${Math.random()}_${i}`,
                  weight: convertedWeight, // Convert from storage unit (kg) to user's preferred unit
                  reps: repMode === 'range' ? (routineSet.reps_max || routineSet.reps || 0) : (routineSet.reps || 0), // For ranges, start with maximum if available
                  repsMin: repMode === 'range' ? (routineSet.reps_min || null) : null,
                  repsMax: repMode === 'range' ? (routineSet.reps_max || null) : null,
                  isRange: repMode === 'range',
                  rpe: routineSet.rpe || 0, // Always inherit RPE from individual sets
                  isCompleted: false
                };
              });
          } else {
            // Fallback: generate sets from default values (for migration compatibility)
            workoutSets = Array.from({ length: exercise.total_sets }).map((_, i) => {
              // Convert stored default weight from kg to user's preferred unit (rounded to whole number)
              let convertedWeight = 0;
              if (isOwner && exercise.default_weight) {
                convertedWeight = convertWeightForDisplay(exercise.default_weight, 'kg', userWeightUnit);
              }
              
              return {
                id: `${Date.now()}_${Math.random()}_${i}`,
                weight: convertedWeight, // Convert from storage unit (kg) to user's preferred unit
                reps: repMode === 'range' ? (exercise.default_reps_max || exercise.default_reps_min || exercise.default_reps || 0) : (exercise.default_reps_min || exercise.default_reps || 0), // For ranges, start with maximum
                repsMin: repMode === 'range' ? (exercise.default_reps_min || null) : null,
                repsMax: repMode === 'range' ? (exercise.default_reps_max || null) : null,
                isRange: repMode === 'range',
                rpe: exercise.default_rpe || 0, // Always inherit RPE defaults
                isCompleted: false
              };
            });
          }
          
          return {
            id: `${Date.now()}_${Math.random()}`, // Temporary ID for workout instance
            exercise_id: exercise.exercise_id, // Original exercise ID for database relationship
            name: exercise.exercises?.name || exercise.name,
            image_url: exercise.exercises?.image_url || null, // Include image from joined exercises table
            sets: workoutSets,
            notes: "",
            repMode: repMode
          };
        })
      });

      // Update the routine's last used info if it's the user's routine
      if (isOwner && routine.id) {
        try {
          const routineStore = useRoutineStore.getState() as any;
          if (routineStore.updateRoutineUsage) {
            routineStore.updateRoutineUsage(routine.id.toString());
          }
        } catch (error) {
          console.log('Could not update routine usage:', error);
        }
      }

      // Navigate to workout screen
      router.push("/newWorkout");
    } catch (error) {
      console.error("Error starting workout from routine:", error);
      Alert.alert("Error", "Failed to start workout. Please try again.");
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingBottom: 100, // Space for footer
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorText: {
      marginTop: 16,
      marginBottom: 24,
      color: colors.primaryText,
      fontSize: 18,
      fontWeight: 'bold',
    },
    backToRoutinesButton: {
      backgroundColor: colors.brand,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
    },
    backToRoutinesButtonText: {
      color: colors.primaryText,
      fontWeight: 'bold',
    },
    routineHeader: {
      padding: 20,
      paddingBottom: 12,
    },
    routineNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    routineName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primaryText,
      flex: 1,
    },
    likeButton: {
      padding: 8,
      marginLeft: 12,
      borderRadius: 8,
      backgroundColor: colors.whiteOverlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    saveButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.whiteOverlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionButtonsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primaryText,
      marginBottom: 12,
      paddingHorizontal: 20,
    },
    creatorSection: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    creatorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    creatorAvatar: {
      marginRight: 12,
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    creatorDetails: {
      flex: 1,
    },
    creatorName: {
      fontSize: 14,
      marginBottom: 2,
    },
    createdByText: {
      fontWeight: '400',
      color: colors.primaryText,
    },
    usernameText: {
      fontWeight: '600',
      color: colors.primaryText,
    },
    createdDate: {
      fontSize: 12,
      color: colors.secondaryText,
    },
    statisticsSection: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.whiteOverlayLight,
    },
    statisticsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    statisticItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statisticText: {
      fontSize: 13,
      color: colors.secondaryText,
      fontWeight: '500',
    },
    actionButtonContainer: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    startWorkoutButton: {
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      flexDirection: 'row',
      backgroundColor: colors.brand,
      marginBottom: 6,
    },
    startWorkoutButtonText: {
      color: colors.primaryText,
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 8,
    },
    routineStats: {
      marginTop: 4,
    },
    routineStatsText: {
      fontSize: 14,
      color: colors.secondaryText,
    },
    workoutSection: {
      backgroundColor: colors.background,
      paddingTop: 12,
    },
    exerciseItemWrapper: {
      borderBottomWidth: 1,
      borderBottomColor: colors.whiteOverlayLight,
    },
    exerciseItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
    },
    exerciseSelectableArea: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    exerciseImageAndName: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    exerciseImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
      backgroundColor: colors.primaryText,
    },
    exerciseImagePlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
      backgroundColor: colors.whiteOverlayLight,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.whiteOverlay,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    exerciseItemName: {
      fontSize: 16,
      color: colors.brand,
      fontWeight: '500',
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

    infoButton: {
      padding: 12,
      justifyContent: 'center',
      alignItems: 'center',
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
    optionsModalContent: {
      flex: 1,
      padding: 16,
    },
    bottomSheetHeader: {
      marginBottom: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.whiteOverlay,
    },
    optionsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.primaryText,
      textAlign: 'center',
      marginBottom: 8,
    },
    optionsSubtitle: {
      fontSize: 14,
      color: colors.secondaryText,
      textAlign: 'center',
      opacity: 0.8,
    },
    optionsContent: {
      flex: 1,
    },
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.whiteOverlayLight,
    },
    optionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.whiteOverlay,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    optionTextContainer: {
      flex: 1,
      marginRight: 12,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primaryText,
      marginBottom: 4,
    },
    optionSubtitle: {
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
    // Sets display styles
    setsContainer: {
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    setsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    setHeaderText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.secondaryText,
      flex: 1,
      textAlign: 'center',
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    setRowAlternate: {
      backgroundColor: colors.primaryAccent,
    },
    setNumber: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.primaryText,
      flex: 1,
      textAlign: 'center',
    },
    setData: {
      fontSize: 14,
      color: colors.primaryText,
      flex: 1,
      textAlign: 'center',
    },
  });

  if (loading) {
    return <RoutineDetailSkeleton />;
  }

  if (!routine) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={colors.secondaryText} />
          <Text style={styles.errorText}>Routine not found</Text>
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.backToRoutinesButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backToRoutinesButtonText}>Back to Routines</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Routine Header */}
        <View style={styles.routineHeader}>
          <View style={styles.routineNameRow}>
            <Text style={styles.routineName}>{routine.name}</Text>
            {!isOriginalCreator && (
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                activeOpacity={0.5}
                  style={styles.saveButton}
                  onPress={handleSaveRoutine}
                >
                  <Ionicons 
                    name={isSaved ? "bookmark" : "bookmark-outline"} 
                    size={20} 
                    color={isSaved ? colors.brand : colors.secondaryText} 
                  />
                </TouchableOpacity>
                <TouchableOpacity
                activeOpacity={0.5}
                  style={styles.likeButton}
                  onPress={handleLikeRoutine}
                >
                <IonIcon 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={20} 
                  color={isLiked ? colors.notification : colors.primaryText} 
                />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={styles.routineStats}>
            <Text style={styles.routineStatsText}>
              {routine.routine_exercises.length} exercises • {routine.routine_exercises.reduce((total: number, ex: any) => total + ex.total_sets, 0)} sets
            </Text>
          </View>
        </View>

        {/* Creator Section */}
        <View style={styles.creatorSection}>
          <TouchableOpacity
                activeOpacity={0.5} style={styles.creatorInfo} onPress={handleViewCreatorProfile}>
            <CachedAvatar 
              path={routine.original_creator_profile?.avatar_url || routine.profiles?.avatar_url}
              size={32}
              style={styles.creatorAvatar}
              fallbackIconName="person-circle"
              fallbackIconColor={colors.secondaryText}
            />
            <View style={styles.creatorDetails}>
              <Text style={styles.creatorName}>
                <Text style={styles.createdByText}>Created by </Text>
                <Text style={styles.usernameText}>
                  {routine.original_creator_profile?.username || routine.profiles?.username || 'Unknown User'}
                </Text>
              </Text>
              <Text style={styles.createdDate}>{routine.created_at_formatted}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Routine Statistics Section */}
        <View style={styles.statisticsSection}>
          <View style={styles.statisticsContainer}>
            <View style={styles.statisticItem}>
              <Ionicons name="trending-up" size={16} color={colors.secondaryText} />
              <Text style={styles.statisticText}>
                {routine.usage_count || 0} {routine.usage_count === 1 ? 'use' : 'uses'}
              </Text>
            </View>
            <View style={styles.statisticItem}>
              <Ionicons name="bookmark" size={16} color={colors.secondaryText} />
              <Text style={styles.statisticText}>
                {saveCount} {saveCount === 1 ? 'save' : 'saves'}
              </Text>
            </View>
            <View style={styles.statisticItem}>
              <IonIcon name="heart" size={16} color={colors.secondaryText} />
              <Text style={styles.statisticText}>
                {likeCount} {likeCount === 1 ? 'like' : 'likes'}
              </Text>
            </View>
          </View>
        </View>

        {/* Full Width Action Buttons */}
        <View style={styles.actionButtonContainer}>
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.startWorkoutButton}
            onPress={handleStartWorkout}
          >
            <Ionicons name="add" size={18} color={colors.primaryText} />
            <Text style={styles.startWorkoutButtonText}>Start Routine</Text>
          </TouchableOpacity>
        </View>

        {/* Workout Section */}
        <View style={styles.workoutSection}>
          <Text style={styles.sectionTitle}>Workout</Text>
          
          {routine.routine_exercises.map((exercise: any, index: number) => (
            <View key={exercise.id} style={styles.exerciseItemWrapper}>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.exerciseItemContent}
                onPress={() => handleViewExerciseDetails(exercise)}
              >
                <View style={styles.exerciseSelectableArea}>
                  <View style={styles.exerciseImageAndName}>
                    {/* Exercise image */}
                    {exercise.exercises?.image_url && !failedImages.has(exercise.id) ? (
                      <Image 
                        source={{ uri: exercise.exercises.image_url }}
                        style={styles.exerciseImage}
                        resizeMode="cover"
                        onError={() => {
                          setFailedImages(prev => new Set(prev).add(exercise.id));
                        }}
                      />
                    ) : (
                      <View style={styles.exerciseImagePlaceholder}>
                        <Ionicons 
                          name={(!exercise.exercise_id || exercise.exercise_id.startsWith('custom-')) ? "construct-outline" : "barbell-outline"} 
                          size={20} 
                          color={colors.secondaryText} 
                        />
                      </View>
                    )}
                    
                    <View style={styles.exerciseInfo}>
                      <View style={styles.exerciseNameRow}>
                        <Text style={styles.exerciseItemName}>
                          {exercise.exercises?.name || exercise.name}
                        </Text>
                        {/* Custom Exercise Badge */}
                        {(!exercise.exercise_id || exercise.exercise_id.startsWith('custom-')) && (
                          <View style={styles.customBadge}>
                            <Text style={styles.customBadgeText}>Custom</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
                
                <View style={styles.infoButton}>
                  <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
                </View>
              </TouchableOpacity>
              
              {/* Sets details - outside the touchable area for full width */}
              <View style={styles.setsContainer}>
                {/* Sets header */}
                <View style={styles.setsHeader}>
                  <Text style={styles.setHeaderText}>SET</Text>
                  <Text style={styles.setHeaderText}>WEIGHT</Text>
                  <Text style={styles.setHeaderText}>REPS</Text>
                  <Text style={styles.setHeaderText}>RPE</Text>
                </View>
                
                {/* Sets data */}
                {exercise.routine_sets && exercise.routine_sets.length > 0 ? (
                  exercise.routine_sets
                    .sort((a: any, b: any) => a.set_number - b.set_number)
                    .map((set: any, setIndex: number) => {
                      const repMode = exercise.rep_mode || (exercise.default_reps_min && exercise.default_reps_max ? 'range' : 'single');
                      
                      return (
                        <View key={set.id || setIndex} style={[
                          styles.setRow,
                          setIndex % 2 === 1 && styles.setRowAlternate
                        ]}>
                          <Text style={styles.setNumber}>{set.set_number}</Text>
                          
                          {/* Weight */}
                          <Text style={styles.setData}>
                            {set.weight && isOwner ? 
                              displayWeightForUser(set.weight, 'kg', userWeightUnit, true) : 
                              '-'
                            }
                          </Text>
                          
                          {/* Reps */}
                          <Text style={styles.setData}>
                            {repMode === 'range' ? (
                              set.reps_min && set.reps_max 
                                ? `${set.reps_min}-${set.reps_max}` 
                                : set.reps_min || set.reps_max || '-'
                            ) : (
                              set.reps || '-'
                            )}
                          </Text>
                          
                          {/* RPE */}
                          <Text style={styles.setData}>
                            {set.rpe || '-'}
                          </Text>
                        </View>
                      );
                    })
                ) : (
                  // Fallback: show default values for all sets
                  Array.from({ length: exercise.total_sets }).map((_, setIndex) => {
                    const repMode = exercise.rep_mode || (exercise.default_reps_min && exercise.default_reps_max ? 'range' : 'single');
                    
                    return (
                      <View key={setIndex} style={[
                        styles.setRow,
                        setIndex % 2 === 1 && styles.setRowAlternate
                      ]}>
                        <Text style={styles.setNumber}>{setIndex + 1}</Text>
                        
                        {/* Weight */}
                        <Text style={styles.setData}>
                          {exercise.default_weight && isOwner ? 
                            displayWeightForUser(exercise.default_weight, 'kg', userWeightUnit, true) : 
                            '-'
                          }
                        </Text>
                        
                        {/* Reps */}
                        <Text style={styles.setData}>
                          {repMode === 'range' ? (
                            exercise.default_reps_min && exercise.default_reps_max 
                              ? `${exercise.default_reps_min}-${exercise.default_reps_max}` 
                              : exercise.default_reps_min || exercise.default_reps_max || exercise.default_reps || '-'
                          ) : (
                            exercise.default_reps_min || exercise.default_reps || '-'
                          )}
                        </Text>
                        
                        {/* RPE */}
                        <Text style={styles.setData}>
                          {exercise.default_rpe || '-'}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Routine Options Bottom Sheet */}
      <BottomSheet
        ref={optionsBottomSheetRef}
        index={-1}
        snapPoints={optionsSnapPoints}
        onChange={handleOptionsSheetChanges}
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
        <BottomSheetView style={styles.optionsModalContent}>
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.optionsTitle}>Routine Options</Text>
            <Text style={styles.optionsSubtitle}>Manage your routine settings</Text>
          </View>
          
          <View style={styles.optionsContent}>
            {/* Copy Routine Option - always available */}
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.optionItem} 
              onPress={() => {
                optionsBottomSheetRef.current?.close();
                handleCopyRoutine();
              }}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="copy-outline" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Copy Routine</Text>
                <Text style={styles.optionSubtitle}>Create an editable copy in your collection</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>

            {/* Edit Routine Option - only show if user is original creator */}
            {isOriginalCreator && (
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.optionItem} 
                onPress={() => {
                  optionsBottomSheetRef.current?.close();
                  handleEditRoutine();
                }}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="pencil-outline" size={24} color={colors.primaryText} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Edit Routine</Text>
                  <Text style={styles.optionSubtitle}>Modify exercises and settings</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            )}

            {/* Delete Routine Option - only show if user is owner */}
            {isOwner && (
              <TouchableOpacity
                activeOpacity={0.5} 
                style={[styles.optionItem, styles.destructiveOption]} 
                onPress={() => {
                  optionsBottomSheetRef.current?.close();
                  confirmDeleteRoutine();
                }}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="trash-outline" size={24} color={colors.notification} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, styles.destructiveText]}>Delete Routine</Text>
                  <Text style={styles.optionSubtitle}>Permanently remove this routine from your collection</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.notification} />
              </TouchableOpacity>
            )}
          </View>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}