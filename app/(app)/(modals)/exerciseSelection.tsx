import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  Animated,
  SectionList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../constants/colors';
import { supabase } from '../../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView, FlatList, ScrollView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetFlatList } from '@gorhom/bottom-sheet';

export default function ExerciseSelection() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [exercises, setExercises] = useState([]);
  const [customExercises, setCustomExercises] = useState([]);
  const [recentExercises, setRecentExercises] = useState([]);
  const [sectionsData, setSectionsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState("All");
  const [selectedEquipment, setSelectedEquipment] = useState("All");
  const [selectedExercises, setSelectedExercises] = useState(new Set());
  const [selectedExercisesOrder, setSelectedExercisesOrder] = useState([]); // Track selection order
  const [animatedValues] = useState(new Map());
  const [muscleGroupModalVisible, setMuscleGroupModalVisible] = useState(false);
  const [equipmentModalVisible, setEquipmentModalVisible] = useState(false);
  const [failedImages, setFailedImages] = useState(new Set()); // Track failed image loads
  
  // Bottom Sheet refs
  const muscleGroupBottomSheetRef = useRef(null);
  const equipmentBottomSheetRef = useRef(null);
  
  // SectionList ref for auto-scrolling
  const sectionListRef = useRef(null);
  const searchInputRef = useRef(null);

  // Bottom Sheet snap points
  const selectionSnapPoints = useMemo(() => [600], []);

  const CUSTOM_EXERCISES_KEY = 'custom_exercises';
  const RECENT_EXERCISES_KEY = 'recent_exercises';

  const muscleGroups = [
    { 
      label: "All Muscles", 
      value: "All",
      imageUrl: null, // Use icon for "All" option
      iconName: "grid-outline" as const
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

  const equipment = [
    { 
      label: "All Equipment", 
      value: "All",
      iconName: "grid-outline" as const,
      imageUrl: null // Use icon for "All" option
    },
    { 
      label: "None", 
      value: "None",
      iconName: "body-outline" as const,
      imageUrl: "https://placeholder-equipment.com/bodyweight.jpg"
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

  // Helper function to get fallback icon for muscle groups
  const getMuscleGroupFallbackIcon = (muscleGroupValue) => {
    const iconMap = {
      'All': 'grid-outline',
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
      'All': 'grid-outline',
      'None': 'body-outline',
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
  const handleMuscleGroupSheetChanges = useCallback((index) => {
    if (index === -1) {
      setMuscleGroupModalVisible(false);
    }
  }, []);

  const handleEquipmentSheetChanges = useCallback((index) => {
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
          if (muscleGroupModalVisible) {
            muscleGroupBottomSheetRef.current?.close();
          }
          if (equipmentModalVisible) {
            equipmentBottomSheetRef.current?.close();
          }
        }}
      />
    ),
    [muscleGroupModalVisible, equipmentModalVisible]
  );

  // ...existing useEffect and other functions remain the same...

  useEffect(() => {
    loadExercises();
  }, []);

  useEffect(() => {
    filterAndOrganizeExercises();
  }, [searchQuery, selectedMuscleGroup, selectedEquipment, exercises, customExercises, recentExercises]);

  // Keyboard event listeners for auto-scroll
  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', (event) => {
      // Small delay to ensure the keyboard is fully shown
      setTimeout(() => {
        if (searchInputRef.current) {
          sectionListRef.current?.scrollToLocation({
            sectionIndex: 0,
            itemIndex: 0,
            animated: true,
            viewPosition: 0.2, // Show search input near top with some padding
          });
        }
      }, 100);
    });

    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      // Keyboard hidden - no action needed
    });

    return () => {
      showListener?.remove();
      hideListener?.remove();
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const reloadCustomExercises = async () => {
        const customExs = await loadCustomExercises();
        setCustomExercises(customExs);
      };

      const reloadRecentExercises = async () => {
        const recentExs = await loadRecentExercises();
        setRecentExercises(recentExs);
      };
      
      reloadCustomExercises();
      reloadRecentExercises();
    }, [])
  );

  // ...existing functions remain the same (loadCustomExercises, loadRecentExercises, etc.)...

  const loadCustomExercises = async () => {
    try {
      const customExercises = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
      return customExercises ? JSON.parse(customExercises) : [];
    } catch (error) {
      console.error('Error loading custom exercises:', error);
      return [];
    }
  };

  const loadRecentExercises = async () => {
    try {
      const recentExercises = await AsyncStorage.getItem(RECENT_EXERCISES_KEY);
      return recentExercises ? JSON.parse(recentExercises) : [];
    } catch (error) {
      console.error('Error loading recent exercises:', error);
      return [];
    }
  };

  const saveRecentExercise = async (exercise) => {
    try {
      const existing = await loadRecentExercises();
      const filtered = existing.filter(ex => ex.id !== exercise.id);
      const updated = [exercise, ...filtered].slice(0, 5);
      await AsyncStorage.setItem(RECENT_EXERCISES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving recent exercise:', error);
    }
  };

  const loadExercises = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name');

      if (error) throw error;
      
      const [customExs, recentExs] = await Promise.all([
        loadCustomExercises(),
        loadRecentExercises()
      ]);
      
      setExercises(data || []);
      setCustomExercises(customExs);
      setRecentExercises(recentExs);
    } catch (err) {
      console.error('Error loading exercises:', err);
      setError('Failed to load exercises');
    } finally {
      setLoading(false);
    }
  };

  const filterExercises = (exerciseList) => {
    let filtered = exerciseList;

    if (selectedMuscleGroup && selectedMuscleGroup !== "All") {
      // Separate exercises into primary and secondary matches
      const primaryMatches = [];
      const secondaryMatches = [];
      
      exerciseList.forEach(exercise => {
        // Check if it's primary muscle group
        if (exercise.primary_muscle_group === selectedMuscleGroup) {
          primaryMatches.push(exercise);
        }
        // Check if it's in secondary muscle groups (but not primary)
        else if (
          (exercise.secondary_muscle_groups && 
           exercise.secondary_muscle_groups.includes(selectedMuscleGroup)) ||
          (exercise.muscle_groups &&
           exercise.muscle_groups.includes(selectedMuscleGroup))
        ) {
          secondaryMatches.push(exercise);
        }
      });
      
      // Combine with primary matches first, then secondary matches
      filtered = [...primaryMatches, ...secondaryMatches];
    }

    if (selectedEquipment && selectedEquipment !== "All") {
      filtered = filtered.filter(exercise => {
        if (selectedEquipment === "Custom" && exercise.is_custom) {
          return true;
        }

        let exerciseEquipment = exercise.equipment_required || exercise.equipment;
        
        if (Array.isArray(exerciseEquipment)) {
          if (exerciseEquipment.length === 0 || exerciseEquipment.includes("None")) {
            return selectedEquipment === "Bodyweight";
          }
          return exerciseEquipment.some(equip => 
            equip.toLowerCase().includes(selectedEquipment.toLowerCase())
          );
        } else if (typeof exerciseEquipment === 'string') {
          if (!exerciseEquipment || exerciseEquipment.toLowerCase() === 'none') {
            return selectedEquipment === "Bodyweight";
          }
          return exerciseEquipment.toLowerCase().includes(selectedEquipment.toLowerCase());
        } else {
          return selectedEquipment === "Bodyweight";
        }
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const startsWithMatches = [];
      const containsMatches = [];
      const primaryMuscleMatches = [];
      const secondaryMuscleMatches = [];
      
      // Separate exercises into different priority groups
      filtered.forEach(exercise => {
        const exerciseName = exercise.name ? exercise.name.toLowerCase() : '';
        
        // Check name matches first (highest priority)
        if (exerciseName.startsWith(query)) {
          // Exercise name starts with search query (highest priority)
          startsWithMatches.push(exercise);
        } else if (exerciseName.includes(query)) {
          // Exercise name contains search query but doesn't start with it
          containsMatches.push(exercise);
        } else {
          // Check muscle groups only if name doesn't match
          const primaryMatch = exercise.primary_muscle_group && exercise.primary_muscle_group.toLowerCase().includes(query);
          const secondaryMatch = Array.isArray(exercise.secondary_muscle_groups) && exercise.secondary_muscle_groups.some(mg => mg.toLowerCase().includes(query));
          const customMatch = Array.isArray(exercise.muscle_groups) && exercise.muscle_groups.some(mg => mg.toLowerCase().includes(query));
          
          if (primaryMatch || customMatch) {
            // Primary muscle group or custom muscle groups (higher priority)
            primaryMuscleMatches.push(exercise);
          } else if (secondaryMatch) {
            // Secondary muscle groups (lower priority)
            // secondaryMuscleMatches.push(exercise); Don't show secondary matches if primary matches exist
          }
        }
      });
      
      // Combine with name matches first (starts with, then contains), then muscle group matches
      filtered = [...startsWithMatches, ...containsMatches, ...primaryMuscleMatches, ...secondaryMuscleMatches];
    }

    return filtered;
  };

  const filterAndOrganizeExercises = () => {
    const sections = [];

    if (searchQuery || (selectedMuscleGroup && selectedMuscleGroup !== "All") || (selectedEquipment && selectedEquipment !== "All")) {
      const allExercises = [...exercises, ...customExercises];
      const filtered = filterExercises(allExercises);
      
      // Only add section if we have results or if it's not a search query
      if (filtered.length > 0 || !searchQuery) {
        let title = 'Filtered Results';
        if (searchQuery) {
          title = 'Search Results';
        } else {
          title = 'All Exercises';
        }
        
        sections.push({
          title: title,
          data: filtered,
          key: 'filtered'
        });
      }
    } else {
      if (recentExercises.length > 0) {
        sections.push({
          title: 'Recent Exercises',
          data: recentExercises,
          key: 'recent'
        });
      }

      if (customExercises.length > 0) {
        sections.push({
          title: 'Custom Exercises',
          data: customExercises,
          key: 'custom'
        });
      }

      sections.push({
        title: 'All Exercises',
        data: exercises,
        key: 'all'
      });
    }

    setSectionsData(sections);
  };

  // Updated selection handlers
  const handleMuscleGroupSelect = (muscleGroup) => {
    setSelectedMuscleGroup(muscleGroup.value);
    muscleGroupBottomSheetRef.current?.close();
  };

  const handleEquipmentSelect = (equipmentItem) => {
    setSelectedEquipment(equipmentItem.value);
    equipmentBottomSheetRef.current?.close();
  };

  const openMuscleGroupSelection = () => {
    Keyboard.dismiss(); // Dismiss keyboard when opening bottom sheet
    setMuscleGroupModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    muscleGroupBottomSheetRef.current?.snapToIndex(0);
  };

  const openEquipmentSelection = () => {
    Keyboard.dismiss(); // Dismiss keyboard when opening bottom sheet
    setEquipmentModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    equipmentBottomSheetRef.current?.snapToIndex(0);
  };

  // Check if any filters are applied
  const hasFiltersApplied = () => {
    return selectedMuscleGroup !== "All" || selectedEquipment !== "All";
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedMuscleGroup("All");
    setSelectedEquipment("All");
  };

  // ...existing functions remain the same (getAnimatedValue, handleSelectExercise, etc.)...

  const getAnimatedValue = (exerciseId) => {
    if (!animatedValues.has(exerciseId)) {
      animatedValues.set(exerciseId, new Animated.Value(0));
    }
    return animatedValues.get(exerciseId);
  };

  const handleSelectExercise = async (exercise) => {
    const newSelected = new Set(selectedExercises);
    const newOrder = [...selectedExercisesOrder];
    const animatedValue = getAnimatedValue(exercise.id);
    
    if (selectedExercises.has(exercise.id)) {
      // Remove from selection
      newSelected.delete(exercise.id);
      const orderIndex = newOrder.findIndex(ex => ex.id === exercise.id);
      if (orderIndex !== -1) {
        newOrder.splice(orderIndex, 1);
      }
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      // Add to selection in order
      newSelected.add(exercise.id);
      newOrder.push(exercise);
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
    
    setSelectedExercises(newSelected);
    setSelectedExercisesOrder(newOrder);
  };

  const handleAddSelectedExercises = async () => {
    // Use the ordered array to maintain selection order
    const exercisesToAdd = selectedExercisesOrder;
    
    for (const exercise of exercisesToAdd) {
      await saveRecentExercise(exercise);
    }
    
    // Check if we came from routine editing
    if (params?.fromRoutineEdit && params?.routineId) {
      // Can't use router.back() followed by setting params, so go back and then navigate directly
      router.back();
      router.navigate({
        pathname: `/(app)/(modals)/editRoutine/${params.routineId}`,
        params: { 
          selectedExercises: JSON.stringify(exercisesToAdd),
          isMultiple: 'true',
          fromRoutineEdit: 'true',
        }
      });
    } else {
      // Can't use router.back() followed by setting params, so go back and then navigate directly
      router.back();
      router.navigate({
        pathname: '/(app)/(modals)/newWorkout',
        params: {
          selectedExercises: JSON.stringify(exercisesToAdd),
          isMultiple: 'true',
        }
      })
    }
  };

  const handleViewExerciseDetails = (exercise) => {
    router.push({
      pathname: '/(app)/(modals)/exerciseDetails',
      params: { 
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        fromSelection: 'true'
      }
    });
  };

  const getCurrentMuscleGroupLabel = () => {
    const muscleGroup = muscleGroups.find(mg => mg.value === selectedMuscleGroup);
    return muscleGroup ? muscleGroup.label : "All Muscles";
  };

  const getCurrentEquipmentLabel = () => {
    const equipmentItem = equipment.find(eq => eq.value === selectedEquipment);
    return equipmentItem ? equipmentItem.label : "All Equipment";
  };

  const renderExerciseItem = ({ item, section }) => {
    const isSelected = selectedExercises.has(item.id);
    const animatedValue = getAnimatedValue(item.id);
    
    const slideInterpolation = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 4],
    });

    const ribbonOpacity = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    const getMuscleGroupsText = (exercise) => {
      if (exercise.is_custom && exercise.muscle_groups) {
        return exercise.muscle_groups.join(', ');
      } else {
        return exercise.primary_muscle_group;
      }
    };

    return (
      <Pressable
        style={styles.exerciseItemWrapper} onPress={() => handleSelectExercise(item)}>
        <Animated.View 
          style={[
            styles.selectionRibbon,
            { 
              opacity: ribbonOpacity,
              width: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 4],
              })
            }
          ]} 
        />
        
        <Animated.View 
          style={[
            styles.exerciseItemContent,
            { 
              transform: [{ translateX: slideInterpolation }],
            },
            isSelected ? styles.selectedExerciseBackground : styles.unselectedExerciseBackground
          ]}
        >
          <View style={styles.exerciseSelectableArea}>
            {item.image_url && !failedImages.has(item.id) ? (
              <Image 
                source={{ uri: item.image_url }}
                style={styles.exerciseImage}
                resizeMode="cover"
                onError={() => {
                  setFailedImages(prev => new Set(prev).add(item.id));
                }}
              />
            ) : (
              <View style={styles.exerciseImagePlaceholder}>
                <Ionicons 
                  name={
                    item.is_custom ? "construct-outline" : "barbell-outline"
                  } 
                  size={20} 
                  color={colors.secondaryText} 
                />
              </View>
            )}
            
            <View style={styles.exerciseInfo}>
              <View style={styles.exerciseNameRow}>
                <Text style={styles.exerciseItemName}>{item.name}</Text>
                {item.is_custom && (
                  <View style={styles.customBadge}>
                    <Text style={styles.customBadgeText}>Custom</Text>
                  </View>
                )}
              </View>
              <View style={styles.exerciseItemDetails}>
                <Text style={styles.exerciseItemGroup}>
                  {getMuscleGroupsText(item)}
                </Text>
              </View>
            </View>
          </View>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.infoButton}
            onPress={() => handleViewExerciseDetails(item)}
          >
            <Ionicons 
              name="information-circle-outline" 
              size={24} 
              color={colors.secondaryText} 
            />
          </TouchableOpacity>
        </Animated.View>
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }) => {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    );
  };

  // Dynamic content container style
  const contentContainerStyle = {
    paddingBottom: selectedExercises.size > 0 ? 100 : 20
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.header}>
  <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.back()} style={styles.headerButton}>
    <Text style={styles.cancelText}>Cancel</Text>
  </TouchableOpacity>
  
  <Text style={styles.headerTitle}>Add Exercise</Text>
  
  <TouchableOpacity
                activeOpacity={0.5} 
    onPress={() => {
      router.push({
        pathname: '/(app)/(modals)/createCustomExercise',
        params: { 
          fromRoutineEdit: params?.fromRoutineEdit,
          fromNewWorkout: params?.fromNewWorkout,
          routineId: params?.routineId,
        }
      });
    }} 
    style={styles.headerButton}
  >
    <Text style={styles.customText}>Custom</Text>
  </TouchableOpacity>
</View>

        {/* Search and Filter Container */}
        <View style={styles.searchFilterContainer}>
          {/* Enhanced Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchIconContainer}>
              <Ionicons name="search-outline" size={20} color={colors.brand} />
            </View>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={colors.secondaryText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery("")}
              >
                <Ionicons name="close-circle" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Buttons Row */}
          <View style={styles.filterButtonsRow}>
            {/* Equipment Button */}
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[
                styles.filterDropdownButton,
                selectedEquipment !== "All" && styles.selectedFilterDropdownButton
              ]}
              onPress={openEquipmentSelection}
            >
              <Text style={[
                styles.filterDropdownText,
                selectedEquipment !== "All" && styles.selectedFilterDropdownText
              ]}>
                {getCurrentEquipmentLabel()}
              </Text>
            </TouchableOpacity>

            {/* Muscle Group Button */}
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[
                styles.filterDropdownButton,
                selectedMuscleGroup !== "All" && styles.selectedFilterDropdownButton
              ]}
              onPress={openMuscleGroupSelection}
            >
              <Text style={[
                styles.filterDropdownText,
                selectedMuscleGroup !== "All" && styles.selectedFilterDropdownText
              ]}>
                {getCurrentMuscleGroupLabel()}
              </Text>
            </TouchableOpacity>

            {/* Clear Filters Button */}
            {hasFiltersApplied() && (
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.clearFiltersButton}
                onPress={clearAllFilters}
              >
                <Ionicons name="close-circle" size={24} color={colors.secondaryText} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Exercise List */}
        {loading ? (
          <View style={styles.loadingContainer}>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
                activeOpacity={0.5} style={styles.retryButton} onPress={loadExercises}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <SectionList
            ref={sectionListRef}
            sections={sectionsData}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            renderItem={renderExerciseItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={contentContainerStyle}
            stickySectionHeadersEnabled={false}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => {
              Keyboard.dismiss();
            }}
            ListEmptyComponent={
              searchQuery ? (
                <View style={styles.searchEmptyContainer}>
                  <Text style={styles.searchEmptyTitle}>Can't find "{searchQuery}"</Text>
                  <Text style={styles.searchEmptySubtext}>
                    We don't have that exercise in our database yet.
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.5}
                    style={styles.createCustomButton}
                    onPress={() => {
                      router.push({
                        pathname: '/(app)/(modals)/createCustomExercise',
                        params: { 
                          suggestedName: searchQuery,
                          fromRoutineEdit: params?.fromRoutineEdit,
                          fromNewWorkout: params?.fromNewWorkout,
                          routineId: params?.routineId,
                        }
                      });
                    }}
                  >
                    <Text style={styles.createCustomButtonText}>Create Custom Exercise</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyListContainer}>
                  <Text style={styles.emptyListText}>No exercises found</Text>
                  <Text style={styles.emptyListSubtext}>
                    Try a different search term, muscle group, or equipment
                  </Text>
                </View>
              )
            }
          />
        )}

        {/* Floating Add Button */}
        {selectedExercises.size > 0 && (
          <Animated.View 
            style={[
              styles.floatingButton,
              {
                transform: [{
                  translateY: selectedExercises.size > 0 ? 0 : 100
                }]
              }
            ]}
          >
            <TouchableOpacity
                activeOpacity={0.5}
              style={styles.addButton}
              onPress={handleAddSelectedExercises}
            >
              <Ionicons name="add" size={24} color={colors.primaryText} />
              <Text style={styles.addButtonText}>
                Add {selectedExercises.size} Exercise{selectedExercises.size > 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Equipment Bottom Sheet */}
        <BottomSheet
          ref={equipmentBottomSheetRef}
          index={-1}
          snapPoints={selectionSnapPoints}
          onChange={handleEquipmentSheetChanges}
          enablePanDownToClose={true}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetIndicator}
          backdropComponent={renderBackdrop}
          maxDynamicContentSize={600}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Equipment</Text>
              <Text style={styles.bottomSheetSubtitle}>Select equipment type to filter exercises</Text>
            </View>
            
            <View style={{ maxHeight: '100%', paddingBottom: 140 }}>
            <ScrollView
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.bottomSheetList}
              style={{ borderRadius: 12 }}
            >
              {equipment.map((equipmentItem, index) => (
                <View key={equipmentItem.value}>
                  <TouchableOpacity
                activeOpacity={0.5}
                    style={styles.bottomSheetItem}
                    onPress={() => handleEquipmentSelect(equipmentItem)}
                  >
                    <View style={styles.bottomSheetItemIcon}>
                      {equipmentItem.imageUrl && !failedImages.has(`equipment_${equipmentItem.value}`) ? (
                        <Image 
                          source={{ uri: equipmentItem.imageUrl }}
                          resizeMode="contain"
                          style={[styles.bottomSheetItemImage, { width: '70%', height: '70%'}]}
                          onError={() => {
                            console.log(`Failed to load image for ${equipmentItem.label}`);
                            setFailedImages(prev => new Set([...prev, `equipment_${equipmentItem.value}`]));
                          }}
                        />
                      ) : (
                        <Ionicons 
                          name={getEquipmentFallbackIcon(equipmentItem.value)} 
                          size={24} 
                          color={colors.background}
                        />
                      )}
                    </View>
                    <Text style={[
                      styles.bottomSheetItemText,
                      selectedEquipment === equipmentItem.value && styles.selectedBottomSheetItemText
                    ]}>
                      {equipmentItem.label}
                    </Text>
                    {selectedEquipment === equipmentItem.value && (
                      <Ionicons name="checkmark" size={20} color={colors.brand} />
                    )}
                  </TouchableOpacity>
                  {index < equipment.length - 1 && <View style={styles.bottomSheetDivider} />}
                </View>
              ))}
            </ScrollView>
            </View>
          </BottomSheetView>
        </BottomSheet>

        {/* Muscle Group Bottom Sheet */}
        <BottomSheet
          ref={muscleGroupBottomSheetRef}
          index={-1}
          snapPoints={selectionSnapPoints}
          onChange={handleMuscleGroupSheetChanges}
          enablePanDownToClose={true}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetIndicator}
          backdropComponent={renderBackdrop}
          maxDynamicContentSize={600}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Muscle Group</Text>
              <Text style={styles.bottomSheetSubtitle}>Select muscle group to filter exercises</Text>
            </View>
            
            <View style={{ maxHeight: '100%', paddingBottom: 140 }}>
            <ScrollView
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.bottomSheetList}
              style={{ borderRadius: 12 }}
            >
              {muscleGroups.map((muscleGroup, index) => (
                <View key={muscleGroup.value}>
                  <TouchableOpacity
                activeOpacity={0.5}
                    style={styles.bottomSheetItem}
                    onPress={() => handleMuscleGroupSelect(muscleGroup)}
                  >
                    <View style={styles.bottomSheetItemIcon}>
                      {muscleGroup.imageUrl && !failedImages.has(muscleGroup.value) ? (
                        <Image 
                          source={{ uri: muscleGroup.imageUrl }}
                          resizeMode="contain"
                          style={styles.bottomSheetItemImage}
                          onError={() => {
                            console.log(`Failed to load image for ${muscleGroup.label}`);
                            setFailedImages(prev => new Set([...prev, muscleGroup.value]));
                          }}
                        />
                      ) : (
                        <Ionicons 
                          name={muscleGroup.iconName || getMuscleGroupFallbackIcon(muscleGroup.value)} 
                          size={24} 
                          color={colors.background} 
                        />
                      )}
                    </View>
                    <Text style={[
                      styles.bottomSheetItemText,
                      selectedMuscleGroup === muscleGroup.value && styles.selectedBottomSheetItemText
                    ]}>
                      {muscleGroup.label}
                    </Text>
                    {selectedMuscleGroup === muscleGroup.value && (
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
      </View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // ...existing styles remain the same...
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: colors.background,
  justifyContent: 'space-between', // Changed from center
  borderBottomWidth: 1,
  borderBottomColor: colors.whiteOverlay,
  paddingVertical: 10, // Reduced from 16
  paddingHorizontal: 12,
  paddingTop: 53, // Increased to match settings page
},

headerButton: {
  padding: 8,
  minWidth: 60,
  alignItems: 'center',
},

headerTitle: {
  fontSize: 16, // Reduced from 18 to match settings
  fontWeight: '500',
  color: colors.primaryText,
  flex: 1,
  textAlign: 'center',
},

cancelText: {
  fontSize: 16,
  color: colors.brand,
  fontWeight: '400',
},

customText: {
  fontSize: 16,
  color: colors.brand,
  fontWeight: '400',
},
  searchFilterContainer: {
    backgroundColor: colors.backgrund,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 4,
    height: 44,
    width: '100%',
  },
  searchIconContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.primaryText,
    fontSize: 16,
    paddingVertical: 8,
  },
  clearSearchButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  filterButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  filterDropdownButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedFilterDropdownButton: {
    backgroundColor: colors.brand,
  },
  filterDropdownText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectedFilterDropdownText: {
    color: colors.primaryText,
  },
  clearFiltersButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  bottomSheetScrollContainer: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    marginHorizontal: 10,
    flex: 1,
  },
  bottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
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

  // Keep all existing styles...
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: 20,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.secondaryText,
    marginRight: 8,
  },
  recentBadge: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.5)',
  },
  recentBadgeText: {
    fontSize: 10,
    color: colors.brand,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: colors.secondaryText,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  exerciseItemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  selectionRibbon: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.brand,
    zIndex: 1,
  },
  exerciseItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingRight: 12,
  },
  exerciseSelectableArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
  },
  exerciseImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: colors.primaryAccent,
  },
  exerciseImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 8,
  },
  exerciseItemName: {
    fontSize: 16,
    color: colors.primaryText,
    fontWeight: '500',
    marginBottom: 4,
  },
  exerciseItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  exerciseItemGroup: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  infoButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyListContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyListText: {
    color: colors.secondaryText,
    fontSize: 16,
    marginBottom: 8,
  },
  emptyListSubtext: {
    color: colors.secondaryText,
    fontSize: 14,
    opacity: 0.7,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: colors.brand,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customBadge: {
    backgroundColor: 'rgba(155, 89, 182, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.5)',
  },
  customBadgeText: {
    fontSize: 10,
    color: '#9B59B6',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  selectedExerciseBackground: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  unselectedExerciseBackground: {
    backgroundColor: 'transparent',
  },
  searchEmptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  searchEmptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
  },
  searchEmptySubtext: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  createCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  createCustomButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
});