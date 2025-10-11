import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { colors } from '../constants/colors';
import * as Haptics from 'expo-haptics';

interface RpeItem {
  value: number;
  label: string;
  description: string;
}

interface RpeSelectorProps {
  data: RpeItem[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  itemWidth?: number;
}

const { width: screenWidth } = Dimensions.get('window');

const RpeSelector: React.FC<RpeSelectorProps> = ({
  data,
  selectedIndex,
  onIndexChange,
  itemWidth = 80,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const previousIndexRef = useRef(selectedIndex);
  const lastPropIndexRef = useRef(selectedIndex);
  const isUserScrolling = useRef(false);
  const [isScrollingState, setIsScrollingState] = useState(false);

  // Calculate padding to center items
  const sideSpacing = itemWidth * 2;

  // Initial scroll on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollViewRef.current && selectedIndex >= 0 && selectedIndex < data.length) {
        const targetOffset = selectedIndex * itemWidth + (Platform.OS === 'android' ? -2 : 14);
        scrollViewRef.current.scrollTo({
          x: targetOffset,
          animated: false,
        });
      }
    }, 150);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Scroll to position when selectedIndex changes from outside (not from user scrolling)
    if (lastPropIndexRef.current !== selectedIndex && !isUserScrolling.current) {
      const timer = setTimeout(() => {
        if (scrollViewRef.current && selectedIndex >= 0 && selectedIndex < data.length) {
          const targetOffset = selectedIndex * itemWidth + (Platform.OS === 'android' ? -2 : 14);
          scrollViewRef.current.scrollTo({
            x: targetOffset,
            animated: false,
          });
        }
      }, 100);
      
      lastPropIndexRef.current = selectedIndex;
      return () => clearTimeout(timer);
    }
  }, [selectedIndex, data.length, itemWidth]);

  // Haptic feedback when selectedIndex changes
  useEffect(() => {
    if (previousIndexRef.current !== selectedIndex) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      } catch (error) {
        // Fallback for devices without haptics
      }
      previousIndexRef.current = selectedIndex;
    }
  }, [selectedIndex]);

  const handleScrollBeginDrag = () => {
    setIsScrollingState(true);
    isUserScrolling.current = true;
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset?.x;
    if (offsetX === undefined) return;

    // Calculate current item position
    const currentIndex = Math.round(offsetX / itemWidth);
    const boundedIndex = Math.max(0, Math.min(currentIndex, data.length - 1));

    // Update selectedIndex immediately during scroll
    if (boundedIndex !== selectedIndex) {
      console.log("Updating index to:", boundedIndex);
      lastPropIndexRef.current = boundedIndex; // Update our tracking ref
      onIndexChange(boundedIndex);
    }
  };

  const handleItemPress = (index: number) => {
    if (isScrollingState || index === selectedIndex) return;

    // Mark as user scrolling to prevent useEffect interference
    isUserScrolling.current = true;
    setIsScrollingState(true);

    // Scroll to the tapped item
    const targetOffset = index * itemWidth + (Platform.OS === 'android' ? -2 : 14);
    scrollViewRef.current?.scrollTo({
      x: targetOffset,
      animated: true,
    });

    // Reset scrolling state after animation
    setTimeout(() => {
      isUserScrolling.current = false;
      setIsScrollingState(false);
    }, 300);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToOffsets={data.map((_, i) => i * itemWidth + (Platform.OS === 'android' ? -2 : 14))}
        snapToAlignment="center"
        decelerationRate="fast"
        // onScrollBeginDrag={handleScrollBeginDrag}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: sideSpacing,
        }}
      >
        {data.map((item, index) => {
          const isSelected = index === selectedIndex;
          const isAdjacent = Math.abs(index - selectedIndex) === 1;
          const opacity = isSelected ? 1 : isAdjacent ? 0.7 : 0.3;

          return (
            <TouchableOpacity
              key={item.value.toString()}
              activeOpacity={isScrollingState ? 1 : 0.7}
              disabled={isScrollingState}
              style={[styles.item, { width: itemWidth }]}
              onPress={() => handleItemPress(index)}
            >
              <View
                style={[
                  styles.itemContainer,
                  isSelected && styles.selectedItemContainer,
                ]}
              >
                <Text
                  style={[
                    styles.itemText,
                    isSelected && styles.selectedItemText,
                    { opacity },
                  ]}
                >
                  {item.value}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    justifyContent: 'center',
  },
  item: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
  },
  itemContainer: {
    width: 80,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'android' ? 10 : 0,
  },
  selectedItemContainer: {
  },
  itemText: {
    fontSize: 48,
    fontWeight: '600',
    color: colors.primaryText,
  },
  selectedItemText: {
    color: colors.brand,
    fontWeight: 'bold',
  },
});

export default RpeSelector;
