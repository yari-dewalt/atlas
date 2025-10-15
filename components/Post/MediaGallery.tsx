import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  View, 
  Image, 
  Text, 
  StyleSheet, 
  Dimensions, 
  Pressable, 
  FlatList, 
  Modal, 
  StatusBar, 
  SafeAreaView, 
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import ExercisesList from './ExercisesList';
import VideoThumbnail from '../VideoThumbnail';
import { useRouter } from 'expo-router';

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  uri: string;
  duration?: number;
}

interface MediaGalleryProps {
  media: MediaItem[];
  exercises?: Array<any>; // Add exercises as optional prop
  onMediaPress: (item: MediaItem, index: number) => void;
  isDetailView?: boolean;
  isPostVisible?: boolean; // Add prop to track if post is visible
  workoutId?: string; // Add workoutId prop
  workoutName?: string; // Add workoutName prop
  routineData?: {
    id: string;
    name: string;
  };
  postUser?: {
    id: string;
    username?: string;
    name?: string;
    full_name?: string;
  };
  // State management props
  activeIndex?: number;
  globalVideoMuted?: boolean;
  onActiveIndexChange?: (index: number) => void;
  onMuteToggle?: (muted: boolean) => void;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({ 
  media, 
  exercises = [], 
  onMediaPress, 
  isDetailView, 
  isPostVisible = true, 
  workoutId, 
  workoutName, 
  routineData, 
  postUser,
  activeIndex: externalActiveIndex = 0,
  globalVideoMuted: externalGlobalVideoMuted = true,
  onActiveIndexChange,
  onMuteToggle
}) => {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(externalActiveIndex);
  const [remainingTimes, setRemainingTimes] = useState<{[key: string]: number}>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [contentItems, setContentItems] = useState<Array<{type: string; data: any}>>([]);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [mediaUrls, setMediaUrls] = useState<{[key: string]: string}>({});
  const [galleryWidth, setGalleryWidth] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{[key: string]: Video}>({});
  const fullscreenVideoRef = useRef<Video>(null);

  // Sync external state with internal state
  useEffect(() => {
    setActiveIndex(externalActiveIndex);
    // Scroll to the correct index if FlatList is available
    if (flatListRef.current && galleryWidth > 0 && contentItems.length > 0) {
      flatListRef.current.scrollToOffset({
        offset: externalActiveIndex * galleryWidth,
        animated: false
      });
    }
  }, [externalActiveIndex, galleryWidth, contentItems.length]);

  useEffect(() => {
    const processContentAndUrls = async () => {
      // Process media URLs
      const urlMap = {};
      
      if (media && media.length > 0) {
        for (const item of media) {
          // If it's already a full URL, use it as is
          if (item.uri && item.uri.startsWith('http')) {
            urlMap[item.id] = item.uri;
            continue;
          }
          
          try {
            // Extract just the filename from the path or use the whole path
            const storagePath = item.uri ? 
              (item.uri.includes('/') ? item.uri : `posts/${item.uri}`) : 
              null;
              
            if (storagePath) {
              // Get public URL from Supabase storage
              const correctPath = storagePath.split('/user-content/')[1];
              const { data } = supabase.storage
                .from('user-content')
                .getPublicUrl(correctPath);
              if (data && data.publicUrl) {
                urlMap[item.id] = data.publicUrl;
              }
            }
          } catch (error) {
            console.error('Error processing media URL:', error, item);
          }
        }
      }
      
      // Set processed URLs
      setMediaUrls(urlMap);
      
      // Create content items in the same effect
      const items = [];
      for (const mediaItem of media) {
        items.push({ type: 'media', data: mediaItem });
      }
      
      // Add exercises if available
      if (exercises && exercises.length > 0) {
        items.push({ type: 'exercises', data: exercises });
      }
      
      setContentItems(items);
    };
    
    processContentAndUrls();
  }, [media, exercises]);



  // Initialize remaining times for videos
  useEffect(() => {
    const times = {};
    media.forEach(item => {
      if (item.type === 'video' && item.duration) {
        times[item.id] = item.duration;
      }
    });
    setRemainingTimes(times);
  }, [media]);

  // Cleanup effect - pause all videos when component unmounts or media changes
  useEffect(() => {
    return () => {
      // Pause all video refs when component unmounts or media changes
      Object.values(videoRefs.current).forEach((videoRef) => {
        if (videoRef) {
          // Use a non-blocking approach to check and pause videos
          videoRef.getStatusAsync()
            .then((status) => {
              if (status.isLoaded) {
                return videoRef.pauseAsync();
              }
            })
            .catch(() => {
              // Ignore errors if video is already deallocated
            });
        }
      });
      
      // Also pause fullscreen video if it exists
      if (fullscreenVideoRef.current) {
        fullscreenVideoRef.current.getStatusAsync()
          .then((status) => {
            if (status.isLoaded) {
              return fullscreenVideoRef.current.pauseAsync();
            }
          })
          .catch(() => {
            // Ignore errors if video is already deallocated
          });
      }
      
      // Clear refs to prevent memory leaks
      videoRefs.current = {};
    };
  }, [media]); // Re-run cleanup when media changes

  const handleLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    setGalleryWidth(width);
  };
  


  const handlePlaybackStatusUpdate = async (itemId: string, status: any) => {
    if (status.isLoaded && status.durationMillis) {
      const currentPositionSecs = (status.positionMillis || 0) / 1000;
      const totalDurationSecs = status.durationMillis / 1000;
      const remaining = totalDurationSecs - currentPositionSecs;
      
      setRemainingTimes(prev => ({
        ...prev,
        [itemId]: Math.max(0, remaining)
      }));
    }
  };

  const handleMediaPress = (item: MediaItem, index: number) => {
    const mediaUrl = mediaUrls[item.id] || item.uri;
    setSelectedItem({
      ...item,
      uri: mediaUrl
    });
    setSelectedIndex(index);
    setIsFullscreen(true);
    
    // Call the parent's onMediaPress handler if needed
    onMediaPress && onMediaPress(item, index);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    setSelectedItem(null);
  };

  // Track fullscreen video progress
  useEffect(() => {
    const interval = setInterval(async () => {
      if (fullscreenVideoRef.current && selectedItem?.type === 'video') {
        try {
          const status = await fullscreenVideoRef.current.getStatusAsync();
          if (status.isLoaded && status.durationMillis) {
            setVideoDuration(status.durationMillis / 1000);
            setVideoProgress(status.positionMillis / status.durationMillis);
            if ('isPlaying' in status) {
              setIsVideoPlaying(status.isPlaying);
            }
          }
        } catch (error) {
          // Ignore errors - video might not be loaded yet or has been deallocated
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [selectedItem]);

  const togglePlayPause = async () => {
    if (fullscreenVideoRef.current) {
      try {
        // Check if video is loaded before attempting to play/pause
        const status = await fullscreenVideoRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (isVideoPlaying) {
            await fullscreenVideoRef.current.pauseAsync();
          } else {
            await fullscreenVideoRef.current.playAsync();
          }
          setIsVideoPlaying(!isVideoPlaying);
        }
      } catch (error) {
        // Ignore errors if video is already deallocated
      }
    }
  };

  const toggleMute = () => {
    const newMutedState = !externalGlobalVideoMuted;
    onMuteToggle?.(newMutedState);
  };

  const renderContentItem = ({ item, index }: { item: any; index: number }) => {
    if (item.type === 'media') {
      // Don't pass the entire array of media items, map through them instead
      return (
        renderMediaItem({ item: item.data, index })
      );
    } else if (item.type === 'exercises' && !isDetailView) {
      return (
        <View style={[styles.mediaItem, { width: galleryWidth }]}>
          <ExercisesList exercises={item.data} workoutId={workoutId} workoutName={workoutName} routineData={routineData} postUser={postUser} />
        </View>
      );
    }
    return null;
  };

  const renderMediaItem = ({ item, index }: { item: MediaItem; index: number }) => {
    const mediaUrl = mediaUrls[item.id] || item.uri;

    return (
      <Pressable
        style={[styles.mediaItem, { width: galleryWidth }]}
        onPress={() => handleMediaPress(item, index)}
      >
        {item.type === 'image' ? (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.media}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.videoContainer}>
            <Video
              ref={(ref) => {
                if (ref) {
                  videoRefs.current[item.id] = ref;
                }
              }}
              style={styles.media}
              source={{ uri: mediaUrl }}
              shouldPlay={index === activeIndex && isPostVisible}
              isLooping
              isMuted={externalGlobalVideoMuted}
              resizeMode={ResizeMode.COVER}
              useNativeControls={false}
              onPlaybackStatusUpdate={(status) => handlePlaybackStatusUpdate(item.id, status)}
            />
            <Pressable
              style={styles.muteButton}
              onPress={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
            >
              <IonIcon 
                name={externalGlobalVideoMuted ? "volume-mute" : "volume-high"} 
                size={14} 
                color={colors.primaryText} 
              />
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  };

  const renderPaginationDots = () => {
    if (contentItems.length <= 1) return null;
    
    return (
      <View style={styles.paginationContainer}>
        {contentItems.map((_, idx) => (
          <View 
            key={`dot-${idx}`} 
            style={[
              styles.paginationDot, 
              idx === activeIndex ? styles.activeDot : {}
            ]} 
          />
        ))}
      </View>
    );
  };

  const handleScroll = (event) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / galleryWidth);
    setActiveIndex(index);
    // Wait for scroll to settle before calling the callback
    if (Platform.OS === 'ios') {
      setTimeout(() => {
        onActiveIndexChange?.(index);
      }, 250);
    }
  };

  return (
    <View
      style={styles.container}
      onLayout={handleLayout}
    >
      {galleryWidth > 0 && (
        <FlatList
          ref={flatListRef}
          data={contentItems}
          renderItem={renderContentItem}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled={true}
          snapToInterval={galleryWidth}
          decelerationRate="fast"
          contentContainerStyle={styles.listContent}
          onScroll={handleScroll}
          snapToAlignment="start"
          initialScrollIndex={0}
          getItemLayout={(_, index) => ({
            length: galleryWidth,
            offset: galleryWidth * index,
            index,
          })}
        />
      )}

      {renderPaginationDots()}

      {/* Fullscreen Modal */}
      <Modal
        visible={isFullscreen}
        transparent={false}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={closeFullscreen}
      >
        <StatusBar hidden />
        <SafeAreaView style={styles.fullscreenContainer}>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={closeFullscreen}
            activeOpacity={0.7}
          >
            <IonIcon name="close" size={24} color={colors.primaryText} />
          </TouchableOpacity>
          
          {selectedItem && selectedItem.type === 'image' ? (
            <Image
              source={{ uri: selectedItem.uri }}
              style={styles.fullscreenMedia}
              resizeMode="contain"
            />
          ) : selectedItem && (
            <View style={styles.fullscreenVideoContainer}>
              <TouchableOpacity 
                style={styles.videoOverlay}
                onPress={togglePlayPause}
                activeOpacity={1}
              >
                <Video
                  ref={fullscreenVideoRef}
                  style={styles.fullscreenMedia}
                  source={{ uri: selectedItem.uri }}
                  shouldPlay={isVideoPlaying}
                  isLooping
                  isMuted={false}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls={false}
                />
                
                {!isVideoPlaying && (
                  <View style={styles.playButtonOverlay}>
                    <IonIcon name="play" size={60} color="rgba(255, 255, 255, 0.8)" />
                  </View>
                )}
              </TouchableOpacity>
              
              <View style={styles.videoControlsContainer}>
                <View style={styles.progressBarBackground} />
                <View 
                  style={[
                    styles.progressBar, 
                    { width: `${videoProgress * 100}%` }
                  ]} 
                />
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 400,
    backgroundColor: colors.primaryAccent,
  },
  listContent: {
    alignItems: 'center',
    backgroundColor: colors.primaryAccent,
  },
  mediaItem: {
    height: '100%',
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    width: '100%',
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryText,
    opacity: 0.5,
  },
  activeDot: {
    backgroundColor: colors.primaryText,
    opacity: 1,
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  muteButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fullscreen styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenMedia: {
    width: '100%',
    height: '100%',
  },
  fullscreenVideoContainer: {
    flex: 1,
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  playButtonOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 40,
    width: 80,
    height: 80,
  },
  videoControlsContainer: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    height: 3,
  },
  progressBarBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    height: 3,
    backgroundColor: 'white',
    borderRadius: 1.5,
  },

});

export default MediaGallery;