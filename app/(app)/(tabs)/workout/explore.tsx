import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../../../../constants/colors';
import { supabase } from '../../../../lib/supabase';
import RoutineCard from '../../../../components/RoutineCard';
import RoutineListSkeleton from '../../../../components/RoutineListSkeleton';

export default function ExploreRoutines() {
  const [trendingRoutines, setTrendingRoutines] = useState([]);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    loadTrendingRoutines();
  }, []);

  const loadTrendingRoutines = async () => {
    setLoading(true);
    try {
      // Get current date and 7 days ago for recent activity weighting
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Fetch routines with trending metrics
      const { data: routinesData, error: routinesError } = await supabase
        .from('routines')
        .select(`
          id,
          name,
          created_at,
          user_id,
          original_creator_id,
          save_count,
          usage_count,
          like_count,
          is_official
        `)
        .gt('save_count', 0) // Must have at least some engagement
        .limit(50); // Get more routines to calculate trending from

      if (routinesError) throw routinesError;

      // Calculate trending score for each routine
      const routinesWithTrending = routinesData.map(routine => {
        const saves = routine.save_count || 0;
        const usage = routine.usage_count || 0;
        const likes = routine.like_count || 0;
        const daysOld = Math.max(1, Math.floor((new Date().getTime() - new Date(routine.created_at).getTime()) / (1000 * 60 * 60 * 24)));

        // Trending algorithm: Weight recent activity higher, decay over time
        // Formula: (saves * 3 + usage * 2 + likes * 1) / log(daysOld + 1)
        // This favors routines with high engagement that are relatively recent
        const engagementScore = (saves * 3) + (usage * 2) + (likes * 1);
        const timeDecay = Math.log(daysOld + 1);
        const trendingScore = engagementScore / timeDecay;

        return {
          ...routine,
          trendingScore: trendingScore
        };
      });

      // Sort by trending score and take top 5
      const topTrending = routinesWithTrending
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 5);

      if (topTrending.length === 0) {
        setTrendingRoutines([]);
        return;
      }

      // Get routine IDs for fetching exercises
      const routineIds = topTrending.map(r => r.id);

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
        .in('routine_id', routineIds)
        .order('order_position');

      if (exercisesError) throw exercisesError;

      // Fetch profiles for creators
      const userIds = topTrending
        .map(routine => routine.user_id)
        .filter(Boolean);

      const uniqueUserIds = [...new Set(userIds)];

      let profilesMap = {};
      if (uniqueUserIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', uniqueUserIds);

        if (!profilesError && profiles) {
          profilesMap = profiles.reduce((map, profile) => {
            map[profile.id] = profile;
            return map;
          }, {});
        }
      }

      // Group exercises by routine_id
      const exercisesByRoutine = exercisesData.reduce((acc, exercise) => {
        if (!acc[exercise.routine_id]) {
          acc[exercise.routine_id] = [];
        }
        acc[exercise.routine_id].push(exercise);
        return acc;
      }, {});

      // Process trending routine data
      const processedTrending = topTrending.map(routine => {
        const profile = profilesMap[routine.user_id];
        const originalCreatorProfile = profilesMap[routine.original_creator_id];
        const routineExercises = exercisesByRoutine[routine.id] || [];

        // Extract all muscle groups from exercises
        const allMuscleGroups = routineExercises.reduce((groups, exercise) => {
          if (exercise.exercises) {
            // Add primary muscle group
            if (exercise.exercises.primary_muscle_group && !groups.includes(exercise.exercises.primary_muscle_group)) {
              groups.push(exercise.exercises.primary_muscle_group);
            }

            // Add secondary muscle groups
            if (exercise.exercises.secondary_muscle_groups && Array.isArray(exercise.exercises.secondary_muscle_groups)) {
              exercise.exercises.secondary_muscle_groups.forEach(group => {
                if (!groups.includes(group)) {
                  groups.push(group);
                }
              });
            }
          }
          return groups;
        }, []);

        return {
          id: routine.id,
          name: routine.name,
          creator: profile?.username || 'Unknown',
          creatorUsername: profile?.username || 'Unknown',
          creatorAvatar: profile?.avatar_url || null,
          originalCreator: originalCreatorProfile?.username || routine.original_creator_id ? 'Unknown' : profile?.username || 'Unknown',
          originalCreatorAvatar: originalCreatorProfile?.avatar_url || routine.original_creator_id ? null : profile?.avatar_url || null,
          exerciseCount: routineExercises.length,
          saveCount: routine.save_count || 0,
          usageCount: routine.usage_count || 0,
          likeCount: routine.like_count || 0,
          isOfficial: routine.is_official || false,
          muscleGroups: allMuscleGroups,
          exercises: routineExercises.map(ex => ex.name) || [],
          created_at: new Date(routine.created_at),
          trendingScore: routine.trendingScore
        };
      });

      setTrendingRoutines(processedTrending);
    } catch (error) {
      console.error('Error loading trending routines:', error);
      // Don't show alert for trending failure, just log it
      setTrendingRoutines([]);
    } finally {
      setLoading(false);
    }
  };

  // Category button handlers
  const handleOfficialRoutines = () => {
    Keyboard.dismiss();
    router.push('/workout/official-routines');
  };

  const handleSearchCommunity = () => {
    Keyboard.dismiss();
    router.push('/workout/search-community');
  };

  const handleMostLiked = () => {
    Keyboard.dismiss();
    router.push('/workout/most-liked');
  };

  const handleMostUsed = () => {
    Keyboard.dismiss();
    router.push('/workout/most-used');
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Category Buttons Grid - Always visible */}
            <View style={styles.categoryGrid}>
              <View style={styles.categoryRow}>
                <TouchableOpacity
              activeOpacity={0.5} style={styles.categoryButton} onPress={handleOfficialRoutines}>
                  <Ionicons name="shield-checkmark" size={60} color={colors.brand} />
                  <Text style={styles.categoryButtonText}>Official Routines</Text>
                </TouchableOpacity>

                <TouchableOpacity
              activeOpacity={0.5} style={styles.categoryButton} onPress={handleSearchCommunity}>
                  <Ionicons name="search" size={60} color={colors.brand} />
                  <Text style={styles.categoryButtonText}>Search Community</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.categoryRow}>
                <TouchableOpacity
              activeOpacity={0.5} style={styles.categoryButton} onPress={handleMostLiked}>
                  <Ionicons name="heart" size={60} color={colors.brand} />
                  <Text style={styles.categoryButtonText}>Most Liked</Text>
                </TouchableOpacity>

                <TouchableOpacity
              activeOpacity={0.5} style={styles.categoryButton} onPress={handleMostUsed}>
                  <Ionicons name="trending-up" size={60} color={colors.brand} />
                  <Text style={styles.categoryButtonText}>Most Used</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Trending Routines Section */}
            <View style={styles.trendingSection}>
              <View style={{ paddingHorizontal: 16 }}>
                <Text style={styles.sectionTitle}>Trending Routines</Text>
                <Text style={styles.sectionSubtitle}>Popular routines this week</Text>
              </View>

              {loading ? (
                <RoutineListSkeleton />
              ) : trendingRoutines.length > 0 ? (
                <View style={styles.trendingRoutines}>
                  {trendingRoutines.map((routine) => (
                    <RoutineCard
                      key={routine.id}
                      routine={routine}
                      showTrendingBadge={true}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="flame" size={60} color={colors.secondaryText} />
                  <Text style={styles.emptyTitle}>No trending routines yet</Text>
                  <Text style={styles.emptyText}>
                    Check back later for popular routines
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  categoryGrid: {
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: colors.secondaryAccent,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
    gap: 10,
  },
  categoryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
  },
  trendingSection: {
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primaryText,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 16,
  },
  trendingRoutines: {
    paddingHorizontal: 16,
    gap: 12,
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
  },
});
