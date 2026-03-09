import { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  Pressable, 
  RefreshControl, 
  TouchableOpacity
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '../../../../../lib/supabase';
import { colors } from '../../../../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useProfileStore } from '../../../../../stores/profileStore';
import { useAuthStore } from '../../../../../stores/authStore';
import { getUserWeightUnit, displayWeightForUser } from '../../../../../utils/weightUtils';
import WorkoutListSkeleton from '../../../../../components/WorkoutCardSkeleton';

export default function UserWorkoutsScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const { currentProfile, isCurrentUser } = useProfileStore();
  const { profile } = useAuthStore();
  
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  // Get user's preferred weight unit
  const userWeightUnit = getUserWeightUnit(profile);

  const fetchWorkouts = useCallback(async (pageIndex = 0, refresh = false) => {
    try {
      if (refresh) {
        setWorkouts([]);
        setPage(0);
        pageIndex = 0;
      }
      
      setLoading(true);
      setError(null);
      
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
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
            notes,
            workout_sets(
              id,
              weight,
              reps,
              rpe,
              is_completed,
              order_index
            )
          )
        `)
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .range(from, to);
        
      if (error) throw error;
      
      // Process the data to calculate metrics
      const processedWorkouts = data.map(workout => {
        const exercises = workout.workout_exercises.map(exercise => {
          const sets = exercise.workout_sets.sort((a, b) => a.order_index - b.order_index);
          
          // Calculate metrics for this exercise
          const completedSets = sets.filter(set => set.is_completed).length;
          const totalVolume = sets.reduce((sum, set) => {
            return sum + (set.weight || 0) * (set.reps || 0);
          }, 0);
          
          return {
            ...exercise,
            sets: sets,
            completedSets,
            totalSets: sets.length,
            totalVolume
          };
        });
        
        // Calculate overall workout metrics
        const totalExercises = exercises.length;
        const totalSets = exercises.reduce((sum, ex) => sum + ex.totalSets, 0);
        const totalCompletedSets = exercises.reduce((sum, ex) => sum + ex.completedSets, 0);
        const totalVolume = exercises.reduce((sum, ex) => sum + ex.totalVolume, 0);
        
        return {
          ...workout,
          workout_exercises: exercises,
          metrics: {
            totalExercises,
            totalSets,
            totalCompletedSets,
            totalVolume
          }
        };
      });
      
      if (refresh) {
        setWorkouts(processedWorkouts);
      } else {
        setWorkouts(prev => [...prev, ...processedWorkouts]);
      }
      
      setHasMore(data.length === PAGE_SIZE);
      setPage(pageIndex);
    } catch (err: any) {
      console.error('Error fetching workouts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWorkouts(0, true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchWorkouts(page + 1);
    }
  };

  const renderWorkoutCard = useCallback(({ item: workout }: { item: any }) => {
    const startDate = new Date(workout.start_time);
    const formattedDate = format(startDate, 'MMM d, yyyy');
    const formattedTime = format(startDate, 'h:mm a');
    
    // Format duration
    const hours = Math.floor(workout.duration / 3600);
    const minutes = Math.floor((workout.duration % 3600) / 60);
    const formattedDuration = hours > 0 
      ? `${hours}h ${minutes}m` 
      : `${minutes}m`;
    
    return (
      <TouchableOpacity
                activeOpacity={0.5} 
        style={styles.workoutCard}
        onPress={() => router.push(`/workout/${workout.id}`)}
      >
        <View style={styles.workoutCardContent}>
          <View style={styles.workoutHeader}>
            <View style={styles.workoutInfo}>
              <Text style={styles.workoutName}>{workout.name}</Text>
              <Text style={styles.workoutDate}>
                {formattedDate} • {formattedTime}
              </Text>
            </View>
            <View style={styles.workoutDuration}>
              <Ionicons name="time-outline" size={14} color={colors.brand} />
              <Text style={styles.workoutDurationText}>{formattedDuration}</Text>
            </View>
          </View>
          
          <View style={styles.workoutStats}>
            <View style={styles.workoutStat}>
              <Ionicons name="fitness-outline" size={14} color={colors.secondaryText} />
              <Text style={styles.workoutStatText}>{workout.metrics.totalExercises} exercises</Text>
            </View>
            <View style={styles.workoutStat}>
              <Ionicons name="barbell-outline" size={14} color={colors.secondaryText} />
              <Text style={styles.workoutStatText}>
                {displayWeightForUser(workout.metrics.totalVolume, 'kg', userWeightUnit, true)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [router, userWeightUnit]);

  return (
    <>
      <Stack.Screen 
        options={{
          title: isCurrentUser ? "My Workouts" : `${currentProfile?.username}'s Workouts`,
          headerBackTitle: "Profile",
        }}
      />
      
      <View style={styles.container}>
        {loading && !refreshing ? (
          <WorkoutListSkeleton />
        ) : (
          <FlatList
            data={workouts}
            renderItem={renderWorkoutCard}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.brand}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="barbell-outline" size={60} color={colors.secondaryText} />
                  <Text style={styles.emptyText}>No workouts found</Text>
                  {isCurrentUser && (
                    <TouchableOpacity
                activeOpacity={0.5} 
                      style={styles.startWorkoutButton}
                      onPress={() => router.push('/newWorkout')}
                    >
                      <Text style={styles.buttonText}>Start Your First Workout</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null
            }
            ListFooterComponent={
              loading && !refreshing && workouts.length > 0 ? (
                <View style={styles.loaderFooter}>
                  <ActivityIndicator size="small" color={colors.brand} />
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity
                activeOpacity={0.5} style={styles.retryButton} onPress={() => fetchWorkouts(page)}>
                    <Text style={styles.buttonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  workoutCard: {
    marginBottom: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  workoutCardContent: {
    backgroundColor: colors.primaryAccent,
    padding: 16,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 12,
  },
  workoutDate: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  workoutDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.whiteOverlayLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  workoutDurationText: {
    color: colors.brand,
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 4,
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
  loaderFooter: {
    padding: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyText: {
    color: colors.secondaryText,
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  startWorkoutButton: {
    backgroundColor: colors.brand,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    color: colors.notification,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.brand,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
});