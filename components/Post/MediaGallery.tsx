import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  Platform
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import ExercisesList from './ExercisesList';

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
  workoutId,
  workoutName,
  routineData,
  postUser,
  activeIndex: externalActiveIndex = 0,
  onActiveIndexChange,
}) => {
  const [activeIndex, setActiveIndex] = useState(externalActiveIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [contentItems, setContentItems] = useState<Array<{type: string; data: any}>>([]);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [mediaUrls, setMediaUrls] = useState<{[key: string]: string}>({});
  const [galleryWidth, setGalleryWidth] = useState(0);
  const flatListRef = useRef<FlatList>(null);
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



  // Cleanup: pause fullscreen video on unmount to release the decoder
  useEffect(() => {
    return () => {
      if (fullscreenVideoRef.current) {
        fullscreenVideoRef.current.getStatusAsync()
          .then((status) => {
            if (status.isLoaded) return fullscreenVideoRef.current?.pauseAsync();
          })
          .catch(() => {});
      }
    };
  }, []);

  const handleLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    setGalleryWidth(width);
  };
  


  const handleMediaPress = (item: MediaItem, index: number) => {
    const mediaUrl = mediaUrls[item.id] || item.uri;
    setSelectedItem({ ...item, uri: mediaUrl });
    setIsFullscreen(true);
    onMediaPress && onMediaPress(item, index);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    setSelectedItem(null);
    setVideoProgress(0);
    setIsVideoPlaying(true);
  };

  // Handle fullscreen video playback status updates (event-driven, no polling)
  const handleFullscreenPlaybackStatus = useCallback((status: any) => {
    if (status.isLoaded && status.durationMillis) {
      setVideoProgress(status.positionMillis / status.durationMillis);
      if ('isPlaying' in status) {
        setIsVideoPlaying(status.isPlaying);
      }
    }
  }, []);

  const togglePlayPause = async () => {
    if (!fullscreenVideoRef.current) return;
    try {
      const status = await fullscreenVideoRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (isVideoPlaying) {
          await fullscreenVideoRef.current.pauseAsync();
        } else {
          await fullscreenVideoRef.current.playAsync();
        }
        setIsVideoPlaying(!isVideoPlaying);
      }
    } catch {
      // video already deallocated
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

  const renderMediaItem = ({ item }: { item: MediaItem; index: number }) => {
    const mediaUrl = mediaUrls[item.id] || item.uri;

    return (
      <Pressable
        style={[styles.mediaItem, { width: galleryWidth }]}
        onPress={() => handleMediaPress(item, 0)}
      >
        {item.type === 'image' ? (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.media}
            resizeMode="cover"
            progressiveRenderingEnabled={true}
            fadeDuration={0}
          />
        ) : (
          // Static placeholder for videos in the feed — avoids loading the full
          // video and the memory spike it causes. Tap opens fullscreen on demand.
          <View style={styles.videoPlaceholder}>
            <IonIcon name="play-circle" size={56} color="rgba(255, 255, 255, 0.85)" />
            {item.duration != null && item.duration > 0 && (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>
                  {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')}
                </Text>
              </View>
            )}
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
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          getItemLayout={(_, index) => ({
            length: galleryWidth,
            offset: galleryWidth * index,
            index,
          })}
        />
      )}

      {renderPaginationDots()}

      {/* Fullscreen Modal — video is loaded here on demand, never in the feed */}
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
                  onPlaybackStatusUpdate={handleFullscreenPlaybackStatus}
                />
                {!isVideoPlaying && (
                  <View style={styles.playButtonOverlay}>
                    <IonIcon name="play" size={60} color="rgba(255, 255, 255, 0.8)" />
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.videoControlsContainer}>
                <View style={styles.progressBarBackground} />
                <View style={[styles.progressBar, { width: `${videoProgress * 100}%` }]} />
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
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.secondaryAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: colors.overlay,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  durationText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '600',
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

export default memo(MediaGallery);