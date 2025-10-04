import { Animated } from 'react-native';
import { useRef, useCallback, useMemo } from 'react';

export interface AnimationManager {
  completionAnimations: Record<string, Animated.Value>;
  completionRibbonAnimations: Record<string, Animated.Value>;
  deletionAnimations: Record<string, Animated.Value>;
  errorFlashAnimations: Record<string, Animated.Value>;
  updateAnimations: (
    setKey: string,
    animations: {
      completion?: Animated.Value;
      ribbon?: Animated.Value;
      deletion?: Animated.Value;
      weightError?: Animated.Value;
      repsError?: Animated.Value;
      rpeError?: Animated.Value;
    }
  ) => void;
  cleanupAnimations: (setKey: string) => void;
  getAnimationForSet: (setKey: string, type: 'completion' | 'ribbon' | 'deletion', defaultValue?: number) => Animated.Value;
  getErrorAnimationForField: (setKey: string, field: string) => Animated.Value;
}

export const useAnimationManager = (): AnimationManager => {
  const completionAnimationsRef = useRef<Record<string, Animated.Value>>({});
  const completionRibbonAnimationsRef = useRef<Record<string, Animated.Value>>({});
  const deletionAnimationsRef = useRef<Record<string, Animated.Value>>({});
  const errorFlashAnimationsRef = useRef<Record<string, Animated.Value>>({});

  const updateAnimations = useCallback((
    setKey: string,
    animations: {
      completion?: Animated.Value;
      ribbon?: Animated.Value;
      deletion?: Animated.Value;
      weightError?: Animated.Value;
      repsError?: Animated.Value;
      rpeError?: Animated.Value;
    }
  ) => {
    if (animations.completion) {
      completionAnimationsRef.current[setKey] = animations.completion;
    }
    if (animations.ribbon) {
      completionRibbonAnimationsRef.current[setKey] = animations.ribbon;
    }
    if (animations.deletion) {
      deletionAnimationsRef.current[setKey] = animations.deletion;
    }
    if (animations.weightError) {
      errorFlashAnimationsRef.current[`${setKey}-weight`] = animations.weightError;
    }
    if (animations.repsError) {
      errorFlashAnimationsRef.current[`${setKey}-reps`] = animations.repsError;
    }
    if (animations.rpeError) {
      errorFlashAnimationsRef.current[`${setKey}-rpe`] = animations.rpeError;
    }
  }, []);

  const cleanupAnimations = useCallback((setKey: string) => {
    // Clean up all animations for a given set
    delete completionAnimationsRef.current[setKey];
    delete completionRibbonAnimationsRef.current[setKey];
    delete deletionAnimationsRef.current[setKey];
    delete errorFlashAnimationsRef.current[`${setKey}-weight`];
    delete errorFlashAnimationsRef.current[`${setKey}-reps`];
    delete errorFlashAnimationsRef.current[`${setKey}-rpe`];
  }, []);

  const getAnimationForSet = useCallback((
    setKey: string, 
    type: 'completion' | 'ribbon' | 'deletion', 
    defaultValue = 0
  ): Animated.Value => {
    const animationsMap = {
      completion: completionAnimationsRef.current,
      ribbon: completionRibbonAnimationsRef.current,
      deletion: deletionAnimationsRef.current,
    };

    const animations = animationsMap[type];
    if (!animations[setKey]) {
      animations[setKey] = new Animated.Value(defaultValue);
    }
    return animations[setKey];
  }, []);

  const getErrorAnimationForField = useCallback((setKey: string, field: string): Animated.Value => {
    const key = `${setKey}-${field}`;
    if (!errorFlashAnimationsRef.current[key]) {
      errorFlashAnimationsRef.current[key] = new Animated.Value(0);
    }
    return errorFlashAnimationsRef.current[key];
  }, []);

  return useMemo(() => ({
    completionAnimations: completionAnimationsRef.current,
    completionRibbonAnimations: completionRibbonAnimationsRef.current,
    deletionAnimations: deletionAnimationsRef.current,
    errorFlashAnimations: errorFlashAnimationsRef.current,
    updateAnimations,
    cleanupAnimations,
    getAnimationForSet,
    getErrorAnimationForField,
  }), [updateAnimations, cleanupAnimations, getAnimationForSet, getErrorAnimationForField]);
};
