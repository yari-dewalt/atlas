import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, TextInput, Keyboard, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FlashList } from '@shopify/flash-list';
import { supabase } from '../../../../../lib/supabase';
import CachedAvatar from '../../../../../components/CachedAvatar';
import UserListSkeleton from '../../../../../components/UserListSkeleton';
import { colors } from '../../../../../constants/colors';
import { useAuthStore } from '../../../../../stores/authStore';
import { useProfileStore } from '../../../../../stores/profileStore';

const PAGE_SIZE = 30;

export default function PostLikesScreen() {
  const { postId } = useLocalSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [likes, setLikes] = useState([]);
  const [filteredLikes, setFilteredLikes] = useState([]);
  const [error, setError] = useState(null);
  const [followingUsers, setFollowingUsers] = useState(new Set<string>());
  const [followingBackUsers, setFollowingBackUsers] = useState(new Set<string>());
  const [searchQuery, setSearchQuery] = useState('');

  const { session } = useAuthStore();
  const { followUser, unfollowUser } = useProfileStore();

  useEffect(() => {
    if (postId) {
      setPage(0);
      setHasMore(true);
      setLikes([]);
      fetchLikes(0, true);
    }
  }, [postId]);

  useEffect(() => {
    if (page > 0) {
      fetchLikes(page, false);
    }
  }, [page]);

  const fetchLikes = async (pageNum: number, fetchSets: boolean) => {
    try {
      if (pageNum === 0) setIsLoading(true);
      else setLoadingMore(true);
      setError(null);

      const { data, error } = await supabase
        .from('post_likes')
        .select(`
          user_id,
          created_at,
          profiles!inner(
            id,
            username,
            name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      const newLikes = data || [];
      if (newLikes.length < PAGE_SIZE) setHasMore(false);

      const allLikes = pageNum === 0 ? newLikes : (prev => [...prev, ...newLikes])(likes);
      setLikes(pageNum === 0 ? newLikes : prev => [...prev, ...newLikes]);

      if (fetchSets && session?.user?.id && newLikes.length > 0) {
        const userIds = newLikes.map((like: any) => like.profiles.id).filter((id: string) => id !== session.user.id);

        const [followingResult, followersResult] = await Promise.all([
          userIds.length > 0
            ? supabase.from('follows').select('following_id').eq('follower_id', session.user.id).in('following_id', userIds)
            : Promise.resolve({ data: [] }),
          supabase.from('follows').select('follower_id').eq('following_id', session.user.id),
        ]);

        setFollowingUsers(new Set(followingResult.data?.map(f => f.following_id) ?? []));
        setFollowingBackUsers(new Set(followersResult.data?.map(f => f.follower_id) ?? []));
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        setFilteredLikes((pageNum === 0 ? newLikes : [...likes, ...newLikes]).filter((like: any) =>
          like.profiles.username.toLowerCase().includes(q) ||
          (like.profiles.name && like.profiles.name.toLowerCase().includes(q))
        ));
      } else {
        setFilteredLikes(pageNum === 0 ? newLikes : prev => [...prev, ...newLikes]);
      }
    } catch (err) {
      console.error('Error fetching likes:', err);
      setError(err.message || 'Failed to load likes');
    } finally {
      if (pageNum === 0) setIsLoading(false);
      else setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setPage(p => p + 1);
  }, [hasMore, loadingMore]);

  const handleFollowToggle = useCallback(async (userId: string) => {
    if (!session?.user?.id || userId === session.user.id) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const isCurrentlyFollowing = followingUsers.has(userId);

    if (isCurrentlyFollowing) {
      setFollowingUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
    } else {
      setFollowingUsers(prev => new Set([...prev, userId]));
    }

    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(userId, session.user.id);
      } else {
        await followUser(userId, session.user.id);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      if (isCurrentlyFollowing) {
        setFollowingUsers(prev => new Set([...prev, userId]));
      } else {
        setFollowingUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
      }
    }
  }, [session?.user?.id, followingUsers, followUser, unfollowUser]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredLikes(likes);
    } else {
      const q = query.toLowerCase();
      setFilteredLikes(likes.filter((like: any) =>
        like.profiles.username.toLowerCase().includes(q) ||
        (like.profiles.name && like.profiles.name.toLowerCase().includes(q))
      ));
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredLikes(likes);
  };

  const renderLike = useCallback(({ item }) => {
    const isOwnProfile = session?.user?.id === item.profiles.id;
    const isFollowing = followingUsers.has(item.profiles.id);
    const hasFullName = item.profiles.name && item.profiles.name.trim() !== '';

    return (
      <TouchableOpacity
        activeOpacity={0.5}
        style={styles.likeItem}
        onPress={() => router.push(`/profile/${item.profiles.id}`)}
      >
        <CachedAvatar path={item.profiles.avatar_url} size={44} />
        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.profiles.username}</Text>
          {hasFullName && <Text style={styles.fullName}>{item.profiles.name}</Text>}
        </View>
        {!isOwnProfile && (
          <TouchableOpacity
            activeOpacity={0.5}
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleFollowToggle(item.profiles.id);
            }}
          >
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? 'Following' : (followingBackUsers.has(item.profiles.id) ? 'Follow Back' : 'Follow')}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }, [session?.user?.id, followingUsers, followingBackUsers, handleFollowToggle]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <UserListSkeleton count={8} showFollowButton={true} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          activeOpacity={0.5}
          style={styles.retryButton}
          onPress={() => fetchLikes(0, true)}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {filteredLikes.length === 0 && !isLoading ? (
        <TouchableOpacity activeOpacity={0.5} style={styles.emptyContainer} onPress={Keyboard.dismiss}>
          {searchQuery.length > 0 ? (
            <>
              <IonIcon name="search-outline" size={64} color={colors.secondaryText} />
              <Text style={styles.emptyText}>No results found</Text>
              <Text style={styles.emptySubtext}>Try searching with a different username</Text>
            </>
          ) : likes.length === 0 ? (
            <>
              <IonIcon name="heart-outline" size={64} color={colors.secondaryText} />
              <Text style={styles.emptyText}>No likes yet</Text>
              <Text style={styles.emptySubtext}>Be the first to like this post!</Text>
            </>
          ) : null}
        </TouchableOpacity>
      ) : (
        <FlashList
          data={filteredLikes}
          renderItem={renderLike}
          keyExtractor={(item) => item.user_id}
          estimatedItemSize={72}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={true}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={colors.brand} /> : null}
          ListHeaderComponent={
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <IonIcon name="search" size={20} color={colors.secondaryText} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search"
                  placeholderTextColor={colors.secondaryText}
                  value={searchQuery}
                  onChangeText={handleSearch}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity activeOpacity={0.5} onPress={clearSearch} style={styles.clearButton}>
                    <IonIcon name="close-circle" size={20} color={colors.secondaryText} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: 16,
    color: colors.notification,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: colors.primaryText,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
  },
  listContainer: {
    paddingTop: 16,
  },
  likeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 2,
  },
  fullName: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  followButton: {
    width: 120,
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingButton: {
    backgroundColor: colors.secondaryAccent,
  },
  followButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  followingButtonText: {
    color: colors.primaryText,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryAccent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.primaryText,
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  footer: {
    padding: 16,
  },
});
