import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, Pressable, SafeAreaView, Modal, StatusBar, TouchableOpacity, Image } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { colors } from '../../../../../constants/colors';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import CachedImage from '../../../../../components/CachedImage';
import VideoThumbnail from '../../../../../components/VideoThumbnail';
import MediaSkeleton from '../../../../../components/MediaSkeleton';
import { supabase } from '../../../../../lib/supabase';
import { Video, AVPlaybackStatus, ResizeMode } from 'expo-av';
import { VisibilitySensor } from '@futurejj/react-native-visibility-sensor';

const { width, height } = Dimensions.get('window');

type ViewMode = 'grid' | 'list';

export default function MediaScreen() {
  const router = useRouter();
  const { userId, startIndex = '0', mediaId } = useLocalSearchParams();
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(parseInt(startIndex as string));
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [videoMuted, setVideoMuted] = useState<{[key: string]: boolean}>({});
  const [backgroundVideoMutedBeforeFullscreen, setBackgroundVideoMutedBeforeFullscreen] = useState<boolean | null>(null);
  const [processedMediaCache, setProcessedMediaCache] = useState<{[key: string]: any}>({});
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [visibleVideos, setVisibleVideos] = useState<Set<string>>(new Set()); // Track which videos are visible
  const flatListRef = useRef<FlatList>(null);
  const gridListRef = useRef<FlatList>(null);
  const fullscreenVideoRef = useRef<Video | null>(null);
  const videoRefs = useRef<{[key: string]: Video | null}>({});

  useEffect(() => {
    if (userId) {
      fetchAllMedia(userId as string);
    }
  }, [userId]);

  // Effect to find the correct index when mediaId is provided
  useEffect(() => {
    if (mediaId && media.length > 0) {
      const index = media.findIndex(item => item.id === mediaId);
      if (index !== -1) {
        setCurrentIndex(index);
        setShouldAutoScroll(true); // Flag that we need to auto-scroll
      }
    }
  }, [mediaId, media]);

  useEffect(() => {
    // Only auto-scroll when we have the shouldAutoScroll flag set
    if (shouldAutoScroll && media.length > 0 && currentIndex < media.length && viewMode === 'list') {
      const timeout = setTimeout(() => {
        if (flatListRef.current && currentIndex >= 0) {
          try {
            flatListRef.current.scrollToIndex({ 
              index: currentIndex, 
              animated: false, // Don't animate for better UX
              viewPosition: 0.5 // Center the item in view
            });
          } catch (error) {
            // If scrollToIndex fails, use scrollToOffset as fallback
            console.warn('scrollToIndex failed, using fallback');
            const ESTIMATED_ITEM_HEIGHT = 400;
            flatListRef.current.scrollToOffset({
              offset: currentIndex * ESTIMATED_ITEM_HEIGHT,
              animated: false
            });
          }
        }
        setShouldAutoScroll(false); // Reset the flag after scrolling
      }, 200); // Increased timeout for better reliability
      
      return () => clearTimeout(timeout);
    }
  }, [shouldAutoScroll, currentIndex, media, viewMode]);

  // Separate effect for view mode changes (grid to list)
  useEffect(() => {
    // Only auto-scroll when switching from grid to list view
    if (media.length > 0 && currentIndex < media.length && viewMode === 'list' && !mediaId) {
      const timeout = setTimeout(() => {
        if (flatListRef.current && currentIndex > 0) {
          flatListRef.current.scrollToIndex({ 
            index: currentIndex, 
            animated: false 
          });
        }
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [viewMode]); // Only trigger when view mode changes

  // Initialize video muted states when media loads
  useEffect(() => {
    const mutedStates = {};
    media.forEach(item => {
      if (item.type === 'video') {
        mutedStates[item.id] = true; // Videos start muted by default
      }
    });
    setVideoMuted(mutedStates);
  }, [media]);

  // Handle video playback based on visible videos
  useEffect(() => {
    if (viewMode === 'list') {
      media.forEach((item) => {
        if (item.type === 'video') {
          const videoRef = videoRefs.current[item.id];
          if (videoRef) {
            if (visibleVideos.has(item.id)) {
              // Play the visible video
              videoRef.setIsMutedAsync(videoMuted[item.id] ?? true).then(() => {
                videoRef.playAsync();
              });
            } else {
              // Pause and reset non-visible videos
              videoRef.pauseAsync().then(() => {
                videoRef.setPositionAsync(0);
              });
            }
          }
        }
      });
    } else {
      // Pause all videos when in grid view
      media.forEach(item => {
        if (item.type === 'video') {
          const videoRef = videoRefs.current[item.id];
          if (videoRef) {
            videoRef.pauseAsync();
          }
        }
      });
    }
  }, [visibleVideos, media, viewMode]); // Use visibleVideos instead of playingVideoIndex

  // Handle mute state changes separately to avoid restarting videos
  useEffect(() => {
    if (viewMode === 'list') {
      media.forEach((item) => {
        if (item.type === 'video' && visibleVideos.has(item.id)) {
          const videoRef = videoRefs.current[item.id];
          if (videoRef) {
            // Only update mute state without affecting playback
            videoRef.setIsMutedAsync(videoMuted[item.id] ?? true);
          }
        }
      });
    }
  }, [videoMuted, visibleVideos, media, viewMode]); // Use visibleVideos instead of playingVideoIndex

  // Cleanup effect - pause all videos when component unmounts
  useEffect(() => {
    return () => {
      Object.values(videoRefs.current).forEach(videoRef => {
        if (videoRef) {
          videoRef.pauseAsync().catch(() => {
            // Ignore errors during cleanup
          });
        }
      });
    };
  }, []);

  const fetchAllMedia = async (profileId: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          created_at,
          description,
          post_media(
            id,
            storage_path,
            media_type,
            width,
            height,
            duration,
            order_index
          )
        `)
        .eq('user_id', profileId)
        .not('post_media', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Flatten media from all posts and sort by creation date
      const allMedia: any[] = [];
      const newProcessedCache = { ...processedMediaCache };
      
      data?.forEach(post => {
        post.post_media?.forEach((media: any) => {
          let processedUri = media.storage_path;
          
          // Check cache first
          if (newProcessedCache[media.id]) {
            processedUri = newProcessedCache[media.id].uri;
          } else {
            // Process URL if it's not already a full URL
            if (!media.storage_path.startsWith('http')) {
              try {
                const { data: urlData } = supabase.storage
                  .from('user-content')
                  .getPublicUrl(media.storage_path);
                if (urlData && urlData.publicUrl) {
                  processedUri = urlData.publicUrl;
                }
              } catch (error) {
                console.error('Error processing media URL:', error);
              }
            }
          }
          
          const mediaItem = {
            id: media.id,
            uri: processedUri,
            type: media.media_type,
            width: media.width,
            height: media.height,
            duration: media.duration,
            order_index: media.order_index,
            post_id: post.id,
            post_description: post.description,
            created_at: post.created_at
          };
          
          // Cache the processed item
          newProcessedCache[media.id] = mediaItem;
          allMedia.push(mediaItem);
        });
      });
      
      // Update cache
      setProcessedMediaCache(newProcessedCache);
      
      // Sort by post creation date
      allMedia.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setMedia(allMedia);
    } catch (err) {
      console.error('Error fetching all media:', err);
      // If there's an error fetching real data, set empty array
      setMedia([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMediaPress = useCallback((item: any) => {
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
    
    setSelectedItem(item);
    setIsFullscreen(true);
  }, [videoMuted]);

  const closeFullscreen = () => {
    setIsFullscreen(false);
    
    // Resume the video in the list view if it was playing before fullscreen
    if (selectedItem && selectedItem.type === 'video') {
      const videoRef = videoRefs.current[selectedItem.id];
      if (videoRef && viewMode === 'list') {
        // Small delay to ensure the modal has closed
        setTimeout(() => {
          // Restore the original muted state (before fullscreen was opened)
          const originalMutedState = backgroundVideoMutedBeforeFullscreen ?? true;
          videoRef.setIsMutedAsync(originalMutedState).then(() => {
            // Only play if this video is currently visible
            if (visibleVideos.has(selectedItem.id)) {
              videoRef.playAsync();
            }
          });
        }, 100);
      }
    }
    
    setSelectedItem(null);
    setBackgroundVideoMutedBeforeFullscreen(null);
    setVideoProgress(0);
    setVideoDuration(0);
    setIsVideoPlaying(true);
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

  const toggleMute = useCallback(async (itemId: string) => {
    const videoRef = videoRefs.current[itemId];
    if (videoRef) {
      const newMutedState = !videoMuted[itemId];
      setVideoMuted(prev => ({
        ...prev,
        [itemId]: newMutedState
      }));
      await videoRef.setIsMutedAsync(newMutedState);
    }
  }, [videoMuted]);

  // Handle video visibility changes
  const handleVideoVisibilityChange = useCallback((itemId: string, isVisible: boolean) => {
    setVisibleVideos(prev => {
      const newSet = new Set(prev);
      if (isVisible) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  }, []);

  const renderListMediaItem = useCallback(({ item, index }: { item: any, index: number }) => {
    // Use fixed height like MediaGallery component
    const itemHeight = 400;
    
    return (
      <View style={styles.listMediaContainer}>
        <TouchableOpacity
                activeOpacity={0.5} 
          style={[styles.mediaWrapper, { height: itemHeight }]}
          onPress={() => handleMediaPress(item)}
        >
          {item.type === 'video' ? (
            <VisibilitySensor
              onChange={(isVisible) => handleVideoVisibilityChange(item.id, isVisible)}
              threshold={{ top: 360, bottom: 380 }}
            >
              <View style={styles.videoContainer}>
                <Video
                  ref={(ref) => { videoRefs.current[item.id] = ref; }}
                  source={{ uri: item.uri }}
                  style={styles.mediaImage}
                  useNativeControls={false}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={visibleVideos.has(item.id) && viewMode === 'list'}
                  isLooping={true}
                  isMuted={videoMuted[item.id] ?? true}
                />
                <Pressable
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
                </Pressable>
              </View>
            </VisibilitySensor>
          ) : (
            <CachedImage
              path={item.uri}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity
              activeOpacity={0.5} 
          style={styles.descriptionContainer}
          onPress={() => router.push(`/post/${item.post_id}`)}
        >
          {item.post_description && (
            <Text style={styles.descriptionText} numberOfLines={2} ellipsizeMode="tail">
              {item.post_description}
            </Text>
          )}
          <IonIcon name="chevron-forward" size={20} color={colors.secondaryText} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      </View>
    );
  }, [visibleVideos, viewMode, videoMuted, handleMediaPress, toggleMute, handleVideoVisibilityChange, router]);

  const renderGridMediaItem = useCallback(({ item, index }: { item: any, index: number }) => {
    const itemSize = (width - 4) / 3; // 3 columns with 1px gaps (2px total gap space)
    
    return (
      <TouchableOpacity
                activeOpacity={0.5} 
        style={[styles.gridMediaContainer, { width: itemSize, height: itemSize }]}
        onPress={() => {
          // For grid view, open fullscreen directly
          handleMediaPress(item);
        }}
      >
        {item.type === 'video' ? (
          <VideoThumbnail
            videoUri={item.uri}
            style={styles.mediaImage}
          />
        ) : (
          <CachedImage
            path={item.uri}
            style={styles.mediaImage}
            resizeMode="cover"
          />
        )}
        {item.type === 'video' && (
          <View style={styles.gridVideoIndicator}>
            <IonIcon name="play" size={16} color={colors.primaryText} />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [handleMediaPress]);



  const onScrollToIndexFailed = useCallback((info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
    // Handle scroll failures by scrolling to the nearest measured frame
    const wait = new Promise(resolve => setTimeout(resolve, 500));
    wait.then(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({ 
          index: Math.min(info.index, info.highestMeasuredFrameIndex), 
          animated: false // Don't animate to prevent glitches
        });
      }
    });
  }, []);

  // Memoize keyExtractor to prevent unnecessary re-renders
  const keyExtractor = useCallback((item: any) => item.id, []);

  // Memoize getItemLayout for list view performance
  const getItemLayout = useCallback((data: any, index: number) => {
    // Approximate item height for better performance
    const ESTIMATED_ITEM_HEIGHT = 400;
    return {
      length: ESTIMATED_ITEM_HEIGHT,
      offset: ESTIMATED_ITEM_HEIGHT * index,
      index,
    };
  }, []);

  // Track current visible item for counter (separate from video playback)
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0 && viewMode === 'list' && !shouldAutoScroll) {
      const newIndex = viewableItems[0].index || 0;
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    }
  }, [currentIndex, viewMode, shouldAutoScroll]);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50, // For counter purposes
    waitForInteraction: false,
    minimumViewTime: 100,
  }), []);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Media',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primaryText,
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.back()} style={styles.backButton}>
              <IonIcon name="arrow-back" size={24} color={colors.primaryText} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              {viewMode === 'list' && (
                <Text style={styles.counterText}>
                  {currentIndex + 1} / {media.length}
                </Text>
              )}
            </View>
          ),
        }}
      />
      <SafeAreaView style={styles.container}>
        {loading ? (
          <>
            {/* View Mode Toggle - Real buttons always visible */}
            <View style={styles.viewModeToggle}>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={[
                  styles.toggleButton,
                  viewMode === 'list' && styles.activeToggleButton
                ]}
                onPress={() => setViewMode('list')}
              >
                <Text style={[
                  styles.toggleButtonText,
                  viewMode === 'list' && styles.activeToggleButtonText
                ]}>
                  List
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={[
                  styles.toggleButton,
                  viewMode === 'grid' && styles.activeToggleButton
                ]}
                onPress={() => setViewMode('grid')}
              >
                <Text style={[
                  styles.toggleButtonText,
                  viewMode === 'grid' && styles.activeToggleButtonText
                ]}>
                  Grid
                </Text>
              </TouchableOpacity>
            </View>
            {/* Skeleton content that changes based on viewMode */}
            <MediaSkeleton viewMode={viewMode} count={viewMode === 'grid' ? 18 : 6} />
          </>
        ) : media.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IonIcon name="images-outline" size={64} color={colors.secondaryText} />
            <Text style={styles.emptyText}>No media found</Text>
          </View>
        ) : (
          <>
            {/* View Mode Toggle */}
            <View style={styles.viewModeToggle}>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={[
                  styles.toggleButton,
                  viewMode === 'list' && styles.activeToggleButton
                ]}
                onPress={() => setViewMode('list')}
              >
                <Text style={[
                  styles.toggleButtonText,
                  viewMode === 'list' && styles.activeToggleButtonText
                ]}>
                  List
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={[
                  styles.toggleButton,
                  viewMode === 'grid' && styles.activeToggleButton
                ]}
                onPress={() => setViewMode('grid')}
              >
                <Text style={[
                  styles.toggleButtonText,
                  viewMode === 'grid' && styles.activeToggleButtonText
                ]}>
                  Grid
                </Text>
              </TouchableOpacity>
            </View>

            {viewMode === 'grid' ? (
              <FlatList
                key="grid-view"
                ref={gridListRef}
                data={media}
                renderItem={renderGridMediaItem}
                keyExtractor={keyExtractor}
                numColumns={3}
                columnWrapperStyle={styles.gridRow}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.gridContent}
                initialNumToRender={18}
                maxToRenderPerBatch={18}
                windowSize={10}
                removeClippedSubviews={true}
                getItemLayout={undefined}
              />
            ) : (
              <FlatList
                key="list-view"
                ref={flatListRef}
                data={media}
                renderItem={renderListMediaItem}
                keyExtractor={keyExtractor}
                showsVerticalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                removeClippedSubviews={false}
                onScrollToIndexFailed={onScrollToIndexFailed}
                contentContainerStyle={styles.listContent}
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={10}
                getItemLayout={getItemLayout}
              />
            )}
          </>
        )}
      </SafeAreaView>

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
          
          {/* View Post button - only show in grid view mode */}
          {viewMode === 'grid' && selectedItem && (
            <TouchableOpacity 
              style={styles.viewPostButton} 
              onPress={() => {
                closeFullscreen();
                router.push(`/post/${selectedItem.post_id}`);
              }}
              activeOpacity={0.7}
            >
              <IonIcon name="document-text-outline" size={20} color={colors.primaryText} />
              <Text style={styles.viewPostButtonText}>View Post</Text>
            </TouchableOpacity>
          )}
          
          {selectedItem && selectedItem.type === 'image' ? (
            <Image
              source={{ uri: selectedItem.uri }}
              style={styles.fullscreenImage}
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
                  style={styles.fullscreenVideo}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  counterText: {
    color: colors.secondaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: colors.secondaryText,
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  activeToggleButton: {
    borderBottomColor: colors.brand,
  },
  toggleButtonText: {
    color: colors.secondaryText,
    fontSize: 16,
    fontWeight: '500',
  },
  activeToggleButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  listContent: {
    paddingTop: 6,
    paddingBottom: 20,
  },
  listMediaContainer: {
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaWrapper: {
    position: 'relative',
    borderRadius: 0,
    overflow: 'hidden',
  },
  gridContent: {
    padding: 1,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  gridMediaContainer: {
    position: 'relative',
    borderRadius: 0,
    overflow: 'hidden',
  },
  gridVideoIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.overlay,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.primaryAccent,
    gap: 8,
  },
  descriptionText: {
    color: colors.primaryText,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  // Fullscreen styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenVideo: {
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
    backgroundColor: colors.overlay,
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
    backgroundColor: colors.overlay,
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
    backgroundColor: colors.overlay,
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    height: 3,
    backgroundColor: colors.primaryText,
    borderRadius: 1.5,
  },
  viewPostButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    backgroundColor: colors.overlay,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewPostButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
  },
});
