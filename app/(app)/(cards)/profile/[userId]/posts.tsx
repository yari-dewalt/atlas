import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { colors } from "../../../../../constants/colors";
import Post from "../../../../../components/Post/Post";
import FeedSkeleton from "../../../../../components/Post/FeedSkeleton";
import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../../../../lib/supabase";
import { useProfileStore } from "../../../../../stores/profileStore";
import { checkIfUserLikedPost } from "../../../../../utils/postUtils";
import { useAuthStore } from "../../../../../stores/authStore";

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
      
      // First fetch the profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name')
        .eq('id', profileId)
        .single();
      
      if (profileError) {
        console.log('Profile fetch error:', profileError);
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
          post_likes(count),
          post_comments(count),
          post_media(id, storage_path, media_type, width, height, duration, order_index)
        `)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }

      // Transform the data to match your Post component's expected format
      const formattedPosts = await Promise.all(data.map(async post => {
        // Check if current user has liked this post
        let hasLiked = false;
        if (session?.user?.id) {
          hasLiked = await checkIfUserLikedPost(post.id, session.user.id);
        }
        
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
          comments: []
        };
      }));
      
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

  // Fetch posts when component mounts or userId changes
  useEffect(() => {
    if (userId || (currentProfile && currentProfile.id)) {
      const profileId = userId || currentProfile.id;
      fetchUserPosts(profileId);
    }
  }, [userId, currentProfile]);

  // Pull-to-refresh functionality
  const onRefresh = () => {
    setRefreshing(true);
    if (userId || (currentProfile && currentProfile.id)) {
      const profileId = userId || currentProfile.id;
      fetchUserPosts(profileId);
    } else {
      setRefreshing(false);
    }
  };

  // Render loading state
  if (loading && !refreshing) {
    return (
      <ScrollView style={styles.container}>
        <FeedSkeleton count={4} />
      </ScrollView>
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

  // Render empty state
  if (posts.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.centerContent, styles.contentContainer]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.emptyText}>No posts yet</Text>
        {currentProfile && currentProfile.id === userId && (
          <Text style={styles.emptySubtext}>
            Share your workout progress by creating a new post!
          </Text>
        )}
      </ScrollView>
    );
  }

  // Render posts
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.postsContentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {posts.map(post => (
        <Post 
          key={post.id} 
          data={post} 
          onDelete={handlePostDeleted} 
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 20,
  },
  postsContentContainer: {
    gap: 6,
    paddingBottom: 20,
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