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
  { id: 1, name: "Upper Body Split", date: "May 12, 2025", duration: "45 min", volume: "5,400 lbs" },
  { id: 2, name: "Lower Body Focus", date: "May 9, 2025", duration: "58 min", volume: "8,250 lbs" },
  { id: 3, name: "Full Body Workout", date: "May 5, 2025", duration: "72 min", volume: "7,800 lbs" },
];

export default function Workout() {
  const scrollViewRef = useRef(null);
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const router = useRouter();
  const { session, profile } = useAuthStore();
  const { activeWorkout, isPaused } = useWorkoutStore();

  // Get user's preferred weight unit
  const userWeightUnit = getUserWeightUnit(profile);
  const { routines, loading: routinesLoading, fetchRoutines } = useRoutineStore() as any;
  const [loading, setLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Register scroll ref for tab scroll-to-top functionality
  useEffect(() => {
    setTabScrollRef('workout', scrollViewRef.current);
  }, []);

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
        
        return {
          id: workout.id,
          name: workout.name,
          date: format(parseISO(workout.start_time), "MMM d, yyyy"),
          duration: formattedDuration,
          volume: displayWeightForUser(Math.round(totalVolume), 'kg', userWeightUnit, true),
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
      
      // Start a new workout with this routine
      useWorkoutStore.getState().startNewWorkout({
        name: routine.name,
        routineId: routine.id, // Make sure this is included
        exercises: routine.routine_exercises.map((exercise: any) => ({
          id: Date.now() + Math.random(), // Temporary ID for workout instance
          exercise_id: exercise.exercise_id, // Original exercise ID for database relationship
          name: exercise.name,
          image_url: exercise.exercises?.image_url || null, // Include image from joined exercises table
          sets: Array.from({ length: exercise.total_sets }).map((_, i) => ({
            id: Date.now() + Math.random() + i,
            weight: exercise.default_weight,
            reps: exercise.default_reps,
            rpe: exercise.default_rpe,
            isCompleted: false
          })),
          notes: "",
          superset_id: exercise.superset_id || null, // Include superset ID if exists
        }))
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

  const handleActiveWorkoutPress = () => {
    if (navigating) return;
    
    setNavigating(true);
    router.push("/newWorkout");
    setTimeout(() => setNavigating(false), 1000);
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

  const confirmDiscardWorkout = () => {
    Alert.alert(
      "Discard Workout",
      "Are you sure you want to discard this workout? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            useWorkoutStore.getState().endWorkout();
            // Optional: Show a toast or feedback message
          }
        }
      ]
    );
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
              Empty Workout
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Workout Section - Show under Quick Start */}
        {activeWorkout && (
          <View style={styles.activeWorkoutContainer}>
            <TouchableOpacity
            activeOpacity={0.5} 
              style={[
                styles.activeWorkoutCard,
                navigating && styles.disabledButton
              ]}
              onPress={handleActiveWorkoutPress}
              disabled={navigating}
            >
              <View style={styles.activeWorkoutHeader}>
                <View style={styles.activeWorkoutTitleRow}>
                  <Text style={styles.activeWorkoutTitle}>Active Workout</Text>
                </View>
                <View style={styles.activeWorkoutTimeRow}>
                  <IonIcon 
                    name={isPaused ? "pause-circle" : "timer-outline"} 
                    size={18} 
                    color={isPaused ? colors.secondaryText : colors.brand} 
                    style={[styles.timeIcon, isPaused && { opacity: 0.5 } ]}
                  />
                  <Text style={[
                    styles.activeWorkoutTime,
                    isPaused && styles.pausedTime
                  ]}>
                    {formatDuration(activeWorkout.duration)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.activeWorkoutContent}>
                <View style={styles.activeWorkoutStats}>
                  <View style={styles.workoutStat}>
                    <Text style={styles.workoutStatText}>{activeWorkout.exercises.length} exercises</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.activeWorkoutAction}>
                <TouchableOpacity
            activeOpacity={0.5} 
                  style={styles.discardButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    confirmDiscardWorkout();
                  }}
                >
                  <IonIcon name="trash-outline" size={16} color={colors.notification} />
                  <Text style={styles.discardButtonText}>Discard</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* My Routines Section - Show skeleton while loading */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Routines</Text>
        </View>
        
        {/* Quick Action Buttons - Always visible */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            activeOpacity={0.5} 
            style={styles.quickActionButton}
            onPress={() => router.push("/editRoutine/new")}
          >
            <IonIcon name="add-circle-outline" size={20} color={colors.primaryText} />
            <Text style={styles.quickActionText}>Create New</Text>
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
                <TouchableOpacity
            activeOpacity={0.5} 
                  style={styles.emptyStateButton}
                  onPress={() => router.push(`/profile/${session?.user.id}/routines`)}
                >
                  <Text style={styles.emptyStateButtonText}>View Routines</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <TouchableOpacity
              activeOpacity={0.5} 
              style={styles.viewAllButton}
              onPress={() => router.push(`/profile/${session?.user.id}/routines`)}
            >
              <Text style={styles.viewAllText}>View All Routines</Text>
              <IonIcon name="chevron-forward" size={16} color={colors.brand} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Workout History Section - Show skeleton while loading */}
      <View style={[styles.section, styles.lastSection]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Workout History</Text>
        </View>
        
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
                        <Text style={styles.historyStatText}>{workout.exercises} exercises</Text>
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
                <TouchableOpacity
            activeOpacity={0.5} 
                  style={styles.emptyStateButton}
                  onPress={startEmptyWorkout}
                >
                  <Text style={styles.emptyStateButtonText}>Start First Workout</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <TouchableOpacity
              activeOpacity={0.5} 
              style={styles.viewAllButton}
              onPress={() => router.push(`/profile/${session?.user.id}/workouts`)}
            >
              <Text style={styles.viewAllText}>View All History</Text>
              <IonIcon name="chevron-forward" size={16} color={colors.brand} />
            </TouchableOpacity>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    backgroundColor: colors.secondaryAccent,
    borderRadius: 12,
    marginBottom: 8,
  },
  emptyStateText: {
    textAlign: 'center',
    color: colors.secondaryText,
    marginBottom: 12,
  },
  emptyStateButton: {
    backgroundColor: colors.brand,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: colors.primaryText,
    fontWeight: '500',
  },
  activeWorkoutContainer: {
    marginTop: 8,
  },
  activeWorkoutCard: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    padding: 16,
  },
  activeWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeWorkoutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeWorkoutTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeIcon: {
    marginRight: 4,
  },
  activeWorkoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginLeft: 0,
  },
  activeWorkoutTime: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.brand,
  },
  pausedTime: {
    color: colors.secondaryText,
    opacity: 0.5,
  },
  activeWorkoutContent: {
    marginBottom: 12,
  },
  activeWorkoutStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  workoutStatText: {
    fontSize: 14,
    color: colors.secondaryText,
    marginLeft: 0,
    fontWeight: '500',
  },
  activeWorkoutAction: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryAccent,
    borderWidth: 1,
    borderColor: colors.notification,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
  },
  discardButtonText: {
    color: colors.notification,
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 15,
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
});