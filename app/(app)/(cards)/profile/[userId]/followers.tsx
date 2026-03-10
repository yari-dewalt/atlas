import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { colors } from '../../../../../constants/colors';
import { supabase } from '../../../../../lib/supabase';
import { useAuthStore } from '../../../../../stores/authStore';
import CachedAvatar from '../../../../../components/CachedAvatar';
import UserListSkeleton from '../../../../../components/UserListSkeleton';

type Follower = {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
  is_following: boolean;
};

const PAGE_SIZE = 30;

export default function FollowersScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [followingUsers, setFollowingUsers] = useState(new Set<string>());
  const [followingBackUsers, setFollowingBackUsers] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const { session } = useAuthStore();
  const currentUserId = session?.user?.id;

  const filteredFollowers = followers.filter(follower => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const username = follower.username?.toLowerCase() || '';
    const name = follower.name?.toLowerCase() || '';
    return username.includes(query) || name.includes(query);
  });

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    setFollowers([]);
    fetchFollowers(0, true);
  }, [userId]);

  useEffect(() => {
    if (page > 0) {
      fetchFollowers(page, false);
    }
  }, [page]);

  async function fetchFollowers(pageNum: number, fetchSets: boolean) {
    try {
      if (pageNum === 0) setLoading(true);
      else setLoadingMore(true);

      if (!userId) return;

      const followersQuery = supabase
        .from('follows')
        .select('follower:profiles!follows_follower_id_fkey(id, username, name, avatar_url)')
        .eq('following_id', userId)
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (fetchSets && currentUserId) {
        const [followersResult, followingResult, followersBackResult] = await Promise.all([
          followersQuery,
          supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
          supabase.from('follows').select('follower_id').eq('following_id', currentUserId),
        ]);

        if (followersResult.error) {
          console.error('Error fetching followers:', followersResult.error);
          return;
        }

        const newFollowingSet = new Set<string>(followingResult.data?.map(f => f.following_id) ?? []);
        const newFollowingBackSet = new Set<string>(followersBackResult.data?.map(f => f.follower_id) ?? []);
        setFollowingUsers(newFollowingSet);
        setFollowingBackUsers(newFollowingBackSet);

        const newFollowers = buildFollowers(followersResult.data ?? [], newFollowingSet);
        if (newFollowers.length < PAGE_SIZE) setHasMore(false);
        setFollowers(newFollowers);
      } else {
        const followersResult = await followersQuery;
        if (followersResult.error) {
          console.error('Error fetching followers:', followersResult.error);
          return;
        }

        const newFollowers = buildFollowers(followersResult.data ?? [], followingUsers);
        if (newFollowers.length < PAGE_SIZE) setHasMore(false);
        setFollowers(prev => [...prev, ...newFollowers]);
      }
    } catch (error) {
      console.error('Error in followers fetch:', error);
    } finally {
      if (pageNum === 0) setLoading(false);
      else setLoadingMore(false);
    }
  }

  function buildFollowers(data: any[], followingSet: Set<string>): Follower[] {
    return data.map(item => {
      const f = item.follower as any;
      return {
        id: f.id,
        username: f.username,
        name: f.name,
        avatar_url: f.avatar_url,
        is_following: f.id === currentUserId ? false : followingSet.has(f.id),
      };
    });
  }

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setPage(p => p + 1);
  }, [hasMore, loadingMore]);

  const toggleFollow = useCallback(async (followerId: string, currentlyFollowing: boolean) => {
    if (!currentUserId || followerId === currentUserId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setFollowers(prev => prev.map(f =>
      f.id === followerId ? { ...f, is_following: !currentlyFollowing } : f
    ));

    try {
      if (currentlyFollowing) {
        await supabase.from('follows').delete().match({ follower_id: currentUserId, following_id: followerId });
      } else {
        await supabase.from('follows').insert({ follower_id: currentUserId, following_id: followerId });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      setFollowers(prev => prev.map(f =>
        f.id === followerId ? { ...f, is_following: currentlyFollowing } : f
      ));
    }
  }, [currentUserId]);

  const renderFollower = useCallback(({ item }: { item: Follower }) => (
    <TouchableOpacity
      activeOpacity={0.5}
      style={styles.followerItem}
      onPress={() => router.push(`/profile/${item.id}`)}
    >
      <CachedAvatar path={item.avatar_url} size={40} style={styles.profileImage} />
      <View style={styles.userInfo}>
        <Text style={styles.displayName}>{item.username}</Text>
        {item.name && <Text style={styles.name}>{item.name}</Text>}
      </View>
      {item.id !== currentUserId && (
        <TouchableOpacity
          activeOpacity={0.5}
          style={[styles.followButton, item.is_following && styles.followingButton]}
          onPress={() => toggleFollow(item.id, item.is_following)}
        >
          <Text style={[styles.followButtonText, item.is_following && styles.followingButtonText]}>
            {item.is_following ? 'Following' : (followingBackUsers.has(item.id) ? 'Follow Back' : 'Follow')}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  ), [currentUserId, followingBackUsers, toggleFollow]);

  if (loading && followers.length === 0) {
    return (
      <View style={styles.container}>
        <UserListSkeleton count={8} showFollowButton={true} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={filteredFollowers}
        keyExtractor={(item) => item.id}
        estimatedItemSize={68}
        renderItem={renderFollower}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={colors.brand} /> : null}
        ListHeaderComponent={
          <View style={styles.searchContainer}>
            <IonIcon name="search" size={20} color={colors.secondaryText} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor={colors.secondaryText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity activeOpacity={0.5} style={styles.clearButton} onPress={() => setSearchQuery('')}>
                <IonIcon name="close-circle" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {searchQuery.trim() ? `No followers found for "${searchQuery}"` : 'No followers yet'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryAccent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: colors.primaryText,
  },
  clearButton: {
    marginLeft: 8,
  },
  followerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 4,
  },
  name: {
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
  },
  followingButton: {
    backgroundColor: colors.secondaryAccent,
  },
  followButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 13,
  },
  followingButtonText: {
    color: colors.primaryText,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: colors.secondaryText,
    fontSize: 16,
  },
  footer: {
    padding: 16,
  },
});
