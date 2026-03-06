import React, { memo, useCallback, useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform, Vibration, Pressable, Dimensions } from 'react-native';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

interface SetItemProps {
  set: any;
  setIndex: number;
  exercise: any;
  userWeightUnit: string;
  workoutSettings: any;
  styles: any;
  colors: any;
  swipeableRefs: React.MutableRefObject<any>;
  onToggleSetCompletion?: (exerciseId: string, setId: string) => void;
  onRemoveSet: (exerciseId: string, setId: string) => void;
  onOpenSetEdit: (exerciseIndex: number, setIndex: number) => void;
  onCloseAllSwipeables: () => void;
  exerciseIndex: number;
  showCheckbox?: boolean; // New prop to control checkbox visibility
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
  showCheckbox = true, // Default to true for backward compatibility
}) => {
  const setKey = `${exercise.id}-${set.id}`;
  const swipeableKey = setKey;
  
  // Get screen width for swipe detection
  const screenWidth = Dimensions.get('window').width;
  
  // Custom swipe state
  const [isCustomSwiping, setIsCustomSwiping] = useState(false);
  const [hasSwipedInCurrentGesture, setHasSwipedInCurrentGesture] = useState(false);
  const swipeTranslateX = useRef(new Animated.Value(0)).current;
  const deleteButtonOpacity = useRef(new Animated.Value(0)).current;

  // Custom swipe styles
  const swipeContainerStyle = { position: 'relative' as const };
  const deleteOverlayStyle = {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    justifyContent: 'flex-end' as const,
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    paddingRight: 0,
  };
  const deleteTouchableStyle = {
    width: 80,
    height: '100%' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 0,
    flexDirection: 'column' as const,
    gap: 4,
  };

  const deleteTextStyle = {
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  };
  
  // Create local animations for this component instance
  const animation = useRef(new Animated.Value(set.isCompleted ? 0.8 : 0)).current;
  const ribbonAnimation = useRef(new Animated.Value(set.isCompleted ? 1 : 0)).current;
  const deletionAnim = useRef(new Animated.Value(1)).current;
  
  // Error flash animations for individual fields
  const weightErrorFlash = useRef(new Animated.Value(0)).current;
  const repsErrorFlash = useRef(new Animated.Value(0)).current;
  const rpeErrorFlash = useRef(new Animated.Value(0)).current;
  
  // Track animation states to prevent conflicts
  const animationRunning = useRef(false);
  const errorAnimationRunning = useRef(false);
  
  // Sync animations with current state when component mounts or set completion changes
  useEffect(() => {
    // Only sync if no animation is currently running
    if (!animationRunning.current) {
      if (set.isCompleted) {
        animation.setValue(0.8);
        ribbonAnimation.setValue(1);
      } else {
        animation.setValue(0);
        ribbonAnimation.setValue(0);
      }
    }
    
    // Always reset error animations
    if (!errorAnimationRunning.current) {
      weightErrorFlash.setValue(0);
      repsErrorFlash.setValue(0);
      rpeErrorFlash.setValue(0);
    }
  }, [set.isCompleted]);
  
  // Validation
  const hasWeight = set.weight !== null && set.weight !== undefined;
  const hasReps = set.isRange 
    ? (set.repsMin !== null && set.repsMin !== undefined && set.repsMin > 0 && 
       set.repsMax !== null && set.repsMax !== undefined && set.repsMax > 0)
    : (set.reps !== null && set.reps !== undefined && set.reps > 0);
  const isValid = hasWeight && hasReps;
  
  // Flash error animation function - memoized
  const flashError = useCallback((exerciseId: string, setId: string, missingFields: string[]) => {
    // Prevent multiple error animations from running simultaneously
    if (errorAnimationRunning.current) {
      return;
    }
    
    errorAnimationRunning.current = true;
    const animations: Animated.CompositeAnimation[] = [];
    
    missingFields.forEach(field => {
      let fieldErrorFlash: Animated.Value | null = null;
      
      if (field === 'weight') {
        fieldErrorFlash = weightErrorFlash;
      } else if (field === 'reps') {
        fieldErrorFlash = repsErrorFlash;
      } else if (field === 'rpe') {
        fieldErrorFlash = rpeErrorFlash;
      }
      
      if (fieldErrorFlash) {
        // Reset to 0 first
        fieldErrorFlash.setValue(0);
        
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
      Animated.parallel(animations).start((finished) => {
        errorAnimationRunning.current = false;
        
        // Force reset all error animations regardless of finished state
        weightErrorFlash.setValue(0);
        repsErrorFlash.setValue(0);
        rpeErrorFlash.setValue(0);
      });
    } else {
      errorAnimationRunning.current = false;
    }
  }, [weightErrorFlash, repsErrorFlash, rpeErrorFlash]);
  
  // Legacy right action function - no longer used but keeping for compatibility
  const rightAction = useCallback((exerciseId: string, setId: string, deletionAnim: Animated.Value, setKey: string, prog: any) => {
    return null; // We're using custom swipe implementation now
  }, []);
  
  // Handle set press
  const handleSetPress = useCallback(() => {
    // Prevent onPress if any swipe-related state is active
    if (
      swipeableRefs.current[swipeableKey + '_swiping'] || 
      isCustomSwiping || 
      hasSwipedInCurrentGesture
    ) {
      return;
    }
    
    // Check if we're translated on the X-axis (indicating we're in a swiped state)
    const currentTranslateX = (swipeTranslateX as any)._value;
    if (currentTranslateX !== 0) {
      return;
    }
    
    // In editRoutine mode (no checkbox), always allow editing
    // In workout mode (with checkbox), only allow editing if not completed
    if (!showCheckbox || !set.isCompleted) {
      onCloseAllSwipeables();
      onOpenSetEdit(exerciseIndex, setIndex);
    }
  }, [swipeableKey, set.isCompleted, onCloseAllSwipeables, onOpenSetEdit, exerciseIndex, setIndex, isCustomSwiping, hasSwipedInCurrentGesture, swipeTranslateX]);
  
  // Handle checkbox press
  const handleCheckboxPress = useCallback((e: any) => {
    e.stopPropagation();
    
    // Prevent checkbox press if swiping
    if (
      swipeableRefs.current[swipeableKey + '_swiping'] || 
      isCustomSwiping || 
      hasSwipedInCurrentGesture
    ) {
      return;
    }
    
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
    
    // Stop any current animations before starting new ones
    animation.stopAnimation();
    ribbonAnimation.stopAnimation();
    animationRunning.current = true;
    
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
      ]).start((finished) => {
        animationRunning.current = false;
        // Force set final values regardless of finished state
        animation.setValue(0.8);
        ribbonAnimation.setValue(1);
      });
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
      ]).start((finished) => {
        animationRunning.current = false;
        // Force set final values regardless of finished state
        animation.setValue(0);
        ribbonAnimation.setValue(0);
      });
    }
    
    onToggleSetCompletion?.(exercise.id, set.id);
  }, [
    swipeableKey,
    isCustomSwiping,
    hasSwipedInCurrentGesture,
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
  
  // Custom pan gesture handler
  const handlePanGestureEvent = useCallback((event: any) => {
    const { translationX, translationY, velocityX, velocityY } = event.nativeEvent;
    
    // Check if this is primarily a vertical gesture - if so, don't interfere with scrolling
    const horizontalDistance = Math.abs(translationX);
    const verticalDistance = Math.abs(translationY);
    
    // If vertical movement is greater than horizontal and we haven't established horizontal intent, don't handle
    if (verticalDistance > horizontalDistance && horizontalDistance < 10) {
      return;
    }
    
    // If we have established horizontal intent (swiping state is active), continue handling
    if (isCustomSwiping || horizontalDistance >= 10) {
      // Only allow left swipes (negative translation)
      if (translationX >= 0) {
        swipeTranslateX.setValue(0);
        deleteButtonOpacity.setValue(0);
        return;
      }
      
      // Limit the swipe distance
      const maxSwipeDistance = -screenWidth;
      const clampedTranslation = Math.max(translationX, maxSwipeDistance);
      
      // Update translation
      swipeTranslateX.setValue(clampedTranslation);
      
      // Calculate delete button opacity based on swipe distance
      const swipeProgress = Math.min(Math.abs(clampedTranslation) / 60, 1);
      deleteButtonOpacity.setValue(swipeProgress);
    }
    
  }, [isCustomSwiping, screenWidth]);
  
  const handlePanHandlerStateChange = useCallback((event: any) => {
    const { state, translationX, translationY, velocityX, velocityY } = event.nativeEvent;
    
    if (state === State.BEGAN) {
      // Reset any previous gesture state
      setHasSwipedInCurrentGesture(false);
      return;
    } else if (state === State.ACTIVE) {
      // Check if this is primarily a horizontal gesture
      const horizontalDistance = Math.abs(translationX);
      const verticalDistance = Math.abs(translationY);
      
      // Only start swiping if this is clearly a horizontal gesture and moving left
      if (horizontalDistance > verticalDistance && horizontalDistance > 10 && translationX < -5) {
        if (!isCustomSwiping) {
          setIsCustomSwiping(true);
          setHasSwipedInCurrentGesture(true);
          swipeableRefs.current[swipeableKey + '_swiping'] = true;
          // Close other swipeables but not this one
          Object.keys(swipeableRefs.current).forEach(key => {
            const ref = swipeableRefs.current[key];
            if (key.endsWith('_swiping')) {
              return;
            }
            if (key !== swipeableKey && ref && ref.close) {
              ref.close();
            }
          });
        }
      }
    } else if (state === State.END || state === State.CANCELLED) {
      // Only process end state if we were actually swiping
      const wasActuallySwiping = isCustomSwiping || hasSwipedInCurrentGesture;
      
      // Always reset swiping state immediately
      setIsCustomSwiping(false);
      swipeableRefs.current[swipeableKey + '_swiping'] = false;
      
      // If we were swiping, keep the flag to prevent onPress, otherwise reset it
      if (!wasActuallySwiping) {
        setHasSwipedInCurrentGesture(false);
      } else {
        // Reset the swipe flag after a longer delay to prevent onPress from firing
        setTimeout(() => {
          setHasSwipedInCurrentGesture(false);
        }, 300);
      }
      
      const swipeThreshold = -60; // Threshold for showing delete button
      const deleteThreshold = -(screenWidth / 2.5); // Threshold for auto-delete (third screen width)
      
      if (translationX <= deleteThreshold) {
        // Auto-delete: swipe is far enough or fast enough
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (error) {
          Vibration.vibrate(100);
        }
        
        // Don't reset states here - let the animation complete
        // First animate the swipe off screen, then fade out, then remove
        Animated.timing(swipeTranslateX, {
          toValue: -screenWidth,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          // After swipe animation completes, fade out the entire item
          Animated.timing(deletionAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            // Finally remove the set after all animations complete
            onRemoveSet(exercise.id, set.id);
          });
        });
        return; // Exit early to prevent state reset
      } else if (translationX <= swipeThreshold) {
        onCloseAllSwipeables();
        // Show delete button: swipe is past threshold but not far enough for auto-delete
        Animated.parallel([
          Animated.spring(swipeTranslateX, {
            toValue: -80,
            useNativeDriver: true,
            tension: 120,
            friction: 9,
          }),
          Animated.timing(deleteButtonOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          })
        ]).start();
        // Don't reset swiping states - keep the delete button visible
        return; // Exit early to prevent state reset
      } else {
        // Snap back: swipe wasn't far enough
        Animated.parallel([
          Animated.spring(swipeTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
          Animated.timing(deleteButtonOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          })
        ]).start();
      }
    }
  }, [swipeableKey, onCloseAllSwipeables, screenWidth, onRemoveSet, exercise.id, set.id, deletionAnim]);
  
  // Manual delete button press
  const handleManualDelete = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      Vibration.vibrate(100);
    }
    
    // First animate the swipe off screen, then fade out, then remove
    Animated.timing(swipeTranslateX, {
      toValue: -screenWidth,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      // After swipe animation completes, fade out the entire item
      Animated.timing(deletionAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        // Finally remove the set after all animations complete
        onRemoveSet(exercise.id, set.id);
      });
    });
  }, [screenWidth, deletionAnim, onRemoveSet, exercise.id, set.id]);
  
  // Close custom swipe
  const closeCustomSwipe = useCallback(() => {
    // Don't close if we're currently in the middle of a swipe gesture
    if (isCustomSwiping) {
      return;
    }
    
    Animated.parallel([
      Animated.spring(swipeTranslateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(deleteButtonOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
    setIsCustomSwiping(false);
    setHasSwipedInCurrentGesture(false);
    swipeableRefs.current[swipeableKey + '_swiping'] = false;
  }, [swipeableKey, isCustomSwiping, hasSwipedInCurrentGesture]);
  
  // Store the close function in the refs
  useEffect(() => {
    swipeableRefs.current[swipeableKey] = {
      close: closeCustomSwipe
    };
    
    return () => {
      delete swipeableRefs.current[swipeableKey];
    };
  }, [swipeableKey, closeCustomSwipe]);
  
  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      // Stop all animations when component unmounts
      animation.stopAnimation();
      ribbonAnimation.stopAnimation();
      deletionAnim.stopAnimation();
      weightErrorFlash.stopAnimation();
      repsErrorFlash.stopAnimation();
      rpeErrorFlash.stopAnimation();
      swipeTranslateX.stopAnimation();
      deleteButtonOpacity.stopAnimation();
    };
  }, []);
  
  return (
    <Animated.View
      key={set.id}
      style={{
        opacity: deletionAnim,
      }}
    >
      <View style={swipeContainerStyle}>
        {/* Delete button overlay - positioned behind */}
        <Animated.View
          style={[
            styles.setRow,
            {
              backgroundColor: colors.notification || colors.destructive,
              opacity: deleteButtonOpacity,
            },
            deleteOverlayStyle,
          ]}
          pointerEvents="auto"
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleManualDelete}
            style={deleteTouchableStyle}
          >
            <IonIcon name="trash-outline" size={20} color={colors.primaryText} />
            <Text style={[deleteTextStyle, { color: colors.primaryText }]}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>

        <PanGestureHandler
          enabled={exercise.sets.length > 1 && (!showCheckbox || !set.isCompleted)}
          onGestureEvent={handlePanGestureEvent}
          onHandlerStateChange={handlePanHandlerStateChange}
          activeOffsetX={[-10, 10]}
          failOffsetY={[-30, 30]}
          shouldCancelWhenOutside={false}
        >
          <Animated.View style={{ transform: [{ translateX: swipeTranslateX }] }}>
            <Pressable
              style={[
                styles.setRow,
                set.isCompleted && styles.completedSetRow,
              ]}
              onPress={handleSetPress}
              disabled={(showCheckbox && set.isCompleted) || isCustomSwiping || hasSwipedInCurrentGesture}
            >
          {({ pressed }) => (
            <>
              {pressed && (!showCheckbox || !set.isCompleted) && (
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
                    },
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
                {set.isRange ? (
                  <View style={styles.repRangeDisplay}>
                    <Text style={[
                      styles.setValueText,
                      set.isCompleted && styles.completedSetText,
                      (!set.repsMin && !set.isCompleted) && styles.placeholderSetText
                    ]}>
                      {set.repsMin !== null && set.repsMin !== undefined ? String(set.repsMin) : "-"}
                    </Text>
                    <Text style={[styles.repRangeSeparator, set.isCompleted && styles.completedSetText]}>to</Text>
                    <Text style={[
                      styles.setValueText,
                      set.isCompleted && styles.completedSetText,
                      (!set.repsMax && !set.isCompleted) && styles.placeholderSetText
                    ]}>
                      {set.repsMax !== null && set.repsMax !== undefined ? String(set.repsMax) : "-"}
                    </Text>
                  </View>
                ) : (
                  <Text style={[
                    styles.setValueText,
                    set.isCompleted && styles.completedSetText,
                    (!set.reps && !set.isCompleted) && styles.placeholderSetText
                  ]}>
                    {set.reps !== null && set.reps !== undefined && set.reps !== 0 ? String(set.reps) : "-"}
                  </Text>
                )}
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
              
              {/* Completion checkbox - only show if enabled */}
              {showCheckbox && (
                <TouchableOpacity
                  hitSlop={{ top: 30, bottom: 30, left: 20, right: 30 }}
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
              )}
            </>
          )}
        </Pressable>
          </Animated.View>
        </PanGestureHandler>
      </View>
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
    prevSet.repsMin !== nextSet.repsMin ||
    prevSet.repsMax !== nextSet.repsMax ||
    prevSet.isRange !== nextSet.isRange ||
    prevSet.rpe !== nextSet.rpe ||
    prevSet.isCompleted !== nextSet.isCompleted
  ) {
    return false; // Re-render if set data changed
  }
  
  // Check if exercise index changed (e.g. after reorder)
  if (prevProps.exerciseIndex !== nextProps.exerciseIndex) {
    return false;
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
