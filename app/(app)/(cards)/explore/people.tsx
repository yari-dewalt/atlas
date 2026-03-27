import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { colors } from '../../../../constants/colors';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../stores/authStore';
import CachedAvatar from '../../../../components/CachedAvatar';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { useProfileStore } from '../../../../stores/profileStore';
import ProBadge from '../../../../components/ProBadge';

export default function PeopleToFollow() {
  const router = useRouter();
  const { session } = useAuthStore();
  
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { followUser, unfollowUser } = useProfileStore();
  
  const USERS_PER_PAGE = 20;
  
  useEffect(() => {
    if (session?.user?.id) {
      loadSuggestedUsers();
    }
  }, [session?.user?.id]);
  
  const loadSuggestedUsers = async (reset = true) => {
    if (!session?.user?.id) return;
    
    try {
      if (reset) {
        setLoading(true);
        setPage(0);
      } else {
        setLoadingMore(true);
      }
      
      const currentPage = reset ? 0 : page;
      
      // First get IDs of users the current user already follows
      const { data: followingData, error: followingError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', session.user.id);
        
      if (followingError) throw followingError;
      
      // Extract the IDs into an array
      const followingIds = followingData.map(f => f.following_id);
      // Add the current user's ID to exclude them from suggestions
      followingIds.push(session.user.id);
      
      // Get users with most followers who aren't already followed
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          name,
          avatar_url,
          subscription_tier,
          followers:follows!follows_following_id_fkey(count)
        `)
        .not('id', 'in', `(${followingIds.length > 0 ? followingIds.join(',') : '0'})`)
        .range(currentPage * USERS_PER_PAGE, (currentPage + 1) * USERS_PER_PAGE - 1)
        .order('created_at', { ascending: false });
        
      if (usersError) throw usersError;
      
      // Calculate follower count for each user
      const usersWithCounts = users.map(user => ({
        ...user,
        follower_count: user.followers.length > 0 ? user.followers[0].count : 0,
        isFollowing: false
      }));
      
      // Sort by follower count
      usersWithCounts.sort((a, b) => b.follower_count - a.follower_count);
      
      if (reset) {
        setSuggestedUsers(usersWithCounts);
      } else {
        setSuggestedUsers(prev => [...prev, ...usersWithCounts]);
      }
      
      // Update pagination state
      setPage(currentPage + 1);
      setHasMoreUsers(users.length === USERS_PER_PAGE);
      
    } catch (error) {
      console.error("Error fetching suggested users:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  const handleFollowUser = async (userId) => {
    try {
      await followUser(userId, session?.user.id);
      
      // Update local state to show user as followed
      setSuggestedUsers(prev => 
        prev.map(user => user.id === userId ? { ...user, isFollowing: true } : user)
      );
    } catch (error) {
      console.error("Error following user:", error);
    }
  };
  
  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.5} 
      style={styles.userItem}
      onPress={() => router.push(`/profile/${item.id}`)}
    >
      <CachedAvatar 
        path={item.avatar_url}
        size={60}
        style={styles.avatar}
        initial={(item.name || item.username || "?").charAt(0)}
      />
      <View style={styles.userInfo}>
        <View style={styles.usernameRow}>
          <Text style={styles.userName}>{item.name || item.username}</Text>
          {item.subscription_tier === 'pro' && <ProBadge />}
        </View>
        <Text style={styles.username}>@{item.username || 'user'}</Text>
        <Text style={styles.followersCount}>{item.follower_count} followers</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.5} 
        style={[
          styles.followButton, 
          item.isFollowing && styles.followingButton
        ]}
        onPress={() => handleFollowUser(item.id)}
        disabled={item.isFollowing}
      >
        <Text style={styles.followButtonText}>
          {item.isFollowing ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
  
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSuggestedUsers(true);
    setRefreshing(false);
  }, []);
  
  const handleLoadMore = () => {
    if (!loadingMore && hasMoreUsers) {
      loadSuggestedUsers(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'People to Follow',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.primaryText,
          headerShadowVisible: false,
          headerBackTitle: 'Explore',
        }}
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>Finding people for you...</Text>
        </View>
      ) : (
        <FlashList
          data={suggestedUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          estimatedItemSize={80}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.brand]}
              tintColor={colors.brand}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IonIcon name="people-outline" size={56} color={colors.secondaryText} />
              <Text style={styles.emptyText}>No suggested users found</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : null
          }
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
  listContent: {
    padding: 16,
    gap: 16,
  },
  userItem: {
    flexDirection: 'row',
    backgroundColor: colors.primaryAccent,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  avatar: {
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 4,
  },
  followersCount: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  followButton: {
    backgroundColor: colors.brand,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: colors.primaryAccent,
    borderWidth: 1,
    borderColor: colors.secondaryText,
  },
  followButtonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: colors.secondaryText,
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  emptyText: {
    color: colors.secondaryText,
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
});