import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Dimensions,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { supabase } from '../../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWorkoutStore } from '../../../stores/workoutStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBannerStore } from '../../../stores/bannerStore';

const CUSTOM_EXERCISES_KEY = 'custom_exercises';
const RECENT_EXERCISES_KEY = 'recent_exercises';

export default function ExerciseDetails() {
  const { exerciseId, exerciseName, fromWorkout, fromSelection, fromRoutineEdit } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [exercise, setExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  
  // Get workout store functions
  const { activeWorkout, removeExercise } = useWorkoutStore();
  
  // Get banner store functions
  const { showSuccess, showError } = useBannerStore();

  // Detect if we're in a fullscreen modal by checking the route
  // If we're coming from a workout, selection, or routine modal, we're likely in fullscreen
  const isInFullscreenModal = fromWorkout || fromSelection || fromRoutineEdit;

  // Calculate header padding based on context and platform
  const headerPaddingTop = Platform.OS === 'android' && isInFullscreenModal ? 48 : 
                          isInFullscreenModal ? 16 : insets.top + 16;

  useEffect(() => {
    if (exerciseId) {
      loadExerciseDetails();
    }
  }, [exerciseId]);

  const loadExerciseDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if it's a custom exercise first
      if (typeof exerciseId === 'string' && exerciseId.startsWith('custom-')) {
        const customExercises = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
        if (customExercises) {
          const exercises = JSON.parse(customExercises);
          
          let customExercise = null;
          
          // First try to find by exact ID match
          customExercise = exercises.find(ex => ex.id === exerciseId);
          
          // If not found and this is from a workout, try to find by name
          if (!customExercise && fromWorkout) {
            customExercise = exercises.find(ex => ex.name === exerciseName);
          }
          
          if (customExercise) {
            setExercise({
              ...customExercise,
              muscle_groups: customExercise.muscle_groups || [],
              equipment: Array.isArray(customExercise.equipment_required) 
                ? customExercise.equipment_required.join(', ') 
                : customExercise.equipment_required || 'Custom',
              difficulty: customExercise.difficulty_level || 'Custom',
              tips: [],
              is_custom: true,
            });
            return;
          }
        }
        
        // If we still haven't found the custom exercise, create a fallback
        if (fromWorkout) {
          setExercise({
            id: exerciseId,
            name: exerciseName || 'Custom Exercise',
            description: 'Custom exercise from your workout.',
            muscle_groups: [],
            equipment: 'Custom',
            difficulty: 'Custom',
            instructions: 'Custom exercise created during workout.',
            tips: [],
            image_url: null,
            is_custom: true,
          });
          return;
        }
      }

      // Try to load from Supabase if not custom
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .single();

      if (exerciseError && exerciseError.code !== 'PGRST116') {
        console.log('Exercise not found in database:', exerciseError);
      }

      if (exerciseData) {
        setExercise({
          ...exerciseData,
          muscle_groups: [
            exerciseData.primary_muscle_group,
            ...(exerciseData.secondary_muscle_groups || [])
          ].filter(Boolean),
          equipment: Array.isArray(exerciseData.equipment_required) 
            ? exerciseData.equipment_required.join(', ') 
            : exerciseData.equipment_required || 'Unknown',
          difficulty: exerciseData.difficulty_level || 'Unknown',
          tips: [],
        });
      } else {
        setExercise({
          id: exerciseId,
          name: exerciseName || 'Unknown Exercise',
          description: 'Exercise from your workout routine.',
          muscle_groups: [],
          equipment: 'As specified in workout',
          difficulty: 'Unknown',
          instructions: 'Follow your workout routine for this exercise.',
          tips: [],
          image_url: null,
        });
      }
    } catch (err) {
      console.error('Error loading exercise details:', err);
      setError('Failed to load exercise details');
      showError('Failed to load exercise details. Using cached information.');
      setExercise({
        id: exerciseId,
        name: exerciseName || 'Unknown Exercise',
        description: 'Exercise from your workout routine.',
        muscle_groups: [],
        equipment: 'As specified in workout',
        difficulty: 'Unknown',
        instructions: 'Follow your workout routine for this exercise.',
        tips: [],
        image_url: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOptionsPress = () => {
    if (exercise?.is_custom) {
      Alert.alert(
        'Custom Exercise Options',
        `What would you like to do with "${exercise.name}"?`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Delete Exercise',
            style: 'destructive',
            onPress: handleDeleteCustomExercise
          }
        ]
      );
    }
  };

  const handleDeleteCustomExercise = () => {
    Alert.alert(
      'Delete Exercise',
      `Are you sure you want to delete "${exercise.name}"? This will remove it from your custom exercises, recent exercises, and current workout.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const exerciseIdToDelete = exercise.id;
              
              // 1. Remove from custom exercises
              const customExercises = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
              if (customExercises) {
                const exercises = JSON.parse(customExercises);
                const updatedCustomExercises = exercises.filter(ex => ex.id !== exerciseIdToDelete);
                await AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(updatedCustomExercises));
              }

              // 2. Remove from recent exercises
              const recentExercises = await AsyncStorage.getItem(RECENT_EXERCISES_KEY);
              if (recentExercises) {
                const exercises = JSON.parse(recentExercises);
                const updatedRecentExercises = exercises.filter(ex => ex.id !== exerciseIdToDelete);
                await AsyncStorage.setItem(RECENT_EXERCISES_KEY, JSON.stringify(updatedRecentExercises));
              }

              // 3. Remove from active workout if it exists there
              if (activeWorkout?.exercises?.some(ex => ex.id === exerciseIdToDelete)) {
                removeExercise(exerciseIdToDelete);
              }

              // Navigate back
              router.back();
              
              // Show success message
              showSuccess(`"${exercise.name}" has been completely removed from your app.`);
              
            } catch (error) {
              console.error('Error deleting custom exercise:', error);
              showError('Failed to delete exercise. Please try again.');
            }
          }
        }
      ]
    );
  };

  const renderMuscleGroups = () => {
    if (!exercise?.muscle_groups || exercise.muscle_groups.length === 0) {
      return <Text style={styles.noDataText}>No muscle groups specified</Text>;
    }

    const primaryMuscle = exercise.muscle_groups[0];
    const secondaryMuscles = exercise.muscle_groups.slice(1);

    return (
      <View style={styles.muscleGroupsContainer}>
        {primaryMuscle && (
          <View style={styles.muscleGroupRow}>
            <Text style={styles.muscleGroupLabel}>Primary: </Text>
            <Text style={styles.muscleGroupValue}>{primaryMuscle}</Text>
          </View>
        )}
        {secondaryMuscles.length > 0 && (
          <View style={styles.muscleGroupRow}>
            <Text style={styles.muscleGroupLabel}>Secondary: </Text>
            <Text style={styles.muscleGroupValue}>{secondaryMuscles.join(', ')}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEquipment = () => {
    if (!exercise?.equipment || exercise.equipment === 'Unknown') {
      return <Text style={styles.noDataText}>No equipment specified</Text>;
    }

    return (
      <View style={styles.equipmentContainer}>
        <View style={styles.equipmentRow}>
          <Text style={styles.equipmentLabel}>Equipment: </Text>
          <Text style={styles.equipmentValue}>{exercise.equipment}</Text>
        </View>
      </View>
    );
  };

  const renderInstructions = () => {
    if (!exercise?.instructions || exercise.instructions.trim() === '') {
      return <Text style={styles.noDataText}>No instructions available</Text>;
    }

    // Split the instructions string into sentences for better formatting
    const instructionSteps = exercise.instructions
      .split('. ')
      .filter(step => step.trim() !== '')
      .map(step => step.trim() + (step.endsWith('.') ? '' : '.'));

    return (
      <View style={styles.instructionsContainer}>
        {instructionSteps.map((instruction, index) => (
          <View key={index} style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>{index + 1}.</Text>
            <Text style={styles.instructionText}>{instruction.replaceAll('\\n', ' ')}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderTips = () => {
    if (!exercise?.tips || exercise.tips.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tips</Text>
        <View style={styles.tipsContainer}>
          {exercise.tips.map((tip, index) => (
            <View key={index} style={styles.tipItem}>
              <Ionicons name="bulb-outline" size={16} color={colors.brand} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {/* Static header */}
        <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
          <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="chevron-down" size={24} color={colors.primaryText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Exercise Details</Text>
          <View style={styles.headerButton} />
        </View>
        
        <View style={styles.loadingContainer}>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Static header */}
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-down" size={24} color={colors.primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{exercise?.name || 'Exercise Details'}</Text>
        <TouchableOpacity
                activeOpacity={0.5} onPress={handleOptionsPress} style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Exercise Image */}
        {exercise?.image_url && !imageLoadError ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: exercise.image_url }}
              style={styles.exerciseImage}
              resizeMode="cover"
              onError={() => setImageLoadError(true)}
            />
          </View>
        ) : exercise?.image_url && imageLoadError ? (
          <View style={styles.imageContainer}>
            <View style={styles.imagePlaceholder}>
              <Ionicons 
                name={exercise?.is_custom ? "construct-outline" : "barbell-outline"} 
                size={60} 
                color={colors.secondaryText} 
              />
              <Text style={styles.imagePlaceholderText}>Image not available</Text>
            </View>
          </View>
        ) : null}

        {/* Exercise Info */}
        <View style={styles.infoContainer}>
          <View style={styles.exerciseNameRow}>
            <Text style={styles.exerciseName}>{exercise?.name}</Text>
            {exercise?.is_custom && (
              <View style={styles.customBadge}>
                <Text style={styles.customBadgeText}>Custom</Text>
              </View>
            )}
          </View>
          
          {exercise?.description && (
            <Text style={styles.exerciseDescription}>{exercise.description}</Text>
          )}

          {/* Muscle Groups */}
          <View style={styles.section}>
            {renderMuscleGroups()}
          </View>

          {/* Equipment */}
          <View style={styles.section}>
            {renderEquipment()}
          </View>

          {/* Instructions - Only show for non-custom exercises */}
          {!exercise?.is_custom && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How to Perform</Text>
              {renderInstructions()}
            </View>
          )}

          {/* Tips */}
          {renderTips()}
        </View>
      </ScrollView>
    </View>
  );
}

// ... styles remain the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  headerButton: {
    padding: 8,
    width: 40, // Fixed width for alignment
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: colors.primaryText,
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primaryAccent,
    gap: 12,
  },
  imagePlaceholderText: {
    fontSize: 16,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  infoContainer: {
    padding: 20,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primaryText,
    flex: 1,
  },
  customBadge: {
    backgroundColor: colors.customBadgeBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.customBadgeBorder,
  },
  customBadgeText: {
    fontSize: 12,
    color: colors.customBadgeText,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  exerciseDescription: {
    fontSize: 16,
    color: colors.secondaryText,
    lineHeight: 24,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 16,
  },
  muscleGroupsContainer: {
    gap: 8,
  },
  muscleGroupRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  muscleGroupLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.secondaryText,
    minWidth: 80,
  },
  muscleGroupValue: {
    fontSize: 16,
    color: colors.primaryText,
    textTransform: 'capitalize',
    flex: 1,
  },
  equipmentContainer: {
    gap: 8,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  equipmentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.secondaryText,
    minWidth: 80,
  },
  equipmentValue: {
    fontSize: 16,
    color: colors.primaryText,
    textTransform: 'capitalize',
  },
  instructionsContainer: {
    gap: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  instructionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primaryText,
    minWidth: 24,
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    color: colors.primaryText,
    lineHeight: 24,
    marginTop: -4,
  },
  tipsContainer: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.secondaryAccent,
    padding: 12,
    borderRadius: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: colors.primaryText,
    lineHeight: 20,
  },
  noDataText: {
    fontSize: 14,
    color: colors.secondaryText,
    fontStyle: 'italic',
  },
});