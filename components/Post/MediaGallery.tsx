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
  Platform,
  PanResponder,
  Animated,
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
  isPostVisible = false,
  workoutId,
  workoutName,
  routineData,
  postUser,
  activeIndex: externalActiveIndex = 0,
  globalVideoMuted = true,
  onActiveIndexChange,
  onMuteToggle,
}) => {
  const [activeIndex, setActiveIndex] = useState(externalActiveIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [contentItems, setContentItems] = useState<Array<{type: string; data: any}>>([]);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPosition, setVideoPosition] = useState(0);
  const [fullscreenMuted, setFullscreenMuted] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<{[key: string]: string}>({});
  const [galleryWidth, setGalleryWidth] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const fullscreenVideoRef = useRef<Video>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubberTrackWidth, setScrubberTrackWidth] = useState(0);
  const muteIconOpacity = useRef(new Animated.Value(0)).current;
  const muteIconName = useRef<'volume-mute' | 'volume-high'>('volume-high');
  const isSeeking = useRef(false);
  const scrubberWidth = useRef(0);
  const videoDurationRef = useRef(0);
  const dismissPan = useRef(new Animated.ValueXY()).current;
  const closeFullscreenRef = useRef<() => void>(() => {});
  const inlineVideoRefs = useRef<Map<string, Video>>(new Map());

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
    setFullscreenMuted(globalVideoMuted);
    setIsFullscreen(true);
    onMediaPress && onMediaPress(item, index);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    setSelectedItem(null);
    setVideoProgress(0);
    setVideoPosition(0);
    setVideoDuration(0);
    setFullscreenMuted(false);
    dismissPan.setValue({ x: 0, y: 0 });
  };
  closeFullscreenRef.current = closeFullscreen;

  // Keep duration ref in sync for use inside PanResponder closure
  useEffect(() => { videoDurationRef.current = videoDuration; }, [videoDuration]);

  // Handle fullscreen video playback status updates (event-driven, no polling)
  const handleFullscreenPlaybackStatus = useCallback((status: any) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish) {
      setVideoProgress(0);
      setVideoPosition(0);
      fullscreenVideoRef.current?.setPositionAsync(0)
        .then(() => fullscreenVideoRef.current?.playAsync())
        .catch(() => {});
      return;
    }
    if (isSeeking.current || !status.durationMillis) return;
    setVideoDuration(status.durationMillis);
    setVideoPosition(status.positionMillis);
    setVideoProgress(status.positionMillis / status.durationMillis);
  }, []);

  const seekToPosition = useCallback(async (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    const posMs = Math.floor(clamped * videoDurationRef.current);
    setVideoProgress(clamped);
    setVideoPosition(posMs);
    if (fullscreenVideoRef.current && videoDurationRef.current > 0) {
      try {
        await fullscreenVideoRef.current.setPositionAsync(posMs);
      } catch {}
    }
  }, []);

  const seekToRef = useRef(seekToPosition);
  useEffect(() => { seekToRef.current = seekToPosition; }, [seekToPosition]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        isSeeking.current = true;
        setIsScrubbing(true);
        fullscreenVideoRef.current?.pauseAsync().catch(() => {});
        seekToRef.current(e.nativeEvent.locationX / scrubberWidth.current);
      },
      onPanResponderMove: (e) => {
        seekToRef.current(Math.max(0, e.nativeEvent.locationX) / scrubberWidth.current);
      },
      onPanResponderRelease: () => {
        isSeeking.current = false;
        setIsScrubbing(false);
        fullscreenVideoRef.current?.playAsync().catch(() => {});
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        isSeeking.current = false;
        setIsScrubbing(false);
        fullscreenVideoRef.current?.playAsync().catch(() => {});
      },
    })
  ).current;

  const dismissResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy) > 10,
      onPanResponderMove: (_, gs) => {
        dismissPan.setValue({ x: gs.dx, y: gs.dy });
      },
      onPanResponderRelease: (_, gs) => {
        const dist = Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy);
        const vel = Math.sqrt(gs.vx * gs.vx + gs.vy * gs.vy);
        if (dist > 120 || vel > 1.2) {
          const scale = 700 / Math.max(dist, 1);
          Animated.timing(dismissPan, {
            toValue: { x: gs.dx * scale, y: gs.dy * scale },
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            closeFullscreenRef.current();
            dismissPan.setValue({ x: 0, y: 0 });
          });
        } else {
          Animated.spring(dismissPan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dismissPan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
      },
    })
  ).current;

  const handleFullscreenTap = () => {
    const newMuted = !fullscreenMuted;
    setFullscreenMuted(newMuted);
    onMuteToggle?.(newMuted);
    muteIconName.current = newMuted ? 'volume-mute' : 'volume-high';
    muteIconOpacity.setValue(1);
    Animated.timing(muteIconOpacity, {
      toValue: 0,
      duration: 800,
      delay: 600,
      useNativeDriver: true,
    }).start();
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
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
    const isActiveItem = index === activeIndex && isPostVisible;

    if (item.type === 'image') {
      return (
        <Pressable
          style={[styles.mediaItem, { width: galleryWidth }]}
          onPress={() => handleMediaPress(item, index)}
        >
          <Image
            source={{ uri: mediaUrl }}
            style={styles.media}
            resizeMode="cover"
            progressiveRenderingEnabled={true}
            fadeDuration={0}
          />
        </Pressable>
      );
    }

    // Always render Video — first frame shows immediately as poster, no placeholder flash.
    // shouldPlay is gated on isActiveItem so off-screen/inactive videos are paused.
    return (
      <View style={[styles.mediaItem, { width: galleryWidth }]}>
        <View style={styles.videoContainer}>
          <Video
            ref={(v) => { if (v) inlineVideoRefs.current.set(item.id, v); else inlineVideoRefs.current.delete(item.id); }}
            style={styles.media}
            source={{ uri: mediaUrl }}
            shouldPlay={isActiveItem && !isFullscreen}
            isMuted={globalVideoMuted}
            resizeMode={ResizeMode.COVER}
            useNativeControls={false}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && status.didJustFinish && isActiveItem && !isFullscreen) {
                const v = inlineVideoRefs.current.get(item.id);
                v?.setPositionAsync(0).then(() => v.playAsync()).catch(() => {});
              }
            }}
          />
          {/* Full-area tap target to open fullscreen (below mute button) */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => handleMediaPress(item, index)}
          />
          {/* Mute toggle (on top) */}
          <TouchableOpacity
            style={styles.muteButton}
            onPress={() => onMuteToggle?.(!globalVideoMuted)}
            activeOpacity={0.8}
          >
            <IonIcon
              name={globalVideoMuted ? 'volume-mute' : 'volume-high'}
              size={18}
              color={colors.primaryText}
            />
          </TouchableOpacity>
        </View>
      </View>
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
            <Animated.View
              style={[styles.fullscreenImageWrap, { transform: [{ translateX: dismissPan.x }, { translateY: dismissPan.y }] }]}
              {...dismissResponder.panHandlers}
            >
              <Image
                source={{ uri: selectedItem.uri }}
                style={styles.fullscreenMedia}
                resizeMode="contain"
              />
            </Animated.View>
          ) : selectedItem && (
            <Animated.View
              style={[styles.fullscreenVideoContainer, { transform: [{ translateX: dismissPan.x }, { translateY: dismissPan.y }] }]}
              {...dismissResponder.panHandlers}
            >
              {/* Video */}
              <Video
                ref={fullscreenVideoRef}
                style={styles.fullscreenMedia}
                source={{ uri: selectedItem.uri }}
                shouldPlay={true}
                isMuted={fullscreenMuted}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls={false}
                onPlaybackStatusUpdate={handleFullscreenPlaybackStatus}
              />

              {/* Tap overlay — mute toggle */}
              <Pressable style={StyleSheet.absoluteFill} onPress={handleFullscreenTap} />

              {/* Mute icon in center — fades in then out on toggle */}
              <Animated.View
                style={[styles.muteIconOverlay, { opacity: muteIconOpacity }]}
                pointerEvents="none"
              >
                <View style={styles.muteIconCircle}>
                  <IonIcon name={muteIconName.current} size={36} color={colors.primaryText} />
                </View>
              </Animated.View>

              {/* Scrubber — full width, flush to bottom */}
              {(() => {
                const THUMB_R = 8;
                const thumbX = videoProgress * scrubberTrackWidth;
                const popupW = 88;
                const popupLeft = Math.max(0, Math.min(scrubberTrackWidth - popupW, thumbX - popupW / 2));
                return (
                  <View style={styles.scrubberOuter}>
                    {isScrubbing && (
                      <View style={[styles.scrubTimePopup, { left: popupLeft, width: popupW }]}>
                        <Text style={styles.scrubTimeText}>
                          {formatTime(videoPosition)} / {formatTime(videoDuration)}
                        </Text>
                      </View>
                    )}
                    <View
                      style={styles.scrubberTrack}
                      onLayout={(e) => {
                        scrubberWidth.current = e.nativeEvent.layout.width;
                        setScrubberTrackWidth(e.nativeEvent.layout.width);
                      }}
                      {...panResponder.panHandlers}
                    >
                      <View style={[styles.scrubberBar, isScrubbing && styles.scrubberBarActive]}>
                        <View style={[styles.scrubberFill, { flex: videoProgress }]} />
                        <View style={[styles.scrubberEmpty, { flex: Math.max(0, 1 - videoProgress) }]} />
                      </View>
                      {isScrubbing && (
                        <View style={[styles.scrubberThumb, { left: thumbX - THUMB_R }]} />
                      )}
                    </View>
                  </View>
                );
              })()}
            </Animated.View>
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
  muteButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: colors.overlay,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
  fullscreenImageWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: colors.overlay,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrubberOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  scrubTimePopup: {
    position: 'absolute',
    bottom: 28,
    backgroundColor: colors.overlay,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scrubTimeText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  scrubberTrack: {
    width: '100%',
    height: 28,
    justifyContent: 'center',
    position: 'relative',
  },
  scrubberBar: {
    flexDirection: 'row',
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  scrubberBarActive: {
    height: 5,
    borderRadius: 2.5,
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: colors.primaryText,
  },
  scrubberEmpty: {
    height: '100%',
    backgroundColor: colors.primaryText,
    opacity: 0.35,
  },
  scrubberThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primaryText,
    top: '50%',
    marginTop: -8,
  },

});

export default memo(MediaGallery);