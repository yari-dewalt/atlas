import React, { memo, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform, Vibration, Pressable } from 'react-native';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { AnimationManager } from '../../../hooks/useAnimationManager';

interface SetItemProps {
  set: any;
  setIndex: number;
  exercise: any;
  userWeightUnit: string;
  workoutSettings: any;
  styles: any;
  colors: any;
  swipeableRefs: React.MutableRefObject<any>;
  onToggleSetCompletion: (exerciseId: string, setId: string) => void;
  onRemoveSet: (exerciseId: string, setId: string) => void;
  onOpenSetEdit: (exerciseIndex: number, setIndex: number) => void;
  onCloseAllSwipeables: () => void;
  exerciseIndex: number;
  animationManager: AnimationManager;
}

const SetItem = memo<SetItemProps>(({
  set,
  setIndex,
  exercise,
  userWeightUnit,
  workoutSettings,
  styles,
  colors,
  swipeableRefs,
  onToggleSetCompletion,
  onRemoveSet,
  onOpenSetEdit,
  onCloseAllSwipeables,
  exerciseIndex,
  animationManager
}) => {
  const setKey = `${exercise.id}-${set.id}`;
  const swipeableKey = setKey;
  
  // Get or create animations using animation manager
  const animation = animationManager.getAnimationForSet(setKey, 'completion', set.isCompleted ? 0.8 : 0);
  const ribbonAnimation = animationManager.getAnimationForSet(setKey, 'ribbon', set.isCompleted ? 1 : 0);
  const deletionAnim = animationManager.getAnimationForSet(setKey, 'deletion', 1);
  
  // Error flash animations for individual fields
  const weightErrorFlash = animationManager.getErrorAnimationForField(setKey, 'weight');
  const repsErrorFlash = animationManager.getErrorAnimationForField(setKey, 'reps');
  const rpeErrorFlash = animationManager.getErrorAnimationForField(setKey, 'rpe');
  
  // Validation
  const hasWeight = set.weight !== null && set.weight !== undefined;
  const hasReps = set.reps !== null && set.reps !== undefined && set.reps > 0;
  const isValid = hasWeight && hasReps;
  
  // Flash error animation function - memoized
  const flashError = useCallback((exerciseId: string, setId: string, missingFields: string[]) => {
    const setKey = `${exerciseId}-${setId}`;
    const animations: Animated.CompositeAnimation[] = [];
    
    missingFields.forEach(field => {
      const fieldErrorFlash = animationManager.getErrorAnimationForField(setKey, field);
      
      if (fieldErrorFlash) {
        const fieldAnimation = Animated.sequence([
          Animated.timing(fieldErrorFlash, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(fieldErrorFlash, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(fieldErrorFlash, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(fieldErrorFlash, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
        ]);
        animations.push(fieldAnimation);
      }
    });
    
    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }
  }, [animationManager]);
  
  // Right action function - memoized
  const rightAction = useCallback((exerciseId: string, setId: string, deletionAnim: Animated.Value, setKey: string, prog: any) => {
    if (prog.value > 2.2) {
      Animated.timing(deletionAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        onRemoveSet(exerciseId, setId);
      });
    }
    
    const handleDeletePress = () => {
      Animated.timing(deletionAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        onRemoveSet(exerciseId, setId);
      });
    };
    
    return (
      <View style={styles.hiddenItem}>
        <TouchableOpacity
          activeOpacity={0.5}
          style={[styles.deleteButton, Platform.OS === 'android' && styles.deleteButtonAndroid]}
          onPress={handleDeletePress}
        >
          <View style={styles.deleteButtonContent}>
            <IonIcon name="trash-outline" size={20} color="white" />
            <Text style={styles.deleteText}>Delete</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [onRemoveSet, styles]);
  
  // Handle set press
  const handleSetPress = useCallback(() => {
    if (swipeableRefs.current[swipeableKey + '_swiping']) {
      return;
    }
    
    if (!set.isCompleted) {
      onCloseAllSwipeables();
      onOpenSetEdit(exerciseIndex, setIndex);
    }
  }, [swipeableKey, set.isCompleted, onCloseAllSwipeables, onOpenSetEdit, exerciseIndex, setIndex]);
  
  // Handle checkbox press
  const handleCheckboxPress = useCallback((e: any) => {
    e.stopPropagation();
    onCloseAllSwipeables();
    
    if (!isValid && !set.isCompleted) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch (error) {
        Vibration.vibrate([100, 50, 100]);
      }
      
      const missingFields = [];
      if (!hasWeight) missingFields.push('weight');
      if (!hasReps) missingFields.push('reps');
      
      flashError(exercise.id, set.id, missingFields);
      return;
    }
    
    const newValue = !set.isCompleted;
    
    if (newValue) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        Vibration.vibrate(40);
      }
      
      Animated.parallel([
        Animated.sequence([
          Animated.timing(animation, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(animation, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(ribbonAnimation, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(animation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(ribbonAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    }
    
    onToggleSetCompletion(exercise.id, set.id);
  }, [
    isValid, 
    set.isCompleted, 
    hasWeight, 
    hasReps, 
    flashError, 
    exercise.id, 
    set.id, 
    animation, 
    ribbonAnimation, 
    onToggleSetCompletion,
    onCloseAllSwipeables
  ]);
  
  // Handle swipeable ref
  const swipeableRef = useRef<any>(null);
  
  useEffect(() => {
    if (swipeableRef.current) {
      swipeableRefs.current[swipeableKey] = swipeableRef.current;
    }
    
    return () => {
      delete swipeableRefs.current[swipeableKey];
    };
  }, [swipeableKey]);
  
  // Handle swipeable open start
  const handleSwipeableOpenStart = useCallback(() => {
    swipeableRefs.current[swipeableKey + '_swiping'] = true;
    
    Object.keys(swipeableRefs.current).forEach(key => {
      const ref = swipeableRefs.current[key];
      if (key.endsWith('_swiping')) {
        return;
      }
      if (key !== swipeableKey && ref && ref.close) {
        ref.close();
      }
    });
  }, [swipeableKey]);
  
  // Handle swipeable will close
  const handleSwipeableWillClose = useCallback(() => {
    swipeableRefs.current[swipeableKey + '_swiping'] = false;
  }, [swipeableKey]);
  
  return (
    <Animated.View
      key={set.id}
      style={{
        opacity: deletionAnim,
      }}
    >
      <Swipeable
        ref={swipeableRef}
        enabled={exercise.sets.length > 1 && !set.isCompleted}
        renderRightActions={(prog) => rightAction(exercise.id, set.id, deletionAnim, setKey, prog)}
        rightThreshold={60}
        onSwipeableOpenStartDrag={handleSwipeableOpenStart}
        onSwipeableWillClose={handleSwipeableWillClose}
      >
        <Pressable
          style={[
            styles.setRow,
            set.isCompleted && styles.completedSetRow,
          ]}
          onPress={handleSetPress}
          disabled={set.isCompleted}
        >
          {({ pressed }) => (
            <>
              {pressed && !set.isCompleted && (
                <View style={styles.setPressOverlay} />
              )}
              
              <Animated.View
                style={[
                  styles.setRowCompletionRibbon,
                  {
                    opacity: ribbonAnimation,
                    transform: [{
                      translateX: ribbonAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-100, 0],
                      })
                    }]
                  }
                ]}
              />
              
              <Text style={[styles.setText, styles.setNumberColumn]}>{setIndex + 1}</Text>
              
              {/* Weight display */}
              <View style={[styles.setInputColumn, styles.setValueDisplay]}>
                <Animated.View
                  style={[
                    styles.setFieldErrorOverlay,
                    {
                      opacity: weightErrorFlash.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1],
                      }),
                    }
                  ]}
                />
                <Text style={[
                  styles.setValueText,
                  set.isCompleted && styles.completedSetText,
                  (set.weight === null || set.weight === undefined) && !set.isCompleted && styles.placeholderSetText
                ]}>
                  {set.weight !== null && set.weight !== undefined ? `${String(set.weight)} ${userWeightUnit}` : "-"}
                </Text>
              </View>

              {/* Reps display */}
              <View style={[styles.setInputColumn, styles.setValueDisplay]}>
                <Animated.View
                  style={[
                    styles.setFieldErrorOverlay,
                    {
                      opacity: repsErrorFlash.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1],
                      }),
                    }
                  ]}
                />
                <Text style={[
                  styles.setValueText,
                  set.isCompleted && styles.completedSetText,
                  (!set.reps && !set.isCompleted) && styles.placeholderSetText
                ]}>
                  {set.reps !== null && set.reps !== undefined && set.reps !== 0 ? String(set.reps) : "-"}
                </Text>
              </View>

              {/* RPE display */}
              {workoutSettings.rpeEnabled && (
                <View style={[styles.setInputColumn, styles.setValueDisplay]}>
                  <Animated.View
                    style={[
                      styles.setFieldErrorOverlay,
                      {
                        opacity: rpeErrorFlash.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 1],
                        }),
                      }
                    ]}
                  />
                  <Text style={[
                    styles.setValueText,
                    set.isCompleted && styles.completedSetText,
                    (!set.rpe && !set.isCompleted) && styles.placeholderSetText
                  ]}>
                    {set.rpe !== null && set.rpe !== undefined && set.rpe !== 0 ? String(set.rpe) : "-"}
                  </Text>
                </View>
              )}
              
              {/* Completion checkbox */}
              <TouchableOpacity
                activeOpacity={0.5}
                onPress={handleCheckboxPress}
                style={[
                  styles.checkboxColumn,
                  !isValid && !set.isCompleted && styles.disabledCheckbox
                ]}
              >
                <Animated.View
                  style={[
                    styles.customCheckbox,
                    set.isCompleted && styles.customCheckboxCompleted,
                    {
                      transform: [
                        { scale: animation.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [1, 1.2, 1]
                        }) }
                      ]
                    }
                  ]}
                >
                  {set.isCompleted && (
                    <IonIcon 
                      name="checkmark" 
                      size={16} 
                      color="white" 
                    />
                  )}
                </Animated.View>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  const prevSet = prevProps.set;
  const nextSet = nextProps.set;
  
  // Check if set data has changed
  if (
    prevSet.id !== nextSet.id ||
    prevSet.weight !== nextSet.weight ||
    prevSet.reps !== nextSet.reps ||
    prevSet.rpe !== nextSet.rpe ||
    prevSet.isCompleted !== nextSet.isCompleted
  ) {
    return false; // Re-render if set data changed
  }
  
  // Check if exercise sets length changed (affects swipeable enable/disable)
  if (prevProps.exercise.sets.length !== nextProps.exercise.sets.length) {
    return false;
  }
  
  // Check if workout settings changed
  if (prevProps.workoutSettings.rpeEnabled !== nextProps.workoutSettings.rpeEnabled) {
    return false;
  }
  
  // Check if user weight unit changed
  if (prevProps.userWeightUnit !== nextProps.userWeightUnit) {
    return false;
  }
  
  return true; // Skip re-render if nothing important changed
});

SetItem.displayName = 'SetItem';

export default SetItem;
