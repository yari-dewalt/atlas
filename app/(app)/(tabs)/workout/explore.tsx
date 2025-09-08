import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Pressable, 
  ActivityIndicator,
  ScrollView,
  Alert,
  Modal,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../../../../constants/colors';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../stores/authStore';
import { useRoutineStore } from '../../../../stores/routineStore';
import CachedAvatar from '../../../../components/CachedAvatar';
import RoutineCard from '../../../../components/RoutineCard';
import ExploreRoutinesSkeleton from '../../../../components/ExploreRoutinesSkeleton';
import RoutineListSkeleton from '../../../../components/RoutineListSkeleton';

export default function ExploreRoutines() {
  const [routines, setRoutines] = useState([]);
  const [trendingRoutines, setTrendingRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedRoutineIds, setSavedRoutineIds] = useState(new Set());
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const router = useRouter();
  const { session } = useAuthStore();

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    loadRoutines();
    loadTrendingRoutines();
    if (session?.user?.id) {
      loadSavedRoutines();
    }
  }, [session?.user?.id]);

  const loadRoutines = async () => {
    setLoading(true);
    try {
      // First, fetch routines with basic info
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
        .order('created_at', { ascending: false });
      
      if (routinesError) throw routinesError;
      
      // Get all routine IDs for fetching exercises
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
      
      // Fetch profiles separately
      const userIds = routinesData
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
      
      // Process routine data
      const processedRoutines = routinesData.map(routine => {
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
          created_at: new Date(routine.created_at)
        };
      });
      
      setRoutines(processedRoutines);
    } catch (error) {
      console.error('Error loading routines:', error);
      Alert.alert('Error', 'Failed to load routines');
    } finally {
      setLoading(false);
    }
  };
  
  const loadTrendingRoutines = async () => {
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
    }
  };
  
  const loadSavedRoutines = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_routines')
        .select('routine_id')
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      
      const savedIds = new Set(data.map(item => item.routine_id));
      setSavedRoutineIds(savedIds);
    } catch (error) {
      console.error('Error loading saved routines:', error);
    }
  };

  // Category button handlers
  const handleOfficialRoutines = () => {
    if (isKeyboardVisible) {
      Keyboard.dismiss();
      return;
    }
    router.push('/workout/official-routines');
  };

  const handleSearchCommunity = () => {
    if (isKeyboardVisible) {
      Keyboard.dismiss();
      return;
    }
    router.push('/workout/search-community');
  };

  const handleMostLiked = () => {
    if (isKeyboardVisible) {
      Keyboard.dismiss();
      return;
    }
    router.push('/workout/most-liked');
  };

  const handleMostUsed = () => {
    if (isKeyboardVisible) {
      Keyboard.dismiss();
      return;
    }
    router.push('/workout/most-used');
  };

  const saveRoutine = async (routineId) => {
    if (!session?.user?.id) {
      Alert.alert('Sign In Required', 'Please sign in to save routines');
      return;
    }
    
    setSaving(true);
    try {
      // First, we need to check if this user already has this routine
      const { data: existingRoutine, error: checkError } = await supabase
        .from('routines')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('name', routines.find(r => r.id === routineId).name)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existingRoutine) {
        Alert.alert(
          'Routine Already Exists',
          'You already have a routine with this name. Would you like to save it with a different name?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Save As New', 
              onPress: () => saveRoutineWithNewName(routineId) 
            }
          ]
        );
        setSaving(false);
        return;
      }
      
      // If user already saved this routine, remove the save
      if (savedRoutineIds.has(routineId)) {
        await unsaveRoutine(routineId);
        return;
      }
      
      // Save the routine (create a copy)
      await saveRoutineToUserCollection(routineId);
      
      // Then mark as saved
      const { error: saveError } = await supabase
        .from('saved_routines')
        .insert({
          user_id: session.user.id,
          routine_id: routineId
        });
      
      if (saveError) throw saveError;
      
      // Update the save count
      const { error: updateError } = await supabase
        .from('routines')
        .update({ save_count: routines.find(r => r.id === routineId).saveCount + 1 })
        .eq('id', routineId);
      
      if (updateError) throw updateError;
      
      // Update local state
      setSavedRoutineIds(prev => new Set([...prev, routineId]));
      setRoutines(routines.map(r => 
        r.id === routineId 
          ? { ...r, saveCount: r.saveCount + 1 } 
          : r
      ));
      
      Alert.alert('Success', 'Routine saved to your collection');
    } catch (error) {
      console.error('Error saving routine:', error);
      Alert.alert('Error', 'Failed to save routine');
    } finally {
      setSaving(false);
    }
  };
  
  const unsaveRoutine = async (routineId) => {
    try {
      // Remove from saved_routines table
      const { error } = await supabase
        .from('saved_routines')
        .delete()
        .eq('user_id', session.user.id)
        .eq('routine_id', routineId);
      
      if (error) throw error;
      
      // Update the save count
      const { error: updateError } = await supabase
        .from('routines')
        .update({ save_count: Math.max(0, routines.find(r => r.id === routineId).saveCount - 1) })
        .eq('id', routineId);
      
      if (updateError) throw updateError;
      
      // Update local state
      const newSaved = new Set(savedRoutineIds);
      newSaved.delete(routineId);
      setSavedRoutineIds(newSaved);
      
      setRoutines(routines.map(r => 
        r.id === routineId 
          ? { ...r, saveCount: Math.max(0, r.saveCount - 1) } 
          : r
      ));
      
      Alert.alert('Removed', 'Routine removed from your saved collection');
    } catch (error) {
      console.error('Error unsaving routine:', error);
      Alert.alert('Error', 'Failed to remove routine');
    }
  };
  
  const saveRoutineWithNewName = async (routineId) => {
    // Show dialog to input new name
    Alert.prompt(
      'New Routine Name',
      'Enter a new name for this routine:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (newName) => {
            if (!newName || newName.trim() === '') {
              Alert.alert('Error', 'Please enter a valid name');
              return;
            }
            
            try {
              setSaving(true);
              await saveRoutineToUserCollection(routineId, newName.trim());
              Alert.alert('Success', 'Routine saved with new name');
            } catch (error) {
              console.error('Error saving routine with new name:', error);
              Alert.alert('Error', 'Failed to save routine');
            } finally {
              setSaving(false);
            }
          }
        }
      ],
      'plain-text'
    );
  };
  
  const saveRoutineToUserCollection = async (routineId, newName = null) => {
    // Get the original routine with all exercises
    const { data: originalRoutine, error: fetchError } = await supabase
      .from('routines')
      .select(`
        id,
        name,
        category,
        user_id,
        original_creator_id,
        routine_exercises (
          exercise_id,
          name,
          order_position,
          total_sets,
          default_weight,
          default_reps,
          default_reps_min,
          default_reps_max,
          default_rpe
        )
      `)
      .eq('id', routineId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Create a new routine, preserving the original creator
    const { data: newRoutine, error: createError } = await supabase
      .from('routines')
      .insert({
        user_id: session.user.id,
        name: newName || originalRoutine.name,
        category: originalRoutine.category,
        original_creator_id: originalRoutine.original_creator_id || originalRoutine.user_id,
      })
      .select('id')
      .single();
    
    if (createError) throw createError;
    
    // Save all exercises (excluding personal defaults like weight)
    const exercisesToSave = originalRoutine.routine_exercises.map(ex => ({
      routine_id: newRoutine.id,
      exercise_id: ex.exercise_id,
      name: ex.name,
      order_position: ex.order_position,
      total_sets: ex.total_sets,
      default_weight: null, // Don't copy personal weight defaults
      default_reps: ex.default_reps,
      default_reps_min: ex.default_reps_min,
      default_reps_max: ex.default_reps_max,
      default_rpe: ex.default_rpe // Copy RPE as it's part of routine design
    }));
    
    const { error: exerciseError } = await supabase
      .from('routine_exercises')
      .insert(exercisesToSave);
    
    if (exerciseError) throw exerciseError;
    
    return newRoutine.id;
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
                  <AntDesign name="like1" size={60} color={colors.brand} />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: colors.secondaryText,
    fontSize: 16,
  },
  routineCard: {
    backgroundColor: colors.secondaryAccent,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: colors.overlay,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routineName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 4,
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
  creatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  creatorAvatar: {
    marginRight: 8,
  },
  creatorText: {
    fontSize: 14,
    color: colors.secondaryText,
    marginLeft: 8,
  },
  routineInfo: {
    flex: 1,
  },
  exerciseCount: {
    fontSize: 14,
    color: colors.secondaryText,
    marginTop: 4,
  },
  exercisePreview: {
    marginTop: 8,
  },
  exercisePreviewText: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  saveInfo: {
    alignItems: 'flex-end',
  },
  saveCount: {
    fontSize: 12,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  // New styles for enhanced routine cards
  routineNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  officialBadge: {
    marginLeft: 4,
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  trendingText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brand,
    letterSpacing: 0.5,
  },
  engagementMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  muscleGroupsContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  muscleGroupsScroll: {
    gap: 6,
  },
  muscleGroupTag: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
  },
  muscleGroupText: {
    fontSize: 10,
    color: colors.secondaryText,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});