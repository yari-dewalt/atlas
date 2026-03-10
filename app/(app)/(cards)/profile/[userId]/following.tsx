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

type Following = {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
  is_following: boolean;
};

const PAGE_SIZE = 30;

export default function FollowingScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const [following, setFollowing] = useState<Following[]>([]);
  const [followingUsers, setFollowingUsers] = useState(new Set<string>());
  const [followingBackUsers, setFollowingBackUsers] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const { session } = useAuthStore();
  const currentUserId = session?.user?.id;

  const filteredFollowing = following.filter(profile => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const username = profile.username?.toLowerCase() || '';
    const name = profile.name?.toLowerCase() || '';
    return username.includes(query) || name.includes(query);
  });

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    setFollowing([]);
    fetchFollowing(0, true);
  }, [userId]);

  useEffect(() => {
    if (page > 0) {
      fetchFollowing(page, false);
    }
  }, [page]);

  async function fetchFollowing(pageNum: number, fetchSets: boolean) {
    try {
      if (pageNum === 0) setLoading(true);
      else setLoadingMore(true);

      if (!userId) return;

      const followingQuery = supabase
        .from('follows')
        .select('following:profiles!follows_following_id_fkey(id, username, name, avatar_url)')
        .eq('follower_id', userId)
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      // Shortcut: viewing own following list — all are marked as following
      if (userId === currentUserId) {
        const { data, error } = await followingQuery;
        if (error) {
          console.error('Error fetching following:', error);
          return;
        }
        const profiles = buildFollowing(data ?? [], null);
        if (profiles.length < PAGE_SIZE) setHasMore(false);
        setFollowing(pageNum === 0 ? profiles : prev => [...prev, ...profiles]);
        return;
      }

      if (fetchSets && currentUserId) {
        const [followingResult, currentFollowingResult, followersBackResult] = await Promise.all([
          followingQuery,
          supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
          supabase.from('follows').select('follower_id').eq('following_id', currentUserId),
        ]);

        if (followingResult.error) {
          console.error('Error fetching following:', followingResult.error);
          return;
        }

        const newFollowingSet = new Set<string>(currentFollowingResult.data?.map(f => f.following_id) ?? []);
        const newFollowingBackSet = new Set<string>(followersBackResult.data?.map(f => f.follower_id) ?? []);
        setFollowingUsers(newFollowingSet);
        setFollowingBackUsers(newFollowingBackSet);

        const profiles = buildFollowing(followingResult.data ?? [], newFollowingSet);
        if (profiles.length < PAGE_SIZE) setHasMore(false);
        setFollowing(profiles);
      } else {
        const { data, error } = await followingQuery;
        if (error) {
          console.error('Error fetching following:', error);
          return;
        }
        const profiles = buildFollowing(data ?? [], followingUsers);
        if (profiles.length < PAGE_SIZE) setHasMore(false);
        setFollowing(prev => [...prev, ...profiles]);
      }
    } catch (error) {
      console.error('Error in following fetch:', error);
    } finally {
      if (pageNum === 0) setLoading(false);
      else setLoadingMore(false);
    }
  }

  function buildFollowing(data: any[], followingSet: Set<string> | null): Following[] {
    return data.map(item => {
      const p = item.following as any;
      return {
        id: p.id,
        username: p.username,
        name: p.name,
        avatar_url: p.avatar_url,
        // Own profile shortcut: followingSet is null → mark all as following
        is_following: followingSet === null ? true : (p.id === currentUserId ? false : followingSet.has(p.id)),
      };
    });
  }

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setPage(p => p + 1);
  }, [hasMore, loadingMore]);

  const toggleFollow = useCallback(async (followingId: string, currentlyFollowing: boolean) => {
    if (!currentUserId || followingId === currentUserId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setFollowing(prev => prev.map(p =>
      p.id === followingId ? { ...p, is_following: !currentlyFollowing } : p
    ));

    try {
      if (currentlyFollowing) {
        await supabase.from('follows').delete().match({ follower_id: currentUserId, following_id: followingId });
      } else {
        await supabase.from('follows').insert({ follower_id: currentUserId, following_id: followingId });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      setFollowing(prev => prev.map(p =>
        p.id === followingId ? { ...p, is_following: currentlyFollowing } : p
      ));
    }
  }, [currentUserId]);

  const renderFollowing = useCallback(({ item }: { item: Following }) => (
    <TouchableOpacity
      activeOpacity={0.5}
      style={styles.followingItem}
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

  if (loading && following.length === 0) {
    return (
      <View style={styles.container}>
        <UserListSkeleton count={8} showFollowButton={true} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={filteredFollowing}
        keyExtractor={(item) => item.id}
        estimatedItemSize={68}
        renderItem={renderFollowing}
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
            {searchQuery.trim() ? `No following found for "${searchQuery}"` : 'Not following anyone yet'}
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
  followingItem: {
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
