import { View, Text, ScrollView, StyleSheet, TextInput, Pressable, TouchableOpacity, SafeAreaView, Animated, ActivityIndicator, RefreshControl, Keyboard, Platform } from "react-native";
import { FlashList } from '@shopify/flash-list';
import { colors } from "../../../constants/colors";
import Post from "../../../components/Post/Post";
import { useRouter, useFocusEffect } from "expo-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Ionicons as IonIcon } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from "../../../lib/supabase";
import { useAuthStore } from "../../../stores/authStore";
import CachedAvatar from "../../../components/CachedAvatar";
import ExploreSkeleton from "../../../components/ExploreSkeleton";
import SuggestedUsersSkeleton from "../../../components/SuggestedUsersSkeleton";
import FeedSkeleton from "../../../components/Post/FeedSkeleton";
import SearchSkeleton from "../../../components/SearchSkeleton";
import { usePostStore } from "../../../stores/postStore";
import { useProfileStore } from "../../../stores/profileStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateGlobalScrollPosition } from "../../../hooks/usePostVisibility";
import { setTabScrollRef } from "./_layout";

// Helper function to process workout data for posts
const processWorkoutData = (workout) => {
  if (!workout) return null;

  // Use the duration field directly from the database (which is already in seconds)
  let calculatedDuration = workout.duration ?? 0;

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

  return {
    ...workout,
    duration: calculatedDuration,
    exerciseCount: exercises.length,
    totalVolume,
    totalSets: exercises.reduce((acc, ex) => 
      acc + (ex.workout_sets?.length || 0), 0)
  };
};

// Helper function to process likes data for posts (synchronous — uses pre-fetched followingIdSet)
const processLikesData = (postLikes, currentUserId, followingIdSet) => {
  if (!postLikes || postLikes.length === 0) return null;

  const featuredUser = postLikes.find(like => followingIdSet.has(like.user_id)) ?? postLikes[0];
  const filteredLikes = postLikes.filter(like => like.user_id !== currentUserId);

  return {
    featuredUser: featuredUser?.profiles,
    totalCount: filteredLikes.length,
    recentLikes: filteredLikes.slice(0, 3),
  };
};

export default function Explore() {
  const router = useRouter();
  const { session } = useAuthStore();
  // Temporary local state for posts until we fix the store typing
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchOverlayOpacity = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef(null);
  const flashListRef = useRef(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const searchTimeout = useRef(null);
  
  // Follow button states for each user
  const [followButtonStates, setFollowButtonStates] = useState({});
  const [followingUsers, setFollowingUsers] = useState(new Set());
  const [followingBackUsers, setFollowingBackUsers] = useState(new Set()); // Users who are following us
  
  // Search bar sliding animation
  const searchBarTranslateY = useRef(new Animated.Value(0)).current;
  const searchBarOpacity = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const scrollDirection = useRef('down');
  
  // Temporary function to fetch trending posts
  const fetchTrendingPosts = async (isLoadMore = false) => {
    if (!session?.user?.id) return;
    
    try {
      if (isLoadMore) {
        setLoadingMorePosts(true);
      } else {
        setPostsLoading(true);
      }
      
      const offset = isLoadMore ? trendingPosts.length : 0;
      const limit = 10;
      
      // Query to get recent posts excluding current user's posts
      const { data: posts, error: postsError } = await supabase
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
          post_likes(count),
          post_comments(
            id,
            text,
            likes_count,
            created_at,
            profiles:user_id(id, username, avatar_url)
          ),
          post_media(id, storage_path, media_type, width, height, duration, order_index),
          post_likes_detailed:post_likes(
            user_id,
            created_at,
            profiles:user_id(id, username, full_name, avatar_url)
          ),
          workouts(
            id,
            name,
            start_time,
            end_time,
            duration,
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
                rpe,
                is_completed
              )
            )
          )
        `)
        .neq('user_id', session.user.id) // Exclude current user's posts
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
        
      if (postsError) throw postsError;
      
      if (posts) {
        // Pre-fetch following IDs once for likes attribution
        const { data: followingData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', session.user.id);
        const followingIdSet = new Set((followingData ?? []).map(f => f.following_id));

        // Transform the data to match Post component format
        const formattedPosts = posts.map(post => {
          const profileData = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
          const hasLiked = post.post_likes_detailed?.some(like => like.user_id === session.user.id) ?? false;

          return {
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
            media: post.post_media ? post.post_media.map(media => ({
              id: media.id,
              type: media.media_type,
              uri: media.storage_path.startsWith('http')
                ? media.storage_path
                : `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/user-content/${media.storage_path}`,
              width: media.width,
              height: media.height,
              duration: media.duration,
              order_index: media.order_index
            })).sort((a, b) => a.order_index - b.order_index) : [],
            likes: post.likes_count || (post.post_likes?.[0]?.count || 0),
            is_liked: hasLiked,
            comments: post.post_comments ? post.post_comments.map(comment => {
              const commentProfile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
              return {
                id: comment.id,
                text: comment.text,
                likes_count: comment.likes_count || 0,
                created_at: comment.created_at,
                user: {
                  id: commentProfile?.id,
                  username: commentProfile?.username,
                  avatar_url: commentProfile?.avatar_url
                },
                is_liked: false
              };
            }).slice(0, 2) : [],
            comments_count: post.post_comments?.length || 0,
            likes_data: processLikesData(post.post_likes_detailed, session.user.id, followingIdSet),
            workout_data: processWorkoutData(post.workouts)
          };
        });
        
        // Filter out posts from blocked users
        const filteredPosts = formattedPosts.filter(post => 
          !isUserBlocked(post.user.id)
        );
        
        if (isLoadMore) {
          setTrendingPosts(prev => [...prev, ...filteredPosts]);
        } else {
          setTrendingPosts(filteredPosts);
        }
        
        // Check if we have more posts to load
        setHasMorePosts(posts.length === limit);
      }
    } catch (error) {
      console.error("Error fetching trending posts:", error);
    } finally {
      if (isLoadMore) {
        setLoadingMorePosts(false);
      } else {
        setPostsLoading(false);
      }
    }
  };
  
  const { followUser, unfollowUser, isUserBlocked } = useProfileStore();
  
  // Data states
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [suggestedClubs, setSuggestedClubs] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Register scroll ref for tab scroll-to-top functionality
  useEffect(() => {
    setTabScrollRef('explore', flashListRef);
  }, []);

  useEffect(() => {
    Animated.timing(searchOverlayOpacity, {
      toValue: isSearchFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    if (isSearchFocused && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchFocused]);

  // Refresh recent searches when search overlay opens and reset state when leaving
  useFocusEffect(
    useCallback(() => {
      loadRecentSearches();
      
      // Return a cleanup function that runs when the tab loses focus
      return () => {
        // Reset search state when navigating away from explore tab
        setIsSearchFocused(false);
        setSearchQuery('');
        setSearchResults([]);
        setSearchLoading(false);
        Keyboard.dismiss();
      };
    }, [])
  );
  
  // Load all data when component mounts
  useEffect(() => {
    if (session?.user?.id) {
      loadRecentSearches();
      loadSuggestedUsers();
      fetchFollowingRelationships();
      setHasMorePosts(true); // Reset pagination state
      fetchTrendingPosts(false); // Start fresh
    }
  }, [session?.user?.id]);

  // Fetch who we're following and who's following us
  const fetchFollowingRelationships = async () => {
    if (!session?.user?.id) return;

    try {
      // Get users we're following
      const { data: followingData, error: followingError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', session.user.id);

      if (followingError) {
        console.error('Error fetching following:', followingError);
      } else {
        const followingSet = new Set(followingData.map(f => f.following_id));
        setFollowingUsers(followingSet);
      }

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
  
  // Handle loading more posts when reaching the end
  const handleLoadMore = useCallback(() => {
    if (!loadingMorePosts && hasMorePosts && trendingPosts.length > 0) {
      fetchTrendingPosts(true);
    }
  }, [loadingMorePosts, hasMorePosts, trendingPosts.length]);
  
  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    if (!session?.user?.id) return;
    
    setRefreshing(true);
    setHasMorePosts(true); // Reset pagination state
    await Promise.all([
      loadSuggestedUsers(),
      fetchFollowingRelationships(),
      fetchTrendingPosts(false) // Reset posts
    ]);
    setRefreshing(false);
  }, [session?.user?.id]);

  // Handle scroll events for video visibility and search bar sliding
  const handleScroll = useCallback((event) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    
    updateGlobalScrollPosition(scrollY);
    
    // Check if we're near the bottom for infinite scrolling
    const isNearBottom = scrollY + layoutHeight >= contentHeight - 1000; // Trigger 1000px before bottom
    if (isNearBottom) {
      handleLoadMore();
    }
    
    // Search bar sliding logic
    const currentScrollY = scrollY;
    const diff = currentScrollY - lastScrollY.current;
    
    // Always show search bar when at the top
    if (currentScrollY <= 10) {
      if (scrollDirection.current !== 'top') {
        scrollDirection.current = 'top';
        Animated.parallel([
          Animated.timing(searchBarTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(searchBarOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          })
        ]).start();
      }
    }
    // Determine scroll direction when not at top
    else if (Math.abs(diff) > 3) { // Reduced threshold for more responsive behavior
      if (diff > 0 && scrollDirection.current !== 'down') {
        // Scrolling down - hide search bar
        scrollDirection.current = 'down';
        Animated.parallel([
          Animated.timing(searchBarTranslateY, {
            toValue: -100, // Move search bar up and out of view
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(searchBarOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          })
        ]).start();
      } else if (diff < 0 && scrollDirection.current !== 'up') {
        // Scrolling up - show search bar
        scrollDirection.current = 'up';
        Animated.parallel([
          Animated.timing(searchBarTranslateY, {
            toValue: 0, // Move search bar back to original position
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(searchBarOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          })
        ]).start();
      }
    }
    
    lastScrollY.current = currentScrollY;
  }, [handleLoadMore]);

  const loadRecentSearches = async () => {
    try {
      const storedSearches = await AsyncStorage.getItem(`recentSearches_${session?.user?.id}`);
      if (storedSearches) {
        setRecentSearches(JSON.parse(storedSearches));
      }
    } catch (error) {
      console.error("Error loading recent searches:", error);
    }
  };

  const saveToRecentSearches = async (item) => {
    try {
      // Create a new array without the clicked item (if it exists)
      const filteredSearches = recentSearches.filter(search => 
        !(search.id === item.id && search.type === item.type)
      );
      
      // Add the clicked item to the beginning
      const updatedSearches = [item, ...filteredSearches].slice(0, 8); // Keep last 8 searches
      
      setRecentSearches(updatedSearches);
      await AsyncStorage.setItem(
        `recentSearches_${session?.user?.id}`,
        JSON.stringify(updatedSearches)
      );
    } catch (error) {
      console.error("Error saving recent search:", error);
    }
  };
  
  // Fetch suggested users based on popularity and not already followed
  const loadSuggestedUsers = async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoadingUsers(true);
      
      // First get IDs of users the current user already follows
      const { data: followingData, error: followingError } = await supabase
        .from('follows')  // Changed from 'followers' to 'follows'
        .select('following_id')
        .eq('follower_id', session.user.id);
        
      if (followingError) throw followingError;
      
      // Extract the IDs into an array
      const followingIds = followingData.map(f => f.following_id);
      // Add the current user's ID to exclude them from suggestions
      followingIds.push(session.user.id);
      
      // Get users with most followers who aren't already followed and have completed onboarding
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          name,
          avatar_url,
          onboarding_completed,
          followers:follows!follows_following_id_fkey(count)
        `)
        .not('id', 'in', `(${followingIds.length > 0 ? followingIds.join(',') : '0'})`)
        .eq('onboarding_completed', true)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (usersError) throw usersError;
      
      // Calculate follower count for each user
      const usersWithCounts = users.map(user => ({
        ...user,
        follower_count: user.followers.length > 0 ? user.followers[0].count : 0
      }));
      
      // Sort by follower count
      usersWithCounts.sort((a, b) => b.follower_count - a.follower_count);
      
      setSuggestedUsers(usersWithCounts);
    } catch (error) {
      console.error("Error fetching suggested users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };
  
  // Fetch suggested clubs based on popularity and not already joined
  const loadSuggestedClubs = async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoadingClubs(true);
      
      // First get IDs of clubs the current user is already a member of
      const { data: membershipData, error: membershipError } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', session.user.id);
        
      if (membershipError) throw membershipError;
      
      // Extract the club IDs into an array
      const memberClubIds = membershipData.map(m => m.club_id);
      
      // Get clubs with most members that the user hasn't joined
      const { data: clubs, error: clubsError } = await supabase
        .from('clubs')
        .select(`
          id,
          name,
          avatar_url,
          privacy_level,
          members:club_members(count)
        `)
        .eq('privacy_level', 'public') // Only suggest public clubs
        .not('id', 'in', `(${memberClubIds.length > 0 ? memberClubIds.join(',') : '0'})`)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (clubsError) throw clubsError;
      
      // Calculate member count for each club
      const clubsWithCounts = clubs.map(club => ({
        ...club,
        member_count: club.members.length > 0 ? club.members[0].count : 0
      }));
      
      // Sort by member count
      clubsWithCounts.sort((a, b) => b.member_count - a.member_count);
      
      setSuggestedClubs(clubsWithCounts.slice(0, 3)); // Just take top 3 for display
    } catch (error) {
      console.error("Error fetching suggested clubs:", error);
    } finally {
      setLoadingClubs(false);
    }
  };
  
  // Follow/unfollow a user with optimistic updates
  const handleFollowUser = async (userId) => {
    const currentState = followButtonStates[userId] || 'follow';
    const newState = currentState === 'follow' ? 'following' : 'follow';
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Optimistic update
    setFollowButtonStates(prev => ({ ...prev, [userId]: newState }));
    
    // Update local state to show user as followed/unfollowed
    setSuggestedUsers(prev => 
      prev.map(user => user.id === userId ? { ...user, isFollowing: newState === 'following' } : user)
    );
    
    try {
      if (newState === 'following') {
        // Follow the user
        await followUser(userId, session?.user.id);
      } else {
        // Unfollow the user
        await unfollowUser(userId, session?.user.id);
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      // Revert on error
      setFollowButtonStates(prev => ({ ...prev, [userId]: currentState }));
      setSuggestedUsers(prev => 
        prev.map(user => user.id === userId ? { ...user, isFollowing: currentState === 'following' } : user)
      );
    }
  };
  
  // Join a club
  const handleJoinClub = async (clubId) => {
    try {
      // Add user as club member with 'member' role
      const { error } = await supabase
        .from('club_members')
        .insert({
          club_id: clubId,
          user_id: session.user.id,
          role: 'member'
        });
        
      if (error) throw error;
      
      // Update local state to show club as joined
      setSuggestedClubs(prev => 
        prev.map(club => club.id === clubId ? { ...club, isJoined: true } : club)
      );
      
      // Optionally remove from suggestions
      // setSuggestedClubs(prev => prev.filter(club => club.id !== clubId));
    } catch (error) {
      console.error("Error joining club:", error);
    }
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    
    // Don't search if query is empty
    if (!text.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    
    // Show loading immediately and clear previous results
    setSearchLoading(true);
    setSearchResults([]);
    
    // Debounce search to avoid too many requests
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    searchTimeout.current = setTimeout(() => {
      searchUsersAndClubs(text);
    }, 500);
  };
  
  // Search for users only (no clubs)
  const searchUsersAndClubs = async (query) => {
    if (!session?.user?.id || !query.trim()) return;
    
    try {
      setSearchLoading(true);
      
      // Search users only (exclude users who haven't completed onboarding)
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, name, avatar_url, onboarding_completed, followers:follows!follows_following_id_fkey(count)')
        .or(`username.ilike.%${query}%,name.ilike.%${query}%`)
        .eq('onboarding_completed', true)
        .limit(20);
        
      if (usersError) throw usersError;
      
      // Calculate follower count for users
      const usersWithCounts = users.map(user => ({
        ...user,
        follower_count: user.followers.length > 0 ? user.followers[0].count : 0,
        type: 'user'
      }));
      
      // Sort alphabetically
      usersWithCounts.sort((a, b) => {
        const nameA = a.name || a.username || '';
        const nameB = b.name || b.username || '';
        return nameA.localeCompare(nameB);
      });
      
      setSearchResults(usersWithCounts);
      
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setSearchLoading(false);
    }
  };
  
  // Handle clicking on a search result
  const handleSearchResultClick = (item) => {
    // Save to recent searches
    saveToRecentSearches({
      id: item.id,
      name: item.name || item.username,
      username: item.username,
      avatar_url: item.avatar_url,
      follower_count: item.follower_count || 0,
      type: item.type,
      timestamp: new Date().toISOString()
    });
    
    // Navigate to user profile
    if (item.type === 'user') {
      router.push(`/profile/${item.id}`);
    }
  };
  
  // Handle clearing recent searches
  const clearRecentSearches = async () => {
    try {
      await AsyncStorage.removeItem(`recentSearches_${session?.user?.id}`);
      setRecentSearches([]);
    } catch (error) {
      console.error("Error clearing recent searches:", error);
    }
  };

  // Remove a single item from recent searches
  const removeFromRecentSearches = async (itemToRemove) => {
    try {
      const updatedSearches = recentSearches.filter(search => 
        !(search.id === itemToRemove.id && search.type === itemToRemove.type)
      );
      
      setRecentSearches(updatedSearches);
      await AsyncStorage.setItem(
        `recentSearches_${session?.user?.id}`,
        JSON.stringify(updatedSearches)
      );
    } catch (error) {
      console.error("Error removing recent search:", error);
    }
  };

  // Render a search result item (users only)
  const renderSearchResultItem = (item) => {
    return (
      <TouchableOpacity
                activeOpacity={0.5}
        key={`user-${item.id}`}
        style={styles.searchResultItem}
        onPress={() => handleSearchResultClick(item)}
      >
          <CachedAvatar 
            path={item.avatar_url}
            size={40}
            style={styles.profileImage}
          />
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultName}>
            {item.username}
          </Text>
          <Text style={styles.searchResultMeta}>
            {item.name || ''} · {item.follower_count} followers
          </Text>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Render a recent search item (users only)
  const renderRecentSearchItem = (item) => (
    <TouchableOpacity
                activeOpacity={0.5}
      key={`user-${item.id}`}
      style={styles.recentSearchItem}
      onPress={() => handleSearchResultClick(item)}
    >
        <CachedAvatar 
          path={item.avatar_url}
          size={40}
          style={styles.suggestedProfilePic}
        />
      <View style={styles.searchResultInfo}>
        <Text style={styles.recentSearchUsername}>{item.username || item.name}</Text>
        <Text style={styles.recentSearchName}>
          {item.name} · {item.follower_count || 0} followers
        </Text>
      </View>
      <TouchableOpacity
                activeOpacity={0.5} 
        onPress={(e) => {
          e.stopPropagation();
          removeFromRecentSearches(item);
        }}
        style={styles.closeButton}
      >
        <IonIcon name="close" size={20} color={colors.secondaryText} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
  
  // Render suggested user item
  const renderSuggestedUser = (user) => {
    const buttonState = followButtonStates[user.id] || 'follow';
    
    return (
      <View key={user.id} style={styles.userCard}>
        <TouchableOpacity
                activeOpacity={0.5} 
          onPress={() => router.push(`/profile/${user.id}`)}
          style={styles.userCardContent}
        >
          <CachedAvatar 
            path={user.avatar_url}
            size={80}
            style={styles.userCardAvatar}
          />
          <Text style={styles.userCardUsername} numberOfLines={1}>
            {user.username}
          </Text>
          <Text style={styles.userCardFollowers} numberOfLines={1}>
            Featured
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
                activeOpacity={0.5} 
          style={[
            styles.userCardFollowButton, 
            buttonState === 'following' && styles.followingButton
          ]}
          onPress={() => handleFollowUser(user.id)}
        >
          <Text style={[
            styles.userCardFollowText,
            buttonState === 'following' && styles.followingButtonText
          ]}>
            {buttonState === 'following' ? 'Following' : 
             (followingBackUsers.has(user.id) ? 'Follow Back' : 'Follow')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  // Render suggested club item
  const renderSuggestedClub = (club) => (
    <TouchableOpacity
                activeOpacity={0.5} 
      key={club.id}
      style={styles.clubItem}
      onPress={() => router.push(`/(modals)/clubs/${club.id}`)}
    >
      {club.avatar_url ? (
        <CachedAvatar
          path={club.avatar_url}
          size={60}
          style={styles.clubIcon}
        />
      ) : (
        <View style={styles.clubIcon}>
          <Text style={styles.clubInitial}>{club.name.charAt(0)}</Text>
        </View>
      )}
      <View style={styles.clubInfo}>
        <Text style={styles.clubName} numberOfLines={1}>{club.name}</Text>
        <Text style={styles.clubMembers}>{club.member_count} members</Text>
      </View>
      <TouchableOpacity
                activeOpacity={0.5} 
        style={[
          styles.joinButton, 
          club.isJoined && styles.joinedButton
        ]}
        onPress={() => handleJoinClub(club.id)}
      >
        <Text style={styles.joinButtonText}>
          {club.isJoined ? 'Joined' : 'Join'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Render post item for FlashList
  const renderPost = useCallback(({ item }) => (
    <View key={item.id}>
      <Post data={item} onDelete={() => {}} />
    </View>
  ), []);

  // Suggested Users Header Component
  const SuggestedUsersHeader = useCallback(() => (
    <View style={styles.sectionContainer}>
      {loadingUsers ? (
        <SuggestedUsersSkeleton count={4} />
      ) : (
        <>
          <Text style={styles.suggestedUsersHeader}>Suggested Users</Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestedUsersContainer}
          >
            {suggestedUsers.length > 0 ? (
              suggestedUsers.map(renderSuggestedUser)
            ) : (
              <Text style={styles.emptyStateText}>No suggestions available</Text>
            )}
          </ScrollView>
        </>
      )}
    </View>
  ), [loadingUsers, suggestedUsers, renderSuggestedUser]);

  // Empty Posts Component
  const EmptyPostsComponent = useCallback(() => (
    <View style={styles.emptyPostsContainer}>
      <IonIcon name="trending-up" size={40} color={colors.secondaryText} />
      <Text style={styles.emptyStateText}>No trending posts available</Text>
    </View>
  ), []);

  // Footer Component for loading states
  const FooterComponent = useCallback(() => {
    if (loadingMorePosts) {
      return (
        <View style={styles.loadingMoreContainer}>
          <ActivityIndicator size="small" color={colors.brand} />
          <Text style={styles.loadingMoreText}>Loading more posts...</Text>
        </View>
      );
    }
    if (!hasMorePosts && trendingPosts.length > 0) {
      return (
        <View style={styles.endOfFeedContainer}>
          <Text style={styles.endOfFeedText}>You've reached the end!</Text>
        </View>
      );
    }
    return null;
  }, [loadingMorePosts, hasMorePosts, trendingPosts.length]);

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.header,
          {
            transform: [{ translateY: searchBarTranslateY }],
            opacity: searchBarOpacity
          }
        ]}
      >
        <View style={styles.searchContainer}>
          <IonIcon name="search" size={20} color={colors.secondaryText} />
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.searchInputPressable}
            onPress={() => setIsSearchFocused(true)}
          >
            <Text style={[styles.searchInputPlaceholder, searchQuery && styles.searchInputText]}>
              {searchQuery || "Search users..."}
            </Text>
          </TouchableOpacity>
          {searchQuery.length > 0 && (
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.clearButton}
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setSearchLoading(false);
              }}
            >
              <IonIcon name="close-circle" size={20} color={colors.secondaryText} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
      {/* Show skeleton when loading initial data */}
      {(loadingUsers || postsLoading) && !refreshing ? (
        <View style={styles.container}>
          <ExploreSkeleton />
        </View>
      ) : (
        <FlashList
          ref={flashListRef}
          data={trendingPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.brand]}
              tintColor={colors.brand}
              progressBackgroundColor={colors.primaryAccent}
            />
          }
          contentContainerStyle={styles.contentContainer}
          ListHeaderComponent={SuggestedUsersHeader}
          ListEmptyComponent={!postsLoading ? EmptyPostsComponent : null}
          ListFooterComponent={FooterComponent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={true}
          getItemType={() => 'post'}
        />
      )}
      
      {/* Search Overlay (keeping your existing implementation) */}
      <Animated.View 
        style={[
          styles.searchOverlayContainer,
          { 
            opacity: searchOverlayOpacity,
          }
        ]}
        pointerEvents={isSearchFocused ? 'auto' : 'none'}
      >
        <SafeAreaView style={styles.searchOverlay}>
          <View style={styles.searchHeaderContainer}>
            <View style={[styles.searchOverlayInputContainer, Platform.OS === 'ios' ? {} : { paddingVertical: 2 }]}>
              <IonIcon name="search" size={20} color={colors.secondaryText} />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchOverlayInput, Platform.OS === 'ios' ? {} : { marginLeft: 4 }]}
                placeholder="Search users..."
                placeholderTextColor={colors.secondaryText}
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoCapitalize="none"
                returnKeyType="search"
                autoFocus={false}
              />
              {searchQuery && (
                <TouchableOpacity
                activeOpacity={0.5} 
                  style={styles.clearButton} 
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setSearchLoading(false);
                  }}
                >
                  <IonIcon name="close-circle" size={20} color={colors.secondaryText} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
                activeOpacity={0.5} 
              onPress={() => {
                Keyboard.dismiss();
                setIsSearchFocused(false);
                setSearchQuery('');
                setSearchResults([]);
                setSearchLoading(false);
              }}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.searchContentContainer} keyboardShouldPersistTaps="handled">
            {/* Search Results */}
            {searchQuery ? (
              <View style={styles.searchSection}>
                {searchLoading ? (
                  <SearchSkeleton count={5} />
                ) : searchResults.length > 0 ? (
                  searchResults.map(renderSearchResultItem)
                ) : (
                  <View style={styles.noResultsContainer}>
                    <IonIcon name="search-outline" size={44} color={colors.secondaryText} />
                    <Text style={styles.noResultsText}>
                      No results found for "{searchQuery}"
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              // Recent searches when no query - only show if there are recent searches
              recentSearches.length > 0 && (
                <View style={styles.searchSection}>
                  <View style={styles.recentSearchesHeader}>
                    <Text style={styles.searchSectionTitle}>Recent</Text>
                    <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.push('/explore/recentSearches')}>
                      <Text style={styles.seeAllText}>See all</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.recentSearchesContainer}>
                    {recentSearches.map(renderRecentSearchItem)}
                  </View>
                </View>
              )
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: colors.whiteOverlay,
    paddingTop: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
  },
  searchInputPressable: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  searchInputPlaceholder: {
    fontSize: 16,
    color: colors.secondaryText,
  },
  searchInputText: {
    fontSize: 16,
    color: colors.primaryText,
  },
  searchOverlayInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
    flex: 1,
  },
  searchOverlayInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: colors.primaryText,
  },
  clearButton: {
    marginLeft: 8,
  },
  contentContainer: {
    gap: 16,
    paddingVertical: 16,
    paddingTop: 100, // Add padding for fixed header
  },
  sectionContainer: {
    padding: 16,
    paddingTop: 0,
    gap: 8,
  },
  suggestedUsersHeader: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 12,
  },
  suggestedUsersContainer: {
    paddingRight: 16,
    gap: 12,
  },
  userCard: {
    width: 140,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryAccent,
    padding: 12,
    borderRadius: 8,
  },
  userCardContent: {
    alignItems: 'center',
    gap: 4,
  },
  userCardAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.secondaryText,
  },
  userCardUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    marginTop: 2,
  },
  userCardFollowers: {
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: 'center',
  },
  userCardFollowButton: {
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 0,
    width: '94%',
    alignItems: 'center',
  },
  userCardFollowText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 13,
  },
  followingButtonText: {
    color: colors.primaryText,
  },
  followingButton: {
    backgroundColor: colors.secondaryAccent,
  },
  postsContainer: {
    gap: 0,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  clubName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primaryText,
  },
  clubMembers: {
    fontSize: 11,
    color: colors.secondaryText,
  },
  joinButton: {
    position: 'absolute',
    bottom: -16,
    left: '50%',
    transform: [{ translateX: '-25%' }],
    backgroundColor: colors.brand,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  joinButtonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
    fontSize: 12,
  },
  clubItem: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.primaryAccent,
    padding: 16,
    paddingBottom: 24,
    borderRadius: 8,
    alignItems: 'center',
    gap: 4,
  },
  clubIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: colors.secondaryText,
  },
  clubInfo: {
    alignItems: 'center',
    gap: 4,
  },
  searchHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    gap: 12,
  },
  cancelButton: {
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.primaryText,
  },
  noResultsText: {
    color: colors.secondaryText,
    fontSize: 16,
  },
  searchSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 12,
  },
  recentSearchesContainer: {
    gap: 12,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  suggestedProfilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondaryText,
  },
  searchOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    zIndex: 20, // Higher than the header
  },
  searchOverlay: {
    flex: 1,
  },
  emptyStateText: {
    color: colors.secondaryText,
    textAlign: 'center',
    padding: 20,
  },
  emptyPostsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  joinedButton: {
    backgroundColor: colors.primaryAccent,
  },
  clubInitial: {
    fontSize: 24,
    color: colors.primaryText,
    fontWeight: 'bold',
  },
  searchContentContainer: {
    flex: 1,
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 4,
  },
  searchResultMeta: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  recentSearchesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '500',
  },
  recentSearchUsername: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 4,
  },
  recentSearchName: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  closeButton: {
    padding: 4,
  },
  searchSection: {
    padding: 16,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: {
    color: colors.secondaryText,
    fontSize: 14,
  },
  endOfFeedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  endOfFeedText: {
    color: colors.secondaryText,
    fontSize: 14,
    fontStyle: 'italic',
  },
});