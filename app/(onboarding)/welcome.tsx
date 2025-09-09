import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../constants/colors';
import { useOnboardingStore } from '../../stores/onboardingStore';

// Get screen dimensions for sizing
const { width } = Dimensions.get('window');

// Sample data for carousel
const previewData = [
  {
    id: '1',
    backgroundImage: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2340&q=80',
    screenshot: require('../../assets/screenshots/live_workout.png'),
    text: 'Log your workouts'
  },
  {
    id: '2',
    backgroundImage: 'https://images.unsplash.com/photo-1549476464-37392f717541?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2087&q=80',
    screenshot: require('../../assets/screenshots/profile.png'),
    text: 'Connect with friends'
  },
  {
    id: '3',
    backgroundImage: 'https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1851&q=80',
    screenshot: require('../../assets/screenshots/post.png'),
    text: 'Share your experiences'
  },
  {
    id: '4',
    backgroundImage: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
    screenshot: require('../../assets/screenshots/workout_details_2.png'),
    text: 'Track your progress'
  },
];

export default function Welcome() {
  const router = useRouter();
  const { setInOnboardingFlow } = useOnboardingStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const autoScrollIntervalRef = useRef<number | null>(null);
  const [userScrolling, setUserScrolling] = useState(false);

  // Create wrapped data for infinite scrolling
  const wrappedData = [
    previewData[previewData.length - 1], // Add last item at beginning
    ...previewData,
    previewData[0] // Add first item at end
  ];

  // Set up auto-rotation
  useEffect(() => {
    startAutoRotation();
    
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
      }
    };
  }, []);

  // Initial scroll to first real item
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: 1,
        animated: false
      });
    }, 100);
  }, []);

  const startAutoRotation = () => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
    }
    
    autoScrollIntervalRef.current = setInterval(() => {
      if (!userScrolling && flatListRef.current) {
        const nextIndex = (activeIndex + 1) % previewData.length;
        
        if (nextIndex === 0 && activeIndex === previewData.length - 1) {
          flatListRef.current.scrollToIndex({
            index: wrappedData.length - 1,
            animated: true
          });
          
          setTimeout(() => {
            flatListRef.current.scrollToIndex({
              index: 1,
              animated: false
            });
            setActiveIndex(0);
          }, 400);
        } else {
          flatListRef.current.scrollToIndex({
            index: nextIndex + 1,
            animated: true
          });
          
          setActiveIndex(nextIndex);
        }
      }
    }, 3000);
  };

  const handleScrollBegin = () => {
    setUserScrolling(true);
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    let index = Math.round(scrollPosition / width);
    
    if (index === 0) {
      index = previewData.length;
    } else if (index === wrappedData.length - 1) {
      index = 0;
    } else {
      index = index - 1;
    }
    
    setActiveIndex(index % previewData.length);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setUserScrolling(false);
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    
    if (index === 0) {
      flatListRef.current?.scrollToIndex({
        index: wrappedData.length - 2,
        animated: false
      });
    } else if (index === wrappedData.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: 1,
        animated: false
      });
    }

    startAutoRotation();
  };

  const handleGetStarted = () => {
    setInOnboardingFlow(true);
    router.push('/(onboarding)/username');
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    return (
      <View style={styles.previewItem}>
        <View style={styles.backgroundOverlay} />
        <Text style={styles.itemHeader}>{item.text}</Text>
        <View style={styles.foregroundImageContainer}>
          <Image 
            source={item.screenshot}
            style={styles.foregroundImage}
            resizeMode="cover"
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to Atlas!</Text>
        <Text style={styles.subtitle}>
          Let's get you set up to start tracking your fitness journey
        </Text>
      </View>

      {/* Carousel */}
      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={wrappedData}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBegin}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          initialScrollIndex={1}
        />
        
        <View style={styles.indexContainer}>
          {previewData.map((_, index) => (
            <View 
              key={index}
              style={[
                styles.indexMarker,
                activeIndex === index && styles.indexMarkerActive
              ]} 
            />
          ))}
        </View>
      </View>

      {/* Bottom Button */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.getStartedButton}
          onPress={handleGetStarted}
        >
          <Text style={styles.getStartedButtonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  progressSection: {
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.secondaryText,
    opacity: 0.3,
    marginBottom: 4,
  },
  activeDot: {
    backgroundColor: colors.brand,
    opacity: 1,
  },
  progressLabel: {
    fontSize: 10,
    color: colors.secondaryText,
    textAlign: 'center',
  },
  activeLabel: {
    color: colors.brand,
    fontWeight: '600',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.secondaryText,
    opacity: 0.3,
    marginHorizontal: 8,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.secondaryText,
    textAlign: 'center',
    lineHeight: 24,
  },
  carouselContainer: {
    flex: 1,
    width: '100%',
  },
  previewItem: {
    width,
    height: '100%',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  itemHeader: {
    position: 'absolute',
    top: '5%',
    fontSize: 28,
    fontWeight: '400',
    color: colors.primaryText,
    textAlign: 'center',
    zIndex: 2,
    width: '100%',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  foregroundImageContainer: {
    borderWidth: 2,
    borderColor: colors.secondaryText,
    width: '60%',
    height: '70%',
    position: 'absolute',
    alignSelf: 'center',
    top: '18%',
    zIndex: 10,
    borderRadius: 16,
    overflow: 'hidden',
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  foregroundImage: {
    width: '100%',
    height: '125%',
    top: '0%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 1,
  },
  indexContainer: {
    position: 'absolute',
    bottom: '5%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  indexMarker: {
    borderRadius: 50,
    backgroundColor: colors.secondaryText,
    width: 6,
    height: 6,
    opacity: 0.5,
  },
  indexMarkerActive: {
    backgroundColor: colors.primaryText,
    opacity: 1,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
  },
  getStartedButton: {
    backgroundColor: colors.brand,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
});
