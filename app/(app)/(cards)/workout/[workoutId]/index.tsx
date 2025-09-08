import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator, 
  Pressable,
  Image,
  Alert,
  TouchableOpacity
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../../constants/colors';
import { supabase } from '../../../../../lib/supabase';
import { format } from 'date-fns';
import CachedAvatar from '../../../../../components/CachedAvatar';
import WorkoutDetailSkeleton from '../../../../../components/WorkoutDetailSkeleton';
import { useAuthStore } from '../../../../../stores/authStore';
import { useWorkoutStore } from '../../../../../stores/workoutStore';
import { getUserWeightUnit, displayWeightForUser } from '../../../../../utils/weightUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function WorkoutDetailScreen() {
  const { workoutId } = useLocalSearchParams();
  const router = useRouter();
  const { session, profile } = useAuthStore();
  const { startNewWorkout, activeWorkout, endWorkout } = useWorkoutStore();
  
  const [workout, setWorkout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);
  const [failedImages, setFailedImages] = useState(new Set<string>());

  // Get user's preferred weight unit
  const userWeightUnit = getUserWeightUnit(profile);

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
  const getSupersetColor = (supersetIndex: number) => {
    return supersetColors[supersetIndex % supersetColors.length];
  };

  useEffect(() => {
    fetchWorkout();
  }, [workoutId]);

  const fetchWorkout = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch workout with detailed exercise and set data
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id,
          name,
          start_time,
          end_time,
          duration,
          notes,
          user_id,
          routine_id,
          routines(
            id,
            name
          ),
          workout_exercises(
            id,
            name,
            notes,
            exercise_id,
            superset_id,
            workout_sets(
              id,
              weight,
              reps,
              rpe,
              is_completed,
              order_index
            ),
            exercises(
              id,
              name,
              image_url,
              primary_muscle_group,
              equipment_required
            )
          )
        `)
        .eq('id', workoutId)
        .single();
        
      if (error) throw error;
      
      // Process workout data
      const processedWorkout = {
        ...data,
        routine: data.routines ? data.routines : null,
        workout_exercises: data.workout_exercises.map((exercise: any) => {
          // Sort sets by order_index
          const sets = exercise.workout_sets.sort((a: any, b: any) => a.order_index - b.order_index);
          
          // Calculate exercise metrics
          const completedSets = sets.filter((set: any) => set.is_completed).length;
          const totalVolume = sets.reduce((sum: number, set: any) => {
            return sum + (set.weight || 0) * (set.reps || 0);
          }, 0);
          
          return {
            ...exercise,
            sets: sets,
            completedSets,
            totalSets: sets.length,
            totalVolume
          };
        })
      };
      
      setWorkout(processedWorkout);
      
      // Fetch user details
      if (data.user_id) {
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id, username, name, avatar_url')
          .eq('id', data.user_id)
          .single();
          
        if (!userError) {
          setUser(userData);
          setIsCurrentUser(session?.user?.id === userData.id);
        }
      }
    } catch (err: any) {
      console.error('Error fetching workout:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return <WorkoutDetailSkeleton />;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity
                activeOpacity={0.5} style={styles.retryButton} onPress={fetchWorkout}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Workout not found</Text>
        <TouchableOpacity
                activeOpacity={0.5} style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate overall workout metrics
  const totalExercises = workout.workout_exercises.length;
  const totalSets = workout.workout_exercises.reduce((sum: number, ex: any) => sum + ex.totalSets, 0);
  const totalCompletedSets = workout.workout_exercises.reduce((sum: number, ex: any) => sum + ex.completedSets, 0);
  const totalVolume = workout.workout_exercises.reduce((sum: number, ex: any) => sum + ex.totalVolume, 0);
  
  const startDate = new Date(workout.start_time);
  const endDate = workout.end_time ? new Date(workout.end_time) : null;

    const handleViewExerciseDetails = async (exercise: any) => {
    // For custom exercises (exercise_id is null), we need to find the custom exercise ID
    // Custom exercises are identified by having no exercise_id and should be loaded from local storage
    let exerciseId = exercise.exercise_id;
    
    if (!exercise.exercise_id) {
      // This is a custom exercise - try to find it in local storage by name
      try {
        const customExercises = await AsyncStorage.getItem('custom_exercises');
        if (customExercises) {
          const exercises = JSON.parse(customExercises);
          const customExercise = exercises.find((ex: any) => ex.name === exercise.name);
          if (customExercise) {
            exerciseId = customExercise.id;
          } else {
            // Show modal about custom exercise not in library
            const creatorUsername = user?.username || 'Unknown User';
            Alert.alert(
              "Custom Exercise", 
              `This custom exercise was created by ${creatorUsername} and is not in your exercise library.`,
              [
                { text: "OK", style: "default" }
              ]
            );
            return;
          }
        } else {
          // Show modal about custom exercise not in library
          const creatorUsername = user?.username || 'Unknown User';
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
        console.error('Error loading custom exercises:', error);
        return;
      }
    }
    
    router.push({
      pathname: '/(app)/(modals)/exerciseDetails',
      params: { 
        exerciseId: exerciseId,
        exerciseName: exercise.name,
      }
    });
  };

  // Group exercises into supersets and standalone exercises
  const groupedExercises = () => {
    if (!workout?.workout_exercises) return { supersets: {}, standaloneExercises: [] };
    
    const supersets: {[key: string]: any[]} = {};
    const standaloneExercises: any[] = [];

    workout.workout_exercises.forEach((exercise: any) => {
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

  // Analyze muscle groups used in the workout
  const analyzeMuscleGroups = () => {
    if (!workout?.workout_exercises) return [];
    
    const muscleGroups: { [key: string]: number } = {};
    
    workout.workout_exercises.forEach((exercise: any) => {
      if (exercise.exercises?.primary_muscle_group) {
        const muscle = exercise.exercises.primary_muscle_group;
        muscleGroups[muscle] = (muscleGroups[muscle] || 0) + 1;
      }
    });
    
    const total = Object.values(muscleGroups).reduce((sum, count) => sum + count, 0);
    
    if (total === 0) return [];
    
    // Convert to percentages and sort
    const musclePercentages = Object.entries(muscleGroups)
      .map(([muscle, count]) => ({
        muscle: muscle.charAt(0).toUpperCase() + muscle.slice(1),
        percentage: Math.round((count / total) * 100),
        count
      }))
      .sort((a, b) => b.percentage - a.percentage);
    
    return musclePercentages;
  };

  // Analyze equipment used in the workout
  const analyzeEquipment = () => {
    if (!workout?.workout_exercises) return [];
    
    const equipment = new Set<string>();
    
    workout.workout_exercises.forEach((exercise: any) => {
      if (exercise.exercises?.equipment_required) {
        // Handle both array and string formats
        if (Array.isArray(exercise.exercises.equipment_required)) {
          exercise.exercises.equipment_required.forEach((eq: string) => {
            equipment.add(eq);
          });
        } else if (typeof exercise.exercises.equipment_required === 'string') {
          equipment.add(exercise.exercises.equipment_required);
        }
      }
    });
    
    return Array.from(equipment).sort();
  };

  const startWorkoutBasedOnCurrent = async () => {
    if (!workout?.workout_exercises) return;
    
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
      const preparedExercises = workout.workout_exercises
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
          const preparedSets = exercise.sets.map((originalSet: any, index: number) => ({
            id: `set-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
            weight: null, // Don't copy weight
            reps: originalSet.reps, // Copy reps
            rpe: originalSet.rpe, // Copy RPE
            isCompleted: false // Start as not completed
          }));
          
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
        Alert.alert(
          'No Available Exercises',
          'This workout contains only custom exercises that are not available in your exercise library.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      // Show info if some exercises were skipped
      const skippedCount = workout.workout_exercises.length - preparedExercises.length;
      if (skippedCount > 0) {
        Alert.alert(
          'Custom Exercises Skipped',
          `${skippedCount} custom exercise${skippedCount === 1 ? '' : 's'} from the original workout ${skippedCount === 1 ? 'was' : 'were'} not included because ${skippedCount === 1 ? 'it is' : 'they are'} not in your exercise library.`,
          [{ text: 'Continue', style: 'default' }]
        );
      }
      
      // Start a new workout with the prepared exercises
      const workoutName = `${workout.name} (Copy)`;
      startNewWorkout({ 
        name: workoutName, 
        routineId: undefined, // Don't associate with original routine
        exercises: preparedExercises 
      });
      
      // Navigate to the workout screen
      router.push('/newWorkout');
      
    } catch (error) {
      console.error('Error starting workout:', error);
      Alert.alert('Error', 'Failed to start workout. Please try again.');
    } finally {
      setIsStartingWorkout(false);
    }
  };

  const renderExerciseItem = (exercise: any, supersetColor?: string) => {
    return (
      <View key={exercise.id} style={styles.exerciseItemWrapper}>
        <TouchableOpacity
                activeOpacity={0.5} 
          style={styles.exerciseItemContent}
          onPress={() => handleViewExerciseDetails(exercise)}
        >
          {/* Superset ribbon */}
          {supersetColor && (
            <View style={[styles.supersetRibbon, { backgroundColor: supersetColor }]} />
          )}
          
          <View style={[
            styles.exerciseSelectableArea,
            supersetColor && styles.exerciseSelectableAreaWithRibbon
          ]}>
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
                    name={!exercise.exercise_id ? "construct-outline" : "fitness-outline"} 
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
                  {!exercise.exercise_id && (
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
        
        {/* Exercise Notes */}
        {exercise.notes && (
          <View style={styles.exerciseNotesContainer}>
            <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
          </View>
        )}
        
        {/* Sets details */}
        <View style={styles.setsContainer}>
          {/* Sets header */}
          <View style={styles.setsHeader}>
            <Text style={styles.setHeaderText}>SET</Text>
            <Text style={styles.setHeaderText}>WEIGHT</Text>
            <Text style={styles.setHeaderText}>REPS</Text>
            <Text style={styles.setHeaderText}>RPE</Text>
          </View>
          
          {/* Sets data */}
          {exercise.sets.map((set: any, index: number) => (
            <View key={set.id} style={[
              styles.setRow,
              index % 2 === 1 && styles.setRowAlternate
            ]}>
              <Text style={[
                styles.setNumber,
                set.is_completed ? styles.setCompleted : styles.setIncomplete
              ]}>
                {index + 1}
              </Text>
              <Text style={[
                styles.setData,
                set.is_completed ? styles.setCompleted : styles.setIncomplete
              ]}>
                {set.weight ? displayWeightForUser(set.weight, 'kg', userWeightUnit, true) : '-'}
              </Text>
              <Text style={[
                styles.setData,
                set.is_completed ? styles.setCompleted : styles.setIncomplete
              ]}>
                {set.reps || '-'}
              </Text>
              <Text style={[
                styles.setData,
                set.is_completed ? styles.setCompleted : styles.setIncomplete
              ]}>
                {set.rpe || '-'}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderSuperset = (supersetId: string, exercises: any[], supersetIndex: number) => {
    const supersetColor = getSupersetColor(supersetIndex);
    
    return (
      <View key={supersetId} style={styles.supersetContainer}>
        {exercises.map((exercise) => renderExerciseItem(exercise, supersetColor))}
      </View>
    );
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: workout.name,
          headerBackTitle: "Back",
        }}
      />
      
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Workout Header */}
        <View style={styles.workoutHeader}>
          <Text style={styles.workoutName}>{workout.name}</Text>
          {/* Routine Information */}
          {workout.routine && (
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.routineInfoHeader}
              onPress={() => router.push(`/routine/${workout.routine.id}`)}
            >
              <Ionicons name="list-outline" size={16} color={colors.brand} />
              <Text style={styles.routineTextHeader}>{workout.routine.name}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.workoutStats}>
            <View style={styles.workoutStat}>
              <Ionicons name="time-outline" size={14} color={colors.secondaryText} />
              <Text style={styles.workoutStatText}>{formatDuration(workout.duration)}</Text>
            </View>
            <View style={styles.workoutStat}>
              <Ionicons name="fitness-outline" size={14} color={colors.secondaryText} />
              <Text style={styles.workoutStatText}>{totalExercises} exercises</Text>
            </View>
            <View style={styles.workoutStat}>
              <Ionicons name="barbell-outline" size={14} color={colors.secondaryText} />
              <Text style={styles.workoutStatText}>
                {displayWeightForUser(totalVolume, 'kg', userWeightUnit, true)}
              </Text>
            </View>
          </View>
          
          {/* Start Workout Button */}
          <TouchableOpacity
                activeOpacity={0.5} 
            style={[styles.startWorkoutButton, isStartingWorkout && styles.startWorkoutButtonDisabled]}
            onPress={startWorkoutBasedOnCurrent}
            disabled={isStartingWorkout}
          >
            <Ionicons name="add" size={18} color={colors.primaryText} />
            <Text style={styles.startWorkoutButtonText}>
              Start Workout
            </Text>
          </TouchableOpacity>
        </View>

        {/* User Section */}
        {user && (
          <View style={styles.userSection}>
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.userInfo}
              onPress={() => router.push(`/profile/${user.id}`)}
            >
              <CachedAvatar 
                path={user.avatar_url}
                size={32}
                style={styles.userAvatar}
                fallbackIconName="person-circle"
                fallbackIconColor={colors.secondaryText}
              />
              <View style={styles.userDetails}>
                <Text style={styles.userText}>
                  <Text style={styles.completedByText}>Completed by </Text>
                  <Text style={styles.usernameText}>
                    {user.full_name || user.username}
                  </Text>
                </Text>
                <Text style={styles.workoutDate}>
                  {format(startDate, 'MMM d, yyyy')} • {format(startDate, 'h:mm a')}
                  {endDate && ` - ${format(endDate, 'h:mm a')}`}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Notes */}
        {workout.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{workout.notes}</Text>
          </View>
        )}

        {/* Divider */}
        <View style={styles.sectionDivider} />

        {/* Muscle Split Section */}
        {(() => {
          const muscleData = analyzeMuscleGroups();
          if (muscleData.length > 0) {
            return (
              <View style={styles.muscleSplitSection}>
                <Text style={styles.muscleSplitTitle}>Muscle Split</Text>
                {muscleData.map((muscle, index) => (
                  <View key={muscle.muscle} style={styles.muscleBar}>
                    <View style={styles.muscleBarHeader}>
                      <Text style={styles.muscleBarLabel}>{muscle.muscle}</Text>
                      <Text style={styles.muscleBarPercentage}>{muscle.percentage}%</Text>
                    </View>
                    <View style={styles.muscleBarBackground}>
                      <View 
                        style={[
                          styles.muscleBarFill,
                          { 
                            width: `${muscle.percentage}%`,
                          }
                        ]} 
                      />
                    </View>
                  </View>
                ))}
              </View>
            );
          }
          return null;
        })()}

        {/* Equipment Used Section */}
        {(() => {
          const equipment = analyzeEquipment();
          if (equipment.length > 0) {
            return (
              <View style={styles.equipmentSection}>
                <Text style={styles.equipmentTitle}>Equipment Used</Text>
                <View style={styles.equipmentGrid}>
                  {equipment.map((item, index) => (
                    <View key={item} style={styles.equipmentItem}>
                      <Text style={styles.equipmentText}>
                        {item.charAt(0).toUpperCase() + item.slice(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          }
          return null;
        })()}

        {/* Exercises Section */}
        <View style={styles.exercisesSection}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          
          {(() => {
            const { supersets, standaloneExercises } = groupedExercises();
            
            return (
              <>
                {/* Render supersets */}
                {Object.keys(supersets).map((supersetId, index) => 
                  renderSuperset(supersetId, supersets[supersetId], index)
                )}
                
                {/* Render standalone exercises */}
                {standaloneExercises.map((exercise) => renderExerciseItem(exercise))}
              </>
            );
          })()}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: 40,
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.notification,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.background,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  workoutHeader: {
    padding: 20,
    paddingBottom: 12,
  },
  workoutName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primaryText,
  },
  workoutStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  workoutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  workoutStatText: {
    fontSize: 12,
    color: colors.secondaryText,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  userSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    marginRight: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  userDetails: {
    flex: 1,
  },
  userText: {
    fontSize: 14,
    marginBottom: 2,
  },
  completedByText: {
    fontWeight: '400',
    color: colors.secondaryText,
  },
  usernameText: {
    fontWeight: '600',
    color: colors.primaryText,
  },
  workoutDate: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  notesSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  notesText: {
    fontSize: 14,
    color: colors.secondaryText,
    lineHeight: 20,
  },
  exercisesSection: {
    backgroundColor: colors.background,
    paddingTop: 12,
  },
  exerciseItemWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
    position: 'relative',
  },
  exerciseItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    position: 'relative',
  },
  supersetRibbon: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    zIndex: 1,
  },
  supersetContainer: {
    marginBottom: 8,
  },
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
  setCompleted: {
    opacity: 1,
  },
  setIncomplete: {
    opacity: 0.5,
  },
  exerciseSelectableArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseSelectableAreaWithRibbon: {
    marginLeft: 4,
  },
  exerciseImageAndName: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseNotesContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
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
  exerciseImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: colors.primaryText,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseItemName: {
    fontSize: 16,
    color: colors.brand,
    fontWeight: '500',
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customBadge: {
    backgroundColor: colors.customBadgeBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.customBadgeBorder,
  },
  customBadgeText: {
    fontSize: 10,
    color: colors.customBadgeText,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  exerciseNotes: {
    fontSize: 14,
    color: colors.secondaryText,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  routineInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  routineTextHeader: {
    fontSize: 14,
    color: colors.brand,
    fontWeight: '500',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.whiteOverlay,
    marginVertical: 8,
  },
  infoButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Muscle Split Section
  muscleSplitSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
  },
  muscleSplitTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 12,
  },
  muscleBar: {
    marginBottom: 12,
  },
  muscleBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  muscleBarLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primaryText,
  },
  muscleBarPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand,
  },
  muscleBarBackground: {
    height: 8,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 4,
    overflow: 'hidden',
  },
  muscleBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  // Equipment Section
  equipmentSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
  },
  equipmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 12,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.whiteOverlayLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 8,
  },
  equipmentText: {
    fontSize: 14,
    color: colors.primaryText,
    fontWeight: '500',
  },
  // Start Workout Button
  startWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  startWorkoutButtonDisabled: {
    opacity: 0.6,
  },
  startWorkoutButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primaryText,
    marginLeft: 8,
  },
});