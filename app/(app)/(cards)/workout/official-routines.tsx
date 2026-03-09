import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { supabase } from '../../../../lib/supabase';
import RoutineCard from '../../../../components/RoutineCard';
import RoutineListSkeleton from '../../../../components/RoutineListSkeleton';

export default function OfficialRoutines() {
  const router = useRouter();
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOfficialRoutines();
  }, []);

  const fetchOfficialRoutines = async () => {
    setLoading(true);
    try {
      // Fetch official routines
      const { data: routinesData, error: routinesError } = await supabase
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
        .order('created_at', { ascending: false });

      if (routinesError) throw routinesError;

      if (!routinesData || routinesData.length === 0) {
        setRoutines([]);
        return;
      }

      // Get routine IDs for fetching exercises
      const routineIds = routinesData.map(r => r.id);
      
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
      const userIds = routinesData
        .map(routine => routine.user_id)
        .filter(Boolean);
      
      const originalCreatorIds = routinesData
        .map(routine => routine.original_creator_id)
        .filter(Boolean);
      
      const uniqueUserIds = [...new Set([...userIds, ...originalCreatorIds])];
      
      let profilesMap = {};
      if (uniqueUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, name, avatar_url')
          .in('id', uniqueUserIds);
        
        if (!profilesError && profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
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
      
      // Process routine data
      const processedRoutines = routinesData.map(routine => {
        const routineExercises = exercisesByRoutine[routine.id] || [];
        const profile = profilesMap[routine.user_id];
        const originalCreatorProfile = routine.original_creator_id ? profilesMap[routine.original_creator_id] : null;
        
        // Extract unique muscle groups
        const allMuscleGroups = routineExercises.reduce((groups, exercise) => {
          if (exercise.exercises?.primary_muscle_group) {
            groups.push(exercise.exercises.primary_muscle_group);
          }
          if (exercise.exercises?.secondary_muscle_groups) {
            groups.push(...exercise.exercises.secondary_muscle_groups);
          }
          return groups;
        }, []);
        
        const uniqueMuscleGroups = [...new Set(allMuscleGroups)];
        
        return {
          id: routine.id,
          name: routine.name,
          creator: profile?.name || profile?.username || 'Atlas Team',
          creatorUsername: profile?.username || 'Atlas Team',
          creatorAvatar: profile?.avatar_url || null,
          originalCreator: originalCreatorProfile?.name || originalCreatorProfile?.username || routine.original_creator_id ? 'Atlas Team' : profile?.name || profile?.username || 'Atlas Team',
          originalCreatorAvatar: originalCreatorProfile?.avatar_url || routine.original_creator_id ? null : profile?.avatar_url || null,
          exerciseCount: routineExercises.length,
          usageCount: routine.usage_count || 0,
          saveCount: routine.save_count || 0,
          likeCount: routine.like_count || 0,
          isOfficial: true,
          muscleGroups: uniqueMuscleGroups,
          exercises: routineExercises.map(ex => ex.name) || [],
          created_at: new Date(routine.created_at)
        };
      });
      
      setRoutines(processedRoutines);
    } catch (error) {
      console.error('Error fetching official routines:', error);
      Alert.alert('Error', 'Failed to load official routines');
      setRoutines([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Official Routines</Text>
        <Text style={styles.subtitle}>Curated routines from the Atlas Team</Text>
      </View>

      {loading ? (
        <RoutineListSkeleton />
      ) : routines.length > 0 ? (
        <FlashList
          data={routines}
          renderItem={({ item }) => (
            <RoutineCard
              routine={item}
              showTrendingBadge={false}
            />
          )}
          estimatedItemSize={160}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="shield-checkmark" size={80} color={colors.secondaryText} />
          <Text style={styles.emptyTitle}>No Official Routines Yet</Text>
          <Text style={styles.emptyText}>
            Official routines from the Atlas Team will appear here soon!
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primaryText,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.secondaryText,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: colors.secondaryText,
    fontSize: 16,
  },
  resultsHeader: {
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primaryText,
    marginTop: 16,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: colors.secondaryText,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
});
