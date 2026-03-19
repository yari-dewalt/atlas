import React, { useState, useRef, useEffect } from "react";
import { 
  StyleSheet, 
  View, 
  AppState, 
  Text, 
  Pressable, 
  FlatList, 
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent, 
  TouchableOpacity,
  Image
} from "react-native";
import { supabase } from "../../lib/supabase";
import { colors } from "../../constants/colors";
import { useRouter } from "expo-router";

// Get screen dimensions for sizing
const { width } = Dimensions.get('window');

// Sample data for carousel
const previewData = [
  {
    id: '1',
    bgColor: '#6A4C93', // Fallback color
    backgroundImage: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2340&q=80',
    screenshot: require('../../assets/screenshots/live_workout.png'),
    text: 'Log your workouts.' // Live workout image
  },
  {
    id: '2',
    bgColor: '#1982C4', // Fallback color
    backgroundImage: 'https://images.unsplash.com/photo-1549476464-37392f717541?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2087&q=80',
    screenshot: require('../../assets/screenshots/profile.png'),
    text: 'Connect with friends.' // Profile image
  },
  {
    id: '3',
    bgColor: '#8AC926', // Fallback color
    backgroundImage: 'https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1851&q=80',
    screenshot: require('../../assets/screenshots/post.png'),
    text: 'Share your experiences.' // Post image
  },
  {
    id: '4',
    bgColor: '#FFCA3A', // Fallback color
    backgroundImage: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
    screenshot: require('../../assets/screenshots/workout_details_2.png'),
    text: 'Track your progress.' // Workout details image
  },
];

AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export default function Auth() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const flatListRef = useRef<FlatList>(null);
  const autoScrollIntervalRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);
  const [userScrolling, setUserScrolling] = useState(false);

  const updateActiveIndex = (index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
  };
  
  // Create wrapped data for infinite scrolling
  const wrappedData = [
    previewData[previewData.length - 1], // Add last item at beginning
    ...previewData,
    previewData[0] // Add first item at end
  ];
  
  // Set up auto-rotation
  useEffect(() => {
    // Start auto-rotation
    startAutoRotation();
    
    // Clean up interval on component unmount
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
      }
    };
  }, []);

  // Initial scroll to first real item (index 1)
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: 1,
        animated: false
      });
    }, 100);
  }, []);
  
  // Function to start auto-rotation
  const startAutoRotation = () => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
    }

    autoScrollIntervalRef.current = setInterval(() => {
      if (flatListRef.current) {
        const current = activeIndexRef.current;
        const nextIndex = (current + 1) % previewData.length;
        isAutoScrollingRef.current = true;

        if (nextIndex === 0 && current === previewData.length - 1) {
          // Wrap: scroll to duplicate-first at the end, then jump back
          flatListRef.current.scrollToIndex({
            index: wrappedData.length - 1,
            animated: true
          });
          updateActiveIndex(0);
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: 1, animated: false });
            isAutoScrollingRef.current = false;
          }, 400);
        } else {
          flatListRef.current.scrollToIndex({
            index: nextIndex + 1,
            animated: true
          });
          updateActiveIndex(nextIndex);
          setTimeout(() => { isAutoScrollingRef.current = false; }, 350);
        }
      }
    }, 3000);
  };
  
  // Handle when user begins scrolling
  const handleScrollBegin = () => {
    setUserScrolling(true);
    
    // Optionally pause auto-rotation while user is interacting
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
    }
  };
  
  // Handle when user ends scrolling
  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    handleMomentumScrollEnd(event);
  };
  
  // Handle scroll events — only track position during user-initiated drags
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isAutoScrollingRef.current) return;
    const scrollPosition = event.nativeEvent.contentOffset.x;
    let index = Math.round(scrollPosition / width);
    if (index === 0) {
      index = previewData.length;
    } else if (index === wrappedData.length - 1) {
      index = 0;
    } else {
      index = index - 1;
    }
    updateActiveIndex(index % previewData.length);
  };

  // Handle end of scroll — settle index and restart auto-rotation
  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setUserScrolling(false);
    isAutoScrollingRef.current = false;
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);

    if (index === 0) {
      flatListRef.current?.scrollToIndex({ index: wrappedData.length - 2, animated: false });
      updateActiveIndex(previewData.length - 1);
    } else if (index === wrappedData.length - 1) {
      flatListRef.current?.scrollToIndex({ index: 1, animated: false });
      updateActiveIndex(0);
    } else {
      updateActiveIndex(index - 1);
    }

    startAutoRotation();
  };
  
  // Render each preview item
  const renderItem = ({ item, index }: { item: any, index: number }) => {
    return (
      <View style={styles.previewItem}>
        <Image 
          source={{ uri: item.backgroundImage }}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        <View style={styles.backgroundOverlay} />
        <Image 
          source={require('../../assets/logo/word.png')}
          style={styles.logoImage}
        />
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
    <View style={styles.container}>
      <View style={styles.previewSwiper}>
        <FlatList
          ref={flatListRef}
          data={wrappedData}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onScrollEndDrag={handleMomentumScrollEnd}
          onScrollBeginDrag={handleScrollBegin}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          initialScrollIndex={1}
        />
        
      </View>

      <View style={styles.captionArea}>
        <Text style={styles.captionText} allowFontScaling={false}>
          {previewData[activeIndex].text}
        </Text>
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

      <View style={styles.bottomSection}>
        <TouchableOpacity
                activeOpacity={0.5} 
          style={styles.joinButton}
          onPress={() => router.push("/(auth)/signup")}
        >
          <Text style={styles.joinButtonText} allowFontScaling={false}>Join for free</Text>
        </TouchableOpacity>
        <TouchableOpacity
                activeOpacity={0.5} 
          style={styles.loginButton}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.loginButtonText} allowFontScaling={false}>Log in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: '100%',
  },
  headerText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: colors.primaryText,
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 10,
  },
  logoImage: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    height: 60,
    width: '60%',
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  previewSwiper: {
    flexGrow: 3,
    height: '68%',
    width: '100%',
    display: "flex",
    flexDirection: "column",
    backgroundColor: colors.background,
  },
  previewItem: {
    width,
    height: '100%',
  },
  backgroundImage: {
    width: '100%',
    height: '90%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '68%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Dark overlay for better text readability
  },
  foregroundImageContainer: {
    borderWidth: 3,
    borderColor: colors.secondaryText,
    width: '55%',
    height: '72%',
    position: 'absolute',
    alignSelf: 'center',
    top: '28%',
    zIndex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  foregroundImage: {
    width: '100%',
    height: '108%',
    top: '-6%',
  },
  captionArea: {
    width: '100%',
    height: '10%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 16,
  },
  captionText: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.primaryText,
    textAlign: 'center',
  },
  bottomSection: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: colors.background,
    width: '100%',
    height: '20%',
    paddingTop: 10,
  },
  joinButton: {
    backgroundColor: colors.brand,
    color: colors.primaryText,
    width: '92%',
    minHeight: 48,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButtonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: colors.background,
    color: colors.primaryText,
    width: '92%',
    minHeight: 48,
    paddingVertical: 10,
    borderRadius: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: colors.brand,
    fontWeight: 'bold',
    fontSize: 16,
  },
  indexContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 0,
  },
  indexMarker: {
    borderRadius: 50, 
    backgroundColor: colors.secondaryText,
    width: 6,
    height: 6,
  },
  indexMarkerActive: {
    backgroundColor: colors.brand,
    width: 6,
    height: 6,
  }
});