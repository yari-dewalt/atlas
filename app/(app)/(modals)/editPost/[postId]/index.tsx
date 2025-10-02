import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, ScrollView, Image, Modal, KeyboardAvoidingView, Platform, ImageStyle, Keyboard, Animated, StatusBar, SafeAreaView, TouchableOpacity } from "react-native";
import { colors } from "../../../../../constants/colors";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../../../../stores/authStore";
import { useProfileStore } from "../../../../../stores/profileStore";
import { progressUtils, PROGRESS_LABELS, useProgressStore } from "../../../../../stores/progressStore";
import { useBannerStore, BANNER_MESSAGES } from "../../../../../stores/bannerStore";
import { getUserWeightUnit, displayWeightForUser } from "../../../../../utils/weightUtils";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { fetchPostById, updatePost, uploadPostMedia } from "../../../../../utils/postUtils";
import { Ionicons as IonIcon } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from "expo-image-picker";
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from "../../../../../lib/supabase";
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ExercisesList from '../../../../../components/Post/ExercisesList';

export default function EditPost() {
  const { postId } = useLocalSearchParams();
  const router = useRouter();
  const { session, profile } = useAuthStore();
  const { updatePostsCount, isCurrentUser } = useProfileStore();
  
  // Get user's preferred weight unit
  const userWeightUnit = getUserWeightUnit(profile);
  
  // Progress bar state
  const { progress, isVisible } = useProgressStore();
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);
  
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [postTitle, setPostTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [media, setMedia] = useState([]);
  const [mediaToDelete, setMediaToDelete] = useState([]);
  const [newMedia, setNewMedia] = useState([]);
  const [processedMedia, setProcessedMedia] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isFormValid, setIsFormValid] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Keyboard state and animation for bottom toolbar
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const toolbarPaddingAnim = useRef(new Animated.Value(34)).current; // Start with 34px padding
  
  // Determine if this is a new post or editing existing
  const isNewPost = postId === 'new';
  
  // Bottom sheet refs
  const workoutBottomSheetRef = useRef<BottomSheet>(null);
  
  // Bottom sheet snap points
  const snapPoints = useMemo(() => [600], []);
  
  // Media preview state
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  
  // Video ref for fullscreen modal
  const fullscreenVideoRef = useRef<Video | null>(null);

  // Backdrop component
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        enableTouchThrough={false}
        onPress={() => {
          workoutBottomSheetRef.current?.close();
        }}
      />
    ),
    []
  );
  
  useEffect(() => {
    const loadPost = async () => {
      try {
        setError(null);
        setLoading(true);
        
        if (isNewPost) {
          // For new posts, set initial state
          setPostTitle('');
          setDescription('');
          setSelectedWorkout(null);
          setMedia([]);
          setNewMedia([]);
          setLoading(false);
          return;
        }
        
        if (!postId || !session?.user?.id) {
          throw new Error('Invalid post ID or user not logged in');
        }
        
        const postData = await fetchPostById(postId as string, session.user.id);
        
        // Verify user is the owner
        if (postData.user.id !== session.user.id) {
          throw new Error('You can only edit your own posts');
        }
        
        setPost(postData);
        setPostTitle(postData.title || '');
        setDescription(postData.text || '');
        setMedia(postData.media || []);
        
        // If the post has a workout attached, fetch and set it
        if (postData.workout_id) {
          try {
            const { data: workoutData, error: workoutError } = await supabase
              .from('workouts')
              .select(`
                id,
                name,
                start_time,
                end_time,
                notes,
                routine_id,
                routines(
                  id,
                  name
                ),
                workout_exercises(
                  id,
                  name,
                  exercise_id,
                  superset_id,
                  exercises(
                    id,
                    name,
                    image_url
                  ),
                  workout_sets(
                    id,
                    weight,
                    reps,
                    is_completed
                  )
                )
              `)
              .eq('id', postData.workout_id)
              .single();
            
            if (workoutError) {
              console.error('Error fetching workout:', workoutError);
            } else if (workoutData) {
              // Process the workout data similar to fetchRecentWorkouts
              let totalVolume = 0;
              const exercises = workoutData.workout_exercises || [];
              
              exercises.forEach(exercise => {
                const sets = exercise.workout_sets || [];
                sets.forEach(set => {
                  if (set.weight && set.reps) {
                    totalVolume += set.weight * set.reps;
                  }
                });
              });

              // Calculate duration in seconds (like workout tab)
              let duration = 0;
              if (workoutData.start_time && workoutData.end_time) {
                const startTime = new Date(workoutData.start_time);
                const endTime = new Date(workoutData.end_time);
                duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
              }

              // Format duration like workout tab
              const hours = Math.floor(duration / 3600);
              const minutes = Math.floor((duration % 3600) / 60);
              const formattedDuration = hours > 0 
                ? `${hours}h ${minutes}m` 
                : `${minutes}m`;

              // Convert volume to user's preferred unit and format with k notation
              const volumeResult = displayWeightForUser(totalVolume, 'kg', userWeightUnit, false);
              const volumeInUserUnit = Math.round(typeof volumeResult === 'number' ? volumeResult : parseFloat(volumeResult.toString()));
              const formattedVolume = formatVolumeWithUnit(volumeInUserUnit, userWeightUnit);
              
              const processedWorkout = {
                ...workoutData,
                duration: duration,
                displayDuration: formattedDuration,
                displayDate: formatWorkoutDate(workoutData.start_time),
                exerciseCount: workoutData.workout_exercises?.length || 0,
                totalSets: workoutData.workout_exercises?.reduce((acc, ex) => 
                  acc + (ex.workout_sets?.length || 0), 0) || 0,
                totalVolume: Math.round(totalVolume),
                formattedVolume: formattedVolume
              };
              
              setSelectedWorkout(processedWorkout);
            }
          } catch (workoutErr) {
            console.error('Error loading workout for post:', workoutErr);
          }
        }
      } catch (err) {
        console.error('Error loading post for editing:', err);
        setError(err.message || 'Failed to load post');
        Alert.alert('Error', err.message || 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };
    
    loadPost();
  }, [postId, session?.user?.id, isNewPost]);
  
  useEffect(() => {
    if (session?.user) {
      fetchRecentWorkouts();
    }
  }, [session?.user]);

  useEffect(() => {
    if (media && media.length > 0) {
      processMediaUrls(media);
    }
  }, [media]);

  useEffect(() => {
    const hasDescription = description.trim() !== '';
    const hasMedia = media.length > 0 || newMedia.length > 0;
    const hasWorkout = selectedWorkout !== null;
    const hasContent = hasDescription || hasMedia || hasWorkout;
    
    setIsFormValid(hasContent);
    
    if (!hasContent) {
      setFormError('Your post needs at least one of: description, workout, or media');
    } else {
      setFormError(null);
    }
  }, [postTitle, description, media, newMedia, selectedWorkout]);


  // Keyboard listener effect for bottom toolbar padding animation
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        Animated.timing(toolbarPaddingAnim, {
          toValue: 12, // Smaller padding when keyboard is up
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        Animated.timing(toolbarPaddingAnim, {
          toValue: 34, // Full padding when keyboard is down
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [toolbarPaddingAnim]);

  const fetchRecentWorkouts = async () => {
    if (!session?.user?.id) return;
    
    setWorkoutsLoading(true);
    try {
      const { data, error } = await supabase
          .from('workouts')
          .select(`
              id,
              name,
              start_time,
              end_time,
              notes,
              routine_id,
              routines(
                id,
                name
              ),
              workout_exercises(
                id,
                name,
                exercise_id,
                superset_id,
                exercises(
                  id,
                  name,
                  image_url
                ),
                workout_sets(
                  id,
                  weight,
                  reps,
                  is_completed
                )
              )
            `)
          .eq('user_id', session.user.id)
          .order('start_time', { ascending: false })
          .limit(10); // Fetch last 10 workouts
        
      if (error) throw error;
      
      // Process workouts for display
      const processedWorkouts = data?.map(workout => {
        // Calculate total volume
        let totalVolume = 0;
        const exercises = workout.workout_exercises || [];
        
        exercises.forEach(exercise => {
          const sets = exercise.workout_sets || [];
          sets.forEach(set => {
            if (set.weight && set.reps) {
              totalVolume += set.weight * set.reps;
            }
          });
        });

        // Calculate duration in seconds (like workout tab)
        let duration = 0;
        if (workout.start_time && workout.end_time) {
          const startTime = new Date(workout.start_time);
          const endTime = new Date(workout.end_time);
          duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000); // Convert to seconds
        }

        // Format duration like workout tab
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const formattedDuration = hours > 0 
          ? `${hours}h ${minutes}m` 
          : `${minutes}m`;

        // Convert volume to user's preferred unit and format with k notation
        const volumeResult = displayWeightForUser(totalVolume, 'kg', userWeightUnit, false);
        const volumeInUserUnit = Math.round(typeof volumeResult === 'number' ? volumeResult : parseFloat(volumeResult.toString()));
        const formattedVolume = formatVolumeWithUnit(volumeInUserUnit, userWeightUnit);
        
        return {
          ...workout,
          duration: duration,
          displayDuration: formattedDuration,
          displayDate: formatWorkoutDate(workout.start_time),
          exerciseCount: workout.workout_exercises?.length || 0,
          totalSets: workout.workout_exercises?.reduce((acc, ex) => 
            acc + (ex.workout_sets?.length || 0), 0) || 0,
          totalVolume: Math.round(totalVolume),
          formattedVolume: formattedVolume
        };
      }) || [];
      
      setWorkouts(processedWorkouts);
    } catch (error) {
      console.error('Error fetching workouts:', error);
      Alert.alert('Error', 'Failed to load recent workouts');
    } finally {
      setWorkoutsLoading(false);
    }
  };
  
  const formatWorkoutDate = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (e) {
      return 'recently';
    }
  };

  const formatVolumeWithUnit = (volume: number, unit: string) => {
    if (volume >= 1000) {
      const volumeInK = volume / 1000;
      // If it's a whole number (like 12000 -> 12k), don't show decimals
      if (volumeInK % 1 === 0) {
        return `${volumeInK}k ${unit}`;
      }
      // Otherwise show one decimal place (like 19310 -> 19.3k)
      return `${volumeInK.toFixed(1)}k ${unit}`;
    }
    return `${volume} ${unit}`;
  };

  const processMediaUrls = async (mediaItems) => {
    const urlMap = {};
    
    for (const item of mediaItems) {
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
            console.log(`Processed media URL for ${item.id}: ${data.publicUrl}`);
          }
        }
      } catch (error) {
        console.error('Error processing media URL:', error, item);
      }
    }
    
    setProcessedMedia(urlMap);
  };
  
  const handleSave = async () => {
    if (!session?.user?.id) return;
  
    // Check if post has any content
    const hasDescription = description.trim() !== '';
    const hasMedia = media.length > 0 || newMedia.length > 0;
    const hasWorkout = selectedWorkout !== null;
    
    if (!hasDescription && !hasMedia && !hasWorkout) {
      Alert.alert(
        'Empty Post', 
        'Your post needs at least one of the following:\n• A description\n• A workout\n• A photo or video'
      );
      return;
    }
    
    setIsSubmitting(true);
    let loadingInterval: any = null;
    
    try {
      // Start progress tracking
      if (isNewPost) {
        loadingInterval = progressUtils.startLoading(PROGRESS_LABELS.SAVING_POST);
      } else {
        loadingInterval = progressUtils.startLoading(PROGRESS_LABELS.EDITING_POST);
      }

      // Step 1: Preparing data
      progressUtils.stepProgress(1, 3, 'Preparing post data...');

      // Step 2: Saving/Updating
      progressUtils.stepProgress(2, 3, isNewPost ? 'Publishing post...' : 'Updating post...');
      
      if (isNewPost) {
        await createNewPost();
      } else {
        await updateExistingPost();
      }

      // Step 3: Finalizing
      progressUtils.stepProgress(3, 3, 'Finalizing...');
      
      // Complete the progress
      progressUtils.completeLoading();
      
      // Clear the loading interval
      if (loadingInterval) {
        clearInterval(loadingInterval);
      }
    } catch (err) {
      console.error('Error saving post:', err);
      
      // Cancel progress on error
      progressUtils.cancelLoading();
      if (loadingInterval) {
        clearInterval(loadingInterval);
      }
      
      // Show error banner
      const { showError } = useBannerStore.getState();
      showError(BANNER_MESSAGES.ERROR_SAVE_FAILED);
    } finally {
      setIsSubmitting(false);
    }
  };

  const createNewPost = async () => {
    // 1. First create the post record
    const { data: newPost, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: profile.id,
        title: postTitle.trim() || null,
        description: description.trim() || null,
        workout_id: selectedWorkout?.id || null
      })
      .select('id')
      .single();

    if (postError) throw postError;
      
    const newPostId = newPost.id;
    console.log(`Created post with ID: ${newPostId}`);
    
    // 2. Upload any media files to Supabase storage
    for (let i = 0; i < newMedia.length; i++) {
      const mediaItem = newMedia[i];
      try {
        // Get file extension
        const fileExt = mediaItem.uri.split('.').pop().toLowerCase();
        const mediaType = mediaItem.type || (fileExt === 'mp4' ? 'video' : 'image');
        const fileName = `${profile.id}-${Date.now()}-${i}.${fileExt}`;
        const filePath = `posts/${fileName}`;
        
        console.log(`Uploading media item ${i+1}/${newMedia.length}: ${mediaType}`);
        
        // Convert URI to array buffer
        const response = await fetch(mediaItem.uri);
        const arraybuffer = await response.arrayBuffer();
        
        // Upload to storage
        const { data, error: uploadError } = await supabase.storage
          .from('user-content')
          .upload(filePath, arraybuffer, {
            contentType: mediaItem.type === 'video' ? 'video/mp4' : 'image/jpeg',
          });
        
        if (uploadError) {
          console.error('Media upload error:', uploadError);
          throw uploadError;
        }
        
        console.log(`Media uploaded successfully, path: ${data.path}`);
        
        // Insert media record
        const { error: mediaError } = await supabase
          .from('post_media')
          .insert({
            post_id: newPostId,
            storage_path: data.path,
            media_type: mediaType,
            width: mediaItem.width || null,
            height: mediaItem.height || null,
            duration: mediaItem.duration || null,
            order_index: i
          });
        
        if (mediaError) {
          console.error('Media record insert error:', mediaError);
          throw mediaError;
        }
        
      } catch (error) {
        console.error(`Error processing media item ${i+1}:`, error);
        throw new Error(`Failed to process media item ${i+1}: ${error.message}`);
      }
    }
    
    // Update profile posts count if this is the current user's profile
    if (isCurrentUser && profile?.id === session.user.id) {
      updatePostsCount(1);
    }
    
    // Show success banner with View action
    const { showSuccess } = useBannerStore.getState();
    showSuccess(
      BANNER_MESSAGES.POST_CREATED,
      4000, // Show for 4 seconds
      {
        text: 'View',
        onPress: () => {
          router.dismiss();
          router.push(`/post/${newPostId}`);
        }
      }
    );
    
    // Dismiss the modal
    router.dismiss();
  };

  const updateExistingPost = async () => {
    if (!post) return;
    
    // First upload any new media
    let updatedMedia = [...media];
    
    if (newMedia.length > 0) {
      const uploadedMedia = await uploadPostMedia(
        post.id,
        session.user.id,
        newMedia
      );
      
      updatedMedia = [...updatedMedia, ...uploadedMedia];
    }
    
    // Then update the post with all changes
    await updatePost(
      post.id, 
      session.user.id, 
      description.trim(),
      [], // No exercises anymore
      mediaToDelete
    );
    
    // Update title and workout separately
    const { error: titleUpdateError } = await supabase
      .from('posts')
      .update({ 
        title: postTitle.trim() || null,
        workout_id: selectedWorkout?.id || null
      })
      .eq('id', post.id);
    
    if (titleUpdateError) throw titleUpdateError;
    
    // Show success banner with View action
    const { showSuccess } = useBannerStore.getState();
    showSuccess(
      BANNER_MESSAGES.POST_UPDATED,
      4000, // Show for 4 seconds
      {
        text: 'View',
        onPress: () => {
          router.push(`/post/${postId}`);
        }
      }
    );
    
    // Dismiss the modal and navigate to post
    router.dismiss();
  };
  
  const addNewMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        allowsEditing: true, 
        quality: 1,
        exif: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log("User cancelled image picker.");
        return;
      }

      const selectedMedia = result.assets.map(item => ({
        uri: item.uri,
        type: item.type || (item.uri.endsWith('.mp4') ? 'video' : 'image'),
        width: item.width,
        height: item.height,
        duration: item.duration
      }));
      
      setNewMedia([...newMedia, ...selectedMedia]);
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(error.message);
      } else {
        throw error;
      }
    }
  };

  const openCamera = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to take photos and videos.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: 1,
        exif: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log("User cancelled camera.");
        return;
      }

      const capturedMedia = result.assets.map(item => ({
        uri: item.uri,
        type: item.type || (item.uri.endsWith('.mp4') ? 'video' : 'image'),
        width: item.width,
        height: item.height,
        duration: item.duration
      }));
      
      setNewMedia([...newMedia, ...capturedMedia]);
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Camera Error', error.message);
      } else {
        Alert.alert('Camera Error', 'Failed to open camera');
      }
    }
  };
  
  const removeMedia = (index, isNew = false) => {
    Alert.alert(
      '',
      'Remove this media from your post?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (isNew) {
              // Remove from new media array
              const updatedNewMedia = [...newMedia];
              updatedNewMedia.splice(index, 1);
              setNewMedia(updatedNewMedia);
            } else {
              // Mark existing media for deletion
              const mediaItem = media[index];
              setMediaToDelete([...mediaToDelete, mediaItem.id]);
              
              // Remove from UI
              const updatedMedia = [...media];
              updatedMedia.splice(index, 1);
              setMedia(updatedMedia);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };
  
  const openMediaPreview = (media) => {
    setSelectedMedia(media);
    setPreviewVisible(true);
    // Reset video state when opening
    setIsVideoPlaying(true);
    setVideoProgress(0);
    setVideoDuration(0);
  };

  const handleSelectWorkout = (workout) => {
    setSelectedWorkout(workout);
    workoutBottomSheetRef.current?.close();
  };

  const removeSelectedWorkout = () => {
    Alert.alert(
      '',
      'Remove this workout from your post?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => setSelectedWorkout(null),
        },
      ],
      { cancelable: true }
    );
  };

  const handleCancel = () => {
    // Check if there's any content to lose
    const hasTitle = postTitle.trim() !== '';
    const hasDescription = description.trim() !== '';
    const hasMedia = media.length > 0 || newMedia.length > 0;
    const hasWorkout = selectedWorkout !== null;
    const hasContent = hasTitle || hasDescription || hasMedia || hasWorkout;

    if (hasContent) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          {
            text: 'Keep Editing',
            style: 'cancel',
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ],
        { cancelable: true }
      );
    } else {
      router.back();
    }
  };
  
  // Handle scroll start to unfocus inputs
  const handleScrollBeginDrag = () => {
    Keyboard.dismiss();
  };
  
  // Handle workout selection with keyboard dismissal
  const handleWorkoutButtonPress = () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    workoutBottomSheetRef.current?.expand();
  };
  
  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity
                activeOpacity={0.5} 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <GestureHandlerRootView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header - matches exercise selection modal */}
        <View style={styles.header}>
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.headerButton}
            onPress={handleCancel}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>{isNewPost ? 'New Post' : 'Edit Post'}</Text>

          <TouchableOpacity
                activeOpacity={0.5} 
            style={[
              styles.headerButton,
              (!isFormValid || isSubmitting) && styles.disabledButton
            ]}
            onPress={handleSave}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <Text style={[styles.saveText, (!isFormValid || isSubmitting) && styles.saveTextDisabled]}>{isNewPost ? 'Publish' : 'Save'}</Text>
            )}
          </TouchableOpacity>
        {/* Progress Bar */}
        {isVisible && (
          <Animated.View 
            style={[
              styles.progressBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '110%'],
                }),
              }
            ]}
          />
        )}

        </View>
        
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          onScrollBeginDrag={handleScrollBeginDrag}
        >
          {/* Post Title - Strava style */}
          <View style={styles.titleSection}>
            <TextInput
              style={styles.postTitleInput}
              value={postTitle}
              onChangeText={setPostTitle}
              placeholder="Add a Title (Optional)"
              placeholderTextColor={`${colors.secondaryText}80`}
            />
          </View>

          {/* Description Section - Strava style - Now flexes to fill space */}
          <View style={styles.descriptionSection}>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="What's going on?"
              placeholderTextColor={`${colors.secondaryText}80`}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Selected Workout Display */}
          {selectedWorkout && (
            <View style={styles.attachedContentSection}>
              <View style={styles.attachedWorkoutCard}>
                {selectedWorkout.workout_exercises && selectedWorkout.workout_exercises.length > 0 && (
                  <View style={styles.exercisesListContainer}>
                    <ExercisesList 
                      exercises={selectedWorkout.workout_exercises}
                      workoutId={selectedWorkout.id}
                      workoutName={selectedWorkout.name}
                      isDetailView={false}
                      showViewWorkoutButton={false}
                    />
                  </View>
                )}
                
                <TouchableOpacity
                activeOpacity={0.5} 
                  style={styles.workoutOptionsButton}
                  onPress={removeSelectedWorkout}
                >
                  <IonIcon name="ellipsis-horizontal" size={20} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Media Display - Full width */}
          {(media.length > 0 || newMedia.length > 0) && (
            <View style={styles.mediaDisplaySection}>
              {media.map((item, index) => {
                const mediaUrl = processedMedia[item.id] || item.uri;
                // Calculate aspect ratio from item dimensions or use default
                const aspectRatio = (item.width && item.height) ? item.width / item.height : 16/9;
                
                return (
                  <View key={`existing-${index}`} style={[styles.fullWidthMediaItem, { aspectRatio }]}>
                    <TouchableOpacity
                activeOpacity={0.5} onPress={() => openMediaPreview({
                      ...item,
                      uri: mediaUrl
                    })}>
                      {item.type === 'video' ? (
                        <View style={styles.fullWidthMediaContent}>
                          <Video
                            source={{ uri: mediaUrl }}
                            style={styles.fullWidthMediaImage}
                            useNativeControls={false}
                            resizeMode={ResizeMode.COVER}
                            isMuted={true}
                            shouldPlay={false}
                          />
                          <View style={styles.fullWidthVideoIndicator}>
                            <IonIcon name="play" size={32} color="white" />
                          </View>
                        </View>
                      ) : (
                        <Image
                          source={{ uri: mediaUrl }}
                          style={styles.fullWidthMediaImage as ImageStyle}
                          resizeMode="cover"
                        />
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                activeOpacity={0.5} 
                      style={styles.fullWidthRemoveButton}
                      onPress={() => removeMedia(index, false)}
                    >
                      <IonIcon name="ellipsis-horizontal" size={20} color={colors.secondaryText} />
                    </TouchableOpacity>
                  </View>
                );
              })}
                
              {newMedia.map((item, index) => {
                // Calculate aspect ratio from item dimensions or use default
                const aspectRatio = (item.width && item.height) ? item.width / item.height : 16/9;
                
                return (
                  <View key={`new-${index}`} style={[styles.fullWidthMediaItem, { aspectRatio }]}>
                    <TouchableOpacity
                activeOpacity={0.5} onPress={() => openMediaPreview(item)}>
                      {item.type === 'video' ? (
                        <View style={styles.fullWidthMediaContent}>
                          <Video
                            source={{ uri: item.uri }}
                            style={styles.fullWidthMediaImage}
                            useNativeControls={false}
                            resizeMode={ResizeMode.COVER}
                            isMuted={true}
                            shouldPlay={false}
                          />
                          <View style={styles.fullWidthVideoIndicator}>
                            <IonIcon name="play" size={32} color="white" />
                          </View>
                        </View>
                      ) : (
                        <Image
                          source={{ uri: item.uri }}
                          style={styles.fullWidthMediaImage as ImageStyle}
                          resizeMode="cover"
                        />
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                activeOpacity={0.5} 
                      style={styles.fullWidthRemoveButton}
                      onPress={() => removeMedia(index, true)}
                    >
                      <IonIcon name="ellipsis-horizontal" size={20} color={colors.secondaryText} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Sticky Bottom Toolbar - Strava style */}
        <Animated.View style={[
          styles.bottomToolbar,
          { paddingBottom: toolbarPaddingAnim }
        ]}>
                    <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.toolbarButton}
            onPress={handleWorkoutButtonPress}
          >
            <IonIcon name="barbell-outline" size={24} color={colors.secondaryText} />
          </TouchableOpacity>
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.toolbarButton}
            onPress={addNewMedia}
          >
            <IonIcon name="images-outline" size={24} color={colors.secondaryText} />
          </TouchableOpacity>
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.toolbarButton}
            onPress={openCamera}
          >
            <IonIcon name="camera-outline" size={24} color={colors.secondaryText} />
          </TouchableOpacity>
        </Animated.View>

      {/* Bottom Sheet for Workout Selection */}
        <BottomSheet
          ref={workoutBottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetIndicator}
          backdropComponent={renderBackdrop}
          maxDynamicContentSize={600}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Select Workout</Text>
              <Text style={styles.bottomSheetSubtitle}>Choose a workout to attach to your post</Text>
            </View>
            
            <View style={styles.bottomSheetScrollContainer}>
              <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.bottomSheetScrollContent}
                style={styles.bottomSheetScrollView}
              >
            {workoutsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.brand} />
                <Text style={styles.loadingText}>Loading workouts...</Text>
              </View>
            ) : workouts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No recent workouts found</Text>
                <Text style={styles.emptySubtext}>Complete a workout to attach it to your post</Text>
              </View>
            ) : (
              workouts.map((workout, index) => (
                <View key={workout.id}>
                  <TouchableOpacity
                    activeOpacity={0.5} 
                    style={[styles.workoutHistoryCard, index === 0 && { borderTopLeftRadius: 12, borderTopRightRadius: 12 }, index === workouts.length - 1 && { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }]}
                    onPress={() => handleSelectWorkout(workout)}
                  >
                    <View style={styles.workoutHistoryDate}>
                      <Text style={styles.workoutHistoryDateText}>
                        {format(new Date(workout.start_time), "MMM d")}
                      </Text>
                    </View>
                    <View style={styles.workoutHistoryDetails}>
                      <Text style={styles.workoutHistoryTitle} numberOfLines={1} ellipsizeMode="tail">
                        {workout.name || 'Unnamed Workout'}
                      </Text>
                      <View style={styles.workoutHistoryStats}>
                        <View style={styles.workoutHistoryStat}>
                          <IonIcon name="time-outline" size={14} color={colors.secondaryText} />
                          <Text style={styles.workoutHistoryStatText}>
                            {workout.displayDuration}
                          </Text>
                        </View>
                        <View style={styles.workoutHistoryStat}>
                          <IonIcon name="fitness-outline" size={14} color={colors.secondaryText} />
                          <Text style={styles.workoutHistoryStatText}>
                            {workout.exerciseCount}
                          </Text>
                        </View>
                        <View style={styles.workoutHistoryStat}>
                          <IonIcon name="barbell-outline" size={14} color={colors.secondaryText} />
                          <Text style={styles.workoutHistoryStatText}>
                            {workout.formattedVolume}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <IonIcon name="chevron-forward" size={20} color={colors.secondaryText} />
                  </TouchableOpacity>
                  {index < workouts.length - 1 && <View style={styles.bottomSheetDivider} />}
                </View>
              ))
            )}
              </ScrollView>
            </View>
          </BottomSheetView>
        </BottomSheet>
        
        {/* Enhanced Fullscreen Media Modal */}
        <Modal
          visible={previewVisible}
          transparent={false}
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => {
            setPreviewVisible(false);
            setIsVideoPlaying(true);
            setVideoProgress(0);
          }}
        >
          <StatusBar hidden />
          <SafeAreaView style={styles.fullscreenContainer}>
            <View style={styles.fullscreenMedia}>
              {selectedMedia && (
                selectedMedia.type === 'video' ? (
                  <View style={styles.videoContainer}>
                    <Video
                      ref={fullscreenVideoRef}
                      source={{ uri: selectedMedia.uri }}
                      style={styles.fullscreenVideo}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay={isVideoPlaying}
                      isLooping={true}
                      onPlaybackStatusUpdate={(status) => {
                        if (status.isLoaded) {
                          setVideoProgress(status.positionMillis || 0);
                          setVideoDuration(status.durationMillis || 0);
                        }
                      }}
                    />
                    
                    {/* Video Controls Overlay */}
                    <TouchableOpacity
                      style={styles.videoOverlay}
                      onPress={() => setIsVideoPlaying(!isVideoPlaying)}
                      activeOpacity={1}
                    >
                      {!isVideoPlaying && (
                        <View style={styles.playButton}>
                          <IonIcon name="play" size={60} color="white" />
                        </View>
                      )}
                    </TouchableOpacity>
                    
                    {/* Progress Bar */}
                    {videoDuration > 0 && (
                      <View style={styles.progressContainer}>
                        <View style={styles.progressBackground}>
                          <View 
                            style={[
                              styles.progressFill,
                              { width: `${(videoProgress / videoDuration) * 100}%` }
                            ]} 
                          />
                        </View>
                      </View>
                    )}
                  </View>
                ) : (
                  <Image
                    source={{ uri: selectedMedia.uri }}
                    style={styles.fullscreenImage as any}
                    resizeMode="contain"
                  />
                )
              )}
              
              {/* Close Button */}
              <TouchableOpacity
                style={styles.fullscreenCloseButton}
                onPress={() => {
                  setPreviewVisible(false);
                  setIsVideoPlaying(true);
                  setVideoProgress(0);
                }}
              >
                <IonIcon name="close" size={30} color="white" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header styles matching exercise selection modal
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingTop: 53,
  },
  headerButton: {
    padding: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    flex: 1,
    textAlign: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: colors.brand,
    fontWeight: '400',
  },
  saveText: {
    fontSize: 16,
    color: colors.brand,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  saveTextDisabled: {
    color: colors.secondaryText,
  },
  
  // Content styles
  content: {
    flex: 1,
  },
  
  scrollContent: {
    paddingBottom: 120, // Increased padding for bottom toolbar and extra space
    flexGrow: 1,
  },
  
  // Strava-style title section
  titleSection: {
    marginBottom: 4,
  },
  
  // Post title input - Strava style (no background, bigger)
  postTitleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primaryText,
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  
  // Strava-style description section - Now has min height instead of flex
  descriptionSection: {
    minHeight: 200,
    paddingHorizontal: 16,
  },
  descriptionInput: {
    flex: 1,
    fontSize: 20,
    color: colors.primaryText,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  
  // Attached content section
  attachedContentSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  
  // Media display section - full width
  mediaDisplaySection: {
    marginTop: 16,
  },
  
  fullWidthMediaItem: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    marginBottom: 16,
  },
  
  fullWidthMediaContent: {
    position: 'relative',
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  
  fullWidthMediaImage: {
    width: '100%',
    height: '100%',
  } as ImageStyle,
  
  fullWidthVideoIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    backgroundColor: colors.overlay,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  fullWidthRemoveButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: colors.overlay,
    borderRadius: 50,
    padding: 8,
    zIndex: 1,
  },
  
  // Bottom toolbar styles - Strava style
  bottomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 12,
  },
  
  toolbarButtonText: {
    fontSize: 15,
    color: colors.primaryText,
    fontWeight: '400',
  },
  
  // Section styles for Workout and Media (keeping these for now)
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 12,
  },
  
  // Workout selection styles
  // Attached workout card styles (matching history card style)
  attachedWorkoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAccent,
    padding: 12,
    height: 400, // Fixed height to prevent scrolling issues
    position: 'relative',
  },
  exercisesListContainer: {
    flex: 1,
    height: '100%',
  },
  attachedWorkoutDate: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.secondaryAccent,
    marginRight: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  attachedWorkoutDateText: {
    fontSize: 12,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  attachedWorkoutDetails: {
    flex: 1,
  },
  attachedWorkoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 10,
  },
  attachedWorkoutStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachedWorkoutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  attachedWorkoutStatText: {
    fontSize: 12,
    color: colors.secondaryText,
    marginLeft: 4,
  },
  removeWorkoutButton: {
    padding: 8,
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
  },
  workoutHeaderContainer: {
    position: 'relative',
  },
  workoutOptionsButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    zIndex: 1,
    backgroundColor: colors.overlay,
    borderRadius: 50,
    padding: 8,
  },
  
  // Media styles
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mediaItem: {
    position: 'relative',
  },
  mediaItemContent: {
    position: 'relative',
  },
  mediaImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  videoIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  addMediaButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  addMediaText: {
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 4,
    textAlign: 'center',
  },
  
  // Bottom Sheet Styles
  bottomSheetBackground: {
    backgroundColor: colors.primaryAccent,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  bottomSheetIndicator: {
    backgroundColor: colors.secondaryText,
    width: 40,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bottomSheetHeader: {
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: 4,
  },
  bottomSheetScrollContainer: {
    maxHeight: '100%',
    paddingBottom: 140,
  },
  bottomSheetScrollView: {
    borderRadius: 12,
  },
  bottomSheetScrollContent: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  
  // Workout History Card Styles (matching exercise selection)
  workoutHistoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryAccent,
    padding: 16,
    marginBottom: 0,
  },
  workoutHistoryDate: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.primaryAccent,
    marginRight: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  workoutHistoryDateText: {
    fontSize: 12,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  workoutHistoryDetails: {
    flex: 1,
  },
  workoutHistoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 10,
  },
  workoutHistoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutHistoryStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  workoutHistoryStatText: {
    fontSize: 12,
    color: colors.secondaryText,
    marginLeft: 4,
  },
  
  // Bottom sheet divider style (matching exercise selection)
  bottomSheetDivider: {
    height: 1,
    backgroundColor: colors.whiteOverlay,
    marginHorizontal: 16,
  },
  
  // Loading and error states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: colors.secondaryText,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
  backButton: {
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.primaryText,
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    color: colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
  },
  
  // Enhanced Fullscreen Modal Styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullscreenMedia: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  } as ImageStyle,
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 40,
    padding: 20,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
  },
  progressBackground: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primaryText,
    borderRadius: 1.5,
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 10,
    zIndex: 1,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 1,
    backgroundColor: colors.brand,
  },

});
