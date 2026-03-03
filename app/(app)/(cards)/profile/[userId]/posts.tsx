import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { colors } from "../../../../../constants/colors";
import Post from "../../../../../components/Post/Post";
import FeedSkeleton from "../../../../../components/Post/FeedSkeleton";
import { useEffect, useState, useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../../../../lib/supabase";
import { useProfileStore } from "../../../../../stores/profileStore";
import { useAuthStore } from "../../../../../stores/authStore";
import { FlashList } from '@shopify/flash-list';

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

const Posts = () => {
  const { userId } = useLocalSearchParams();
  const { currentProfile } = useProfileStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const { session } = useAuthStore();

  // Function to fetch posts for a specific user
  const fetchUserPosts = async (profileId) => {
    try {
      setError(null);
      
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
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }

      // Pre-fetch following IDs once for likes attribution
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', session?.user?.id ?? '');
      const followingIdSet = new Set((followingData ?? []).map(f => f.following_id));

      // Transform the data to match your Post component's expected format
      const formattedPosts = data.map(post => {
        const profileData = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
        const hasLiked = post.post_likes_detailed?.some(like => like.user_id === session?.user?.id) ?? false;

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
          likes_data: processLikesData(post.post_likes_detailed, session?.user?.id, followingIdSet),
          workout_data: processWorkoutData(post.workouts)
        };
      });
      
      setPosts(formattedPosts);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePostDeleted = (postId) => {
    setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
  };

  // Render item for FlashList
  const renderPost = useCallback(({ item }) => (
    <View key={item.id} style={styles.postContainer}>
      <Post 
        data={item} 
        onDelete={handlePostDeleted} 
      />
    </View>
  ), []);

  // Empty state component
  const EmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No posts yet</Text>
      {currentProfile && currentProfile.id === userId && (
        <Text style={styles.emptySubtext}>
          Share your workout progress by creating a new post!
        </Text>
      )}
    </View>
  ), [currentProfile, userId]);

  // Fetch posts when component mounts or userId changes
  useEffect(() => {
    if (userId || (currentProfile && currentProfile.id)) {
      const profileId = userId || currentProfile.id;
      fetchUserPosts(profileId);
    }
  }, [userId, currentProfile]);

  // Pull-to-refresh functionality
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (userId || (currentProfile && currentProfile.id)) {
      const profileId = userId || currentProfile.id;
      fetchUserPosts(profileId);
    } else {
      setRefreshing(false);
    }
  }, [userId, currentProfile]);

  // Render loading state
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <FeedSkeleton count={4} />
      </View>
    );
  }

  // Render error state
  if (error && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>Could not load posts</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
      </View>
    );
  }

  // Render posts with FlashList
  return (
    <View style={styles.container}>
      <FlashList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  postContainer: {
    marginBottom: 6,
  },
  emptyContainer: {
    padding: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 400,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.notification,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginHorizontal: 30,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginHorizontal: 30,
  },
});

export default Posts;