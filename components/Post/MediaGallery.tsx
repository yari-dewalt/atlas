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
  TouchableWithoutFeedback
} from 'react-native';
import { VideoView, useVideoPlayer, VideoSource } from 'expo-video';
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
  const [globalVideoMuted, setGlobalVideoMuted] = useState<boolean>(true); // Global mute state for all videos
  const [backgroundVideoMutedBeforeFullscreen, setBackgroundVideoMutedBeforeFullscreen] = useState<boolean | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const videoPlayers = useRef<{[key: string]: any}>({});
  const fullscreenVideoPlayer = useVideoPlayer('', (player) => {
    player.loop = true;
    player.muted = false;
  });

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



  // Create video players for each video item (only depend on media URLs, not mute state)
  const videoPlayersList = media.filter(item => item.type === 'video').map(item => {
    const mediaUrl = mediaUrls[item.id] || item.uri;
    return {
      id: item.id,
      player: useVideoPlayer(mediaUrl || '', (player) => {
        player.loop = true;
        player.muted = true; // Start muted, will be updated separately
      })
    };
  });

  // Update the ref with current players
  useEffect(() => {
    const playersMap = {};
    videoPlayersList.forEach(({ id, player }) => {
      playersMap[id] = player;
    });
    videoPlayers.current = playersMap;
  }, [videoPlayersList]);

  useEffect(() => {
    // Initialize remaining times with original durations
    const times = {};
    media.forEach(item => {
      if (item.type === 'video' && item.duration) {
        times[item.id] = item.duration;
      }
    });
    setRemainingTimes(times);

    // Handle video playback based on focus
    media.forEach((item, index) => {
      if (item.type === 'video') {
        const player = videoPlayers.current[item.id];
        if (player) {
          if (index === activeIndex && isPostVisible) {
            // Reset and play the active video, using global mute state
            player.currentTime = 0;
            player.muted = globalVideoMuted;
            player.play();
          } else {
            // Pause non-active videos
            player.pause();
          }
        }
      }
    });
  }, [activeIndex, media, isPostVisible]); // Removed globalVideoMuted from dependencies

  // Separate effect to handle mute state changes without restarting videos
  useEffect(() => {
    media.forEach((item, index) => {
      if (item.type === 'video') {
        const player = videoPlayers.current[item.id];
        if (player) {
          // Only update mute state without affecting playback position
          player.muted = globalVideoMuted;
        }
      }
    });
  }, [globalVideoMuted]);

  // Handle post visibility changes - pause videos when post goes out of view
  useEffect(() => {
    media.forEach((item, index) => {
      if (item.type === 'video') {
        const player = videoPlayers.current[item.id];
        if (player) {
          if (!isPostVisible) {
            // Pause all videos when post goes out of view or screen loses focus
            player.pause();
          } else if (index === activeIndex) {
            // Resume the active video when post comes back into view and screen is focused
            player.muted = globalVideoMuted;
            player.play();
          }
        }
      }
    });
  }, [isPostVisible, activeIndex, media, globalVideoMuted]);

  // Cleanup effect - pause all videos when component unmounts (navigation away)
  useEffect(() => {
    return () => {
      // Pause all videos when component unmounts
      Object.values(videoPlayers.current).forEach(player => {
        if (player) {
          try {
            player.pause();
          } catch (error) {
            // Ignore errors if player is already deallocated
          }
        }
      });
      
      // Also pause fullscreen video if it exists
      if (fullscreenVideoPlayer) {
        try {
          fullscreenVideoPlayer.pause();
        } catch (error) {
          // Ignore errors if player is already deallocated
        }
      }
    };
  }, []);

  const handleLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    setGalleryWidth(width);
  };
  


  const handlePlaybackStatusUpdate = (itemId: string, totalDuration?: number) => {
    const player = videoPlayers.current[itemId];
    if (player && totalDuration) {
      const currentPositionSecs = player.currentTime || 0;
      const remaining = totalDuration - currentPositionSecs;
      
      setRemainingTimes(prev => ({
        ...prev,
        [itemId]: Math.max(0, remaining)
      }));
    }
  };

  const handleMediaPress = (item: MediaItem, index: number) => {
    // If opening a video in fullscreen, mute the background video to prevent audio overlap
    if (item.type === 'video') {
      const player = videoPlayers.current[item.id];
      if (player) {
        // Store the current muted state before muting for fullscreen
        setBackgroundVideoMutedBeforeFullscreen(globalVideoMuted);
        // Mute the background video
        player.muted = true;
      }
    }
    
    const mediaUrl = mediaUrls[item.id] || item.uri;
    setSelectedItem({
      ...item,
      uri: mediaUrl
    });
    setSelectedIndex(index);
    
    // Set up fullscreen player
    if (item.type === 'video') {
      fullscreenVideoPlayer.replace(mediaUrl);
      fullscreenVideoPlayer.muted = false;
      // Auto-play the video when entering fullscreen
      setTimeout(() => {
        try {
          fullscreenVideoPlayer.play();
        } catch (error) {
          // Ignore errors if player is already deallocated
        }
      }, 100);
    }
    
    setIsFullscreen(true);
    
    // Call the parent's onMediaPress handler if needed
    onMediaPress && onMediaPress(item, index);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    
    // Resume the video in the gallery if it was playing before fullscreen
    if (selectedItem && selectedItem.type === 'video') {
      const player = videoPlayers.current[selectedItem.id];
      if (player && isPostVisible) {
        // Small delay to ensure the modal has closed
        setTimeout(() => {
          // Restore the original muted state (before fullscreen was opened)
          const originalMutedState = backgroundVideoMutedBeforeFullscreen ?? true;
          player.muted = originalMutedState;
          if (media.findIndex(item => item.id === selectedItem.id) === activeIndex) {
            player.play();
          }
        }, 100);
      }
    }
    
    // Pause fullscreen video
    fullscreenVideoPlayer.pause();
    
    setSelectedItem(null);
    setBackgroundVideoMutedBeforeFullscreen(null);
  };

  // Track fullscreen video progress
  useEffect(() => {
    const interval = setInterval(() => {
      if (fullscreenVideoPlayer && selectedItem?.type === 'video') {
        const duration = fullscreenVideoPlayer.duration || 0;
        const currentTime = fullscreenVideoPlayer.currentTime || 0;
        
        setVideoDuration(duration);
        if (duration > 0) {
          setVideoProgress(currentTime / duration);
        }
        setIsVideoPlaying(fullscreenVideoPlayer.playing);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [selectedItem]);

  const togglePlayPause = async () => {
    if (fullscreenVideoPlayer) {
      try {
        if (isVideoPlaying) {
          fullscreenVideoPlayer.pause();
        } else {
          fullscreenVideoPlayer.play();
        }
        setIsVideoPlaying(!isVideoPlaying);
      } catch (error) {
        // Ignore errors if player is already deallocated
      }
    }
  };

  const toggleMute = async (itemId: string) => {
    const player = videoPlayers.current[itemId];
    if (player) {
      const newMutedState = !globalVideoMuted;
      setGlobalVideoMuted(newMutedState);
      
      // Only update the mute state without affecting playback
      Object.values(videoPlayers.current).forEach(player => {
        if (player) {
          player.muted = newMutedState;
        }
      });
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
            <VideoView
              player={videoPlayers.current[item.id]}
              style={styles.media}
              nativeControls={false}
              contentFit="cover"
            />
            <Pressable
              style={styles.muteButton}
              onPress={(e) => {
                e.stopPropagation();
                toggleMute(item.id);
              }}
            >
              <IonIcon 
                name={globalVideoMuted ? "volume-mute" : "volume-high"} 
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
                <VideoView
                  player={fullscreenVideoPlayer}
                  style={styles.fullscreenMedia}
                  nativeControls={false}
                  contentFit="contain"
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