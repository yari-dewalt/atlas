import { StyleSheet, Text, View, RefreshControl, TouchableOpacity } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FlashList } from '@shopify/flash-list';
import { colors } from '../../../constants/colors';
import Post from '../../../components/Post/Post';
import FeedSkeleton from '../../../components/Post/FeedSkeleton';
import { useAuthStore } from '../../../stores/authStore';
import { useProfileStore } from '../../../stores/profileStore';
import { useBannerStore } from '../../../stores/bannerStore';
import { supabase } from '../../../lib/supabase';
import { checkIfUserLikedPost } from '../../../utils/postUtils';
import { Ionicons } from '@expo/vector-icons';
import { updateGlobalScrollPosition } from '../../../hooks/usePostVisibility';
import { setTabScrollRef } from './_layout';

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

// Helper function to process likes data for posts
const processLikesData = async (postLikes, currentUserId) => {
  if (!postLikes || postLikes.length === 0) {
    return null;
  }

  try {
    // Find the most recent user that the current user follows (if any)
    let featuredUser = null;
    if (currentUserId) {
      // Check which of these users the current user follows
      const userIds = postLikes.map(like => like.user_id);
      const { data: following, error: followError } = await supabase
        .from('follows')
        .select('following_user_id')
        .eq('follower_user_id', currentUserId)
        .in('following_user_id', userIds);

      if (!followError && following && following.length > 0) {
        const followingIds = following.map(f => f.following_user_id);
        featuredUser = postLikes.find(like => followingIds.includes(like.user_id));
      }
    }
    
    // If no followed user found, use the most recent liker
    if (!featuredUser) {
      featuredUser = postLikes[0];
    }

    // Filter out current user from display
    const filteredLikes = postLikes.filter(like => like.user_id !== currentUserId);

    return {
      featuredUser: featuredUser?.profiles,
      totalCount: filteredLikes.length,
      recentLikes: filteredLikes.slice(0, 3)
    };
  } catch (error) {
    console.error('Error processing likes data:', error);
    return null;
  }
};

export default function Home() {
  const { session } = useAuthStore();
  const { initializeFollowedUsers } = useProfileStore();
  const { showError } = useBannerStore();
  const flashListRef = useRef(null);
  
  const [feedPosts, setFeedPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Check if there's a stored set of viewed posts
  useEffect(() => {
    if (session?.user?.id) {
      // Initialize followed users when session is available
      initializeFollowedUsers(session.user.id);
      loadFeed();
    }
  }, [session?.user?.id]);
  
  // Register scroll ref for tab scroll-to-top functionality
  useEffect(() => {
    setTabScrollRef('home', flashListRef);
  }, []);
  
  // Load feed posts from users the current user follows
  const loadFeed = async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoading(true);
      
      // Fetch users the current user follows
      const { data: followingData, error: followingError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', session.user.id);
        
      if (followingError) throw followingError;
      
      // If user doesn't follow anyone, show empty state
      if (!followingData || followingData.length === 0) {
        setFeedPosts([]);
        setLoading(false);
        return;
      }
      
      const followingIds = followingData.map(f => f.following_id);
      // Add the current user's ID to see their own posts
      followingIds.push(session.user.id);
      
      // Fetch posts from followed users
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
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (postsError) throw postsError;
      
      if (!posts || posts.length === 0) {
        setFeedPosts([]);
        setLoading(false);
        return;
      }
      
      // Transform posts to match Post component format
      const formattedPosts = await Promise.all(posts.map(async post => {
        // Check if current user has liked this post
        let hasLiked = false;
        hasLiked = await checkIfUserLikedPost(post.id, session.user.id);
        
        // Handle profiles data (could be array or single object)
        const profileData = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
        
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
              is_liked: false // We'll need to check this separately if needed
            };
          }).slice(0, 2) : [], // Only take first 2 for preview
          comments_count: post.post_comments?.length || 0,
          likes_data: await processLikesData(post.post_likes_detailed, session.user.id),
          workout_data: processWorkoutData(post.workouts)
        };
      }));
      
      // Set the formatted posts as feed posts
      setFeedPosts(formattedPosts);
    } catch (error) {
      console.error("Error loading feed:", error);
      showError("Failed to load your feed");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }, [session?.user?.id]);
  
  // Handle scroll events for video visibility
  const handleScroll = useCallback((event) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    updateGlobalScrollPosition(scrollY);
  }, []);

  // Render item for FlashList
  const renderPost = useCallback(({ item }) => (
    <View style={styles.postContainer} key={item.id}>
      <Post 
        data={item} 
        onDelete={(postId) => {
          setFeedPosts(prev => prev.filter(p => p.id !== postId));
        }}
      />
    </View>
  ), []);

  // Empty state component
  const EmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={56} color={colors.secondaryText} />
      <Text style={styles.emptyTitle}>Your feed is empty</Text>
      <Text style={styles.emptyText}>
        Explore and find people to follow to see their posts here
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <FeedSkeleton count={4} />
      ) : (
        <FlashList
          ref={flashListRef}
          data={feedPosts}
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
          ListEmptyComponent={!loading ? EmptyComponent : null}
          removeClippedSubviews={true}
          getItemType={() => 'post'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  emptyContainer: {
    padding: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 400, // Ensure empty state has proper height for FlashList
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 20,
  },
  postContainer: {
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: colors.primaryAccent,
  },
});