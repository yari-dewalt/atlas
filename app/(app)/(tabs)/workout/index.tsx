import React, { useEffect, useState, useCallback, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable, 
  Image,
  ActivityIndicator, 
  Alert,
  TouchableOpacity
} from "react-native";
import { Link, useRouter, useFocusEffect } from "expo-router";
import { Ionicons as IonIcon } from '@expo/vector-icons';
import { colors } from "../../../../constants/colors";
import { useAuthStore } from "../../../../stores/authStore";
import { getUserWeightUnit, displayWeightForUser } from "../../../../utils/weightUtils";
import { supabase } from "../../../../lib/supabase";
import { format, parseISO } from "date-fns";
import { useWorkoutStore } from "../../../../stores/workoutStore";
import { useRoutineStore } from "../../../../stores/routineStore";
import { setTabScrollRef } from "../_layout";

// Mock data for routines and history
const mockRoutines = [
  { id: 1, name: "Upper Body Split", exercises: 8, lastUsed: "2 days ago" },
  { id: 2, name: "Lower Body Focus", exercises: 6, lastUsed: "5 days ago" },
  { id: 3, name: "Full Body Workout", exercises: 12, lastUsed: "1 week ago" },
];

const mockHistory = [
  { id: 1, name: "Upper Body Split", date: "May 12, 2025", duration: "45 min", volume: "5.4k lbs" },
  { id: 2, name: "Lower Body Focus", date: "May 9, 2025", duration: "58 min", volume: "8.3k lbs" },
  { id: 3, name: "Full Body Workout", date: "May 5, 2025", duration: "72 min", volume: "7.8k lbs" },
];

export default function Workout() {
  const scrollViewRef = useRef(null);
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [officialRoutine, setOfficialRoutine] = useState<any>(null);
  const [officialRoutineLoading, setOfficialRoutineLoading] = useState(true);
  const router = useRouter();
  const { session, profile } = useAuthStore();
  const { activeWorkout } = useWorkoutStore();

  // Get user's preferred weight unit
  const userWeightUnit = getUserWeightUnit(profile);
  const { routines, loading: routinesLoading, fetchRoutines } = useRoutineStore() as any;
  const [loading, setLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Register scroll ref for tab scroll-to-top functionality
  useEffect(() => {
    setTabScrollRef('workout', scrollViewRef.current);
  }, []);

  // Fetch a random official routine for showcase
  const fetchRandomOfficialRoutine = async () => {
    setOfficialRoutineLoading(true);
    try {
      // First get count of official routines
      const { count, error: countError } = await supabase
        .from('routines')
        .select('*', { count: 'exact', head: true })
        .eq('is_official', true);

      if (countError || !count || count === 0) {
        setOfficialRoutine(null);
        return;
      }

      // Get a random offset
      const randomOffset = Math.floor(Math.random() * count);

      // Fetch one random official routine
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
          category
        `)
        .eq('is_official', true)
        .range(randomOffset, randomOffset)
        .single();

      if (routineError || !routineData) {
        setOfficialRoutine(null);
        return;
      }

      // Fetch routine exercises with exercise details
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('routine_exercises')
        .select(`
          routine_id,
          name,
          exercises (
            primary_muscle_group,
            secondary_muscle_groups
          )
        `)
        .eq('routine_id', routineData.id)
        .order('order_position');
      
      if (exercisesError) {
        console.error('Error fetching routine exercises:', exercisesError);
        setOfficialRoutine(null);
        return;
      }

      const routineExercises = exercisesData || [];
      
      // Extract unique muscle groups
      const allMuscleGroups = routineExercises.reduce((groups: string[], exercise: any) => {
        if (exercise.exercises?.primary_muscle_group) {
          groups.push(exercise.exercises.primary_muscle_group);
        }
        if (exercise.exercises?.secondary_muscle_groups && Array.isArray(exercise.exercises.secondary_muscle_groups)) {
          groups.push(...exercise.exercises.secondary_muscle_groups);
        }
        return groups;
      }, []);
      
      const uniqueMuscleGroups = [...new Set(allMuscleGroups)];
      
      const processedRoutine = {
        id: routineData.id,
        name: routineData.name,
        exerciseCount: routineExercises.length,
        usageCount: routineData.usage_count || 0,
        saveCount: routineData.save_count || 0,
        likeCount: routineData.like_count || 0,
        isOfficial: true,
        muscleGroups: uniqueMuscleGroups,
        exercises: routineExercises.map(ex => ex.name) || [],
        created_at: new Date(routineData.created_at)
      };
      
      setOfficialRoutine(processedRoutine);
    } catch (error) {
      console.error('Error fetching random official routine:', error);
      setOfficialRoutine(null);
    } finally {
      setOfficialRoutineLoading(false);
    }
  };

  // Load user's workout history
  const fetchRecentWorkouts = async (showLoading: boolean = true) => {
    if (!session?.user?.id) return;
    
    if (showLoading) {
      setHistoryLoading(true);
    }
    
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id,
          name,
          start_time,
          end_time,
          duration,
          notes,
          workout_exercises(
            id,
            name,
            workout_sets(
              id,
              weight,
              reps,
              is_completed
            )
          )
        `)
        .eq('user_id', session.user.id)
        .order('start_time', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      
      // Process workout data to calculate metrics
      const processedWorkouts = data.map(workout => {
        // Calculate total volume
        let totalVolume = 0;
        const exercises = workout.workout_exercises || [];
        
        exercises.forEach(exercise => {
          const sets = exercise.workout_sets || [];
          sets.forEach(set => {
            if (set.weight && set.reps) {
              totalVolume += set.weight * set.reps;
            }
          });
        });
        
        // Format duration
        const hours = Math.floor(workout.duration / 3600);
        const minutes = Math.floor((workout.duration % 3600) / 60);
        const formattedDuration = hours > 0 
          ? `${hours}h ${minutes}m` 
          : `${minutes}m`;
        
        // Convert volume to user's preferred unit and format with k notation
        const volumeResult = displayWeightForUser(totalVolume, 'kg', userWeightUnit, false);
        const volumeInUserUnit = Math.round(typeof volumeResult === 'number' ? volumeResult : parseFloat(volumeResult.toString()));
        const formattedVolume = formatVolumeWithUnit(volumeInUserUnit, userWeightUnit);

        return {
          id: workout.id,
          name: workout.name,
          date: format(parseISO(workout.start_time), "MMM d, yyyy"),
          duration: formattedDuration,
          volume: formattedVolume,
          exercises: exercises.length
        };
      });
      
      setWorkoutHistory(processedWorkouts);
    } catch (error) {
      console.error("Error loading workout history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      const loadData = async () => {
        await fetchRoutines(session.user.id);
        await (useRoutineStore.getState() as any).updateLastUsedInfo(session.user.id);
        await fetchRecentWorkouts();
        await fetchRandomOfficialRoutine();
      };
      loadData();
    }
  }, [session?.user?.id]);

  // Refresh data when screen comes into focus (e.g., after deleting a routine)
  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        const loadData = async () => {
          await fetchRoutines(session.user.id, false); // Don't show loading on refresh
          await (useRoutineStore.getState() as any).updateLastUsedInfo(session.user.id);
          await fetchRecentWorkouts(false); // Don't show loading on refresh
        };
        loadData();
      }
    }, [session?.user?.id])
  );

  const startEmptyWorkout = () => {
    if (navigating) return; // Prevent multiple calls
    
    setNavigating(true);
    
    if (activeWorkout) {
      Alert.alert(
        "Workout in Progress",
        "You already have an active workout. What would you like to do?",
        [
          {
            text: "Resume Current",
            onPress: () => {
              router.push("/newWorkout");
              setTimeout(() => setNavigating(false), 1000);
            },
            style: "default",
          },
          {
            text: "Discard & Start New",
            onPress: () => {
              useWorkoutStore.getState().endWorkout();
              router.push("/newWorkout");
              setTimeout(() => setNavigating(false), 1000);
            },
            style: "destructive",
          },
          {
            text: "Cancel",
            onPress: () => setNavigating(false),
            style: "cancel",
          },
        ]
      );
    } else {
      router.push("/newWorkout");
      // Reset navigating state after a delay
      setTimeout(() => setNavigating(false), 1000);
    }
  };

  const startRoutine = async (routineId: any) => {
    if (navigating) return; // Prevent multiple calls
    
    setNavigating(true);
    
    if (activeWorkout) {
      Alert.alert(
        "Workout in Progress",
        "You already have an active workout. What would you like to do?",
        [
          {
            text: "Resume Current",
            onPress: () => {
              router.push("/newWorkout");
              setTimeout(() => setNavigating(false), 1000);
            },
            style: "default",
          },
          {
            text: "Discard & Start New",
            onPress: async () => {
              useWorkoutStore.getState().endWorkout();
              await startNewWorkoutFromRoutine(routineId);
              setTimeout(() => setNavigating(false), 1000);
            },
            style: "destructive",
          },
          {
            text: "Cancel",
            onPress: () => setNavigating(false),
            style: "cancel",
          },
        ]
      );
    } else {
      await startNewWorkoutFromRoutine(routineId);
      setTimeout(() => setNavigating(false), 1000);
    }
  };
  
  const startNewWorkoutFromRoutine = async (routineId: any) => {
    try {
      // Get the routine with exercises
      const routine = await (useRoutineStore.getState() as any).getRoutine(routineId);
      
      if (!routine) {
        Alert.alert("Error", "Could not load routine");
        return;
      }
      
      // Check if this routine belongs to the current user
      const isOwner = routine.user_id === session?.user?.id;
      
      // Start a new workout with this routine
      useWorkoutStore.getState().startNewWorkout({
        name: routine.name,
        routineId: routine.id,
        exercises: routine.routine_exercises.map((exercise: any) => {
          // Use explicit rep_mode if available, otherwise determine based on data
          const repMode = exercise.rep_mode || (exercise.default_reps_min && exercise.default_reps_max ? 'range' : 'single');
          
          return {
            id: Date.now() + Math.random(), // Temporary ID for workout instance
            exercise_id: exercise.exercise_id, // Original exercise ID for database relationship
            name: exercise.exercises?.name || exercise.name,
            image_url: exercise.exercises?.image_url || null, // Include image from joined exercises table
            sets: Array.from({ length: exercise.total_sets }).map((_, i) => ({
              id: Date.now() + Math.random() + i,
              weight: isOwner ? exercise.default_weight : null, // Only inherit weight defaults from own routines
              reps: repMode === 'range' ? exercise.default_reps_max : (exercise.default_reps_min || exercise.default_reps), // For ranges, start with maximum
              repsMin: repMode === 'range' ? exercise.default_reps_min : null,
              repsMax: repMode === 'range' ? exercise.default_reps_max : null,
              isRange: repMode === 'range',
              rpe: exercise.default_rpe, // Always inherit RPE defaults
              isCompleted: false
            })),
            notes: "",
            repMode: repMode,
            superset_id: exercise.superset_id || null, // Include superset ID if exists
          };
        })
      });
      
      // Update the routine's last used info
      (useRoutineStore.getState() as any).updateRoutineUsage(routineId);
      
      // Navigate to workout screen
      router.push("/newWorkout");
    } catch (error) {
      console.error("Error starting workout from routine:", error);
      Alert.alert("Error", "Failed to start workout. Please try again.");
    }
  };

  const viewWorkoutDetails = (workoutId: any) => {
    router.push(`/workout/${workoutId}`);
  };

  const formatDuration = (seconds: any) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatVolumeWithUnit = (volume: number, unit: string) => {
    if (volume >= 1000) {
      const volumeInK = volume / 1000;
      // If it's a whole number (like 12000 -> 12k), don't show decimals
      if (volumeInK % 1 === 0) {
        return `${volumeInK}k ${unit}`;
      }
      // Otherwise show one decimal place (like 19310 -> 19.3k)
      return `${volumeInK.toFixed(1)}k ${unit}`;
    }
    return `${volume} ${unit}`;
  };

  return (
    <ScrollView ref={scrollViewRef} style={styles.container}>
      {/* Start Workout Section - Always visible (works offline) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Start</Text>
        <View style={styles.startWorkoutContainer}>
          <TouchableOpacity
            activeOpacity={0.5} 
            style={[
              styles.startEmptyButton,
              navigating && styles.disabledButton
            ]}
            onPress={startEmptyWorkout}
            disabled={navigating}
          >
            <IonIcon 
              name="add-circle-outline" 
              size={32} 
              color={navigating ? colors.secondaryText : colors.primaryText} 
            />
            <Text style={[
              styles.startEmptyText,
              navigating && styles.disabledText
            ]}>
              New Workout
            </Text>
          </TouchableOpacity>
        </View>

        {/* Official Routine Showcase */}
        <View style={styles.officialRoutineContainer}>
            {officialRoutineLoading ? (
              <View style={styles.officialRoutineSkeleton}>
                <View style={styles.skeletonOfficialContent}>
                  <View style={[styles.skeletonLine, styles.skeletonOfficialTitle]} />
                  <View style={[styles.skeletonLine, styles.skeletonOfficialSubtitle]} />
                </View>
                <View style={[styles.skeletonLine, styles.skeletonOfficialButton]} />
              </View>
            ) : officialRoutine ? (
              <TouchableOpacity
                activeOpacity={0.5}
                style={styles.officialRoutineCard}
                onPress={() => router.push(`/routine/${officialRoutine.id}`)}
              >
                <View style={styles.officialRoutineCardContent}>
                  <View style={styles.officialRoutineTitleRow}>
                    <Text style={styles.officialRoutineCardTitle}>{officialRoutine.name}</Text>
                    <IonIcon name="shield-checkmark" size={16} color={colors.brand} />
                  </View>
                  <Text style={styles.officialRoutineCardDetails}>
                    {officialRoutine.exerciseCount} exercises • {officialRoutine.muscleGroups.slice(0, 2).join(', ')}
                    {officialRoutine.muscleGroups.length > 2 && ` +${officialRoutine.muscleGroups.length - 2} more`}
                  </Text>
                </View>
                
                <View style={styles.officialRoutineCardAction}>
                  <TouchableOpacity
                    activeOpacity={0.5}
                    style={styles.startOfficialRoutineButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      startRoutine(officialRoutine.id);
                    }}
                  >
                    <IonIcon name="add" size={18} color={colors.primaryText} />
                    <Text style={styles.startOfficialRoutineButtonText}>Start Routine</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ) : null}
        </View>
      </View>
      
      {/* Routines Section - Show skeleton while loading */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Routines</Text>
        
        {/* Quick Action Buttons - Always visible */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            activeOpacity={0.5} 
            style={styles.quickActionButton}
            onPress={() => router.push("/editRoutine/new")}
          >
            <IonIcon name="add" size={20} color={colors.primaryText} />
            <Text style={styles.quickActionText}>Create Routine</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            activeOpacity={0.5} 
            style={styles.quickActionButton}
            onPress={() => router.push("/workout/explore")}
          >
            <IonIcon name="search-outline" size={20} color={colors.primaryText} />
            <Text style={styles.quickActionText}>Explore</Text>
          </TouchableOpacity>
        </View>
        
        {routinesLoading ? (
          <View style={styles.routinesContainer}>
            {/* Routine skeleton cards */}
            {[1, 2, 3].map((index) => (
              <View key={index} style={styles.skeletonRoutineCard}>
                <View style={styles.skeletonContent}>
                  <View style={[styles.skeletonLine, styles.skeletonTitle]} />
                  <View style={[styles.skeletonLine, styles.skeletonSubtitle]} />
                </View>
                <View style={[styles.skeletonLine, styles.skeletonButton]} />
              </View>
            ))}
            <View style={[styles.skeletonLine, styles.skeletonViewAll]} />
          </View>
        ) : (
          <View style={styles.routinesContainer}>
            {routines.length > 0 ? (
              routines.slice(0, 3).map((routine: any) => (
                <TouchableOpacity
            activeOpacity={0.5} 
                  key={routine.id} 
                  style={styles.routineCard}
                  onPress={() => router.push(`/routine/${routine.id}`)}
                >
                  <View style={styles.routineCardContent}>
                    <Text style={styles.routineCardTitle}>{routine.name}</Text>
                    <Text style={styles.routineCardDetails}>
                      {routine.exercises} exercises • Last used {routine.lastUsed}
                    </Text>
                  </View>
                  
                  <View style={styles.routineCardAction}>
                    <TouchableOpacity
            activeOpacity={0.5} 
                      style={styles.startRoutineButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        startRoutine(routine.id);
                      }}
                    >
                      <IonIcon name="add" size={18} color={colors.primaryText} />
                      <Text style={styles.startRoutineButtonText}>Start Routine</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  You haven't created any routines yet
                </Text>
              </View>
            )}
            
            {routines.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.viewAllButton}
                onPress={() => router.push(`/profile/${session?.user.id}/routines`)}
              >
                <Text style={styles.viewAllText}>View All Routines</Text>
                <IonIcon name="chevron-forward" size={16} color={colors.brand} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      
      {/* Workout History Section - Show skeleton while loading */}
      <View style={[styles.section, styles.lastSection]}>
        <Text style={styles.sectionTitle}>Workout History</Text>
        
        {historyLoading ? (
          <View style={styles.historyContainer}>
            {/* History skeleton cards */}
            {[1, 2, 3].map((index) => (
              <View key={index} style={styles.skeletonHistoryCard}>
                <View style={styles.skeletonDate} />
                <View style={styles.skeletonHistoryContent}>
                  <View style={[styles.skeletonLine, styles.skeletonHistoryTitle]} />
                  <View style={styles.skeletonHistoryStats}>
                    <View style={[styles.skeletonLine, styles.skeletonStat]} />
                    <View style={[styles.skeletonLine, styles.skeletonStat]} />
                    <View style={[styles.skeletonLine, styles.skeletonStat]} />
                  </View>
                </View>
              </View>
            ))}
            <View style={[styles.skeletonLine, styles.skeletonViewAll]} />
          </View>
        ) : (
          <View style={styles.historyContainer}>
            {workoutHistory.length > 0 ? (
              workoutHistory.map((workout) => (
                <TouchableOpacity
            activeOpacity={0.5} 
                  key={workout.id} 
                  style={styles.historyCard}
                  onPress={() => viewWorkoutDetails(workout.id)}
                >
                  <View style={styles.historyDate}>
                    <Text style={styles.historyDateText}>{workout.date}</Text>
                  </View>
                  <View style={styles.historyDetails}>
                    <Text style={styles.historyTitle} numberOfLines={1} ellipsizeMode="tail">
                      {workout.name}
                    </Text>
                    <View style={styles.historyStats}>
                      <View style={styles.historyStat}>
                        <IonIcon name="time-outline" size={14} color={colors.secondaryText} />
                        <Text style={styles.historyStatText}>{workout.duration}</Text>
                      </View>
                      <View style={styles.historyStat}>
                        <IonIcon name="fitness-outline" size={14} color={colors.secondaryText} />
                        <Text style={styles.historyStatText}>{workout.exercises}</Text>
                      </View>
                      <View style={styles.historyStat}>
                        <IonIcon name="barbell-outline" size={14} color={colors.secondaryText} />
                        <Text style={styles.historyStatText}>{workout.volume}</Text>
                      </View>
                    </View>
                  </View>
                  <IonIcon name="chevron-forward" size={20} color={colors.secondaryText} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  You haven't logged any workouts yet
                </Text>
              </View>
            )}
            
            {workoutHistory.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.viewAllButton}
                onPress={() => router.push(`/profile/${session?.user.id}/workouts`)}
              >
                <Text style={styles.viewAllText}>View All History</Text>
                <IonIcon name="chevron-forward" size={16} color={colors.brand} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  lastSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 12,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondaryAccent,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  quickActionText: {
    color: colors.primaryText,
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 14,
  },
  startWorkoutContainer: {
    flexDirection: 'row',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    height: 100,
  },
  startEmptyButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  startEmptyText: {
    color: colors.primaryText,
    marginTop: 8,
    fontWeight: '500',
  },
  routinesContainer: {
    marginBottom: 16,
  },
  routineCard: {
    flexDirection: 'column',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  routineCardContent: {
    flex: 1,
    marginBottom: 12,
  },
  routineCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 4,
  },
  routineCardDetails: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  routineCardAction: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  startRoutineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  startRoutineButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  historyContainer: {
    marginBottom: 16,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  historyDate: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.secondaryAccent,
    marginRight: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  historyDateText: {
    fontSize: 12,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  historyDetails: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 10,
  },
  historyStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  historyStatText: {
    fontSize: 12,
    color: colors.secondaryText,
    marginLeft: 4,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  viewAllText: {
    color: colors.brand,
    fontWeight: '500',
    marginRight: 4,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    marginBottom: 8,
  },
  emptyStateText: {
    textAlign: 'center',
    color: colors.secondaryText,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: colors.secondaryText,
  },
  // Skeleton styles
  skeletonRoutineCard: {
    flexDirection: 'column',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  skeletonContent: {
    flex: 1,
    marginBottom: 12,
  },
  skeletonLine: {
    backgroundColor: colors.secondaryAccent,
    borderRadius: 4,
  },
  skeletonTitle: {
    height: 20,
    width: '60%',
    marginBottom: 8,
  },
  skeletonSubtitle: {
    height: 16,
    width: '80%',
  },
  skeletonButton: {
    height: 44,
    width: '100%',
    borderRadius: 10,
  },
  skeletonViewAll: {
    height: 20,
    width: '40%',
    alignSelf: 'center',
    marginTop: 8,
  },
  skeletonHistoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  skeletonDate: {
    width: 60,
    height: 40,
    backgroundColor: colors.secondaryAccent,
    borderRadius: 6,
    marginRight: 16,
  },
  skeletonHistoryContent: {
    flex: 1,
  },
  skeletonHistoryTitle: {
    height: 20,
    width: '70%',
    marginBottom: 10,
  },
  skeletonHistoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonStat: {
    height: 14,
    width: 60,
    marginRight: 12,
  },
  // Official Routine Showcase styles
  officialRoutineContainer: {
  },
  officialRoutineCard: {
    flexDirection: 'column',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    padding: 16,
  },
  officialRoutineCardContent: {
    flex: 1,
    marginBottom: 12,
  },
  officialRoutineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  officialRoutineCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    flex: 1,
    marginRight: 8,
  },
  officialRoutineCardDetails: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  officialRoutineCardAction: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  startOfficialRoutineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  startOfficialRoutineButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  officialRoutineSkeleton: {
    flexDirection: 'column',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    padding: 16,
  },
  skeletonOfficialContent: {
    flex: 1,
    marginBottom: 4,
  },
  skeletonOfficialTitle: {
    height: 20,
    width: '60%',
    marginBottom: 8,
  },
  skeletonOfficialSubtitle: {
    height: 16,
    width: '80%',
  },
  skeletonOfficialButton: {
    height: 44,
    width: '100%',
    borderRadius: 10,
  },
});