import React, { useState, useRef, useEffect } from 'react';
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
  TouchableWithoutFeedback
} from 'react-native';
import { Video, AVPlaybackStatus, ResizeMode } from 'expo-av';
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
}

const MediaGallery: React.FC<MediaGalleryProps> = ({ media, exercises = [], onMediaPress, isDetailView, isPostVisible = true, workoutId, workoutName, routineData, postUser }) => {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
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
  const [videoMuted, setVideoMuted] = useState<{[key: string]: boolean}>({});
  const [backgroundVideoMutedBeforeFullscreen, setBackgroundVideoMutedBeforeFullscreen] = useState<boolean | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{[key: string]: Video | null}>({});
  const fullscreenVideoRef = useRef<Video | null>(null);

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



  useEffect(() => {
    // Initialize remaining times with original durations and muted states
    const times = {};
    const mutedStates = {};
    media.forEach(item => {
      if (item.type === 'video' && item.duration) {
        times[item.id] = item.duration;
      }
      if (item.type === 'video') {
        // Only set initial muted state if not already set
        if (videoMuted[item.id] === undefined) {
          mutedStates[item.id] = true; // Videos start muted by default
        }
      }
    });
    setRemainingTimes(times);
    
    // Only update muted states for new videos
    if (Object.keys(mutedStates).length > 0) {
      setVideoMuted(prev => ({ ...prev, ...mutedStates }));
    }

    // Handle video playback based on focus
    media.forEach((item, index) => {
      if (item.type === 'video') {
        const videoRef = videoRefs.current[item.id];
        if (videoRef) {
          if (index === activeIndex) {
            // Reset and play the active video, preserving mute state
            videoRef.setPositionAsync(0).then(() => {
              videoRef.setIsMutedAsync(videoMuted[item.id] ?? true).then(() => {
                videoRef.playAsync();
              });
            });
          } else {
            // Pause and reset non-active videos
            videoRef.pauseAsync().then(() => {
              videoRef.setPositionAsync(0);
            });
          }
        }
      }
    });
  }, [activeIndex, media]);

  // Handle post visibility changes - pause videos when post goes out of view
  useEffect(() => {
    media.forEach((item, index) => {
      if (item.type === 'video') {
        const videoRef = videoRefs.current[item.id];
        if (videoRef) {
          if (!isPostVisible) {
            // Pause all videos when post goes out of view or screen loses focus
            videoRef.pauseAsync();
          } else if (index === activeIndex) {
            // Resume the active video when post comes back into view and screen is focused
            videoRef.setIsMutedAsync(videoMuted[item.id] ?? true).then(() => {
              videoRef.playAsync();
            });
          }
        }
      }
    });
  }, [isPostVisible, activeIndex, media, videoMuted]);

  // Cleanup effect - pause all videos when component unmounts (navigation away)
  useEffect(() => {
    return () => {
      // Pause all videos when component unmounts
      Object.values(videoRefs.current).forEach(videoRef => {
        if (videoRef) {
          videoRef.pauseAsync().catch(() => {
            // Ignore errors during cleanup
          });
        }
      });
      
      // Also pause fullscreen video if it exists
      if (fullscreenVideoRef.current) {
        fullscreenVideoRef.current.pauseAsync().catch(() => {
          // Ignore errors during cleanup
        });
      }
    };
  }, []);

  const handleLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    setGalleryWidth(width);
  };
  


  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus, itemId: string, totalDuration?: number) => {
    if (status.isLoaded && !status.isBuffering) {
      if (totalDuration) {
        const currentPositionMillis = status.positionMillis || 0;
        const currentPositionSecs = currentPositionMillis / 1000;
        const remaining = totalDuration - currentPositionSecs;
        
        setRemainingTimes(prev => ({
          ...prev,
          [itemId]: Math.max(0, remaining)
        }));
      }
    }
  };

  const handleMediaPress = (item: MediaItem, index: number) => {
    // If opening a video in fullscreen, mute the background video to prevent audio overlap
    if (item.type === 'video') {
      const videoRef = videoRefs.current[item.id];
      if (videoRef) {
        // Store the current muted state before muting for fullscreen
        setBackgroundVideoMutedBeforeFullscreen(videoMuted[item.id] ?? true);
        // Mute the background video
        videoRef.setIsMutedAsync(true);
      }
    }
    
    setSelectedItem({
      ...item,
      uri: mediaUrls[item.id] || item.uri
    });
    setSelectedIndex(index);
    setIsFullscreen(true);
    
    // Call the parent's onMediaPress handler if needed
    onMediaPress && onMediaPress(item, index);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    
    // Resume the video in the gallery if it was playing before fullscreen
    if (selectedItem && selectedItem.type === 'video') {
      const videoRef = videoRefs.current[selectedItem.id];
      if (videoRef && isPostVisible) {
        // Small delay to ensure the modal has closed
        setTimeout(() => {
          // Restore the original muted state (before fullscreen was opened)
          const originalMutedState = backgroundVideoMutedBeforeFullscreen ?? true;
          videoRef.setIsMutedAsync(originalMutedState).then(() => {
            videoRef.playAsync();
          });
        }, 100);
      }
    }
    
    setSelectedItem(null);
    setBackgroundVideoMutedBeforeFullscreen(null);
  };

  const handleFullscreenPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsVideoPlaying(status.shouldPlay || false);
      
      if (status.durationMillis) {
        setVideoDuration(status.durationMillis / 1000);
      }
      
      if (status.positionMillis && status.durationMillis) {
        const newProgress = status.positionMillis / status.durationMillis;
        setVideoProgress(newProgress);
      }
    }
  };

  const togglePlayPause = async () => {
    if (fullscreenVideoRef.current) {
      if (isVideoPlaying) {
        await fullscreenVideoRef.current.pauseAsync();
      } else {
        await fullscreenVideoRef.current.playAsync();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  const toggleMute = async (itemId: string) => {
    const videoRef = videoRefs.current[itemId];
    if (videoRef) {
      const newMutedState = !videoMuted[itemId];
      setVideoMuted(prev => ({
        ...prev,
        [itemId]: newMutedState
      }));
      await videoRef.setIsMutedAsync(newMutedState);
    }
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
              ref={(ref) => { videoRefs.current[item.id] = ref; }}
              source={{ uri: mediaUrl }}
              style={styles.media}
              useNativeControls={false}
              resizeMode={ResizeMode.COVER}
              shouldPlay={index === activeIndex}
              isLooping={true}
              isMuted={videoMuted[item.id] ?? true}
              onPlaybackStatusUpdate={(status) => handlePlaybackStatusUpdate(status, item.id, item.duration)}
            />
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.muteButton}
              onPress={(e) => {
                e.stopPropagation();
                toggleMute(item.id);
              }}
            >
              <IonIcon 
                name={videoMuted[item.id] ? "volume-mute" : "volume-high"} 
                size={20} 
                color={colors.primaryText} 
              />
            </TouchableOpacity>
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
                  source={{ uri: selectedItem.uri }}
                  style={styles.fullscreenMedia}
                  useNativeControls={false}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={true}
                  isLooping={true}
                  progressUpdateIntervalMillis={10}
                  onPlaybackStatusUpdate={handleFullscreenPlaybackStatusUpdate}
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
  viewWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.primaryAccent,
  },
  viewWorkoutButtonText: {
    fontSize: 16,
    color: colors.brand,
    fontWeight: '600',
  },
});

export default MediaGallery;