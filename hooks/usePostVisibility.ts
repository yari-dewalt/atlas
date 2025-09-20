import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Dimensions } from 'react-native';

interface UsePostVisibilityProps {
  threshold?: number;
  onScroll?: (scrollY: number) => void;
}

interface ViewPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Global scroll tracking
let globalScrollY = 0;
const scrollListeners = new Set<(scrollY: number) => void>();

export const updateGlobalScrollPosition = (scrollY: number) => {
  globalScrollY = scrollY;
  scrollListeners.forEach(listener => listener(scrollY));
};

export const usePostVisibility = ({ threshold = 0.5 }: UsePostVisibilityProps = {}) => {
  const [isVisible, setIsVisible] = useState(true);
  const elementRef = useRef<View>(null);
  const [elementPosition, setElementPosition] = useState<ViewPosition | null>(null);
  const initialPositionRef = useRef<ViewPosition | null>(null);

  const checkVisibility = useCallback((scrollY?: number) => {
    if (!initialPositionRef.current) return;

    const currentScrollY = scrollY !== undefined ? scrollY : globalScrollY;
    const screenHeight = Dimensions.get('window').height;
    
    // Calculate current position based on scroll
    const elementTop = initialPositionRef.current.y - currentScrollY + 320;
    const elementBottom = elementTop + initialPositionRef.current.height - 80;

    // Calculate how much of the element is visible
    const visibleTop = Math.max(0, elementTop);
    const visibleBottom = Math.min(screenHeight, elementBottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const visibilityRatio = visibleHeight / initialPositionRef.current.height;
    
    // Element is considered visible if the visibility ratio exceeds the threshold
    const shouldBeVisible = visibilityRatio >= threshold;
    
    setIsVisible(shouldBeVisible);
  }, [threshold]);

  const measureElement = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.measureInWindow((x, y, width, height) => {
        const position = { x, y, width, height };
        setElementPosition(position);
        if (!initialPositionRef.current) {
          initialPositionRef.current = position;
        }
      });
    }
  }, []);

  // Measure element on layout
  const onLayout = useCallback(() => {
    // Use a small delay to ensure the layout has been applied
    setTimeout(measureElement, 100);
  }, [measureElement]);

  // Register for scroll updates
  useEffect(() => {
    const handleScroll = (scrollY: number) => {
      checkVisibility(scrollY);
    };

    scrollListeners.add(handleScroll);
    
    return () => {
      scrollListeners.delete(handleScroll);
    };
  }, [checkVisibility]);

  // Check visibility when position changes
  useEffect(() => {
    if (initialPositionRef.current) {
      checkVisibility();
    }
  }, [elementPosition, checkVisibility]);

  return {
    isVisible,
    setIsVisible,
    elementRef,
    onLayout,
    checkVisibility,
    measureElement,
  };
};
