import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useBannerStore, BANNER_TYPES } from '../stores/bannerStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { colors } from '../constants/colors';

const { width } = Dimensions.get('window');

const GlobalBanner: React.FC = () => {
  const { isVisible, message, type, action, hideBanner } = useBannerStore();
  const { activeWorkout } = useWorkoutStore();
  const pathname = usePathname();
  const slideAnim = useRef(new Animated.Value(100)).current; // Start below screen
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = React.useState(false);

  useEffect(() => {
    if (isVisible) {
      // Show the component and slide in
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (shouldRender) {
      // Slide out and fade out, then hide
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hide the component after animation completes
        setShouldRender(false);
      });
    }
  }, [isVisible, shouldRender]);

  const getBannerStyle = () => {
    switch (type) {
      case BANNER_TYPES.SUCCESS:
        return {
          iconColor: '#10B981', // green-500
          iconName: 'checkmark-circle' as const,
        };
      case BANNER_TYPES.ERROR:
        return {
          iconColor: '#EF4444', // red-500
          iconName: 'close-circle' as const,
        };
      case BANNER_TYPES.WARNING:
        return {
          iconColor: '#F59E0B', // amber-500
          iconName: 'warning' as const,
        };
      case BANNER_TYPES.INFO:
      default:
        return {
          iconColor: colors.brand,
          iconName: 'information-circle' as const,
        };
    }
  };

  const bannerStyle = getBannerStyle();

  // Check if tabs are visible based on pathname
  const areTabsVisible = () => {
    const tabRoutes = ['/home', '/explore', '/workout', '/workout/explore', '/clubs', '/profile'];
    return tabRoutes.some(route => pathname === route) || pathname === '/';
  };

  // Calculate banner bottom position
  const getBannerBottomPosition = () => {
    const tabsVisible = areTabsVisible();
    
    if (!tabsVisible) {
      // No tabs visible - position near bottom of screen
      return 30;
    }
    
    if (activeWorkout && tabsVisible) {
      // Tabs visible + active workout - position above workout indicator
      // Workout indicator is at bottom: 86 (tab height) + some padding
      return 180; // Above both tabs (86) and workout indicator (~84)
    }
    
    // Only tabs visible - position above tabs
    return 90;
  };

  const handleBannerPress = () => {
    hideBanner();
  };

  const handleActionPress = () => {
    if (action?.onPress) {
      action.onPress();
    }
    hideBanner();
  };

  // Don't render if component should not be rendered
  if (!shouldRender) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: getBannerBottomPosition(),
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={handleBannerPress}
        activeOpacity={0.8}
      >
        <Ionicons 
          name={bannerStyle.iconName} 
          size={20} 
          color={bannerStyle.iconColor} 
          style={styles.icon} 
        />
        <Text style={[styles.message, action && styles.messageWithAction]} numberOfLines={2}>
          {message}
        </Text>
        {action && (
          <TouchableOpacity
            onPress={handleActionPress}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>
              {action.text}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // bottom position is now dynamic - set in component
    left: 16,
    right: 16,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.secondaryAccent,
    opacity: 0.95,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  messageWithAction: {
    marginRight: 12,
  },
  actionText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default GlobalBanner;
