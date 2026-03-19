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
  Image,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../constants/colors';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useBannerStore, BANNER_MESSAGES } from '../../../stores/bannerStore';
import { useSubscriptionStore } from '../../../stores/subscriptionStore';
import { FREE_TIER_LIMITS } from '../../../constants/subscription';

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
  const { isPro } = useSubscriptionStore();
  const [primaryMuscleModalVisible, setPrimaryMuscleModalVisible] = useState(false);
  const [secondaryMuscleModalVisible, setSecondaryMuscleModalVisible] = useState(false);
  const [equipmentModalVisible, setEquipmentModalVisible] = useState(false);
  const [failedImages, setFailedImages] = useState(new Set()); // Track failed image loads
  
  // Bottom Sheet refs
  const primaryMuscleBottomSheetRef = useRef(null);
  const secondaryMuscleBottomSheetRef = useRef(null);
  const equipmentBottomSheetRef = useRef(null);

  // Helper function to get fallback icon for muscle groups
  const getMuscleGroupFallbackIcon = (muscleGroupValue) => {
    const iconMap = {
      'None': 'close-outline',
      'Abdominals': 'body-outline',
      'Abductors': 'body-outline',
      'Adductors': 'body-outline',
      'Biceps': 'fitness-outline',
      'Calves': 'body-outline',
      'Chest': 'body-outline',
      'Forearms': 'fitness-outline',
      'Glutes': 'body-outline',
      'Hamstrings': 'body-outline',
      'Lats': 'body-outline',
      'Lower Back': 'body-outline',
      'Quadriceps': 'body-outline',
      'Shoulders': 'fitness-outline',
      'Traps': 'body-outline',
      'Triceps': 'fitness-outline',
      'Upper Back': 'body-outline',
    };
    return iconMap[muscleGroupValue] || 'body-outline';
  };

  // Helper function to get fallback icon for equipment
  const getEquipmentFallbackIcon = (equipmentValue) => {
    const iconMap = {
      'None': 'close-outline',
      'Barbell': 'barbell-outline',
      'Dumbbell': 'fitness-outline',
      'Kettlebell': 'fitness-outline',
      'Machine': 'hardware-chip-outline',
      'Bench': 'bed-outline',
      'Plate': 'disc-outline',
      'Bands': 'git-branch-outline',
      'Other': 'ellipsis-horizontal-outline',
    };
    return iconMap[equipmentValue] || 'fitness-outline';
  };

  // Get filtered secondary muscle groups (exclude primary selection)
  const getSecondaryMuscleGroups = () => {
    return muscleGroups.filter(muscle => muscle.value !== primaryMuscleGroup);
  };

  // Bottom Sheet snap points
  const selectionSnapPoints = useMemo(() => [600], []);

  const muscleGroups = [
    { 
      label: "None", 
      value: "None",
      imageUrl: null, // Use icon for "None" option
      iconName: "close-outline" as const
    },
    { 
      label: "Abdominals", 
      value: "Abdominals",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/abs_0.jpg"
    },
    { 
      label: "Abductors", 
      value: "Abductors",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/abductors.jpg"
    },
    { 
      label: "Adductors", 
      value: "Adductors",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/adductors.jpg"
    },
    { 
      label: "Biceps", 
      value: "Biceps",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/biceps_0.jpg"
    },
    { 
      label: "Calves", 
      value: "Calves",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/calves_0.jpg"
    },
    { 
      label: "Chest", 
      value: "Chest",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/chest_0.jpg"
    },
    { 
      label: "Forearms", 
      value: "Forearms",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/forearms_0.jpg"
    },
    { 
      label: "Glutes", 
      value: "Glutes",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/glutes_0.jpg"
    },
    { 
      label: "Hamstrings", 
      value: "Hamstrings",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/hamstrings_0.jpg"
    },
    { 
      label: "Lats", 
      value: "Lats",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/lats_0.jpg"
    },
    { 
      label: "Lower Back", 
      value: "Lower Back",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/lowerback.jpg"
    },
    { 
      label: "Quadriceps", 
      value: "Quadriceps",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/quads_1.jpg"
    },
    { 
      label: "Shoulders", 
      value: "Shoulders",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/shoulders_0.jpg"
    },
    { 
      label: "Traps", 
      value: "Traps",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/traps_0.jpg"
    },
    { 
      label: "Triceps", 
      value: "Triceps",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/triceps_0.jpg"
    },
    { 
      label: "Upper Back", 
      value: "Upper Back",
      imageUrl: "https://cdn.muscleandstrength.com/sites/default/files/taxonomy/image/videos/upperback.jpg"
    },
  ];

  const equipmentOptions = [
    { 
      label: "None", 
      value: "None",
      iconName: "close-outline" as const,
      imageUrl: null // Use icon for "None" option
    },
    { 
      label: "Barbell", 
      value: "Barbell",
      iconName: "barbell-outline" as const,
      imageUrl: "https://cdn-icons-png.flaticon.com/512/110/110495.png"
    },
    { 
      label: "Dumbbell", 
      value: "Dumbbell",
      iconName: "fitness-outline" as const,
      imageUrl: "https://cdn-icons-png.flaticon.com/512/10788/10788186.png"
    },
    { 
      label: "Kettlebell", 
      value: "Kettlebell",
      iconName: "fitness-outline" as const,
      imageUrl: "https://cdn-icons-png.flaticon.com/512/2309/2309904.png"
    },
    { 
      label: "Machine", 
      value: "Machine",
      iconName: "hardware-chip-outline" as const,
      imageUrl: "https://cdn-icons-png.flaticon.com/512/8023/8023313.png"
    },
    { 
      label: "Bench", 
      value: "Bench",
      iconName: "bed-outline" as const,
      imageUrl: "https://cdn-icons-png.flaticon.com/512/113/113750.png"
    },
    { 
      label: "Plate", 
      value: "Plate",
      iconName: "disc-outline" as const,
      imageUrl: "https://cdn-icons-png.flaticon.com/512/2324/2324717.png"
    },
    { 
      label: "Bands", 
      value: "Bands",
      iconName: "git-branch-outline" as const,
      imageUrl: "https://cdn-icons-png.flaticon.com/512/18868/18868921.png"
    },
    { 
      label: "Other", 
      value: "Other",
      iconName: "ellipsis-horizontal-outline" as const,
    },
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
    setPrimaryMuscleGroup(muscle.value);
    // Reset secondary if it's the same as the new primary
    if (secondaryMuscleGroup === muscle.value) {
      setSecondaryMuscleGroup('None');
    }
    primaryMuscleBottomSheetRef.current?.close();
  };

  const handleSecondaryMuscleGroupSelect = (muscle) => {
    setSecondaryMuscleGroup(muscle.value);
    secondaryMuscleBottomSheetRef.current?.close();
  };

  const handleEquipmentSelect = (equipmentItem) => {
    setEquipment(equipmentItem.value);
    equipmentBottomSheetRef.current?.close();
  };

  const openPrimaryMuscleGroupSelection = () => {
    Keyboard.dismiss(); // Dismiss keyboard when opening bottom sheet
    setPrimaryMuscleModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    primaryMuscleBottomSheetRef.current?.snapToIndex(0);
  };

  const openSecondaryMuscleGroupSelection = () => {
    Keyboard.dismiss(); // Dismiss keyboard when opening bottom sheet
    setSecondaryMuscleModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    secondaryMuscleBottomSheetRef.current?.snapToIndex(0);
  };

  const openEquipmentSelection = () => {
    Keyboard.dismiss(); // Dismiss keyboard when opening bottom sheet
    setEquipmentModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    equipmentBottomSheetRef.current?.snapToIndex(0);
  };

  const handleSaveCustomExercise = async () => {
    // Validation
    if (!exerciseName.trim()) {
      const { showError } = useBannerStore.getState();
      showError('Please enter an exercise name');
      return;
    }

    // No muscle group validation needed since both are optional now

    // Check free tier custom exercise limit
    if (!isPro()) {
      const stored = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
      const existing = stored ? JSON.parse(stored) : [];
      if (existing.length >= FREE_TIER_LIMITS.maxCustomExercises) {
        Alert.alert(
          'Upgrade to Pro',
          'Unlock unlimited custom exercises with Atlas Pro',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Upgrade', onPress: () => router.push('/(app)/(modals)/pro') },
          ]
        );
        return;
      }
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
        // Show success banner
        const { showSuccess } = useBannerStore.getState();
        showSuccess(`Custom exercise "${exerciseName.trim()}" created successfully!`);
        
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
        const { showError } = useBannerStore.getState();
        showError('Failed to save custom exercise. Please try again.');
      }
    } catch (error) {
      console.error('Error creating custom exercise:', error);
      const { showError } = useBannerStore.getState();
      showError('Failed to create custom exercise. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = exerciseName.trim(); // Only exercise name is required now

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

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
              placeholder="Describe this exercise"
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
            <Text style={styles.sectionTitle}>Muscle Groups</Text>
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
                    {muscleGroups.find(mg => mg.value === primaryMuscleGroup)?.label || 'None'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.selectorHalf}>
                <Text style={styles.subSectionTitle}>Secondary</Text>
                <TouchableOpacity
                activeOpacity={0.5} 
                  style={[
                    styles.selectionButton,
                    primaryMuscleGroup === 'None' && styles.disabledSelectionButton
                  ]}
                  onPress={openSecondaryMuscleGroupSelection}
                  disabled={saving || primaryMuscleGroup === 'None'}
                >
                  <Text style={[
                    styles.selectionButtonText,
                    primaryMuscleGroup === 'None' && styles.disabledSelectionButtonText
                  ]}>
                    {primaryMuscleGroup === 'None' 
                      ? 'None' 
                      : muscleGroups.find(mg => mg.value === secondaryMuscleGroup)?.label || 'None'
                    }
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.helperText}>
              Select the primary muscle group and secondary muscle group (both optional)
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
                {equipmentOptions.find(eq => eq.value === equipment)?.label || 'None'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>
              Optional: Select equipment needed for this exercise
            </Text>
          </View>

            <View style={styles.bottomPadding} />
          </ScrollView>
        </TouchableWithoutFeedback>

        {/* Primary Muscle Group Bottom Sheet */}
        {primaryMuscleModalVisible && (
          <BottomSheet
            ref={primaryMuscleBottomSheetRef}
            index={0}
            snapPoints={selectionSnapPoints}
            onChange={handlePrimaryMuscleSheetChanges}
            enablePanDownToClose={true}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.bottomSheetIndicator}
            backdropComponent={renderBackdrop}
            maxDynamicContentSize={600}
          >
            <BottomSheetView style={styles.bottomSheetContent}>
              <View style={styles.bottomSheetHeader}>
                <Text style={styles.bottomSheetTitle}>Primary Muscle Group</Text>
                <Text style={styles.bottomSheetSubtitle}>Select the primary muscle group for this exercise</Text>
              </View>
              
              <View style={styles.bottomSheetScrollViewContainer}>
                <ScrollView
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={styles.bottomSheetList}
                  style={styles.bottomSheetScrollView}
                >
                  {muscleGroups.map((item, index) => (
                    <View key={item.value}>
                      <TouchableOpacity
                        activeOpacity={0.5}
                        style={styles.bottomSheetItem}
                        onPress={() => handlePrimaryMuscleGroupSelect(item)}
                      >
                        <View style={styles.bottomSheetItemIcon}>
                          {item.imageUrl && !failedImages.has(item.value) ? (
                            <Image 
                              source={{ uri: item.imageUrl }}
                              resizeMode="contain"
                              style={styles.bottomSheetItemImage}
                              onError={() => {
                                setFailedImages(prev => new Set(prev).add(item.value));
                              }}
                            />
                          ) : (
                            <Ionicons 
                              name={item.iconName || getMuscleGroupFallbackIcon(item.value)}
                              size={24} 
                              color={colors.background} 
                            />
                          )}
                        </View>
                        <Text style={[
                          styles.bottomSheetItemText,
                          primaryMuscleGroup === item.value && styles.selectedBottomSheetItemText
                        ]}>
                          {item.label}
                        </Text>
                        {primaryMuscleGroup === item.value && (
                          <Ionicons name="checkmark" size={20} color={colors.brand} />
                        )}
                      </TouchableOpacity>
                      {index < muscleGroups.length - 1 && <View style={styles.bottomSheetDivider} />}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </BottomSheetView>
          </BottomSheet>
        )}

        {/* Secondary Muscle Group Bottom Sheet */}
        {secondaryMuscleModalVisible && (
          <BottomSheet
            ref={secondaryMuscleBottomSheetRef}
            index={0}
            snapPoints={selectionSnapPoints}
            onChange={handleSecondaryMuscleSheetChanges}
            enablePanDownToClose={true}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.bottomSheetIndicator}
            backdropComponent={renderBackdrop}
            maxDynamicContentSize={600}
          >
            <BottomSheetView style={styles.bottomSheetContent}>
              <View style={styles.bottomSheetHeader}>
                <Text style={styles.bottomSheetTitle}>Secondary Muscle Group</Text>
                <Text style={styles.bottomSheetSubtitle}>Select a secondary muscle group (optional)</Text>
              </View>
              
              <View style={styles.bottomSheetScrollViewContainer}>
                <ScrollView
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={styles.bottomSheetList}
                  style={styles.bottomSheetScrollView}
                >
                  {getSecondaryMuscleGroups().map((item, index) => (
                    <View key={item.value}>
                      <TouchableOpacity
                        activeOpacity={0.5}
                        style={styles.bottomSheetItem}
                        onPress={() => handleSecondaryMuscleGroupSelect(item)}
                      >
                        <View style={styles.bottomSheetItemIcon}>
                          {item.imageUrl && !failedImages.has(item.value) ? (
                            <Image 
                              source={{ uri: item.imageUrl }}
                              resizeMode="contain"
                              style={styles.bottomSheetItemImage}
                              onError={() => {
                                setFailedImages(prev => new Set(prev).add(item.value));
                              }}
                            />
                          ) : (
                            <Ionicons 
                              name={item.iconName || getMuscleGroupFallbackIcon(item.value)}
                              size={24} 
                              color={colors.background} 
                            />
                          )}
                        </View>
                        <Text style={[
                          styles.bottomSheetItemText,
                          secondaryMuscleGroup === item.value && styles.selectedBottomSheetItemText
                        ]}>
                          {item.label}
                        </Text>
                        {secondaryMuscleGroup === item.value && (
                          <Ionicons name="checkmark" size={20} color={colors.brand} />
                        )}
                      </TouchableOpacity>
                      {index < getSecondaryMuscleGroups().length - 1 && <View style={styles.bottomSheetDivider} />}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </BottomSheetView>
          </BottomSheet>
        )}

        {/* Equipment Bottom Sheet */}
        {equipmentModalVisible && (
          <BottomSheet
            ref={equipmentBottomSheetRef}
            index={0}
            snapPoints={selectionSnapPoints}
            onChange={handlePrimaryEquipmentSheetChanges}
            enablePanDownToClose={true}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.bottomSheetIndicator}
            backdropComponent={renderBackdrop}
            maxDynamicContentSize={600}
          >
            <BottomSheetView style={styles.bottomSheetContent}>
              <View style={styles.bottomSheetHeader}>
                <Text style={styles.bottomSheetTitle}>Equipment</Text>
                <Text style={styles.bottomSheetSubtitle}>Select the equipment needed for this exercise</Text>
              </View>
              
              <View style={styles.bottomSheetScrollViewContainer}>
                <ScrollView
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={styles.bottomSheetList}
                  style={styles.bottomSheetScrollView}
                >
                  {equipmentOptions.map((item, index) => (
                    <View key={item.value}>
                      <TouchableOpacity
                        activeOpacity={0.5}
                        style={styles.bottomSheetItem}
                        onPress={() => handleEquipmentSelect(item)}
                      >
                        <View style={styles.bottomSheetItemIcon}>
                          {item.imageUrl && !failedImages.has(item.value) ? (
                            <Image 
                              source={{ uri: item.imageUrl }}
                              resizeMode="contain"
                              style={styles.bottomSheetEquipmentImage}
                              onError={() => {
                                setFailedImages(prev => new Set(prev).add(item.value));
                              }}
                            />
                          ) : (
                            <Ionicons 
                              name={item.iconName || getEquipmentFallbackIcon(item.value)}
                              size={24} 
                              color={colors.background} 
                            />
                          )}
                        </View>
                        <Text style={[
                          styles.bottomSheetItemText,
                          equipment === item.value && styles.selectedBottomSheetItemText
                        ]}>
                          {item.label}
                        </Text>
                        {equipment === item.value && (
                          <Ionicons name="checkmark" size={20} color={colors.brand} />
                        )}
                      </TouchableOpacity>
                      {index < equipmentOptions.length - 1 && <View style={styles.bottomSheetDivider} />}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </BottomSheetView>
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
  fontWeight: '500', // Changed from 'bold' to match workoutSettings
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
  bottomSheetList: {
    backgroundColor: colors.secondaryAccent,
  },
  bottomSheetScrollViewContainer: {
    maxHeight: '100%',
    minHeight: 580,
    paddingBottom: 140,
  },
  bottomSheetScrollView: {
    borderRadius: 12,
  },

  bottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bottomSheetItemIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#d4d4d4', // Match background color of currently used images
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  bottomSheetItemImage: {
    width: '100%',
    height: '100%',
  },
  bottomSheetEquipmentImage: {
    width: '70%',
    height: '70%',
  },
  bottomSheetDivider: {
    height: 1,
    backgroundColor: colors.whiteOverlay,
    marginHorizontal: 16,
  },
  bottomSheetItemText: {
    fontSize: 16,
    color: colors.primaryText,
    fontWeight: '400',
    flex: 1,
  },
  selectedBottomSheetItemText: {
    color: colors.brand,
    fontWeight: '600',
  },
  disabledSelectionButton: {
    opacity: 0.5,
  },
  disabledSelectionButtonText: {
    color: colors.secondaryText,
  },
  bottomPadding: {
    height: 40,
  },
});