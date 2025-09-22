import { View, Text, StyleSheet, ScrollView, Pressable, FlatList, ActivityIndicator, Modal, TouchableOpacity, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { colors } from '../../../../../constants/colors';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import CachedAvatar from '../../../../../components/CachedAvatar';
import CachedImage from '../../../../../components/CachedImage';
import ProfileSkeleton from '../../../../../components/ProfileSkeleton';
import ActivityChartSkeleton from '../../../../../components/ActivityChartSkeleton';
import { useAuthStore } from '../../../../../stores/authStore';
import { getUserWeightUnit, convertWeight } from '../../../../../utils/weightUtils';
import { supabase } from '../../../../../lib/supabase';
import { useProfileStore } from '../../../../../stores/profileStore';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay, startOfWeek } from 'date-fns';
import { LineChart } from 'react-native-chart-kit'; 
import { Dimensions } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import VideoThumbnail from '../../../../../components/VideoThumbnail';
import { setTabScrollRef } from '../../../(tabs)/_layout';

export default function ProfileScreen() {
  const scrollViewRef = useRef(null);
  const isInitialMount = useRef(true);
  const [isAvatarFullscreen, setIsAvatarFullscreen] = useState(false);
  const [workoutDays, setWorkoutDays] = useState<number[]>([]);
  const [latestPost, setLatestPost] = useState<any>(null);
  const [postLoading, setPostLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(true);
  const [routines, setRoutines] = useState<any[]>([]);
  const [routinesLoading, setRoutinesLoading] = useState(true);
  const [recentMedia, setRecentMedia] = useState<any[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  
  // Activity graph state
  const [selectedMetric, setSelectedMetric] = useState<'duration' | 'volume' | 'reps'>('duration');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'week' | 'month' | '3months' | 'year' | 'all'>('month');
  const [activityData, setActivityData] = useState<{labels: string[], datasets: any[]}>({
    labels: [],
    datasets: []
  });
  const [activityDataLoading, setActivityDataLoading] = useState(false);
  
  // Chart interaction state
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [selectedPointX, setSelectedPointX] = useState<number | null>(null);
  
  const [activityStats, setActivityStats] = useState<{
    total: number;
    average: number;
    max: number;
    activeDays: number;
  } | null>(null);
  
  // Bottom sheet refs
  const metricBottomSheetRef = useRef<BottomSheet>(null);
  const timeRangeBottomSheetRef = useRef<BottomSheet>(null);
  
  // Bottom sheet snap points
  const snapPoints = useMemo(() => ['40%'], []);

  useEffect(() => {setTabScrollRef('profile', scrollViewRef.current);}, []);
  
  // Backdrop component
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        enableTouchThrough={false}
      />
    ),
    []
  );

  const { profile: authProfile, session } = useAuthStore();
  const { 
    currentProfile, 
    loading, 
    isCurrentUser, 
    followLoading,
    followUser,
    unfollowUser,
    fetchProfile,
    updateCurrentProfile
  } = useProfileStore();
  const [followingBackUsers, setFollowingBackUsers] = useState(new Set()); // Users who are following us
  const router = useRouter();

  // Get user's preferred weight unit
  const userWeightUnit = getUserWeightUnit(authProfile);

  useEffect(() => {
    if (currentProfile?.id) {
      console.log('Fetching latest post for profile ID:', currentProfile.id);
      fetchLatestPost(currentProfile.id);
      fetchWorkoutDays(currentProfile.id);
      fetchRecentWorkouts(currentProfile.id);
      fetchRoutines(currentProfile.id);
      fetchActivityData(currentProfile.id);
      fetchRecentMedia(currentProfile.id);
      fetchFollowingRelationships();
    }
  }, [currentProfile?.id]);

  // Fetch who's following us to show "Follow back" button
  const fetchFollowingRelationships = async () => {
    if (!session?.user?.id) return;

    try {
      // Get users who are following us
      const { data: followersData, error: followersError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', session.user.id);

      if (followersError) {
        console.error('Error fetching followers:', followersError);
      } else {
        const followersSet = new Set(followersData.map(f => f.follower_id));
        setFollowingBackUsers(followersSet);
      }
    } catch (error) {
      console.error('Error fetching follow relationships:', error);
    }
  };



  // Refresh profile data when screen comes into focus (e.g., after deleting a routine or post)
  useFocusEffect(
    useCallback(() => {
      // Skip on initial mount to prevent fetching wrong profile data
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      if (currentProfile?.id && session?.user?.id) {
        console.log('Profile screen focused - refreshing data for profile ID:', currentProfile.id);
        
        // Refresh profile data to ensure posts_count is up-to-date
        fetchProfile(currentProfile.id, session.user.id, false);
        
        // Refresh other data without showing loading spinners
        fetchLatestPost(currentProfile.id, false);
        fetchRecentWorkouts(currentProfile.id, false);
        fetchRoutines(currentProfile.id, false);
        fetchRecentMedia(currentProfile.id, false);
        // Note: Not refreshing workoutDays and activity data as they change less frequently
      }
    }, [currentProfile?.id, session?.user?.id])
  );

  // Enhanced chart area press handler for tapping anywhere
  const handleChartAreaPress = (event: any) => {
    // Handle both direct dot clicks and area clicks
    let locationX: number;
    let index: number | undefined;
    
    if (event.index !== undefined) {
      // Direct dot click - use the provided index
      index = event.index;
    } else if (event.nativeEvent) {
      // Area click - calculate the index from location
      locationX = event.nativeEvent.locationX;
      const chartWidth = Dimensions.get('window').width;
      const paddingLeft = 55; // Chart's left padding - match vertical line calc
      const paddingRight = 20; // Chart's right padding
      const actualChartWidth = chartWidth - paddingLeft - paddingRight;
      
      // Calculate relative position within the chart
      const relativeX = locationX - paddingLeft;
      const progress = Math.max(0, Math.min(1, relativeX / actualChartWidth));
      
      // Find the closest data point
      const dataCount = activityData.labels.length;
      index = Math.round(progress * (dataCount - 1));
    }
    
    if (index !== undefined && index >= 0 && index < activityData.labels.length) {
      const value = activityData.datasets[0]?.data[index];
      // Use the original full labels array for display, not the filtered display labels
      const originalLabels = generateOriginalLabels();
      const label = originalLabels[index] || `Point ${index + 1}`;
      
      if (value !== undefined) {
        // Add haptic feedback when a point is selected
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        setSelectedPointIndex(index);
        setSelectedValue(value);
        setSelectedLabel(label);
      }
    }
  };

  // Pan gesture handler for dragging across the chart
  const handlePanGesture = (event: any) => {
    const { x } = event.nativeEvent;
    const chartWidth = Dimensions.get('window').width;
    const paddingLeft = 55; // Chart's left padding - match vertical line calc
    const paddingRight = 20; // Chart's right padding
    const actualChartWidth = chartWidth - paddingLeft - paddingRight;
    
    // Calculate relative position within the chart
    const relativeX = x - paddingLeft;
    const progress = Math.max(0, Math.min(1, relativeX / actualChartWidth));
    
    // Find the closest data point
    const dataCount = activityData.labels.length;
    const index = Math.round(progress * (dataCount - 1));
    
    if (index >= 0 && index < dataCount && index !== selectedPointIndex) {
      const value = activityData.datasets[0]?.data[index];
      // Use the original full labels array for display, not the filtered display labels
      const originalLabels = generateOriginalLabels();
      const label = originalLabels[index] || `Point ${index + 1}`;
      
      if (value !== undefined) {
        // Add haptic feedback when a new point is selected during drag
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        setSelectedPointIndex(index);
        setSelectedValue(value);
        setSelectedLabel(label);
      }
    }
  };

  // Helper function to generate original labels without filtering
  const generateOriginalLabels = () => {
    const labels: string[] = [];
    const now = new Date();
    
    let days = 30;
    let labelFormat = 'MMM dd';
    let showDataPoints = 10;
    let aggregateBy = 'day';
    
    switch (selectedTimeRange) {
      case 'week': 
        days = 7; 
        labelFormat = 'EEE';
        showDataPoints = 7;
        aggregateBy = 'day';
        break;
      case 'month': 
        days = 30; 
        labelFormat = 'MMM dd';
        showDataPoints = 10;
        aggregateBy = 'day';
        break;
      case '3months': 
        days = 90; 
        labelFormat = 'MMM dd';
        showDataPoints = 12;
        aggregateBy = 'week';
        break;
      case 'year': 
        days = 365; 
        labelFormat = 'MMM';
        showDataPoints = 12;
        aggregateBy = 'month';
        break;
      case 'all': 
        days = 730;
        labelFormat = 'MMM yy';
        showDataPoints = 15;
        aggregateBy = 'month';
        break;
    }

    // Generate the same data structure as in processActivityDataForChart but only return labels
    const generateDailyData = () => {
      const dailyData: { date: Date; value: number }[] = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(now, i);
        dailyData.push({ date, value: 0 }); // We only need dates for labels
      }
      
      return dailyData;
    };

    const dailyData = generateDailyData();
    
    // Aggregate labels based on time range (same logic as in processActivityDataForChart)
    if (aggregateBy === 'day') {
      dailyData.forEach(({ date }) => {
        labels.push(format(date, labelFormat));
      });
    } else if (aggregateBy === 'week') {
      const weeklyData: { [key: string]: boolean } = {};
      
      dailyData.forEach(({ date }) => {
        const weekStart = startOfWeek(date);
        const weekLabel = format(weekStart, 'MMM dd');
        
        if (!weeklyData[weekLabel]) {
          weeklyData[weekLabel] = true;
          labels.push(weekLabel);
        }
      });
    } else if (aggregateBy === 'month') {
      const monthlyData: { [key: string]: boolean } = {};
      
      dailyData.forEach(({ date }) => {
        const monthLabel = format(date, labelFormat);
        
        if (!monthlyData[monthLabel]) {
          monthlyData[monthLabel] = true;
          labels.push(monthLabel);
        }
      });
    }

    // Return the last showDataPoints labels (same as in processActivityDataForChart)
    return labels.slice(-showDataPoints);
  };

  // Reset selection when metric or time range changes
  const resetSelection = () => {
    setSelectedPointIndex(null);
    setSelectedValue(null);
    setSelectedLabel(null);
    setSelectedPointX(null);
    setActivityStats(null);
  };

  useEffect(() => {
    if (currentProfile?.id) {
      resetSelection();
      fetchActivityData(currentProfile.id);
    }
  }, [selectedMetric, selectedTimeRange, currentProfile?.id]);

  const fetchRoutines = async (profileId: string, showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setRoutinesLoading(true);
      }
      
      // Fetch user's own routines
      const { data: ownRoutines, error: ownError } = await supabase
        .from('routines')
        .select(`
          id,
          name,
          created_at,
          user_id,
          original_creator_id,
          routine_exercises (
            id
          )
        `)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });
      
      if (ownError) throw ownError;

      // Fetch saved routines for the current user (only if viewing own profile)
      let savedRoutines = [];
      if (profileId === session?.user?.id) {
        const { data: savedData, error: savedError } = await supabase
          .from('saved_routines')
          .select(`
            created_at,
            routines (
              id,
              name,
              created_at,
              user_id,
              original_creator_id,
              routine_exercises (
                id
              )
            )
          `)
          .eq('user_id', profileId)
          .order('created_at', { ascending: false });

        if (savedError) {
          console.warn('Error fetching saved routines:', savedError);
        } else {
          savedRoutines = savedData?.map(item => ({
            ...item.routines,
            isSaved: true,
            saved_at: item.created_at
          })) || [];
        }
      }
      
      // Combine own routines and saved routines
      const allRoutines = [
        ...ownRoutines.map(routine => ({ ...routine, isSaved: false })),
        ...savedRoutines
      ];

      // Process routines to include exercise count
      const processedRoutines = allRoutines.map(routine => ({
        id: routine.id,
        name: routine.name,
        exerciseCount: routine.routine_exercises?.length || 0,
        created_at: routine.created_at,
        isSaved: routine.isSaved || false,
        saved_at: routine.saved_at || null
      }));
      
      // Sort by creation date (own routines) or saved date (saved routines)
      processedRoutines.sort((a, b) => {
        const dateA = new Date(a.isSaved ? a.saved_at : a.created_at);
        const dateB = new Date(b.isSaved ? b.saved_at : b.created_at);
        return dateB.getTime() - dateA.getTime();
      });
      
      setRoutines(processedRoutines);
    } catch (err) {
      console.error('Error fetching routines:', err);
      // For demo purposes, generate mock routines if no real data exists
      generateMockRoutines();
    } finally {
      setRoutinesLoading(false);
    }
  };
  
  // Helper function to generate mock routines if needed
  const generateMockRoutines = () => {
    const routineNames = [
      "Upper Body Split", 
      "Lower Body Focus", 
      "Push Day", 
      "Pull Day", 
      "Full Body Workout",
      "Cardio & Core"
    ];
    
    const mockRoutines = routineNames.map((name, index) => ({
      id: index.toString(),
      name,
      exerciseCount: Math.floor(Math.random() * 6) + 3, // 3-8 exercises
      created_at: new Date().toISOString()
    }));
    
    setRoutines(mockRoutines);
  };

  const fetchRecentWorkouts = async (profileId: string, showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setWorkoutsLoading(true);
      }
      
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id,
          name,
          start_time,
          end_time,
          duration,
          notes,
          workout_exercises(
            id,
            name,
            notes,
            workout_sets(
              id,
              weight,
              reps,
              rpe,
              is_completed,
              order_index
            )
          )
        `)
        .eq('user_id', profileId)
        .order('start_time', { ascending: false });
      
      if (error) throw error;
      
      // Process the data to calculate total sets for each exercise
      const processedWorkouts = data?.map(workout => {
        const exercises = workout.workout_exercises.map(exercise => {
          // Sort sets by order_index
          const sets = exercise.workout_sets.sort((a, b) => a.order_index - b.order_index);
          
          return {
            ...exercise,
            // Calculate metrics from the sets
            sets: sets.length,
            reps: sets.length > 0 ? sets[0].reps : 0, // Using first set for display
            weight: sets.length > 0 ? sets[0].weight : 0 // Using first set for display
          };
        });
        
        return {
          ...workout,
          workout_exercises: exercises
        };
      }) || [];
      
      setRecentWorkouts(processedWorkouts);
    } catch (err) {
      console.error('Error fetching recent workouts:', err);
      // For demo purposes, generate mock data if no real data exists
      generateMockWorkouts();
    } finally {
      setWorkoutsLoading(false);
    }
  };
  
  // Helper function to generate mock workouts if needed
  const generateMockWorkouts = () => {
    const mockWorkouts = [];
    const now = new Date();
    
    for (let i = 0; i < 5; i++) {
      const workoutDate = new Date(now);
      workoutDate.setDate(workoutDate.getDate() - (i * 2)); // Every other day
      
      const durationMinutes = Math.floor(Math.random() * 60) + 30; // 30-90 minutes
      const exerciseCount = Math.floor(Math.random() * 5) + 3; // 3-7 exercises
      
      // Create random exercises
      const exercises = [];
      for (let j = 0; j < exerciseCount; j++) {
        const exerciseNames = [
          "Bench Press", "Squats", "Deadlift", "Pull-ups", 
          "Shoulder Press", "Leg Press", "Bicep Curls", "Lat Pulldown"
        ];
        
        exercises.push({
          id: j,
          name: exerciseNames[Math.floor(Math.random() * exerciseNames.length)],
          sets: Math.floor(Math.random() * 3) + 2, // 2-4 sets
          reps: Math.floor(Math.random() * 8) + 8, // 8-15 reps
          weight: Math.floor(Math.random() * 80) + 20 // 20-100kg
        });
      }
      
      mockWorkouts.push({
        id: i,
        name: ["Push Day", "Pull Day", "Leg Day", "Upper Body", "Lower Body", "Full Body"][Math.floor(Math.random() * 6)],
        start_time: workoutDate.toISOString(),
        duration: durationMinutes * 60, // in seconds
        workout_exercises: exercises
      });
    }
    
    setRecentWorkouts(mockWorkouts);
  };

  const fetchRecentMedia = async (profileId: string, showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setMediaLoading(true);
      }
      
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
        .order('created_at', { ascending: false })
        .limit(10); // Get recent posts with media
      
      if (error) throw error;
      
      // Flatten and process media from all posts
      const allMedia: any[] = [];
      data?.forEach(post => {
        post.post_media?.forEach((media: any) => {
          let processedUri = media.storage_path;
          
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
          
          allMedia.push({
            id: media.id,
            type: media.media_type,
            uri: processedUri,
            width: media.width,
            height: media.height,
            duration: media.duration,
            order_index: media.order_index,
            post_id: post.id,
            post_description: post.description,
            created_at: post.created_at
          });
        });
      });
      
      // Sort by creation date and take the most recent
      const sortedMedia = allMedia.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setRecentMedia(sortedMedia);
    } catch (err) {
      console.error('Error fetching recent media:', err);
      // If there's an error fetching real data, set empty array
      setRecentMedia([]);
    } finally {
      setMediaLoading(false);
    }
  };

  const fetchActivityData = async (profileId: string) => {
    try {
      setActivityDataLoading(true);
      
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (selectedTimeRange) {
        case 'week':
          startDate = subDays(now, 7);
          break;
        case 'month':
          startDate = subDays(now, 30);
          break;
        case '3months':
          startDate = subDays(now, 90);
          break;
        case 'year':
          startDate = subDays(now, 365);
          break;
        case 'all':
          startDate = subDays(now, 730); // 2 years for "all"
          break;
        default:
          startDate = subDays(now, 30);
      }

      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id,
          name,
          start_time,
          duration,
          workout_exercises(
            workout_sets(
              weight,
              reps,
              is_completed
            )
          )
        `)
        .eq('user_id', profileId)
        .gte('start_time', startDate.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Process data based on selected metric
      const processedData = processActivityDataForChart(data || []);
      setActivityData(processedData);
      
      // Calculate and set activity stats
      calculateActivityStats(data || []);
      
      // If no real data exists, provide a helpful message but still show an empty chart
      if (!data || data.length === 0) {
        console.log('No workout data found for the selected time period');
      }
    } catch (err) {
      console.error('Error fetching activity data:', err);
      // Fallback to empty chart instead of mock data for real data mode
      setActivityData({
        labels: [],
        datasets: [{
          data: [],
          color: (opacity = 1) => colors.brand,
          strokeWidth: 2
        }]
      });
      setActivityStats({
        total: 0,
        average: 0,
        max: 0,
        activeDays: 0
      });
    } finally {
      setActivityDataLoading(false);
    }
  };

  const processActivityDataForChart = (workouts: any[]) => {
    // Initialize time range settings
    let days = 30;
    let labelFormat = 'MMM dd';
    let showDataPoints = 10;
    let aggregateBy = 'day';
    
    switch (selectedTimeRange) {
      case 'week': 
        days = 7; 
        labelFormat = 'EEE';
        showDataPoints = 7;
        aggregateBy = 'day';
        break;
      case 'month': 
        days = 30; 
        labelFormat = 'MMM dd';
        showDataPoints = 10;
        aggregateBy = 'day';
        break;
      case '3months': 
        days = 90; 
        labelFormat = 'MMM dd';
        showDataPoints = 12;
        aggregateBy = 'week';
        break;
      case 'year': 
        days = 365; 
        labelFormat = 'MMM';
        showDataPoints = 12;
        aggregateBy = 'month';
        break;
      case 'all': 
        days = 730;
        labelFormat = 'MMM yy';
        showDataPoints = 15;
        aggregateBy = 'month';
        break;
    }

    const now = new Date();
    const dataPoints: { [key: string]: number } = {};
    
    // Initialize all time periods with 0 values
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(now, i);
      let key: string;
      
      if (aggregateBy === 'day') {
        key = format(date, labelFormat);
      } else if (aggregateBy === 'week') {
        key = format(startOfWeek(date), 'MMM dd');
      } else {
        key = format(date, labelFormat);
      }
      
      if (!dataPoints[key]) {
        dataPoints[key] = 0;
      }
    }
    
    // Process workout data
    workouts.forEach(workout => {
      const workoutDate = new Date(workout.start_time);
      let key: string;
      
      if (aggregateBy === 'day') {
        key = format(workoutDate, labelFormat);
      } else if (aggregateBy === 'week') {
        key = format(startOfWeek(workoutDate), 'MMM dd');
      } else {
        key = format(workoutDate, labelFormat);
      }
      
      if (!dataPoints[key]) {
        dataPoints[key] = 0;
      }
      
      switch (selectedMetric) {
        case 'duration':
          // Duration in minutes
          dataPoints[key] += Math.floor((workout.duration || 0) / 60);
          break;
        case 'volume':
          let totalVolume = 0;
          workout.workout_exercises?.forEach((exercise: any) => {
            exercise.workout_sets?.forEach((set: any) => {
              if (set.is_completed && set.weight && set.reps) {
                // Convert weight from kg (database storage) to user's preferred unit for display
                const displayWeight = convertWeight(set.weight, 'kg', userWeightUnit);
                totalVolume += displayWeight * set.reps;
              }
            });
          });
          dataPoints[key] += totalVolume;
          break;
        case 'reps':
          let totalReps = 0;
          workout.workout_exercises?.forEach((exercise: any) => {
            exercise.workout_sets?.forEach((set: any) => {
              if (set.is_completed && set.reps) {
                totalReps += set.reps;
              }
            });
          });
          dataPoints[key] += totalReps;
          break;
      }
    });

    // Convert to arrays and limit to showDataPoints
    const labels = Object.keys(dataPoints);
    const values = Object.values(dataPoints);
    
    const displayLabels = labels.slice(-showDataPoints);
    const displayValues = values.slice(-showDataPoints);

    // Reduce label clutter for longer time ranges
    const finalLabels = displayLabels.map((label, index) => {
      if (selectedTimeRange === 'month' || selectedTimeRange === '3months' || selectedTimeRange === 'year' || selectedTimeRange === 'all') {
        return index % 2 === 0 ? label : '';
      }
      return label;
    });

    // Auto-select the rightmost point
    if (finalLabels.length > 0 && displayValues.length > 0) {
      const lastIndex = finalLabels.length - 1;
      setSelectedPointIndex(lastIndex);
      setSelectedValue(displayValues[lastIndex]);
      setSelectedLabel(finalLabels[lastIndex]);
    }

    return {
      labels: finalLabels,
      datasets: [{
        data: displayValues,
        color: (opacity = 1) => colors.brand,
        strokeWidth: 2
      }]
    };
  };

  const calculateActivityStats = (workouts: any[]) => {
    if (!workouts || workouts.length === 0) {
      setActivityStats({
        total: 0,
        average: 0,
        max: 0,
        activeDays: 0
      });
      return;
    }

    let totalValue = 0;
    let maxValue = 0;
    const activeDaysSet = new Set<string>();

    workouts.forEach(workout => {
      const workoutDate = format(new Date(workout.start_time), 'yyyy-MM-dd');
      activeDaysSet.add(workoutDate);

      let workoutValue = 0;
      
      switch (selectedMetric) {
        case 'duration':
          workoutValue = Math.floor((workout.duration || 0) / 60);
          break;
        case 'volume':
          workout.workout_exercises?.forEach((exercise: any) => {
            exercise.workout_sets?.forEach((set: any) => {
              if (set.is_completed && set.weight && set.reps) {
                const displayWeight = convertWeight(set.weight, 'kg', userWeightUnit);
                workoutValue += displayWeight * set.reps;
              }
            });
          });
          break;
        case 'reps':
          workout.workout_exercises?.forEach((exercise: any) => {
            exercise.workout_sets?.forEach((set: any) => {
              if (set.is_completed && set.reps) {
                workoutValue += set.reps;
              }
            });
          });
          break;
      }
      
      totalValue += workoutValue;
      maxValue = Math.max(maxValue, workoutValue);
    });

    const activeDays = activeDaysSet.size;
    const average = activeDays > 0 ? Math.round(totalValue / activeDays) : 0;

    setActivityStats({
      total: Math.round(totalValue),
      average,
      max: Math.round(maxValue),
      activeDays
    });
  };

  const generateMockActivityData = () => {
    const labels: string[] = [];
    const values: number[] = [];
    const now = new Date();
    
    let days = 7;
    let labelFormat = 'MMM dd';
    let showDataPoints = 10;
    let aggregateBy = 'day'; // 'day', 'week', 'month'
    
    switch (selectedTimeRange) {
      case 'week': 
        days = 7; 
        labelFormat = 'EEE'; // Mon, Tue, Wed
        showDataPoints = 7;
        aggregateBy = 'day';
        break;
      case 'month': 
        days = 30; 
        labelFormat = 'MMM dd';
        showDataPoints = 10;
        aggregateBy = 'day';
        break;
      case '3months': 
        days = 90; 
        labelFormat = 'MMM dd';
        showDataPoints = 12;
        aggregateBy = 'week';
        break;
      case 'year': 
        days = 365; 
        labelFormat = 'MMM';
        showDataPoints = 12;
        aggregateBy = 'month';
        break;
      case 'all': 
        days = 730; // 2 years for comprehensive data
        labelFormat = 'MMM yy';
        showDataPoints = 15;
        aggregateBy = 'month';
        break;
    }

    // Generate realistic activity patterns with seasonal variation
    const generateDailyData = () => {
      const dailyData: { date: Date; value: number }[] = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(now, i);
        const dayOfWeek = date.getDay();
        const monthOfYear = date.getMonth();
        
        // Seasonal patterns (higher activity in spring/summer)
        const seasonalMultiplier = Math.sin((monthOfYear + 3) * Math.PI / 6) * 0.3 + 1;
        
        // Weekly patterns
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isMondayOrTuesday = dayOfWeek === 1 || dayOfWeek === 2;
        
        // Realistic activity probability
        let activityChance = 0.6; // Base chance
        if (isWeekend) activityChance = 0.45; // Lower weekend activity
        if (isMondayOrTuesday) activityChance = 0.75; // Higher early week
        
        let value = 0;
        if (Math.random() < activityChance) {
          // Progressive overload pattern (gradual increase over time)
          const progressFactor = 1 + (days - i) / days * 0.5;
          
          // Base intensity with natural variation
          const baseIntensity = 0.3 + Math.random() * 0.7;
          const weekendMultiplier = isWeekend ? 1.4 : 1.0; // Longer weekend sessions
          
          switch (selectedMetric) {
            case 'duration':
              // 20-150 minutes with realistic distribution
              const baseDuration = 35 + Math.random() * 85;
              value = Math.floor(baseDuration * weekendMultiplier * seasonalMultiplier * progressFactor);
              break;
              
            case 'volume':
              // 500-12000 kg with progressive overload
              const baseVolume = 1200 + Math.random() * 6000;
              const intensityVariation = Math.random() > 0.2 ? 1 : 0.6; // Some lighter days
              value = Math.floor(baseVolume * intensityVariation * seasonalMultiplier * progressFactor);
              break;
              
            case 'reps':
              // 25-450 reps with workout type variation
              const workoutType = Math.random();
              let baseReps;
              if (workoutType < 0.3) {
                // Heavy lifting day (lower reps)
                baseReps = 25 + Math.random() * 75;
              } else if (workoutType < 0.7) {
                // Moderate day
                baseReps = 80 + Math.random() * 120;
              } else {
                // High volume day
                baseReps = 200 + Math.random() * 250;
              }
              value = Math.floor(baseReps * seasonalMultiplier * progressFactor);
              break;
          }
          
          // Add natural variation (±15%)
          value = Math.floor(value * (0.85 + Math.random() * 0.3));
          
          // Ensure minimum values
          value = Math.max(value, selectedMetric === 'duration' ? 15 : 
                                 selectedMetric === 'volume' ? 200 : 10);
        }
        
        dailyData.push({ date, value });
      }
      
      return dailyData;
    };

    const dailyData = generateDailyData();
    
    // Aggregate data based on time range
    if (aggregateBy === 'day') {
      // Use daily data directly
      dailyData.forEach(({ date, value }) => {
        labels.push(format(date, labelFormat));
        values.push(value);
      });
    } else if (aggregateBy === 'week') {
      // Group by week
      const weeklyData: { [key: string]: number[] } = {};
      
      dailyData.forEach(({ date, value }) => {
        const weekStart = startOfWeek(date);
        const weekLabel = format(weekStart, 'MMM dd');
        
        if (!weeklyData[weekLabel]) {
          weeklyData[weekLabel] = [];
        }
        weeklyData[weekLabel].push(value);
      });
      
      Object.entries(weeklyData).forEach(([weekLabel, weekValues]) => {
        labels.push(weekLabel);
        // Sum values for the week
        values.push(weekValues.reduce((sum, val) => sum + val, 0));
      });
    } else if (aggregateBy === 'month') {
      // Group by month
      const monthlyData: { [key: string]: number[] } = {};
      
      dailyData.forEach(({ date, value }) => {
        const monthLabel = format(date, labelFormat);
        
        if (!monthlyData[monthLabel]) {
          monthlyData[monthLabel] = [];
        }
        monthlyData[monthLabel].push(value);
      });
      
      Object.entries(monthlyData).forEach(([monthLabel, monthValues]) => {
        labels.push(monthLabel);
        // Calculate monthly average for better visualization
        const total = monthValues.reduce((sum, val) => sum + val, 0);
        const average = monthValues.length > 0 ? Math.floor(total / monthValues.length) : 0;
        values.push(average);
      });
    }

    // Ensure we show the right number of data points
    const displayLabels = labels.slice(-showDataPoints);
    const displayValues = values.slice(-showDataPoints);

    // Add some smoothing for better visual appeal
    const smoothedValues = displayValues.map((value, index) => {
      if (index === 0 || index === displayValues.length - 1) return value;
      
      const prev = displayValues[index - 1];
      const next = displayValues[index + 1];
      const smoothed = Math.floor((prev + value + next) / 3);
      
      // Don't over-smooth, keep some variation
      return Math.floor(value * 0.7 + smoothed * 0.3);
    });

    // Reduce label clutter by showing every other label for longer time ranges
    const finalLabels = displayLabels.map((label, index) => {
      if (selectedTimeRange === 'month' || selectedTimeRange === '3months' || selectedTimeRange === 'year' || selectedTimeRange === 'all') {
        return index % 2 === 0 ? label : '';
      }
      return label;
    });

    setActivityData({
      labels: finalLabels,
      datasets: [{
        data: smoothedValues,
        color: (opacity = 1) => colors.brand, // Full brand color
        strokeWidth: 2
      }]
    });

    // Calculate stats
    const activeDays = smoothedValues.filter(value => value > 0).length;
    const total = smoothedValues.reduce((sum, value) => sum + value, 0);
    const average = activeDays > 0 ? Math.round(total / activeDays) : 0;
    const max = Math.max(...smoothedValues);
    
    setActivityStats({
      total,
      average,
      max,
      activeDays
    });

    // Auto-select the rightmost point
    if (finalLabels.length > 0 && smoothedValues.length > 0) {
      const lastIndex = finalLabels.length - 1;
      setSelectedPointIndex(lastIndex);
      setSelectedValue(smoothedValues[lastIndex]);
      setSelectedLabel(finalLabels[lastIndex]);
    }
  };

  const fetchWorkoutDays = async (profileId: string) => {
    try {
      setActivityLoading(true);
      
      // Get current date to calculate start of month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Fetch posts with workout_id for the user
      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          created_at,
          workout_id
        `)
        .eq('user_id', profileId)
        .gte('created_at', startOfMonth.toISOString());
      
      if (error) throw error;
      
      // Extract days with workouts
      const days: number[] = [];
      
      posts.forEach(post => {
        if (post.workout_id) {
          const postDate = new Date(post.created_at);
          days.push(postDate.getDate());
        }
      });
      
      setWorkoutDays([...new Set(days)]); // Deduplicate days
    } catch (err) {
      console.error('Error fetching workout days:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  // Function to fetch the most recent post
  const fetchLatestPost = async (profileId: string, showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setPostLoading(true);
      }
      
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          description,
          title,
          created_at,
          likes_count,
          user_id,
          workout_id,
          profiles:user_id(id, username, avatar_url, full_name),
          post_media(id, storage_path, media_type, width, height, duration, order_index)
        `)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const post = data[0];
        // Handle profiles data (could be array or single object)
        const profileData = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
        
        // Transform the post data to match the Post component's expected format
        const formattedPost = {
          id: post.id,
          user: {
            id: profileData?.id,
            username: profileData?.username,
            full_name: profileData?.full_name,
            avatar_url: profileData?.avatar_url
          },
          createdAt: post.created_at,
          title: post.title,
          text: post.description,
          workout_id: post.workout_id,
          media: post.post_media ? post.post_media.map((media: any) => ({
            id: media.id,
            type: media.media_type,
            uri: media.storage_path.startsWith('http') 
              ? media.storage_path 
              : `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/user-content/${media.storage_path}`,
            width: media.width,
            height: media.height,
            duration: media.duration,
            order_index: media.order_index
          })).sort((a: any, b: any) => a.order_index - b.order_index) : [],
          likes: post.likes_count || 0,
          comments: [] // You'll implement comment fetching separately
        };
        
        setLatestPost(formattedPost);
      } else {
        setLatestPost(null);
      }
    } catch (err) {
      console.error('Error fetching latest post:', err);
    } finally {
      setPostLoading(false);
    }
  };

  const handleFollowAction = async () => {
    if (!session?.user?.id || !currentProfile) return; 
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const wasFollowing = currentProfile.is_following;
    
    // Optimistic update - immediately update the UI
    const optimisticUpdate = {
      is_following: !wasFollowing,
      followers_count: wasFollowing 
        ? (currentProfile.followers_count || 1) - 1 
        : (currentProfile.followers_count || 0) + 1
    };
    
    // Update the profile store optimistically
    updateCurrentProfile(optimisticUpdate);
    
    try {
      if (wasFollowing) {
        await unfollowUser(currentProfile.id, session.user.id);
      } else {
        await followUser(currentProfile.id, session.user.id);
      }
    } catch (error) {
      // Revert on error
      const revertUpdate = {
        is_following: wasFollowing,
        followers_count: currentProfile.followers_count
      };
      updateCurrentProfile(revertUpdate);
      console.error('Error toggling follow:', error);
    }
  };

  const toggleAvatarFullscreen = () => {
    setIsAvatarFullscreen(!isAvatarFullscreen);
  };

  const handleMetricSelection = (metric: 'duration' | 'volume' | 'reps') => {
    setSelectedMetric(metric);
    metricBottomSheetRef.current?.close();
  };

  const handleTimeRangeSelection = (range: 'week' | 'month' | '3months' | 'year' | 'all') => {
    setSelectedTimeRange(range);
    timeRangeBottomSheetRef.current?.close();
  };

  const getMetricLabel = () => {
    switch (selectedMetric) {
      case 'duration': return 'Duration (min)';
      case 'volume': return `Volume (${userWeightUnit})`;
      case 'reps': return 'Total Reps';
    }
  };

  const getTimeRangeLabel = () => {
    switch (selectedTimeRange) {
      case 'week': return 'Week';
      case 'month': return 'Month';
      case '3months': return '3 Months';
      case 'year': return 'Year';
      case 'all': return 'All Time';
    }
  };

  const getMetricUnit = () => {
    switch (selectedMetric) {
      case 'duration': return 'min';
      case 'volume': return userWeightUnit;
      case 'reps': return 'reps';
      default: return '';
    }
  };
  
  // Generate workout days if none exist
  if (workoutDays.length === 0) {
    const mockWorkoutDays = Array.from({ length: 15 }, () => 
      Math.floor(Math.random() * 31) + 1
    );
    setWorkoutDays([...new Set(mockWorkoutDays)]); // Remove duplicates
  }

  if (loading || postLoading || workoutsLoading || mediaLoading) {
    return <ProfileSkeleton />;
  }

  if (!currentProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Profile not found</Text>
        <TouchableOpacity
                activeOpacity={0.5} 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.rootContainer}>
      <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Profile header section */}
        <View style={styles.profileHeader}>
          <View style={styles.profileHeaderFirstRow}>
            <TouchableOpacity
                activeOpacity={0.5} onPress={toggleAvatarFullscreen}>
              <CachedAvatar 
                path={currentProfile.avatar_url}
                size={70}
                style={styles.profileImage}
                fallbackIconName="person-circle"
                fallbackIconColor={colors.secondaryText}
              />
            </TouchableOpacity>
            
            <View style={styles.profileInfoContainer}>
              {currentProfile.name && (
                <Text style={styles.displayName}>
                  {currentProfile.name}
                </Text>
              )}
              
              <View style={styles.followersRow}>
                <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.push(`/profile/${currentProfile.id}/followers`)} style={styles.statItem}>
                  <Text style={styles.statLabel}>Followers</Text>
                  <Text style={styles.statValue}>{currentProfile.followers_count || 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.push(`/profile/${currentProfile.id}/following`)} style={styles.statItem}>
                  <Text style={styles.statLabel}>Following</Text>
                  <Text style={styles.statValue}>{currentProfile.following_count || 0}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          {!isCurrentUser && (
            <View style={styles.headerButtons}>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={[styles.followButton, currentProfile?.is_following && styles.followingButton]}
                onPress={handleFollowAction}
              >
                <Text style={styles.buttonText}>
                  {currentProfile?.is_following ? 'Following' : 
                   (followingBackUsers.has(currentProfile?.id) ? 'Follow Back' : 'Follow')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Media Gallery Section */}
          {!mediaLoading && (
            <View style={[styles.mediaGallery, recentMedia.length === 0 && styles.emptyMediaGallery]}>
              <View style={styles.mediaGrid}>
                {recentMedia.length > 0 && (
                  recentMedia.slice(0, 4).map((media, index) => (
                    <TouchableOpacity
                activeOpacity={0.5}
                      key={media.id}
                      style={styles.mediaItem}
                      onPress={() => {
                        if (index === 3 && recentMedia.length > 4) {
                          // For the "All Media" button, just navigate without specific media
                          router.push(`/profile/${currentProfile.id}/media`);
                        } else {
                          // For specific media items, pass the media ID
                          router.push(`/profile/${currentProfile.id}/media?mediaId=${media.id}`);
                        }
                      }}
                    >
                      {index === 3 && recentMedia.length > 4 ? (
                        <View style={styles.allMediaOverlay}>
                          {media.type === 'video' ? (
                            <VideoThumbnail
                              videoUri={media.uri}
                              style={styles.mediaImage}
                            />
                          ) : (
                            <CachedImage
                              path={media.uri}
                              style={styles.mediaImage}
                            />
                          )}
                          <View style={styles.allMediaText}>
                            <Text style={styles.allMediaLabel}>All Media</Text>
                          </View>
                        </View>
                      ) : (
                        <>
                          {media.type === 'video' ? (
                            <VideoThumbnail
                              videoUri={media.uri}
                              style={styles.mediaImage}
                            />
                          ) : (
                            <CachedImage
                              path={media.uri}
                              style={styles.mediaImage}
                            />
                          )}
                        </>
                      )}
                      {media.type === 'video' && index !== 3 && (
                        <View style={styles.videoIndicator}>
                          <IonIcon name="play" size={16} color={colors.primaryText} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          )}
        </View>

        {/* Activity Graph Section */}
        <View style={styles.section}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityTitle}>Activity</Text>
            <View style={styles.activityControls}>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.controlButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  metricBottomSheetRef.current?.expand();
                }}
              >
                <Text style={styles.controlButtonText}>{getMetricLabel()}</Text>
                <IonIcon name="chevron-down" size={16} color={colors.secondaryText} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.controlButton}
                onPress={() => timeRangeBottomSheetRef.current?.expand()}
              >
                <Text style={styles.controlButtonText}>{getTimeRangeLabel()}</Text>
                <IonIcon name="chevron-down" size={16} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Selected Point Stats Section */}
          {selectedPointIndex !== null && selectedValue !== null && selectedLabel !== null && (
            <View style={styles.selectedPointStatsContainer}>
              <View style={styles.selectedPointDateContainer}>
                <Text style={styles.selectedPointDate}>{selectedLabel}</Text>
                <Text style={styles.selectedPointValueDisplay}>{selectedValue} {getMetricUnit()}</Text>
              </View>
            </View>
          )}
          
          {!activityDataLoading ? (
            <View style={styles.chartContainer}>
              {activityData.labels.length > 0 ? (
                <View style={styles.chartWrapper}>
                  <PanGestureHandler onGestureEvent={handlePanGesture}>
                    <Pressable
                      onPress={handleChartAreaPress} style={styles.chartPressable}>
                      <LineChart
                        data={{
                          ...activityData,
                          datasets: activityData.datasets.map(dataset => ({
                            ...dataset,
                            color: (opacity = 1) => colors.brand, // Full brand color for line
                            strokeWidth: 2,
                          }))
                        }}
                        width={Dimensions.get('window').width}
                        height={220}
                        yAxisInterval={1} // Show labels at max and min values
                        onDataPointClick={handleChartAreaPress}
                        chartConfig={{
                          backgroundColor: colors.background,
                          backgroundGradientFrom: colors.background,
                          backgroundGradientTo: colors.background,
                          decimalPlaces: 0,
                          color: (opacity = 1) => colors.brand, // Full brand color for line
                          labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                          style: {
                            borderRadius: 16,
                          },
                          propsForDots: {
                            r: '4',
                            strokeWidth: '2',
                            stroke: colors.brand,
                            fill: colors.background, // Hollow dots by default
                          },
                          // Customize grid lines
                          propsForBackgroundLines: {
                            strokeDasharray: '', // Solid line (no dashes)
                            stroke: colors.secondaryText,
                            strokeWidth: 1,
                            opacity: 0.2, // Very subtle grid lines
                          },
                          propsForVerticalLabels: {
                            fontSize: 12,
                            fill: colors.primaryText,
                          },
                          propsForHorizontalLabels: {
                            fontSize: 12,
                            fill: colors.primaryText,
                          }
                        }}
                        bezier
                        style={styles.chart}
                        withHorizontalLines={true}
                        withVerticalLines={true}
                        withDots={true}
                        segments={2}
                        renderDotContent={({ x, y, index }) => {
                          if (index === selectedPointIndex) {
                            // Store the exact x position for vertical line
                            if (selectedPointX !== x) {
                              setSelectedPointX(x);
                            }
                            return (
                              <View 
                                key={index} 
                                style={[
                                  styles.selectedPointOverlay, 
                                  { 
                                    left: x - 3, 
                                    top: y - 3,
                                  }
                                ]}
                              >
                                <View style={styles.selectedDotGlow} />
                                <View style={styles.selectedDot} />
                              </View>
                            );
                          }
                          return null;
                        }}
                      />
                    </Pressable>
                  </PanGestureHandler>
                  
                  {/* Vertical line indicator for selected point */}
                  {selectedPointIndex !== null && selectedPointX !== null && (
                    <View style={[styles.verticalLine, { 
                      left: selectedPointX
                    }]} />
                  )}
                </View>
              ) : (
                <View style={styles.chartEmptyContainer}>
                  <Text style={styles.chartEmptyText}>No workout data for selected period</Text>
                  <Text style={styles.chartEmptySubtext}>Start logging workouts to see your activity here</Text>
                </View>
              )}
            </View>
          ) : (
            <ActivityChartSkeleton />
          )}
        </View>

        <View style={[styles.section, { borderBottomWidth: 0 }]}>
          <View style={styles.menuContainer}>
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.menuItem}
              onPress={() => router.push(`/profile/${currentProfile.id}/routines`)}
            >
              <View style={styles.menuItemLeft}>
                <IonIcon name="barbell-outline" size={28} color={colors.primaryText} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Routines</Text>
                  <Text style={styles.menuItemCount}>{routines.length}</Text>
                </View>
              </View>
              <IonIcon name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.menuItem}
              onPress={() => router.push(`/profile/${currentProfile.id}/workouts`)}
            >
              <View style={styles.menuItemLeft}>
                <IonIcon name="fitness-outline" size={28} color={colors.primaryText} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Workouts</Text>
                  <Text style={styles.menuItemCount}>{recentWorkouts.length}</Text>
                </View>
              </View>
              <IonIcon name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.menuItem}
              onPress={() => router.push(`/profile/${currentProfile.id}/posts`)}
            >
              <View style={styles.menuItemLeft}>
                <IonIcon name="grid-outline" size={28} color={colors.primaryText} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Posts</Text>
                  <Text style={styles.menuItemCount}>{currentProfile.posts_count || 0}</Text>
                </View>
              </View>
              <IonIcon name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <View>
      <Modal
        animationType="fade"
        transparent={true}
        visible={isAvatarFullscreen}
        onRequestClose={toggleAvatarFullscreen}
      >
        <View style={styles.fullscreenModalContainer}>
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.fullscreenModalCloseButton} 
            onPress={toggleAvatarFullscreen}
          >
            <IonIcon name="close" size={28} color={colors.primaryText} />
          </TouchableOpacity>
          
          <View style={styles.fullscreenAvatarContainer}>
            <CachedAvatar 
              path={currentProfile?.avatar_url}
              size={300} // Large size for fullscreen view
              style={styles.fullscreenAvatar}
              fallbackIconName="person-circle"
              fallbackIconColor={colors.secondaryText}
            />
          </View>
        </View>
      </Modal>
      </View>

      {/* Bottom Sheets */}
      <BottomSheet
        ref={metricBottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <BottomSheetView style={styles.bottomSheetModalContent}>
          <Text style={styles.bottomSheetTitle}>Select Metric</Text>
          <Text style={styles.bottomSheetSubtitle}>Choose a metric to display in your activity graph</Text>
          
          <View style={styles.bottomSheetContent}>
            {['duration', 'volume', 'reps'].map((metric) => (
              <TouchableOpacity
                activeOpacity={0.5}
                key={metric}
                style={[
                  styles.bottomSheetOption,
                  selectedMetric === metric && styles.bottomSheetOptionSelected
                ]}
                onPress={() => handleMetricSelection(metric as 'duration' | 'volume' | 'reps')}
              >
                <View style={styles.bottomSheetOptionIcon}>
                  <IonIcon 
                    name={metric === 'duration' ? 'time-outline' : 
                          metric === 'volume' ? 'barbell-outline' : 'fitness-outline'} 
                    size={20} 
                    color={colors.primaryText} 
                  />
                </View>
                <View style={styles.bottomSheetOptionTextContainer}>
                  <Text style={[
                    styles.bottomSheetOptionText,
                    selectedMetric === metric && styles.bottomSheetOptionTextSelected
                  ]}>
                    {metric === 'duration' ? 'Duration (min)' : 
                     metric === 'volume' ? `Volume (${userWeightUnit})` : 'Total Reps'}
                  </Text>
                </View>
                {selectedMetric === metric && (
                  <IonIcon name="checkmark" size={20} color={colors.brand} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </BottomSheetView>
      </BottomSheet>

      <BottomSheet
        ref={timeRangeBottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <BottomSheetView style={styles.bottomSheetModalContent}>
          <Text style={styles.bottomSheetTitle}>Select Time Range</Text>
          <Text style={styles.bottomSheetSubtitle}>Choose a time period for your activity data</Text>
          
          <View style={styles.bottomSheetContent}>
            {[
              { key: 'week', label: 'Week' },
              { key: 'month', label: 'Month' },
              { key: '3months', label: '3 Months' },
              { key: 'year', label: 'Year' },
              { key: 'all', label: 'All Time' }
            ].map((range) => (
              <TouchableOpacity
                activeOpacity={0.5}
                key={range.key}
                style={[
                  styles.bottomSheetOption,
                  selectedTimeRange === range.key && styles.bottomSheetOptionSelected
                ]}
                onPress={() => handleTimeRangeSelection(range.key as 'week' | 'month' | '3months' | 'year' | 'all')}
              >
                <View style={styles.bottomSheetOptionIcon}>
                  <IonIcon 
                    name={range.key === 'week' ? 'calendar-outline' :
                          range.key === 'month' ? 'calendar-outline' :
                          range.key === '3months' ? 'calendar-outline' :
                          range.key === 'year' ? 'calendar-outline' : 'infinite-outline'} 
                    size={20} 
                    color={colors.primaryText} 
                  />
                </View>
                <View style={styles.bottomSheetOptionTextContainer}>
                  <Text style={[
                    styles.bottomSheetOptionText,
                    selectedTimeRange === range.key && styles.bottomSheetOptionTextSelected
                  ]}>
                    {range.label}
                  </Text>
                </View>
                {selectedTimeRange === range.key && (
                  <IonIcon name="checkmark" size={20} color={colors.brand} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    gap: 20,
  },
  contentContainer: {
    gap: 6,
    paddingBottom: 6,
  },
  profileHeader: {
    padding: 20,
    gap: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  profileHeaderFirstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  profileInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  followersRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 40,
    marginTop: 8,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 50,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 0,
  },
  statItem: {
    alignItems: 'flex-start',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primaryText,
  },
  statLabel: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  followButton: {
    width: 120,
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: -6,
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  menuContainer: {
    padding: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    marginLeft: 16,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 2,
  },
  menuItemCount: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  errorText: {
    color: colors.secondaryText,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  backButton: {
    backgroundColor: colors.brand,
    padding: 10,
    borderRadius: 8,
    margin: 20,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: colors.secondaryAccent,
  },
  fullscreenModalContainer: {
    flex: 1,
    backgroundColor: colors.background + 'E6', // 90% opacity
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenModalCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullscreenAvatarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenAvatar: {
    borderRadius: 150, // Half of the size to make it circular
  },
  // Activity Graph Styles
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  activityTitle: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: 'bold',
  },
  activityControls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    backgroundColor: colors.primaryAccent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  controlButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  chartContainer: {
    alignItems: 'center',
    paddingRight: 0,
  },
  chartWrapper: {
    position: 'relative',
    width: '100%',
  },
  chartPressable: {
    width: '100%',
  },
  chart: {
    borderRadius: 16,
  },
  verticalLine: {
    position: 'absolute',
    top: 0,
    bottom: 39,
    width: 2,
    backgroundColor: colors.brand,
    opacity: 0.8,
  },
  chartEmptyContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
  },
  chartEmptyText: {
    color: colors.secondaryText,
    fontSize: 16,
  },
  // Bottom Sheet Styles (matching newWorkout modal styling)
  bottomSheetBackground: {
    backgroundColor: colors.primaryAccent,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  bottomSheetIndicator: {
    backgroundColor: colors.secondaryText,
    width: 50,
  },
  bottomSheetModalContent: {
    flex: 1,
    padding: 10,
  },
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
    paddingBottom: 12,
  },
  bottomSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
  },
  bottomSheetOptionSelected: {
  },
  bottomSheetOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.whiteOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bottomSheetOptionTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  bottomSheetOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  bottomSheetOptionTextSelected: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.brand,
  },
  // Media Gallery Styles
  mediaGallery: {
    marginTop: 16,
  },
  emptyMediaGallery: {
    marginTop: 0,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  mediaItem: {
    width: '23.5%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  allMediaOverlay: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  allMediaText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  allMediaLabel: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  videoIndicator: {
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
  selectedDot: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 14,
    height: 14,
    backgroundColor: colors.brand,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.primaryAccent,
  },
  selectedDotGlow: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: colors.brand,
    borderRadius: 6,
    opacity: 0.3,
    top: -2,
    left: -2,
  },
  selectedPointStatsContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
    backgroundColor: colors.background,
  },
  selectedPointDateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedPointDate: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  selectedPointValueDisplay: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '700',
  },
  selectedPointOverlay: {
    position: 'absolute',
  },
  chartEmptySubtext: {
    color: colors.secondaryText,
    fontSize: 14,
    opacity: 0.8,
  },
});