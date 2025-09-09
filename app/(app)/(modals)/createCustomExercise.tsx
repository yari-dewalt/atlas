import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../constants/colors';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetBackdrop, BottomSheetFlatList } from '@gorhom/bottom-sheet';

const CUSTOM_EXERCISES_KEY = 'custom_exercises';
const RECENT_EXERCISES_KEY = 'recent_exercises';

export default function CreateCustomExercise() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Check if we're coming from a fullscreen modal based on params
  const isInFullScreenModal = params?.fromRoutineEdit === 'true' || 
                             params?.fromNewWorkout === 'true';
  
  const suggestedName = Array.isArray(params.suggestedName) ? params.suggestedName[0] : params.suggestedName;
  const [exerciseName, setExerciseName] = useState(suggestedName || '');
  const [exerciseDescription, setExerciseDescription] = useState('');
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState('None');
  const [secondaryMuscleGroup, setSecondaryMuscleGroup] = useState('None');
  const [equipment, setEquipment] = useState('None');
  const [saving, setSaving] = useState(false);
  const [primaryMuscleModalVisible, setPrimaryMuscleModalVisible] = useState(false);
  const [secondaryMuscleModalVisible, setSecondaryMuscleModalVisible] = useState(false);
  const [equipmentModalVisible, setEquipmentModalVisible] = useState(false);
  
  // Bottom Sheet refs
  const primaryMuscleBottomSheetRef = useRef(null);
  const secondaryMuscleBottomSheetRef = useRef(null);
  const equipmentBottomSheetRef = useRef(null);

  // Bottom Sheet snap points
  const selectionSnapPoints = useMemo(() => ['60%'], []);

  const muscleGroups = [
    'None', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio'
  ];

  const equipmentOptions = [
    'None', 'Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine', 
    'Resistance Band', 'Kettlebell', 'Smith Machine', 'Other'
  ];

  // Bottom Sheet callbacks
  const handlePrimaryMuscleSheetChanges = useCallback((index) => {
    if (index === -1) {
      setPrimaryMuscleModalVisible(false);
    }
  }, []);

  const handleSecondaryMuscleSheetChanges = useCallback((index) => {
    if (index === -1) {
      setSecondaryMuscleModalVisible(false);
    }
  }, []);

  const handlePrimaryEquipmentSheetChanges = useCallback((index) => {
    if (index === -1) {
      setEquipmentModalVisible(false);
    }
  }, []);

  const handleSecondaryEquipmentSheetChanges = useCallback((index) => {
    if (index === -1) {
      setEquipmentModalVisible(false);
    }
  }, []);

  // Backdrop component
  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        enableTouchThrough={false}
        onPress={() => {
          if (primaryMuscleModalVisible) {
            primaryMuscleBottomSheetRef.current?.close();
          }
          if (secondaryMuscleModalVisible) {
            secondaryMuscleBottomSheetRef.current?.close();
          }
          if (equipmentModalVisible) {
            equipmentBottomSheetRef.current?.close();
          }
        }}
      />
    ),
    [primaryMuscleModalVisible, secondaryMuscleModalVisible, equipmentModalVisible]
  );

  const saveCustomExercise = async (exercise) => {
    try {
      const existingExercises = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
      const exercises = existingExercises ? JSON.parse(existingExercises) : [];
      
      // Add the new exercise
      exercises.push(exercise);
      
      // Save back to storage
      await AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(exercises));
      
      return true;
    } catch (error) {
      console.error('Error saving custom exercise:', error);
      return false;
    }
  };

  const saveRecentExercise = async (exercise) => {
    try {
      const existingRecent = await AsyncStorage.getItem(RECENT_EXERCISES_KEY);
      const recentExercises = existingRecent ? JSON.parse(existingRecent) : [];
      
      // Remove if already exists to avoid duplicates
      const filtered = recentExercises.filter(ex => ex.id !== exercise.id);
      
      // Add to front and limit to 5 recent exercises
      const updated = [exercise, ...filtered].slice(0, 5);
      
      // Save back to storage
      await AsyncStorage.setItem(RECENT_EXERCISES_KEY, JSON.stringify(updated));
      
      return true;
    } catch (error) {
      console.error('Error saving recent exercise:', error);
      return false;
    }
  };

  const handlePrimaryMuscleGroupSelect = (muscle) => {
    setPrimaryMuscleGroup(muscle);
    primaryMuscleBottomSheetRef.current?.close();
  };

  const handleSecondaryMuscleGroupSelect = (muscle) => {
    setSecondaryMuscleGroup(muscle);
    secondaryMuscleBottomSheetRef.current?.close();
  };

  const handlePrimaryEquipmentSelect = (equipment) => {
    setEquipment(equipment);
    equipmentBottomSheetRef.current?.close();
  };

  const handleSecondaryEquipmentSelect = (equipment) => {
    setEquipment(equipment);
    equipmentBottomSheetRef.current?.close();
  };

  const openPrimaryMuscleGroupSelection = () => {
    setPrimaryMuscleModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    primaryMuscleBottomSheetRef.current?.expand();
  };

  const openSecondaryMuscleGroupSelection = () => {
    setSecondaryMuscleModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    secondaryMuscleBottomSheetRef.current?.expand();
  };

  const openEquipmentSelection = () => {
    setEquipmentModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    equipmentBottomSheetRef.current?.expand();
  };

  const handleSaveCustomExercise = async () => {
    // Validation
    if (!exerciseName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }

    if (primaryMuscleGroup === 'None') {
      Alert.alert('Error', 'Please select at least a primary muscle group');
      return;
    }

    setSaving(true);

    try {
      // Build muscle groups array
      const muscleGroupsArray = [];
      if (primaryMuscleGroup !== 'None') {
        muscleGroupsArray.push(primaryMuscleGroup);
      }
      if (secondaryMuscleGroup !== 'None') {
        muscleGroupsArray.push(secondaryMuscleGroup);
      }

      // Build equipment array
      const equipmentArray = [];
      if (equipment !== 'None') {
        equipmentArray.push(equipment);
      }

      const customExercise = {
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: exerciseName.trim(),
        description: exerciseDescription.trim() || `Custom exercise targeting ${muscleGroupsArray.join(', ').toLowerCase()}`,
        primary_muscle_group: primaryMuscleGroup,
        secondary_muscle_groups: secondaryMuscleGroup !== 'None' ? [secondaryMuscleGroup] : [],
        muscle_groups: muscleGroupsArray,
        equipment_required: equipmentArray.length > 0 ? equipmentArray : ['Custom'],
        equipment: equipmentArray.length > 0 ? equipmentArray.join(', ') : 'Custom',
        difficulty_level: 'Custom',
        instructions: `Custom exercise: ${exerciseName.trim()}. Follow your planned routine.`,
        image_url: null,
        is_custom: true,
        created_at: new Date().toISOString(),
      };

      // Save to custom exercises storage
      const savedToCustom = await saveCustomExercise(customExercise);
      
      // Save to recent exercises storage
      const savedToRecent = await saveRecentExercise(customExercise);
      
      if (savedToCustom && savedToRecent) {
        // Navigate back to newWorkout with the custom exercise
        router.back(); // Close createCustomExercise modal
        router.back(); // Close exerciseSelection modal
        
        // Use setTimeout to ensure navigation completes before setting params
        setTimeout(() => {
          router.setParams({ 
            selectedExercise: JSON.stringify(customExercise)
          });
        }, 200);
      } else {
        Alert.alert('Error', 'Failed to save custom exercise. Please try again.');
      }
    } catch (error) {
      console.error('Error creating custom exercise:', error);
      Alert.alert('Error', 'Failed to create custom exercise. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = exerciseName.trim() && primaryMuscleGroup !== 'None';
  console.log(Platform.OS === 'android' && isInFullScreenModal);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[
          styles.header,
          Platform.OS === 'android' && isInFullScreenModal && styles.headerAndroidFullScreen
        ]}>
          <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.back()} style={styles.headerButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Custom Exercise</Text>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            onPress={handleSaveCustomExercise} 
            style={styles.headerButton}
            disabled={!isFormValid || saving}
          >
              <Text style={[
                styles.saveText,
                !isFormValid && styles.disabledText
              ]}>
                Save
              </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Exercise Name */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exercise Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter exercise name"
              placeholderTextColor={colors.secondaryText}
              value={exerciseName}
              onChangeText={setExerciseName}
              maxLength={100}
              editable={!saving}
            />
            <Text style={styles.helperText}>
              Choose a descriptive name for your exercise
            </Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Describe this exercise (optional)"
              placeholderTextColor={colors.secondaryText}
              value={exerciseDescription}
              onChangeText={setExerciseDescription}
              maxLength={300}
              editable={!saving}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.helperText}>
              Optional: Add a brief description of the exercise
            </Text>
          </View>

          {/* Muscle Groups */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Muscle Groups *</Text>
            <View style={styles.dualSelectorContainer}>
              <View style={styles.selectorHalf}>
                <Text style={styles.subSectionTitle}>Primary</Text>
                <TouchableOpacity
                activeOpacity={0.5} 
                  style={styles.selectionButton}
                  onPress={openPrimaryMuscleGroupSelection}
                  disabled={saving}
                >
                  <Text style={styles.selectionButtonText}>
                    {primaryMuscleGroup}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.selectorHalf}>
                <Text style={styles.subSectionTitle}>Secondary</Text>
                <TouchableOpacity
                activeOpacity={0.5} 
                  style={styles.selectionButton}
                  onPress={openSecondaryMuscleGroupSelection}
                  disabled={saving}
                >
                  <Text style={styles.selectionButtonText}>
                    {secondaryMuscleGroup}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.helperText}>
              Select the primary muscle group (required) and secondary muscle group (optional)
            </Text>
          </View>

          {/* Equipment */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Equipment</Text>
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.selectionButton}
              onPress={openEquipmentSelection}
              disabled={saving}
            >
              <Text style={styles.selectionButtonText}>
                {equipment}
              </Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>
              Optional: Select equipment needed for this exercise
            </Text>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Primary Muscle Group Bottom Sheet */}
        {primaryMuscleModalVisible && (
          <BottomSheet
            ref={primaryMuscleBottomSheetRef}
            index={0}
            snapPoints={selectionSnapPoints}
            onChange={handlePrimaryMuscleSheetChanges}
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.bottomSheetIndicator}
          >
            <View style={styles.bottomSheetContent}>
              <View style={styles.bottomSheetHeader}>
                <Text style={styles.bottomSheetTitle}>Primary Muscle Group</Text>
                <Text style={styles.bottomSheetSubtitle}>Select the primary muscle group for this exercise</Text>
              </View>
              <BottomSheetFlatList
                data={muscleGroups}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                activeOpacity={0.5}
                    style={[
                      styles.bottomSheetItem,
                      primaryMuscleGroup === item && styles.selectedBottomSheetItem
                    ]}
                    onPress={() => handlePrimaryMuscleGroupSelect(item)}
                  >
                    <Text style={[
                      styles.bottomSheetItemText,
                      primaryMuscleGroup === item && styles.selectedBottomSheetItemText
                    ]}>
                      {item}
                    </Text>
                    {primaryMuscleGroup === item && (
                      <Ionicons name="checkmark" size={20} color={colors.brand} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </BottomSheet>
        )}

        {/* Secondary Muscle Group Bottom Sheet */}
        {secondaryMuscleModalVisible && (
          <BottomSheet
            ref={secondaryMuscleBottomSheetRef}
            index={0}
            snapPoints={selectionSnapPoints}
            onChange={handleSecondaryMuscleSheetChanges}
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.bottomSheetIndicator}
          >
            <View style={styles.bottomSheetContent}>
              <View style={styles.bottomSheetHeader}>
                <Text style={styles.bottomSheetTitle}>Secondary Muscle Group</Text>
                <Text style={styles.bottomSheetSubtitle}>Select a secondary muscle group (optional)</Text>
              </View>
              <BottomSheetFlatList
                data={muscleGroups}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                activeOpacity={0.5}
                    style={[
                      styles.bottomSheetItem,
                      secondaryMuscleGroup === item && styles.selectedBottomSheetItem
                    ]}
                    onPress={() => handleSecondaryMuscleGroupSelect(item)}
                  >
                    <Text style={[
                      styles.bottomSheetItemText,
                      secondaryMuscleGroup === item && styles.selectedBottomSheetItemText
                    ]}>
                      {item}
                    </Text>
                    {secondaryMuscleGroup === item && (
                      <Ionicons name="checkmark" size={20} color={colors.brand} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </BottomSheet>
        )}

        {/* Equipment Bottom Sheet */}
        {equipmentModalVisible && (
          <BottomSheet
            ref={equipmentBottomSheetRef}
            index={0}
            snapPoints={selectionSnapPoints}
            onChange={handlePrimaryEquipmentSheetChanges}
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.bottomSheetIndicator}
          >
            <View style={styles.bottomSheetContent}>
              <View style={styles.bottomSheetHeader}>
                <Text style={styles.bottomSheetTitle}>Equipment</Text>
                <Text style={styles.bottomSheetSubtitle}>Select the equipment needed for this exercise</Text>
              </View>
              <BottomSheetFlatList
                data={equipmentOptions}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                activeOpacity={0.5}
                    style={[
                      styles.bottomSheetItem,
                      equipment === item && styles.selectedBottomSheetItem
                    ]}
                    onPress={() => handlePrimaryEquipmentSelect(item)}
                  >
                    <Text style={[
                      styles.bottomSheetItemText,
                      equipment === item && styles.selectedBottomSheetItemText
                    ]}>
                      {item}
                    </Text>
                    {equipment === item && (
                      <Ionicons name="checkmark" size={20} color={colors.brand} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </BottomSheet>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    paddingVertical: 10,
    paddingTop: 16,
    paddingHorizontal: 12,
  },

  headerAndroidFullScreen: {
    paddingTop: 52, // Extra padding for Android when in fullscreen modal
  },

headerButton: {
  padding: 8,
  minWidth: 60,
  alignItems: 'center',
},

headerTitle: {
  fontSize: 16, // Reduced from 18 to match workoutSettings
  fontWeight: '600', // Changed from 'bold' to match workoutSettings
  color: colors.primaryText,
  flex: 1,
  textAlign: 'center',
},

cancelText: {
  fontSize: 16,
  color: colors.brand,
  fontWeight: '400',
},

saveText: {
  fontSize: 16,
  color: colors.brand,
  fontWeight: '600',
},

disabledText: {
  color: colors.secondaryText,
  opacity: 0.5,
},
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.secondaryText,
    marginBottom: 8,
  },
  dualSelectorContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  selectorHalf: {
    flex: 1,
  },
  textInput: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.primaryText,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
  },
  selectionButtonText: {
    fontSize: 16,
    color: colors.primaryText,
    textAlign: 'center',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 8,
    opacity: 0.8,
  },
  // Bottom Sheet Styles
  bottomSheetBackground: {
    backgroundColor: colors.primaryAccent,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  bottomSheetIndicator: {
    backgroundColor: colors.secondaryText,
    width: 40,
  },
  bottomSheetContent: {
    flex: 1,
    padding: 10,
  },
  bottomSheetHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    opacity: 0.8,
  },
  bottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 8,
    backgroundColor: colors.whiteOverlayLight,
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
  bottomPadding: {
    height: 40,
  },
});