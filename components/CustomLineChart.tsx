import React, { Fragment, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Animated } from 'react-native';
import Svg, { Line, Circle, Path, Text as SvgText, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { PanGestureHandler } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { colors } from '../constants/colors';

interface CustomLineChartProps {
  data: {
    labels: string[];
    datasets: Array<{
      data: number[];
      color?: (opacity?: number) => string;
      strokeWidth?: number;
    }>;
  };
  width: number;
  height: number;
  onDataPointPress?: (index: number, value: number, x: number, y: number) => void;
  onPanGesture?: (x: number) => void;
  selectedPointIndex?: number | null;
  formatYLabel?: (value: string) => string;
  withHorizontalLines?: boolean;
  withVerticalLines?: boolean;
  withDots?: boolean;
  bezier?: boolean;
  segments?: number;
  yAxisInterval?: number;
  style?: any;
}

const CustomLineChart: React.FC<CustomLineChartProps> = ({
  data,
  width,
  height,
  onDataPointPress,
  onPanGesture,
  selectedPointIndex = null,
  formatYLabel = (value) => value,
  withHorizontalLines = true,
  withVerticalLines = true,
  withDots = true,
  bezier = false,
  segments = 4,
  yAxisInterval = 1,
  style = {}
}) => {
  // Track previous selected index for haptic feedback
  const [prevSelectedIndex, setPrevSelectedIndex] = useState<number | null>(null);
  
  // Animation values for smooth Y position transitions
  const animatedYPositions = useRef<Animated.Value[]>([]);
  const [animatedPositions, setAnimatedPositions] = useState<number[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevDataRef = useRef<number[]>([]);
  
  const paddingTop = 20;
  const paddingBottom = 40;
  const paddingLeft = 55;
  const paddingRight = 20;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  const dataset = data.datasets[0];
  const values = dataset?.data || [];
  const labels = data.labels || [];
  
  // Calculate the min/max for Y position calculations
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const valueRange = maxValue - minValue || 1;

  // Initialize or update animated Y positions when data changes
  useEffect(() => {
    if (values.length === 0) return;
    
    // Calculate new Y positions for the current data
    const newYPositions = values.map((value, index) => {
      return paddingTop + chartHeight - ((value - minValue) / valueRange) * chartHeight;
    });
    
    // Check if this is a data change (not initial load)
    const isDataChange = prevDataRef.current.length > 0 && 
                        prevDataRef.current.length === values.length &&
                        prevDataRef.current.some((val, idx) => val !== values[idx]);
    
    if (animatedYPositions.current.length !== values.length) {
      // Initialize animated Y positions for new data
      animatedYPositions.current = newYPositions.map((yPos, index) => {
        const existingValue = animatedYPositions.current[index];
        if (existingValue) {
          return existingValue;
        }
        return new Animated.Value(yPos);
      });
      setAnimatedPositions([...newYPositions]);
      prevDataRef.current = [...values];
    } else if (isDataChange) {
      // Animate Y positions to new values
      setIsAnimating(true);
      
      // Set up listeners to track animated Y positions
      const currentAnimatedPositions = [...animatedPositions];
      const listeners: string[] = [];
      
      animatedYPositions.current.forEach((animValue, index) => {
        const listenerId = animValue.addListener(({ value }) => {
          currentAnimatedPositions[index] = value;
          setAnimatedPositions([...currentAnimatedPositions]);
        });
        listeners.push(listenerId);
      });
      
      const animations = newYPositions.map((newYPos, index) => {
        return Animated.timing(animatedYPositions.current[index], {
          toValue: newYPos,
          duration: 200,
          useNativeDriver: false,
        });
      });
      
      Animated.parallel(animations).start(() => {
        // Clean up listeners
        listeners.forEach((listenerId, index) => {
          animatedYPositions.current[index]?.removeListener(listenerId);
        });
        
        setIsAnimating(false);
        setAnimatedPositions([...newYPositions]);
        prevDataRef.current = [...values];
      });
    } else {
      // Update without animation for initial load
      newYPositions.forEach((yPos, index) => {
        animatedYPositions.current[index]?.setValue(yPos);
      });
      setAnimatedPositions([...newYPositions]);
      prevDataRef.current = [...values];
    }
  }, [values, minValue, maxValue, valueRange, chartHeight, paddingTop]);
  
  if (values.length === 0) {
    return (
      <View style={[styles.emptyContainer, { width, height }, style]}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }
  
  // Calculate points for the line using animated Y positions when available
  const points = values.map((value, index) => {
    const x = paddingLeft + (index / (values.length - 1)) * chartWidth;
    
    // Use animated Y position if available and currently animating, otherwise calculate normally
    let y;
    if (isAnimating && animatedPositions[index] !== undefined) {
      y = animatedPositions[index];
    } else {
      y = paddingTop + chartHeight - ((value - minValue) / valueRange) * chartHeight;
    }
    
    return { x, y, value, index };
  });
  
  // Create bezier curve path if enabled
  const createBezierPath = (points: Array<{x: number, y: number}>) => {
    if (points.length < 2) return '';
    
    let path = `M${points[0].x},${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const currentPoint = points[i];
      
      const controlPoint1X = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.5;
      const controlPoint1Y = prevPoint.y;
      const controlPoint2X = currentPoint.x - (currentPoint.x - prevPoint.x) * 0.5;
      const controlPoint2Y = currentPoint.y;
      
      path += ` C${controlPoint1X},${controlPoint1Y} ${controlPoint2X},${controlPoint2Y} ${currentPoint.x},${currentPoint.y}`;
    }
    
    return path;
  };
  
  const createLinePath = (points: Array<{x: number, y: number}>) => {
    if (points.length < 2) return '';
    let path = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L${points[i].x},${points[i].y}`;
    }
    return path;
  };
  
  const createAreaPath = (points: Array<{x: number, y: number}>) => {
    if (points.length < 2) return '';
    
    const bottomY = paddingTop + chartHeight;
    let path = `M${points[0].x},${bottomY}`;
    path += ` L${points[0].x},${points[0].y}`;
    
    if (bezier) {
      // Create bezier area path
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const currentPoint = points[i];
        
        const controlPoint1X = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.5;
        const controlPoint1Y = prevPoint.y;
        const controlPoint2X = currentPoint.x - (currentPoint.x - prevPoint.x) * 0.5;
        const controlPoint2Y = currentPoint.y;
        
        path += ` C${controlPoint1X},${controlPoint1Y} ${controlPoint2X},${controlPoint2Y} ${currentPoint.x},${currentPoint.y}`;
      }
    } else {
      // Create linear area path
      for (let i = 1; i < points.length; i++) {
        path += ` L${points[i].x},${points[i].y}`;
      }
    }
    
    // Close the path by connecting to the bottom
    path += ` L${points[points.length - 1].x},${bottomY} Z`;
    return path;
  };
  
  const linePath = bezier ? createBezierPath(points) : createLinePath(points);
  const strokeColor = dataset.color ? dataset.color(1) : colors.brand;
  const strokeWidth = dataset.strokeWidth || 2;
  
  // Calculate Y-axis labels - always show 3 labels (min, middle, max)
  const getYAxisLabels = () => {
    const labels = [];
    
    // Bottom label (min value)
    labels.push({
      value: Math.round(minValue),
      y: paddingTop + chartHeight
    });
    
    // Middle label
    const midValue = minValue + (valueRange / 2);
    labels.push({
      value: Math.round(midValue),
      y: paddingTop + chartHeight / 2
    });
    
    // Top label (max value)
    labels.push({
      value: Math.round(maxValue),
      y: paddingTop
    });
    
    return labels;
  };
  
  const yAxisLabels = getYAxisLabels();
  
  // Helper function to format duration in minutes to "(x)d (x)h (x)m" format
  const formatDuration = (minutes: number): string => {
    if (minutes === 0) return '0m';
    
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    
    const parts: string[] = [];
    
    if (days > 0) {
      parts.push(`${days}d`);
    }
    
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    
    if (mins > 0 || parts.length === 0) {
      parts.push(`${mins}m`);
    }
    
    return parts.join(' ');
  };

  const handlePress = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    
    // Find the closest point horizontally (better for vertical line interaction)
    let closestIndex = 0;
    let closestDistance = Infinity;
    
    points.forEach((point, index) => {
      const distance = Math.abs(locationX - point.x);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    
    const selectedPoint = points[closestIndex];
    if (selectedPoint && onDataPointPress) {
      // Only trigger haptic feedback if index changed
      if (closestIndex !== prevSelectedIndex) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPrevSelectedIndex(closestIndex);
      }
      
      onDataPointPress(closestIndex, selectedPoint.value, selectedPoint.x, selectedPoint.y);
    }
  };

  const handlePanMove = (event: any) => {
    const { x } = event.nativeEvent;
    
    // Find the closest point for dragging
    let closestIndex = 0;
    let closestDistance = Infinity;
    
    points.forEach((point, index) => {
      const distance = Math.abs(x - point.x);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    
    const selectedPoint = points[closestIndex];
    if (selectedPoint) {
      // Call onPanGesture to update vertical line position
      if (onPanGesture) {
        onPanGesture(selectedPoint.x);
      }
      
      // Only trigger haptic feedback and data point update if index changed
      if (closestIndex !== prevSelectedIndex) {
        // Add haptic feedback when a new point is selected during drag
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPrevSelectedIndex(closestIndex);
        
        // Update the selected point during drag
        if (onDataPointPress) {
          onDataPointPress(closestIndex, selectedPoint.value, selectedPoint.x, selectedPoint.y);
        }
      }
    }
  };
  
  return (
    <View style={[styles.container, { width, height }, style]}>
      <PanGestureHandler onGestureEvent={handlePanMove}>
        <Pressable onPress={handlePress} style={styles.chartPressable}>
        <Svg width={width} height={height}>
          {/* Gradient definitions */}
          <Defs>
            <LinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={colors.brand} stopOpacity="0.5" />
              <Stop offset="40%" stopColor={colors.brand} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={colors.brand} stopOpacity="0.2" />
            </LinearGradient>
          </Defs>
          
          {/* Chart border outline */}
          <Rect
            x={paddingLeft}
            y={paddingTop}
            width={chartWidth}
            height={chartHeight}
            fill="none"
            stroke={colors.secondaryText}
            strokeWidth={1}
            opacity={0.4}
          />
          
          {/* Horizontal grid lines */}
          {withHorizontalLines && yAxisLabels.map((label, index) => (
            index > 0 && index < yAxisLabels.length - 1 && (
              <Line
                key={`h-line-${index}`}
                x1={paddingLeft}
                y1={label.y}
                x2={paddingLeft + chartWidth}
                y2={label.y}
                stroke={colors.secondaryText}
                strokeWidth={1}
                opacity={0.4}
              />
            )
          ))}
          
          {/* Vertical grid lines */}
          {withVerticalLines && labels.map((_, index) => {
            // Hide the leftmost and rightmost vertical lines
            if (index === 0 || index === labels.length - 1) return null;
            
            const x = paddingLeft + (index / (labels.length - 1)) * chartWidth;
            return (
              <Line
                key={`v-line-${index}`}
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={paddingTop + chartHeight}
                stroke={colors.secondaryText}
                strokeWidth={1}
                opacity={0.4}
              />
            );
          })}
          
          {/* Filled area under the curve */}
          <Path
            d={createAreaPath(points)}
            fill="url(#areaGradient)"
            pointerEvents="none"
          />
          
          {/* Main line */}
          <Path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Data points */}
          {withDots && points.map((point, index) => {
            const isSelected = selectedPointIndex === index;
            const dotX = point.x;
            return (
              <Fragment key={`dot-fragment-${index}`}>
                {/* Glow effect for selected point */}
                {isSelected && (
                  <Circle
                    cx={dotX}
                    cy={point.y}
                    r={12}
                    fill={strokeColor}
                    opacity={0.25}
                  />
                )}
                {/* Main dot */}
                <Circle
                  key={`dot-${index}`}
                  cx={dotX}
                  cy={point.y}
                  r={isSelected ? 5 : 3}
                  fill={isSelected ? strokeColor : colors.background}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 2 : 1.5}
                />
              </Fragment>
            );
          })}
          
          {/* Y-axis labels */}
          {yAxisLabels.map((label, index) => (
            <SvgText
              key={`y-label-${index}`}
              x={paddingLeft - 8}
              y={label.y + 4}
              fontSize={10}
              fill={colors.secondaryText}
              textAnchor="end"
              fontFamily="System"
            >
              {formatYLabel(label.value.toString())}
            </SvgText>
          ))}
          
          {/* X-axis labels */}
          {labels.map((label, index) => {
            if (!label || index === 0) return null; // Skip empty labels and leftmost label
            const x = paddingLeft + (index / (labels.length - 1)) * chartWidth;
            return (
              <SvgText
                key={`x-label-${index}`}
                x={x}
                y={height - paddingBottom + 18}
                fontSize={10}
                fill={colors.secondaryText}
                textAnchor="middle"
                fontFamily="System"
              >
                {label}
              </SvgText>
            );
          })}

          {/* Selected metric value above selected point */}
          {selectedPointIndex !== null && points[selectedPointIndex] && (
            <SvgText
              x={points[selectedPointIndex].x}
              y={paddingTop - 8}
              fontSize={12}
              fill={colors.primaryText}
              textAnchor="middle"
              fontFamily="System"
              fontWeight="600"
            >
              {formatYLabel(Math.round(points[selectedPointIndex].value).toString())}
            </SvgText>
          )}
        </Svg>
      </Pressable>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  chartPressable: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
  },
  emptyText: {
    color: colors.secondaryText,
    fontSize: 16,
  },
});

export default CustomLineChart;
