import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable, TouchableWithoutFeedback, TouchableOpacity, Alert } from 'react-native';
import { colors } from '../../constants/colors';
import Exercise from './Exercise';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBannerStore } from '../../stores/bannerStore';

interface ExercisesListProps {
  exercises: Array<any>;
  isDetailView?: boolean;
  workoutId?: string;
  workoutName?: string;
  routineData?: {
    id: string;
    name: string;
  };
  postUser?: {
    id: string;
    username?: string;
    name?: string;
    full_name?: string;
  };
  showViewWorkoutButton?: boolean;
}

const ExercisesList: React.FC<ExercisesListProps> = ({ 
  exercises, 
  isDetailView = false, 
  workoutId, 
  workoutName, 
  routineData, 
  postUser,
  showViewWorkoutButton = true 
}) => {
  const router = useRouter();
  const { session, profile } = useAuthStore();
  const { startNewWorkout, activeWorkout, endWorkout } = useWorkoutStore();
  const { showError, showSuccess, showWarning } = useBannerStore();
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);

  // Superset colors - cycle through these (matching newWorkout.tsx)
  const supersetColors = [
    'rgba(255, 107, 107, 0.8)', // Red
    'rgba(54, 162, 235, 0.8)',  // Blue
    'rgba(255, 206, 84, 0.8)',  // Yellow
    'rgba(75, 192, 192, 0.8)',  // Teal
    'rgba(153, 102, 255, 0.8)', // Purple
    'rgba(255, 159, 64, 0.8)',  // Orange
    'rgba(199, 199, 199, 0.8)', // Grey
    'rgba(83, 102, 255, 0.8)',  // Indigo
  ];

  // Function to get superset color
  const getSupersetColor = (supersetId: string, supersetIndex: number) => {
    // Use the superset's index in the order they appear to cycle through colors
    return supersetColors[supersetIndex % supersetColors.length];
  };

  if (!exercises || exercises.length === 0) {
    return null;
  }

  const handleViewWorkout = () => {
    if (workoutId) {
      router.push(`/workout/${workoutId}`);
    }
  };

  const handleViewRoutine = () => {
    if (routineData?.id) {
      router.push(`/routine/${routineData.id}`);
    }
  };

  const handleStartWorkout = async () => {
    if (!workoutId || !exercises || exercises.length === 0) return;
    
    // Check if there's an active workout
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
            onPress: () => {
              endWorkout();
              // Continue with starting the new workout
              startNewWorkoutFromCurrent();
            },
            style: "destructive",
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ]
      );
      return;
    }
    
    // No active workout, proceed normally
    await startNewWorkoutFromCurrent();
  };

  const startNewWorkoutFromCurrent = async () => {
    setIsStartingWorkout(true);
    
    try {
      // Load custom exercises from local storage
      let customExercises: any[] = [];
      try {
        const customExercisesData = await AsyncStorage.getItem('custom_exercises');
        if (customExercisesData) {
          customExercises = JSON.parse(customExercisesData);
        }
      } catch (error) {
        console.error('Error loading custom exercises:', error);
        customExercises = [];
      }
      
      // Filter and prepare exercises data for the new workout
      const preparedExercises = exercises
        .filter((exercise: any) => {
          // If it's a custom exercise (no exercise_id), check if it exists in local storage
          if (!exercise.exercise_id) {
            const customExerciseExists = customExercises.some(
              (customEx: any) => customEx.name === exercise.name
            );
            if (!customExerciseExists) {
              console.log(`Skipping custom exercise "${exercise.name}" - not found in local storage`);
              return false;
            }
          }
          return true;
        })
        .map((exercise: any) => {
          // Create exercise ID
          const exerciseId = `exercise-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Prepare sets without weight and completion status
          const preparedSets = exercise.workout_sets && exercise.workout_sets.length > 0 
            ? exercise.workout_sets.map((originalSet: any, index: number) => ({
                id: `set-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
                weight: null, // Don't copy weight
                reps: originalSet.reps, // Copy reps
                rpe: originalSet.rpe, // Copy RPE
                isCompleted: false // Start as not completed
              }))
            : [
                // If no sets exist, create default sets
                {
                  id: `set-${Date.now()}-0-${Math.floor(Math.random() * 1000)}`,
                  weight: null,
                  reps: null,
                  rpe: null,
                  isCompleted: false
                }
              ];
          
          return {
            id: exerciseId,
            exercise_id: exercise.exercise_id, // Keep reference to original exercise or custom ID
            name: exercise.exercises?.name || exercise.name,
            notes: "", // Don't copy notes
            sets: preparedSets,
            image_url: exercise.exercises?.image_url || null,
            superset_id: exercise.superset_id, // Keep superset grouping
          };
        });
      
      // Check if we have any exercises left after filtering
      if (preparedExercises.length === 0) {
        showError('This workout contains only custom exercises that are not available in your exercise library.');
        return;
      }
      
      // Show info if some exercises were skipped
      const skippedCount = exercises.length - preparedExercises.length;
      if (skippedCount > 0) {
        showWarning(`${skippedCount} custom exercise${skippedCount === 1 ? '' : 's'} from the original workout ${skippedCount === 1 ? 'was' : 'were'} not included because ${skippedCount === 1 ? 'it is' : 'they are'} not in your exercise library.`);
      }
      
      // Start a new workout with the prepared exercises
      const newWorkoutName = `${workoutName} (Copy)`;
      startNewWorkout({ 
        name: newWorkoutName, 
        routineId: undefined, // Don't associate with original routine
        exercises: preparedExercises 
      });
      
      // Navigate to the workout screen
      router.push('/newWorkout');
      
    } catch (error) {
      console.error('Error starting workout:', error);
      showError('Failed to start workout. Please try again.');
    } finally {
      setIsStartingWorkout(false);
    }
  };

  const handleCreateRoutine = async () => {
    if (!session?.user?.id || !exercises || exercises.length === 0) {
      showError('You must be logged in to create a routine.');
      return;
    }

    // First, prompt for routine name
    Alert.prompt(
      'Create Routine',
      'Enter a name for your new routine:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          onPress: (routineName) => {
            if (!routineName || routineName.trim() === '') {
              showError('Please enter a routine name.');
              return;
            }
            confirmCreateRoutine(routineName.trim());
          },
        },
      ],
      'plain-text',
      `${workoutName} Routine`
    );
  };

  const confirmCreateRoutine = (routineName: string) => {
    Alert.alert(
      'Confirm Creation',
      `Create a routine called "${routineName}" with ${exercises.length} exercise${exercises.length === 1 ? '' : 's'}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Create Routine',
          onPress: () => createRoutineWithName(routineName),
          style: 'default',
        },
      ]
    );
  };

  const createRoutineWithName = async (routineName: string) => {
    try {
      // Check if we're the owner of this workout
      const isOwner = postUser?.id === session?.user?.id;
      
      // Create a new routine from the workout
      const { data: newRoutine, error: routineError } = await supabase
        .from('routines')
        .insert({
          name: routineName,
          user_id: session.user.id,
          category: 'user_created',
          original_creator_id: session.user.id,
        })
        .select('id')
        .single();

      if (routineError) throw routineError;

      // Copy all exercises to the routine
      const exercisesToCopy = exercises.map((exercise: any, index: number) => {
        const workoutSets = exercise.workout_sets || [];
        
        // Calculate rep range if there are multiple sets with different rep counts
        const repCounts = workoutSets.map((set: any) => set.reps).filter((reps: any) => reps != null && typeof reps === 'number');
        const uniqueReps = [...new Set(repCounts)] as number[];
        
        let defaultReps = null;
        let defaultRepsMin = null;
        let defaultRepsMax = null;
        
        if (uniqueReps.length === 1) {
          // All sets have the same reps
          defaultReps = uniqueReps[0];
        } else if (uniqueReps.length > 1) {
          // Sets have different reps, set a range
          defaultRepsMin = Math.min(...uniqueReps);
          defaultRepsMax = Math.max(...uniqueReps);
        }
        
        // Get the most common RPE or the first one
        const rpeCounts = workoutSets.map((set: any) => set.rpe).filter((rpe: any) => rpe != null);
        const defaultRpe = rpeCounts.length > 0 ? rpeCounts[0] : null;
        
        // Get the most recent weight used for this exercise (only if we're the owner)
        const weights = workoutSets.map((set: any) => set.weight).filter((weight: any) => weight != null && typeof weight === 'number');
        let defaultWeight = null;
        if (isOwner && weights.length > 0) {
          defaultWeight = weights[weights.length - 1]; // Use the last (most recent) weight
          // Note: Weight is already stored in kg in the database, so no conversion needed
        }
        
        return {
          routine_id: newRoutine.id,
          exercise_id: exercise.exercise_id, // Include exercise_id to maintain relationship with exercises table
          name: exercise.exercises?.name || exercise.name,
          order_position: index + 1,
          total_sets: workoutSets.length > 0 ? workoutSets.length : 3, // Default to 3 sets if no sets exist
          default_weight: defaultWeight, // Copy weight only if we're the owner
          default_reps: defaultReps,
          default_reps_min: defaultRepsMin,
          default_reps_max: defaultRepsMax,
          default_rpe: defaultRpe,
        };
      });

      const { data: insertedExercises, error: exercisesError } = await supabase
        .from('routine_exercises')
        .insert(exercisesToCopy)
        .select('id, order_position');

      if (exercisesError) throw exercisesError;

      // Create individual sets for each exercise based on the workout sets (only if we're the owner)
      if (isOwner) {
        const allSetsToInsert = [];
        
        for (let exerciseIndex = 0; exerciseIndex < exercises.length; exerciseIndex++) {
          const workoutExercise = exercises[exerciseIndex];
          const routineExercise = insertedExercises.find((ex: any) => ex.order_position === exerciseIndex + 1);
          
          if (!routineExercise) continue;
          
          const workoutSets = workoutExercise.workout_sets || [];
          
          // Create routine sets based on workout sets
          const setsForThisExercise = workoutSets.map((workoutSet: any, setIndex: number) => {
            // Weight is already in kg from database, no conversion needed
            const weight = workoutSet.weight && typeof workoutSet.weight === 'number' ? workoutSet.weight : null;
            
            // Determine rep mode and values
            let reps = null;
            let repsMin = null;
            let repsMax = null;
            
            if (workoutSet.reps && typeof workoutSet.reps === 'number') {
              reps = workoutSet.reps;
            }
            
            return {
              routine_exercise_id: routineExercise.id,
              set_number: setIndex + 1,
              weight: weight,
              reps: reps,
              reps_min: repsMin,
              reps_max: repsMax,
              rpe: workoutSet.rpe && typeof workoutSet.rpe === 'number' ? workoutSet.rpe : null,
            };
          });
          
          allSetsToInsert.push(...setsForThisExercise);
        }

        // Insert all the individual sets
        if (allSetsToInsert.length > 0) {
          const { error: setsError } = await supabase
            .from('routine_sets')
            .insert(allSetsToInsert);

          if (setsError) throw setsError;
        }
      }

      // Show success message and navigate to the new routine
      showSuccess(
        `Routine "${routineName}" was successfully created with ${exercises.length} exercise${exercises.length === 1 ? '' : 's'}!`,
        5000,
        {
          text: "View Routine",
          onPress: () => router.push(`/routine/${newRoutine.id}`)
        }
      );
    } catch (error) {
      console.error('Error creating routine:', error);
      showError("Failed to create routine from workout");
    }
  };

  // Group exercises into supersets and standalone exercises
  const groupedExercises = () => {
    const supersets: {[key: string]: any[]} = {};
    const standaloneExercises: any[] = [];

    exercises.forEach(exercise => {
      if (exercise.superset_id) {
        if (!supersets[exercise.superset_id]) {
          supersets[exercise.superset_id] = [];
        }
        supersets[exercise.superset_id].push(exercise);
      } else {
        standaloneExercises.push(exercise);
      }
    });

    // Sort exercises within each superset by order
    Object.keys(supersets).forEach(supersetId => {
      supersets[supersetId].sort((a, b) => 
        (a.superset_order || 0) - (b.superset_order || 0)
      );
    });

    return { supersets, standaloneExercises };
  };

  const { supersets, standaloneExercises } = groupedExercises();

  // Calculate what to display with a max of 4 exercises total
  const maxExercisesToShow = 4;
  let exercisesShown = 0;
  const totalExercises = exercises.length;

  // Determine how many exercises from each group we can show
  const supersetsToShow: {[key: string]: any[]} = {};
  const supersetKeys = Object.keys(supersets);
  
  // First, add supersets (prioritizing them)
  for (const supersetId of supersetKeys) {
    if (exercisesShown >= maxExercisesToShow) break;
    
    const supersetExercises = supersets[supersetId];
    const canShow = Math.min(supersetExercises.length, maxExercisesToShow - exercisesShown);
    supersetsToShow[supersetId] = supersetExercises.slice(0, canShow);
    exercisesShown += canShow;
  }

  // Then add standalone exercises
  const standaloneToShow = standaloneExercises.slice(0, maxExercisesToShow - exercisesShown);
  exercisesShown += standaloneToShow.length;

  const remainingExercises = totalExercises - exercisesShown;

  const renderSuperset = (supersetId: string, exercises: any[], supersetIndex: number) => {
    const supersetColor = getSupersetColor(supersetId, supersetIndex);
    
    return (
      <View key={supersetId} style={styles.supersetContainer}>
        {exercises.map((exercise, index) => (
          <View key={exercise.id} style={styles.supersetExercise}>
            <View style={[styles.supersetRibbon, { backgroundColor: supersetColor }]} />
            <View style={styles.supersetExerciseContent}>
              <Exercise exerciseData={exercise} postUser={postUser} />
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.exercisesWrapper}>
        {/* Workout Name Header */}
        {!isDetailView && workoutName && (
          <View style={styles.workoutHeader}>
            <View style={styles.workoutHeaderContent}>
              <View style={styles.workoutTitleSection}>
                <Text style={styles.workoutName}>{workoutName}</Text>
                {/* Routine Information */}
                {routineData && (
                  <TouchableWithoutFeedback onPress={handleViewRoutine}>
                    <View style={styles.routineInfo}>
                      <IonIcon name="list-outline" size={16} color={colors.brand} />
                      <Text style={styles.routineText}>{routineData.name}</Text>
                    </View>
                  </TouchableWithoutFeedback>
                )}
              </View>
              
              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.actionButton, isStartingWorkout && styles.actionButtonDisabled]}
                  onPress={handleStartWorkout}
                  disabled={isStartingWorkout}
                >
                  <IonIcon 
                    name="play"
                    size={16} 
                    color={colors.primaryText} 
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.actionButton}
                  onPress={handleCreateRoutine}
                >
                  <IonIcon name="copy-outline" size={16} color={colors.primaryText} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        
        <View style={styles.exercisesContainer}>
          {/* Render supersets */}
          {Object.keys(supersetsToShow).map((supersetId, index) => 
            renderSuperset(supersetId, supersetsToShow[supersetId], index)
          )}
          
          {/* Render standalone exercises */}
          {standaloneToShow.map((exercise, exIndex) => (
            <Exercise 
              key={`exercise-${exIndex}`} 
              exerciseData={exercise}
              simplified={!isDetailView}
              postUser={postUser}
            />
          ))}
        </View>
      </View>
      
      {/* Show remaining exercises count if there are any */}
      {remainingExercises > 0 && (
        <View style={styles.remainingExercisesContainer}>
          <Text style={styles.remainingExercisesText}>
            +{remainingExercises} more {remainingExercises === 1 ? 'exercise' : 'exercises'}
          </Text>
        </View>
      )}
      
      {showViewWorkoutButton && (
        <TouchableOpacity
                activeOpacity={0.5} style={styles.viewFullWorkoutButton} onPress={handleViewWorkout}>
          <Text style={styles.viewFullWorkoutText}>View Full Workout</Text>
          <IonIcon name="chevron-forward" size={16} color={colors.brand} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primaryAccent,
  },
  exercisesWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  workoutHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  workoutHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workoutTitleSection: {
    flex: 1,
    justifyContent: 'center',
  },
  workoutName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  exercisesContainer: {
    marginTop: 1,
  },
  routineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
  },
  routineText: {
    fontSize: 14,
    color: colors.brand,
    fontWeight: '500',
  },
  // Superset styles
  supersetContainer: {
    marginBottom: 8,
    overflow: 'hidden',
  },
  supersetExercise: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  supersetRibbon: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    zIndex: 1,
  },
  supersetExerciseContent: {
    flex: 1,
    marginLeft: 4, // Push content to the right by the width of the ribbon
  },
  remainingExercisesContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  remainingExercisesText: {
    fontSize: 14,
    color: colors.secondaryText,
    fontStyle: 'italic',
  },
  viewFullWorkoutButton: {
    marginTop: 'auto',
    alignSelf: 'center',
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewFullWorkoutText: {
    fontSize: 16,
    color: colors.brand,
    textAlign: 'center',
  }
});

export default ExercisesList;