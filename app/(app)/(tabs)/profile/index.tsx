import { View, Text, StyleSheet, ScrollView, Pressable, FlatList, ActivityIndicator, Modal, TouchableOpacity, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { colors } from '../../../../constants/colors';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import CachedAvatar from '../../../../components/CachedAvatar';
import CachedImage from '../../../../components/CachedImage';
import ProfileSkeleton from '../../../../components/ProfileSkeleton';
import ActivityChartSkeleton from '../../../../components/ActivityChartSkeleton';
import { useAuthStore } from '../../../../stores/authStore';
import { getUserWeightUnit, convertWeight } from '../../../../utils/weightUtils';
import { supabase } from '../../../../lib/supabase';
import { useProfileStore } from '../../../../stores/profileStore';
import { format, subDays, subMonths, subYears, subWeeks, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { Dimensions } from 'react-native';
import CustomLineChart from '../../../../components/CustomLineChart';

import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import VideoThumbnail from '../../../../components/VideoThumbnail';
import { setTabScrollRef } from '../_layout'; 

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
  
  const [weeklyMetricsData, setWeeklyMetricsData] = useState<{ [key: string]: { duration: number; volume: number; reps: number } }>({});
  
  // Activity metric selection state
  const [selectedMetric, setSelectedMetric] = useState<'duration' | 'volume' | 'reps'>('duration');
  
  useEffect(() => {setTabScrollRef('profile', scrollViewRef);}, []);

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
  const router = useRouter();

  // Get user's preferred weight unit
  const userWeightUnit = getUserWeightUnit(authProfile);

  // Helper function to format duration in minutes to "(x)d (x)h (x)m" format
  const formatDuration = (minutes: number): string => {
    if (minutes === 0) return '0m';
    
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    
    const parts: string[] = [];
    
    if (days > 0) {
      parts.push(`${days}d`);
    }
    
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    
    if (mins > 0 || parts.length === 0) {
      parts.push(`${mins}m`);
    }
    
    return parts.join(' ');
  };

  // Helper function to format volume with k/m notation
  const formatVolume = (volume: number): string => {
    if (volume === 0) return '0';
    
    if (volume >= 1000000) {
      const millions = volume / 1000000;
      return millions % 1 === 0 ? `${millions}m` : `${millions.toFixed(1)}m`;
    } else if (volume >= 1000) {
      const thousands = volume / 1000;
      return thousands % 1 === 0 ? `${thousands}k` : `${thousands.toFixed(1)}k`;
    }
    
    return volume.toString();
  };

  useEffect(() => {
    if (currentProfile?.id) {

      fetchLatestPost(currentProfile.id);
      fetchWorkoutDays(currentProfile.id);
      fetchRecentWorkouts(currentProfile.id);
      fetchRoutines(currentProfile.id);
      fetchActivityData(currentProfile.id);
      fetchRecentMedia(currentProfile.id);
    }
  }, [currentProfile?.id]);

  // Refresh profile data when screen comes into focus (e.g., after deleting a routine or post)
  useFocusEffect(
    useCallback(() => {
      // Skip on initial mount to prevent fetching wrong profile data
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      if (currentProfile?.id && session?.user?.id) {
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



  // Helper function to generate original labels for 12-week view
  const generateOriginalLabels = () => {
    const labels: string[] = [];
    const now = new Date();
    
    // Fixed 12-week view - generate labels for each week
    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i));
      const weekEnd = endOfWeek(weekStart);
      
      // Check if this is the current week (i === 0)
      if (i === 0) {
        labels.push("This week");
      } else {
        // Format: "Week of Oct 21 - Oct 27"
        const weekLabel = `Week of ${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`;
        labels.push(weekLabel);
      }
    }
    
    return labels;
  };

  // Helper function to generate Strava-style display labels (only show month when it changes)
  const generateStravaStyleLabels = (fullLabels: string[]) => {
    const displayLabels: string[] = [];
    const now = new Date();
    let lastDominantMonth = '';
    
    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i));
      const weekEnd = endOfWeek(weekStart);
      
      // Count days in each month for this week
      const monthCounts: { [month: string]: number } = {};
      
      // Check each day of the week to see which month it belongs to
      for (let day = 0; day < 7; day++) {
        const currentDay = new Date(weekStart);
        currentDay.setDate(currentDay.getDate() + day);
        const monthKey = format(currentDay, 'MMM');
        monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
      }
      
      // Find the month with the most days in this week
      let dominantMonth = '';
      let maxDays = 0;
      Object.entries(monthCounts).forEach(([month, days]) => {
        if (days > maxDays) {
          maxDays = days;
          dominantMonth = month;
        }
      });
      
      // Only show label if this week's dominant month is different from the last one
      if (dominantMonth !== lastDominantMonth) {
        displayLabels.push(dominantMonth.toUpperCase());
        lastDominantMonth = dominantMonth;
      } else {
        displayLabels.push(''); // Empty label for other weeks
      }
    }
    
    return displayLabels;
  };

  // Reset selection when metric or time range changes
  const resetSelection = () => {
    setSelectedPointIndex(null);
    setSelectedValue(null);
    setSelectedLabel(null);
    setSelectedPointX(null);
    setActivityStats(null);
  };

  // Update chart data based on selected metric without refetching
  const updateChartDataForMetric = () => {
    if (Object.keys(weeklyMetricsData).length === 0) return;

    const now = new Date();
    const weekKeys: string[] = [];
    
    // Generate week keys in the same order as original
    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i));
      const weekEnd = endOfWeek(weekStart);
      const weekKey = `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`;
      weekKeys.push(weekKey);
    }

    // Get values based on selected metric from existing data
    const values = weekKeys.map(key => {
      const metrics = weeklyMetricsData[key] || { duration: 0, volume: 0, reps: 0 };
      switch (selectedMetric) {
        case 'duration':
          return metrics.duration;
        case 'volume':
          return metrics.volume;
        case 'reps':
          return metrics.reps;
        default:
          return metrics.duration;
      }
    });
    
    // Generate Strava-style labels (only show month when it changes)
    const finalLabels = generateStravaStyleLabels(weekKeys);

    // Update chart data
    setActivityData({
      labels: finalLabels,
      datasets: [{
        data: values,
        color: (opacity = 1) => colors.brand,
        strokeWidth: 2
      }]
    });

    // Preserve the currently selected point index if it exists, otherwise select the rightmost point
    if (finalLabels.length > 0 && values.length > 0) {
      const targetIndex = selectedPointIndex !== null && selectedPointIndex < values.length 
        ? selectedPointIndex 
        : finalLabels.length - 1;
      
      setSelectedPointIndex(targetIndex);
      setSelectedValue(values[targetIndex]);
      
      // Use the display-friendly label from generateOriginalLabels which includes "This week"
      const originalLabels = generateOriginalLabels();
      const displayLabel = originalLabels[targetIndex] || weekKeys[targetIndex] || finalLabels[targetIndex];
      setSelectedLabel(displayLabel);
      
      // Calculate the X position for the vertical line
      const chartWidth = Dimensions.get('window').width - 55 - 20; // paddingLeft + paddingRight
      const paddingLeft = 55;
      const selectedPointX = paddingLeft + (targetIndex / (values.length - 1)) * chartWidth;
      setSelectedPointX(selectedPointX);
    }

    // Update stats for the new metric
    updateActivityStatsForMetric();
  };

  // Update activity stats based on selected metric without refetching
  const updateActivityStatsForMetric = () => {
    if (Object.keys(weeklyMetricsData).length === 0) {
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
    let activeWeeks = 0;

    Object.values(weeklyMetricsData).forEach(metrics => {
      let weekValue = 0;
      switch (selectedMetric) {
        case 'duration':
          weekValue = metrics.duration;
          break;
        case 'volume':
          weekValue = metrics.volume;
          break;
        case 'reps':
          weekValue = metrics.reps;
          break;
      }
      
      if (weekValue > 0) {
        activeWeeks++;
      }
      totalValue += weekValue;
      maxValue = Math.max(maxValue, weekValue);
    });

    const average = activeWeeks > 0 ? Math.round(totalValue / activeWeeks) : 0;

    setActivityStats({
      total: Math.round(totalValue),
      average,
      max: Math.round(maxValue),
      activeDays: activeWeeks
    });
  };

  useEffect(() => {
    if (currentProfile?.id) {
      resetSelection();
      fetchActivityData(currentProfile.id);
    }
  }, [currentProfile?.id]);

  // Update chart data when metric changes (preserve selection)
  useEffect(() => {
    if (currentProfile?.id && Object.keys(weeklyMetricsData).length > 0) {
      updateChartDataForMetric();
    }
  }, [selectedMetric]);

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
      
      // Fixed 12-week range
      const now = new Date();
      const startDate = subWeeks(now, 11); // 12 weeks total including current week

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
    const now = new Date();
    const dataPoints: { [key: string]: number } = {};
    const allMetricsData: { [key: string]: { duration: number; volume: number; reps: number } } = {};
    const weekKeys: string[] = [];
    
    // Initialize 12 weeks with 0 values and store keys in order
    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i));
      const weekEnd = endOfWeek(weekStart);
      const weekKey = `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`;
      dataPoints[weekKey] = 0;
      allMetricsData[weekKey] = { duration: 0, volume: 0, reps: 0 };
      weekKeys.push(weekKey);
    }
    
    // Process workouts and aggregate by week
    workouts.forEach(workout => {
      const workoutDate = new Date(workout.start_time);
      
      // Find which week this workout belongs to
      for (let i = 11; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(now, i));
        const weekEnd = endOfWeek(weekStart);
        
        if (workoutDate >= weekStart && workoutDate <= weekEnd) {
          const weekKey = `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`;
          
          // Calculate duration
          const duration = Math.floor((workout.duration || 0) / 60);
          allMetricsData[weekKey].duration += duration;
          
          // Calculate volume
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
          allMetricsData[weekKey].volume += totalVolume;
          
          // Calculate reps
          let totalReps = 0;
          workout.workout_exercises?.forEach((exercise: any) => {
            exercise.workout_sets?.forEach((set: any) => {
              if (set.is_completed && set.reps) {
                totalReps += set.reps;
              }
            });
          });
          allMetricsData[weekKey].reps += totalReps;
          
          break;
        }
      }
    });

    // Use the weekKeys array to maintain proper order
    const labels = weekKeys;
    // Get values based on selected metric
    const values = weekKeys.map(key => {
      switch (selectedMetric) {
        case 'duration':
          return allMetricsData[key].duration;
        case 'volume':
          return allMetricsData[key].volume;
        case 'reps':
          return allMetricsData[key].reps;
        default:
          return allMetricsData[key].duration;
      }
    });
    
    // Generate Strava-style labels (only show month when it changes)
    const finalLabels = generateStravaStyleLabels(labels);

    // Store the metrics data for access when points are selected
    setWeeklyMetricsData(allMetricsData);

    // Auto-select the rightmost point (most recent data)
    if (finalLabels.length > 0 && values.length > 0) {
      const lastIndex = finalLabels.length - 1;
      setSelectedPointIndex(lastIndex);
      setSelectedValue(values[lastIndex]);
      
      // Use the display-friendly label from generateOriginalLabels which includes "This week"
      const originalLabels = generateOriginalLabels();
      const displayLabel = originalLabels[lastIndex] || labels[lastIndex] || finalLabels[lastIndex];
      setSelectedLabel(displayLabel);
      
      // Calculate the X position for the vertical line
      // Match the CustomLineChart component's padding and positioning logic
      const chartWidth = Dimensions.get('window').width - 55 - 20; // paddingLeft + paddingRight
      const paddingLeft = 55;
      const selectedPointX = paddingLeft + (lastIndex / (values.length - 1)) * chartWidth;
      setSelectedPointX(selectedPointX);
    }

    return {
      labels: finalLabels,
      datasets: [{
        data: values,
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
      
      // Calculate value based on selected metric
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
    
    // Generate 12 weeks of mock data
    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i));
      const weekEnd = endOfWeek(weekStart);
      const weekKey = `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`;
      
      // Generate mock values with some variation (duration only)
      const baseValue = 180; // Base duration in minutes
      const variation = (Math.random() - 0.5) * 0.6; // ±30% variation
      const mockValue = Math.max(0, Math.round(baseValue * (1 + variation)));
      
      labels.push(weekKey);
      values.push(mockValue);
    }

    // Generate Strava-style labels (only show month when it changes)
    const finalLabels = generateStravaStyleLabels(labels);

    // Add some natural variation to make it look realistic
    const smoothedValues = values.map((value, index) => {
      // Add progressive improvement over time
      const progressFactor = 1 + (index / 12) * 0.3; // 30% improvement over 12 weeks
      const naturalVariation = 0.7 + Math.random() * 0.6; // ±30% natural variation
      return Math.floor(value * progressFactor * naturalVariation);
    });

    setActivityData({
      labels: finalLabels,
      datasets: [{
        data: smoothedValues,
        color: (opacity = 1) => colors.brand,
        strokeWidth: 2
      }]
    });

    // Calculate stats
    const activeWeeks = smoothedValues.filter(value => value > 0).length;
    const total = smoothedValues.reduce((sum, value) => sum + value, 0);
    const average = activeWeeks > 0 ? Math.round(total / activeWeeks) : 0;
    const max = Math.max(...smoothedValues);
    
    setActivityStats({
      total,
      average,
      max,
      activeDays: activeWeeks
    });

    // Auto-select the rightmost point
    if (finalLabels.length > 0 && smoothedValues.length > 0) {
      const lastIndex = finalLabels.length - 1;
      setSelectedPointIndex(lastIndex);
      setSelectedValue(smoothedValues[lastIndex]);
      
      // Use the display-friendly label from generateOriginalLabels which includes "This week"
      const originalLabels = generateOriginalLabels();
      const displayLabel = originalLabels[lastIndex] || labels[lastIndex] || finalLabels[lastIndex];
      setSelectedLabel(displayLabel);
      
      // Calculate the X position for the vertical line
      // Match the CustomLineChart component's padding and positioning logic
      const chartWidth = Dimensions.get('window').width - 55 - 20; // paddingLeft + paddingRight
      const paddingLeft = 55;
      const selectedPointX = paddingLeft + (lastIndex / (smoothedValues.length - 1)) * chartWidth;
      setSelectedPointX(selectedPointX);
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
                  {currentProfile?.is_following ? 'Following' : 'Follow'}
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
          {/* Metric Selection Buttons */}
          <View style={styles.metricSelectorContainer}>
            <TouchableOpacity
              style={[
                styles.metricButton,
                selectedMetric === 'duration' && styles.metricButtonActive
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedMetric('duration');
              }}
            >
              <IonIcon 
                name="time-outline" 
                size={16} 
                color={selectedMetric === 'duration' ? colors.brand : colors.secondaryText} 
              />
              <Text style={[
                styles.metricButtonText,
                selectedMetric === 'duration' && styles.metricButtonTextActive
              ]}>
                Duration
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.metricButton,
                selectedMetric === 'volume' && styles.metricButtonActive
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedMetric('volume');
              }}
            >
              <IonIcon 
                name="barbell-outline" 
                size={16} 
                color={selectedMetric === 'volume' ? colors.brand : colors.secondaryText} 
              />
              <Text style={[
                styles.metricButtonText,
                selectedMetric === 'volume' && styles.metricButtonTextActive
              ]}>
                Volume
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.metricButton,
                selectedMetric === 'reps' && styles.metricButtonActive
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedMetric('reps');
              }}
            >
              <IonIcon 
                name="repeat-outline" 
                size={16} 
                color={selectedMetric === 'reps' ? colors.brand : colors.secondaryText} 
              />
              <Text style={[
                styles.metricButtonText,
                selectedMetric === 'reps' && styles.metricButtonTextActive
              ]}>
                Reps
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Selected Point Stats Section */}
          {selectedPointIndex !== null && selectedValue !== null && selectedLabel !== null && (() => {
            // Get the week key from the original labels
            const originalLabels = generateOriginalLabels();
            const weekLabel = originalLabels[selectedPointIndex];
            
            // Find the corresponding week key in the metrics data
            let metricsForWeek = { duration: 0, volume: 0, reps: 0 };
            Object.entries(weeklyMetricsData).forEach(([key, metrics]) => {
              // Check if this week key corresponds to our selected week
              const weekStart = startOfWeek(subWeeks(new Date(), 11 - selectedPointIndex));
              const weekEnd = endOfWeek(weekStart);
              const expectedKey = `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`;
              if (key === expectedKey) {
                metricsForWeek = metrics;
              }
            });
            
            return (
              <View style={styles.selectedPointStatsContainer}>
                <View style={styles.selectedPointDateContainer}>
                  <Text style={styles.selectedPointDate}>{selectedLabel}</Text>
                </View>
                {/* Show all three metrics for the selected week */}
                <View style={styles.selectedPointMetricsContainer}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Duration</Text>
                    <Text style={styles.metricValue}>{formatDuration(Math.round(metricsForWeek.duration))}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Volume</Text>
                    <Text style={styles.metricValue}>{formatVolume(Math.round(metricsForWeek.volume))} {userWeightUnit}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Reps</Text>
                    <Text style={styles.metricValue}>{formatVolume(Math.round(metricsForWeek.reps))}</Text>
                  </View>
                </View>
              </View>
            );
          })()}
          
          {!activityDataLoading ? (
            <View style={styles.chartContainer}>
              {activityData.labels.length > 0 ? (
                <View style={styles.chartWrapper}>
                  <CustomLineChart
                        data={{
                          ...activityData,
                          datasets: activityData.datasets.map(dataset => ({
                            ...dataset,
                            color: (opacity = 1) => colors.brand,
                            strokeWidth: 2,
                          }))
                        }}
                        width={Dimensions.get('window').width}
                        height={140}
                        selectedPointIndex={selectedPointIndex}
                        onDataPointPress={(index, value, x, y) => {
                          // Use the original full labels array for display
                          const originalLabels = generateOriginalLabels();
                          const label = originalLabels[index] || `Point ${index + 1}`;
                          
                          setSelectedPointIndex(index);
                          setSelectedValue(value);
                          setSelectedLabel(label);
                          setSelectedPointX(x);
                        }}
                        onPanGesture={(x) => {
                          // Update vertical line position continuously during drag
                          setSelectedPointX(x);
                        }}
                        formatYLabel={(value: string) => {
                          const numValue = parseInt(value) || 0;
                          switch (selectedMetric) {
                            case 'duration':
                              return formatDuration(numValue);
                            case 'volume':
                              return `${formatVolume(numValue)} ${userWeightUnit}`;
                            case 'reps':
                              return formatVolume(numValue);
                            default:
                              return formatDuration(numValue);
                          }
                        }}
                        bezier={true}
                        style={styles.chart}
                        withHorizontalLines={false}
                        withVerticalLines={true}
                        withDots={true}
                        segments={1}
                        yAxisInterval={1}
                      />
                  
                  {/* Vertical line indicator for selected point */}
                  {selectedPointIndex !== null && selectedPointX !== null && (
                    <View style={[styles.verticalLine, { 
                      left: selectedPointX - 1, // Center the line
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

        <View style={styles.sectionLast}>
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
    width: 100,
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
    paddingVertical: 12,
  },
  sectionLast: {
    backgroundColor: colors.background,
    borderBottomWidth: 0,
  },
  menuContainer: {
    padding: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
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

  chartContainer: {
    alignItems: 'center',
    paddingRight: 0,
  },
  chartWrapper: {
    position: 'relative',
    width: '100%',
    marginBottom: -8,
  },
  chart: {
    borderRadius: 16,
  },
  verticalLine: {
    position: 'absolute',
    top: 20, // Match chart's top padding
    height: 80, // Match chart's actual drawing area height (140 - 20 - 20)
    width: 2,
    backgroundColor: colors.brand,
    opacity: 1, // Match main line opacity
    borderRadius: 0.75,
  },
  chartEmptyContainer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
  },
  chartEmptyText: {
    color: colors.secondaryText,
    fontSize: 16,
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

  selectedPointStatsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
  },
  selectedPointDateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -20,
    marginBottom: 12,
  },
  selectedPointDate: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  selectedPointMetricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.primaryAccent,
    borderRadius: 8,
    paddingVertical: 8,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: colors.secondaryText,
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 4,
  },
  metricValue: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },

  chartEmptySubtext: {
    color: colors.secondaryText,
    fontSize: 14,
    opacity: 0.8,
  },

  // Metric Selector Styles
  metricSelectorContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  metricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.primaryAccent,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
  },
  metricButtonActive: {
    borderColor: colors.brand,
  },
  metricButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primaryText,
  },
  metricButtonTextActive: {
    color: colors.brand,
  },
});