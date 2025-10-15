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
              {/* Metric Selector Skeleton */}
        <View style={styles.metricSelectorContainer}>
          <View style={styles.metricButton}>
            <View style={styles.metricButtonIconSkeleton} />
            <View style={styles.metricButtonTextSkeleton} />
          </View>
          <View style={styles.metricButton}>
            <View style={styles.metricButtonIconSkeleton} />
            <View style={styles.metricButtonTextSkeleton} />
          </View>
          <View style={styles.metricButton}>
            <View style={styles.metricButtonIconSkeleton} />
            <View style={styles.metricButtonTextSkeleton} />
          </View>
        </View>
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
          {/* Chart border outline */}
          <View style={styles.chartBorderOutline} />
          
          {/* Vertical grid lines */}
          <View style={styles.chartVerticalLinesContainer}>
            {Array.from({ length: 13 }).map((_, index) => (
              // Skip the first and last vertical lines like in CustomLineChart
              index > 0 && index < 14 ? (
                <View key={index} style={styles.chartVerticalLine} />
              ) : null
            ))}
          </View>
          
          {/* Chart dots skeleton positioned at bottom like data points */}
          <View style={styles.chartDotsContainer}>
            {Array.from({ length: 12 }).map((_, index) => (
              <ChartDotSkeleton key={index} delay={index * 100} />
            ))}
          </View>
          
          {/* Y-axis labels skeleton (left side) */}
          <View style={styles.yAxisLabelsContainer}>
            {Array.from({ length: 3 }).map((_, index) => (
              <View key={index} style={styles.yAxisLabelSkeleton} />
            ))}
          </View>
          
          {/* X-axis labels skeleton (bottom) */}
          <View style={styles.xAxisLabelsContainer}>
            {Array.from({ length: 3 }).map((_, index) => (
              <View key={index} style={styles.xAxisLabelSkeleton} />
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
    paddingVertical: 8,
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
  // Chart border outline (like CustomLineChart)
  chartBorderOutline: {
    position: 'absolute',
    top: 20,
    left: 55,
    right: 20,
    bottom: 40,
    borderWidth: 1,
    borderColor: colors.secondaryText,
    opacity: 0.4,
    borderRadius: 0,
  },
  
  // Vertical grid lines container
  chartVerticalLinesContainer: {
    position: 'absolute',
    top: 20,
    left: 55,
    right: 20,
    bottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartVerticalLine: {
    width: 1,
    height: '100%',
    backgroundColor: colors.secondaryText,
    opacity: 0.4,
  },
  
  // Data points positioned at bottom of chart area
  chartDotsContainer: {
    position: 'absolute',
    top: 20,
    left: 55,
    right: 20,
    bottom: 40,
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
  
  // Y-axis labels (left side)
  yAxisLabelsContainer: {
    position: 'absolute',
    top: 20,
    left: 2,
    bottom: 40,
    width: 45,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  yAxisLabelSkeleton: {
    height: 10,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 2,
    width: 35,
  },
  
  // X-axis labels (bottom)
  xAxisLabelsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 75,
    right: 35,
    height: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xAxisLabelSkeleton: {
    height: 10,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 2,
    width: 30,
  },
  
  // Metric Selector Skeleton Styles
  metricSelectorContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  metricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.primaryAccent,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
  },
  metricButtonIconSkeleton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.whiteOverlay,
  },
  metricButtonTextSkeleton: {
    height: 12,
    backgroundColor: colors.whiteOverlay,
    borderRadius: 2,
    width: 50,
  },
});

export default ActivityChartSkeleton;
