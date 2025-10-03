import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { colors } from '../constants/colors';

const ActivityChartSkeleton: React.FC = () => {
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
    <Animated.View style={[styles.container, { opacity }]}>
      {/* Selected point stats */}
      <View style={styles.selectedPointStatsContainer}>
        <View style={styles.selectedPointDateContainer}>
          <View style={styles.selectedPointDateSkeleton} />
        </View>
        
        {/* Three metrics skeleton */}
        <View style={styles.selectedPointMetricsContainer}>
          <View style={styles.metricItem}>
            <View style={styles.metricLabelSkeleton} />
            <View style={styles.metricValueSkeleton} />
          </View>
          <View style={styles.metricItem}>
            <View style={styles.metricLabelSkeleton} />
            <View style={styles.metricValueSkeleton} />
          </View>
          <View style={styles.metricItem}>
            <View style={styles.metricLabelSkeleton} />
            <View style={styles.metricValueSkeleton} />
          </View>
        </View>
      </View>
      
      {/* Chart skeleton */}
      <View style={styles.chartContainer}>
        <View style={styles.chartSkeleton}>
          {/* Chart lines skeleton */}
          <View style={styles.chartLinesSkeleton}>
            {Array.from({ length: 3 }).map((_, index) => (
              <View key={index} style={styles.chartHorizontalLine} />
            ))}
          </View>
          
          {/* Chart dots skeleton */}
          <View style={styles.chartDotsContainer}>
            {Array.from({ length: 12 }).map((_, index) => (
              <ChartDotSkeleton key={index} delay={index * 100} />
            ))}
          </View>
          
          {/* Chart labels skeleton */}
          <View style={styles.chartLabelsContainer}>
            {Array.from({ length: 3 }).map((_, index) => (
              <View key={index} style={styles.chartLabelSkeleton} />
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  
  // Selected Point Stats Skeleton
  selectedPointStatsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
  },
  selectedPointDateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -20,
    marginBottom: 12,
  },
  selectedPointDateSkeleton: {
    height: 16,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 4,
    width: 100,
  },
  selectedPointMetricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.primaryAccent,
    borderRadius: 8,
    paddingVertical: 8,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabelSkeleton: {
    height: 10,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 2,
    width: 40,
    marginBottom: 4,
  },
  metricValueSkeleton: {
    height: 14,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 4,
    width: 60,
  },
  
  // Chart Skeleton Styles
  chartContainer: {
    alignItems: 'center',
    paddingRight: 0,
  },
  chartSkeleton: {
    width: '100%',
    height: 140,
    backgroundColor: colors.background,
    borderRadius: 16,
    position: 'relative',
    marginBottom: -8,
  },
  chartLinesSkeleton: {
    position: 'absolute',
    top: 20,
    left: 55,
    right: 20,
    bottom: 40,
    justifyContent: 'space-between',
  },
  chartHorizontalLine: {
    height: 1,
    backgroundColor: colors.secondaryText,
    opacity: 0.4,
  },
  chartDotsContainer: {
    position: 'absolute',
    top: 30,
    left: 55,
    right: 20,
    bottom: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chartDotSkeleton: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
    opacity: 0.6,
  },
  chartLabelsContainer: {
    position: 'absolute',
    bottom: 22,
    left: 55,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartLabelSkeleton: {
    height: 10,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 2,
    width: 30,
  },
});

export default ActivityChartSkeleton;
