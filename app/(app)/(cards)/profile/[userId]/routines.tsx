import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../../constants/colors';
import { supabase } from '../../../../../lib/supabase';
import { useAuthStore } from '../../../../../stores/authStore';
import { format } from 'date-fns';
import RoutineListSkeleton from '../../../../../components/RoutineCardSkeleton';

export default function ProfileRoutines() {
  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const router = useRouter();
  const { userId: profileId } = useLocalSearchParams();
  const { session } = useAuthStore();

  useEffect(() => {
    fetchRoutines();
  }, [profileId]);

  useEffect(() => {
    if (session) {
      setIsCurrentUser(profileId === session.user.id);
    }
  }, [profileId, session]);

  // Refresh routines when screen comes into focus (e.g., after deleting a routine)
  useFocusEffect(
    useCallback(() => {
      fetchRoutines(false); // Don't show loading spinner on refresh
    }, [profileId])
  );

  const fetchRoutines = async (showLoading: boolean = true) => {
    if (!profileId) return;

    if (showLoading) {
      setLoading(true);
    }
    try {
      // Fetch user's own routines
      const { data: ownRoutines, error: ownError } = await supabase
        .from('routines')
        .select(`
          id,
          name,
          created_at,
          updated_at,
          user_id,
          original_creator_id,
          routine_exercises (
            id,
            name,
            total_sets
          )
        `)
        .eq('user_id', profileId)
        .order('updated_at', { ascending: false });

      if (ownError) throw ownError;

      // Fetch saved routines for the current user (only if viewing own profile)
      let savedRoutines = [];
      if (profileId === session?.user?.id) {
        const { data: savedData, error: savedError } = await supabase
          .from('saved_routines')
          .select(`
            created_at,
            routines (
              id,
              name,
              created_at,
              updated_at,
              user_id,
              original_creator_id,
              routine_exercises (
                id,
                name,
                total_sets
              )
            )
          `)
          .eq('user_id', profileId)
          .order('created_at', { ascending: false });

        if (savedError) {
          console.warn('Error fetching saved routines:', savedError);
        } else {
          savedRoutines = savedData?.map(item => ({
            ...item.routines,
            isSaved: true,
            saved_at: item.created_at
          })) || [];
        }
      }

      // Combine own routines and saved routines
      const allRoutines = [
        ...ownRoutines.map(routine => ({ ...routine, isSaved: false })),
        ...savedRoutines
      ];

      // Process routines to include exercise count and last used info
      const processedRoutines = allRoutines.map(routine => {
        const totalSets = routine.routine_exercises?.reduce((sum, exercise) => {
          return sum + (exercise.total_sets || 0);
        }, 0) || 0;

        return {
          id: routine.id,
          name: routine.name,
          exerciseCount: routine.routine_exercises?.length || 0,
          totalSets: totalSets,
          created_at: format(new Date(routine.created_at), 'MMM d, yyyy'),
          updated_at: format(new Date(routine.updated_at), 'MMM d, yyyy'),
          saved_at: routine.saved_at ? format(new Date(routine.saved_at), 'MMM d, yyyy') : null,
          isSaved: routine.isSaved || false,
          last_used: 'Never', // Will be updated after querying workouts
          exercises: routine.routine_exercises?.map(ex => ex.name) || []
        };
      });

      // Sort by date (creation date for own routines, saved date for saved routines)
      processedRoutines.sort((a, b) => {
        const dateA = new Date(a.isSaved ? a.saved_at : a.updated_at);
        const dateB = new Date(b.isSaved ? b.saved_at : b.updated_at);
        return dateB.getTime() - dateA.getTime();
      });

      // Get the most recent workout for each routine to calculate last used
      try {
        const { data: workoutsData, error: workoutsError } = await supabase
          .from('workouts')
          .select(`
            id, 
            routine_id,
            start_time
          `)
          .eq('user_id', profileId)
          .not('routine_id', 'is', null)
          .order('start_time', { ascending: false });

        if (!workoutsError && workoutsData) {
          // Create a map of routine_id to last used date
          const lastUsedMap = {};
          workoutsData.forEach(workout => {
            if (workout.routine_id && !lastUsedMap[workout.routine_id]) {
              // Calculate time difference
              const workoutDate = new Date(workout.start_time);
              const now = new Date();
              const diffDays = Math.floor((now.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));
              
              let lastUsed;
              if (diffDays === 0) {
                lastUsed = "Today";
              } else if (diffDays === 1) {
                lastUsed = "Yesterday";
              } else if (diffDays < 7) {
                lastUsed = `${diffDays} days ago`;
              } else if (diffDays < 30) {
                lastUsed = `${Math.floor(diffDays/7)} weeks ago`;
              } else {
                lastUsed = `${Math.floor(diffDays/30)} months ago`;
              }
              
              lastUsedMap[workout.routine_id] = lastUsed;
            }
          });

          // Update the routines with last used info
          processedRoutines.forEach(routine => {
            routine.last_used = lastUsedMap[routine.id] || "Never";
          });
        }
      } catch (workoutsError) {
        console.log('Could not fetch workout history for last used info:', workoutsError);
        // Continue with "Never" as default
      }

      setRoutines(processedRoutines);
    } catch (err) {
      console.error('Error fetching routines:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderRoutineCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      activeOpacity={0.5}
      style={styles.routineCard}
      onPress={() => router.push(`/routine/${item.id}`)}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.routineInfo}>
            <View style={styles.routineNameRow}>
              <Text style={styles.routineName}>{item.name}</Text>
              {item.isSaved && (
                <View style={styles.savedBadge}>
                  <Ionicons name="bookmark" size={12} color={colors.brand} />
                  <Text style={styles.savedBadgeText}>Saved</Text>
                </View>
              )}
            </View>
            <Text style={styles.exerciseCount}>
              {item.exerciseCount} {item.exerciseCount === 1 ? 'exercise' : 'exercises'} • {item.totalSets} sets
            </Text>
          </View>
        </View>
        
        {/* Exercise preview */}
        {item.exercises && item.exercises.length > 0 && (
          <View style={styles.exercisePreview}>
            <Text style={styles.exercisePreviewText}>
              {item.exercises.slice(0, 3).join(' • ')}
              {item.exercises.length > 3 && ` • +${item.exercises.length - 3} more`}
            </Text>
          </View>
        )}
        
        {/* Enhanced footer with time icon */}
        <View style={styles.cardFooter}>
          <View style={styles.dateContainer}>
            <Ionicons name="barbell-outline" size={12} color={colors.secondaryText} />
            <Text style={styles.lastUsed}>Last used {item.last_used}</Text>
          </View>
          <View style={styles.dateContainer}>
            <Ionicons name="time-outline" size={12} color={colors.secondaryText} />
            <Text style={styles.lastUpdated}>
              {item.isSaved ? `Saved ${item.saved_at}` : `Updated ${item.updated_at}`}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <RoutineListSkeleton />
      ) : (
        <>
          {routines.length > 0 ? (
            <FlatList
              data={routines}
              renderItem={renderRoutineCard}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="barbell-outline" size={60} color={colors.secondaryText} />
              <Text style={styles.emptyTitle}>No Routines Yet</Text>
              <Text style={styles.emptyText}>
                {isCurrentUser 
                  ? "You haven't created any workout routines yet" 
                  : "This user hasn't created any workout routines yet"}
              </Text>
            </View>
          )}
          
          {isCurrentUser && (
            <View style={styles.createButtonContainer}>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.createRoutineButton}
                onPress={() => router.push('/editRoutine/new')}
              >
                <Ionicons name="add" size={18} color={colors.primaryText} />
                <Text style={styles.createRoutineButtonText}>New Routine</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: 16,
  },
  routineCard: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    padding: 16,
    marginBottom: 6,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routineInfo: {
    flex: 1,
  },
  routineName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 8,
  },
  routineNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  savedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.brand,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exerciseCount: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  exercisePreview: {
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.secondaryAccent,
    borderRadius: 8,
  },
  exercisePreviewText: {
    fontSize: 13,
    color: colors.secondaryText,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lastUsed: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  lastUpdated: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButtonContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  createRoutineButton: {
    backgroundColor: colors.brand,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  createRoutineButtonText: {
    color: colors.primaryText,
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 8,
  }
});