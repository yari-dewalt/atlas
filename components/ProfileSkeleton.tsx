import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { colors } from '../constants/colors';
import ActivityChartSkeleton from './ActivityChartSkeleton';

const ProfileSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Profile Header Skeleton */}
      <ProfileHeaderSkeleton />
      
      {/* Activity Section Skeleton (with chart) */}
      <ActivityChartSkeleton />
      
      {/* Menu Items Skeleton */}
      <MenuItemsSkeleton />
    </View>
  );
};

const ProfileHeaderSkeleton: React.FC = () => {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => animate());
    };

    animate();
  }, [opacity]);

  return (
    <Animated.View style={[styles.profileHeader, { opacity }]}>
      {/* Profile image and info row */}
      <View style={styles.profileHeaderFirstRow}>
        <View style={styles.profileImageSkeleton} />
        
        <View style={styles.profileInfoContainer}>
          <View style={styles.displayNameSkeleton} />
          
          <View style={styles.followersRow}>
            <View style={styles.statItem}>
              <View style={styles.statValueSkeleton} />
              <View style={styles.statLabelSkeleton} />
            </View>
            <View style={styles.statItem}>
              <View style={styles.statValueSkeleton} />
              <View style={styles.statLabelSkeleton} />
            </View>
          </View>
        </View>
      </View>
      
      {/* Follow button skeleton */}
      <View style={styles.headerButtons}>
        <View style={styles.followButtonSkeleton} />
      </View>
      
      {/* Media gallery skeleton */}
      <View style={styles.mediaGallery}>
        <View style={styles.mediaGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <MediaItemSkeleton key={index} delay={index * 50} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

interface MediaItemSkeletonProps {
  delay: number;
}

const MediaItemSkeleton: React.FC<MediaItemSkeletonProps> = ({ delay }) => {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => animate());
    };

    const timer = setTimeout(animate, delay);
    return () => clearTimeout(timer);
  }, [opacity, delay]);

  return (
    <Animated.View style={[styles.mediaItemSkeleton, { opacity }]} />
  );
};

interface ChartDotSkeletonProps {
  delay: number;
}

const ChartDotSkeleton: React.FC<ChartDotSkeletonProps> = ({ delay }) => {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => animate());
    };

    const timer = setTimeout(animate, delay);
    return () => clearTimeout(timer);
  }, [opacity, delay]);

  return (
    <Animated.View style={[styles.chartDotSkeleton, { opacity }]} />
  );
};

const MenuItemsSkeleton: React.FC = () => {
  return (
    <View style={styles.section}>
      <View style={styles.menuContainer}>
        {Array.from({ length: 3 }).map((_, index) => (
          <MenuItemSkeleton key={index} delay={index * 100} />
        ))}
      </View>
    </View>
  );
};

interface MenuItemSkeletonProps {
  delay: number;
}

const MenuItemSkeleton: React.FC<MenuItemSkeletonProps> = ({ delay }) => {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => animate());
    };

    const timer = setTimeout(animate, delay);
    return () => clearTimeout(timer);
  }, [opacity, delay]);

  return (
    <Animated.View style={[styles.menuItem, { opacity }]}>
      <View style={styles.menuItemLeft}>
        <View style={styles.menuItemIconSkeleton} />
        <View style={styles.menuItemText}>
          <View style={styles.menuItemTitleSkeleton} />
          <View style={styles.menuItemCountSkeleton} />
        </View>
      </View>
      <View style={styles.menuItemChevronSkeleton} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    gap: 6,
  },
  
  // Profile Header Skeleton Styles
  profileHeader: {
    padding: 20,
    gap: 10,
    backgroundColor: colors.primaryAccent,
  },
  profileHeaderFirstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  profileImageSkeleton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.whiteOverlay,
  },
  profileInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  displayNameSkeleton: {
    height: 18,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 4,
    width: '60%',
    marginBottom: 8,
  },
  followersRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 40,
    marginTop: 8,
  },
  statItem: {
    alignItems: 'flex-start',
    gap: 4,
  },
  statValueSkeleton: {
    height: 16,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 4,
    width: 30,
  },
  statLabelSkeleton: {
    height: 12,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 4,
    width: 50,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  followButtonSkeleton: {
    width: 100,
    height: 34,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 10,
    marginBottom: -6,
  },
  
  // Media Gallery Skeleton Styles
  mediaGallery: {
    marginTop: 16,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  mediaItemSkeleton: {
    width: '23.5%',
    aspectRatio: 1,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 8,
  },
  
  // Activity Chart Skeleton Styles
  section: {
    backgroundColor: colors.primaryAccent,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  activityTitleSkeleton: {
    height: 20,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 4,
    width: 80,
  },
  activityControls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButtonSkeleton: {
    height: 28,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 8,
    width: 90,
  },
  selectedPointStatsContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
    backgroundColor: colors.primaryAccent,
  },
  selectedPointDateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedPointDateSkeleton: {
    height: 14,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 4,
    width: 70,
  },
  selectedPointValueSkeleton: {
    height: 16,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 4,
    width: 60,
  },
  chartContainer: {
    alignItems: 'center',
    paddingRight: 0,
  },
  chartSkeleton: {
    width: Dimensions.get('window').width,
    height: 220,
    backgroundColor: colors.primaryAccent,
    borderRadius: 16,
    position: 'relative',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 20,
  },
  chartLinesSkeleton: {
    position: 'absolute',
    top: 40,
    left: 55,
    right: 20,
    bottom: 60,
    justifyContent: 'space-between',
  },
  chartHorizontalLine: {
    height: 1,
    backgroundColor: colors.whiteOverlay,
    opacity: 0.3,
  },
  chartDotsContainer: {
    position: 'absolute',
    top: 50,
    left: 65,
    right: 30,
    bottom: 70,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chartDotSkeleton: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.whiteOverlay,
  },
  chartLabelsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 55,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartLabelSkeleton: {
    height: 12,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 4,
    width: 40,
  },
  
  // Menu Items Skeleton Styles
  menuContainer: {
    padding: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIconSkeleton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.whiteOverlay,
  },
  menuItemText: {
    marginLeft: 16,
  },
  menuItemTitleSkeleton: {
    height: 14,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 4,
    width: 80,
    marginBottom: 6,
  },
  menuItemCountSkeleton: {
    height: 12,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 4,
    width: 20,
  },
  menuItemChevronSkeleton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.whiteOverlay,
  },
});

export default ProfileSkeleton;
