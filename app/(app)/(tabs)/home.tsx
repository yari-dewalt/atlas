import { StyleSheet, Text, View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
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

export default function Home() {
  const { session } = useAuthStore();
  const { initializeFollowedUsers } = useProfileStore();
  const { showError } = useBannerStore();
  const scrollViewRef = useRef(null);
  
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
    setTabScrollRef('home', scrollViewRef.current);
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
          post_comments(count),
          post_media(id, storage_path, media_type, width, height, duration, order_index)
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
          comments: []
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

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.brand]}
          tintColor={colors.brand}
          progressBackgroundColor={colors.primaryAccent}
        />
      }
    >
      {loading && !refreshing ? (
        <FeedSkeleton count={4} />
      ) : (
        <>
          {/* Regular Feed Content */}
          {feedPosts.length > 0 && (
            <>
              {feedPosts.map(post => (
                <View key={post.id} style={styles.postContainer}>
                  <Post 
                    data={post} 
                    onDelete={(postId) => {
                      setFeedPosts(prev => prev.filter(p => p.id !== postId));
                    }}
                  />
                </View>
              ))}
            </>
          )}
          
          {/* No posts at all state - show when user follows no one OR follows people but they have no posts */}
          {!loading && feedPosts.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={56} color={colors.secondaryText} />
              <Text style={styles.emptyTitle}>Your feed is empty</Text>
              <Text style={styles.emptyText}>
                Explore and find people to follow to see their posts here
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
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