import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { colors } from '../../constants/colors';
import Exercise from './Exercise';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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
  workoutName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
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