import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TextInput, KeyboardAvoidingView, Platform, StatusBar, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { useWorkoutStore } from '../../../stores/workoutStore';
import { useAuthStore } from '../../../stores/authStore';
import { progressUtils, PROGRESS_LABELS, useProgressStore } from '../../../stores/progressStore';
import { useBannerStore, BANNER_MESSAGES } from '../../../stores/bannerStore';
import { getUserWeightUnit, displayWeightForUser, convertWeight } from '../../../utils/weightUtils';
import DateTimePicker from '@react-native-community/datetimepicker';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function SaveWorkout() {
  const router = useRouter();
  const { 
    activeWorkout, 
    endWorkout, 
    saveWorkoutToDatabase,
    updateWorkoutToDatabase,
    updateActiveWorkout,
    isSaving 
  } = useWorkoutStore();
  const { profile } = useAuthStore();
  
  // Progress bar state
  const { isVisible } = useProgressStore();
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [isVisible]);


  const [workoutTitle, setWorkoutTitle] = useState('');
  const [workoutDate, setWorkoutDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [workoutVisibility, setWorkoutVisibility] = useState('public'); // 'public', 'friends', 'private'
  const [notesVisibility, setNotesVisibility] = useState('public');
  
  // Get user's preferred weight unit
  const userWeightUnit = getUserWeightUnit(profile);
  

  
  // Bottom sheet refs
  const workoutVisibilityBottomSheetRef = useRef<BottomSheet>(null);
  const notesVisibilityBottomSheetRef = useRef<BottomSheet>(null);
  
  // Bottom sheet snap points
  const snapPoints = useMemo(() => ['40%'], []);

  // Backdrop component
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        enableTouchThrough={false}
      />
    ),
    []
  );

  useEffect(() => {
    if (activeWorkout) {
      setWorkoutDate(new Date(activeWorkout.startTime));
      
      // If editing a workout, pre-populate the title from the original workout
      if (activeWorkout.isEditing && activeWorkout.name) {
        setWorkoutTitle(activeWorkout.name);
      }
    }
  }, [activeWorkout]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const calculateWorkoutStats = () => {
    if (!activeWorkout) return { sets: 0, volume: 0, exercises: 0 };

    let totalSets = 0;
    let totalVolume = 0;

    activeWorkout.exercises.forEach(exercise => {
      exercise.sets.forEach(set => {
        if (set.isCompleted) {
          totalSets++;
          if (set.weight && set.reps) {
            totalVolume += set.weight * set.reps;
          }
        }
      });
    });

    return {
      sets: totalSets,
      volume: Math.round(totalVolume),
      exercises: activeWorkout.exercises.length
    };
  };

  const stats = calculateWorkoutStats();

  const handleSaveWorkout = async () => {
    const isEditing = activeWorkout?.isEditing;
    let loadingInterval: any = null;
    
    try {
      // Start progress tracking
      if (isEditing) {
        loadingInterval = progressUtils.startLoading(PROGRESS_LABELS.UPDATING_WORKOUT);
      } else {
        loadingInterval = progressUtils.startLoading(PROGRESS_LABELS.SAVING_WORKOUT);
      }

      // Step 1: Update workout details
      progressUtils.stepProgress(1, 3, 'Preparing workout data...');
      updateActiveWorkout({
        name: workoutTitle,
        startTime: workoutDate,
      });

      // Step 2: Save to database
      progressUtils.stepProgress(2, 3, isEditing ? 'Updating workout...' : 'Saving workout...');
      let success;
      if (isEditing) {
        success = await updateWorkoutToDatabase();
      } else {
        success = await saveWorkoutToDatabase();
      }

      if (success) {
        // Step 3: Finalizing
        progressUtils.stepProgress(3, 3, 'Finalizing...');
        
        // Complete the progress
        progressUtils.completeLoading();
        
        // Clear the loading interval
        if (loadingInterval) {
          clearInterval(loadingInterval);
        }
        
        // Show success banner with action to view the workout
        const { showSuccess } = useBannerStore.getState();
        const message = isEditing ? BANNER_MESSAGES.WORKOUT_UPDATED : BANNER_MESSAGES.WORKOUT_SAVED;
        // For editing: use editingWorkoutId (database ID)
        // For new workouts: success now contains the database ID (string) or false
        const workoutId = isEditing ? activeWorkout?.editingWorkoutId : success;
        
        if (workoutId) {
          showSuccess(
            message,
            4000,
            {
              text: 'View',
              onPress: () => {
                // Navigate to the workout detail screen using the correct database ID
                router.push(`/(app)/(cards)/workout/${workoutId}`);
              }
            }
          );
        } else {
          // Show success without action if we don't have a valid ID
          showSuccess(message, 3000);
        }
        
        endWorkout();
        router.back();
        router.back(); // Go back twice to return to the main screen
      } else {
        // Cancel progress on failure
        progressUtils.cancelLoading();
        if (loadingInterval) {
          clearInterval(loadingInterval);
        }
        
        const { showError } = useBannerStore.getState();
        showError(`Failed to ${isEditing ? 'update' : 'save'} workout. Please try again.`);
      }
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'finishing'} workout:`, error);
      
      // Cancel progress on error
      progressUtils.cancelLoading();
      if (loadingInterval) {
        clearInterval(loadingInterval);
      }
      
      const { showError } = useBannerStore.getState();
      showError(BANNER_MESSAGES.ERROR_GENERIC);
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.back()} style={styles.headerButton}>
          <IonIcon name="chevron-back" size={24} color={colors.primaryText} />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{activeWorkout?.isEditing ? 'Edit workout' : 'Save workout'}</Text>
        </View>
        
        <TouchableOpacity
                activeOpacity={0.5} 
          onPress={handleSaveWorkout} 
          style={styles.saveButton}
          disabled={isSaving}
        >
          <Text style={[styles.saveButtonText, isSaving && styles.saveButtonTextDisabled]}>
            {activeWorkout?.isEditing ? 'Update' : 'Save'}
          </Text>
        </TouchableOpacity>
              {/* Progress Bar */}
      {isVisible && (
        <Animated.View 
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Workout Title */}
        <TextInput
          style={styles.workoutTitleInput}
          value={workoutTitle}
          onChangeText={setWorkoutTitle}
          placeholder="Workout title"
          placeholderTextColor={colors.secondaryText}
        />

        {/* Workout Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{formatDuration(activeWorkout?.duration || 0)}</Text>
                <Text style={styles.summaryLabel}>Duration</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{stats.exercises}</Text>
                <Text style={styles.summaryLabel}>Exercises</Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{stats.sets}</Text>
                <Text style={styles.summaryLabel}>Sets</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {displayWeightForUser(convertWeight(stats.volume, userWeightUnit, 'kg'), 'kg', userWeightUnit, true)}
                </Text>
                <Text style={styles.summaryLabel}>Volume</Text>
              </View>
            </View>
          </View>

          {/* Exercise Breakdown */}
          <View style={styles.exerciseBreakdown}>
            {activeWorkout?.exercises.map((exercise, index) => {
              const completedSets = exercise.sets.filter(set => set.isCompleted).length;
              const exerciseVolume = exercise.sets.reduce((total, set) => {
                if (set.isCompleted && set.weight && set.reps) {
                  return total + (set.weight * set.reps);
                }
                return total;
              }, 0);

              return (
                <View key={exercise.id} style={styles.exerciseItem}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseStats}>
                    {completedSets} sets • {displayWeightForUser(convertWeight(stats.volume, userWeightUnit, 'kg'), 'kg', userWeightUnit, true)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Workout Visibility Bottom Sheet */}
      <BottomSheet
        ref={workoutVisibilityBottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <Text style={styles.bottomSheetTitle}>Workout Visibility</Text>
          
          <BottomSheetScrollView style={styles.bottomSheetList} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[styles.bottomSheetItem, workoutVisibility === 'public' && styles.selectedBottomSheetItem]}
              onPress={() => {
                setWorkoutVisibility('public');
                workoutVisibilityBottomSheetRef.current?.close();
              }}
            >
              <View style={styles.optionContent}>
                <Text style={[styles.bottomSheetItemText, workoutVisibility === 'public' && styles.selectedBottomSheetItemText]}>
                  Public
                </Text>
                <Text style={[styles.optionSubtitle, workoutVisibility === 'public' && styles.selectedOptionSubtitle]}>
                  Anyone can see your workout
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[styles.bottomSheetItem, workoutVisibility === 'friends' && styles.selectedBottomSheetItem]}
              onPress={() => {
                setWorkoutVisibility('friends');
                workoutVisibilityBottomSheetRef.current?.close();
              }}
            >
              <View style={styles.optionContent}>
                <Text style={[styles.bottomSheetItemText, workoutVisibility === 'friends' && styles.selectedBottomSheetItemText]}>
                  Friends
                </Text>
                <Text style={[styles.optionSubtitle, workoutVisibility === 'friends' && styles.selectedOptionSubtitle]}>
                  Only your friends can see your workout
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[styles.bottomSheetItem, workoutVisibility === 'private' && styles.selectedBottomSheetItem]}
              onPress={() => {
                setWorkoutVisibility('private');
                workoutVisibilityBottomSheetRef.current?.close();
              }}
            >
              <View style={styles.optionContent}>
                <Text style={[styles.bottomSheetItemText, workoutVisibility === 'private' && styles.selectedBottomSheetItemText]}>
                  Private
                </Text>
                <Text style={[styles.optionSubtitle, workoutVisibility === 'private' && styles.selectedOptionSubtitle]}>
                  Only you can see your workout
                </Text>
              </View>
            </TouchableOpacity>
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheet>

{/* Notes Visibility Bottom Sheet */}
      <BottomSheet
        ref={notesVisibilityBottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <Text style={styles.bottomSheetTitle}>Notes Visibility</Text>
          
          <BottomSheetScrollView style={styles.bottomSheetList} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[styles.bottomSheetItem, notesVisibility === 'public' && styles.selectedBottomSheetItem]}
              onPress={() => {
                setNotesVisibility('public');
                notesVisibilityBottomSheetRef.current?.close();
              }}
            >
              <View style={styles.optionContent}>
                <Text style={[styles.bottomSheetItemText, notesVisibility === 'public' && styles.selectedBottomSheetItemText]}>
                  Public
                </Text>
                <Text style={[styles.optionSubtitle, notesVisibility === 'public' && styles.selectedOptionSubtitle]}>
                  Your exercise notes are visible to everyone
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[styles.bottomSheetItem, notesVisibility === 'friends' && styles.selectedBottomSheetItem]}
              onPress={() => {
                setNotesVisibility('friends');
                notesVisibilityBottomSheetRef.current?.close();
              }}
            >
              <View style={styles.optionContent}>
                <Text style={[styles.bottomSheetItemText, notesVisibility === 'friends' && styles.selectedBottomSheetItemText]}>
                  Friends
                </Text>
                <Text style={[styles.optionSubtitle, notesVisibility === 'friends' && styles.selectedOptionSubtitle]}>
                  Only your friends can see your exercise notes
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[styles.bottomSheetItem, notesVisibility === 'private' && styles.selectedBottomSheetItem]}
              onPress={() => {
                setNotesVisibility('private');
                notesVisibilityBottomSheetRef.current?.close();
              }}
            >
              <View style={styles.optionContent}>
                <Text style={[styles.bottomSheetItemText, notesVisibility === 'private' && styles.selectedBottomSheetItemText]}>
                  Private
                </Text>
                <Text style={[styles.optionSubtitle, notesVisibility === 'private' && styles.selectedOptionSubtitle]}>
                  Your exercise notes are hidden from everyone
                </Text>
              </View>
            </TouchableOpacity>
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingTop: 53, // Account for status bar
  },
  headerButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 16,
    color: colors.primaryText,
    flex: 1,
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: colors.brand,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  saveButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  workoutTitleInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    fontSize: 20,
    color: colors.primaryText,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 12,
  },
  summaryContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  exerciseBreakdown: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primaryText,
    flex: 1,
  },
  exerciseStats: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: colors.primaryText,
    marginLeft: 12,
  },
  visibilityContainer: {
    marginBottom: 16,
  },
  visibilityTitle: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 8,
  },
  visibilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  visibilityButtonText: {
    fontSize: 16,
    color: colors.primaryText,
    fontWeight: '500',
  },
  // Bottom Sheet Styles
  bottomSheetBackground: {
    backgroundColor: colors.primaryAccent,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  bottomSheetIndicator: {
    backgroundColor: colors.secondaryText,
    width: 40,
  },
  bottomSheetContent: {
    flex: 1,
    padding: 10,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 12,
  },
  bottomSheetList: {
    flex: 1,
  },
  bottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  selectedBottomSheetItem: {
    backgroundColor: colors.brand,
  },
  bottomSheetItemText: {
    fontSize: 16,
    color: colors.primaryText,
    fontWeight: '500',
  },
  selectedBottomSheetItemText: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  optionContent: {
    flex: 1,
  },
  optionSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  selectedOptionSubtitle: {
    color: colors.secondaryText,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 1,
    backgroundColor: colors.brand,
    zIndex: 1000,
  },

});