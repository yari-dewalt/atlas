import { View, Text, FlatList, StyleSheet, Pressable, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { Ionicons as IonIcon } from '@expo/vector-icons';
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

export default function FollowingScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const [following, setFollowing] = useState<Following[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [followingBackUsers, setFollowingBackUsers] = useState(new Set()); // Users who are following us
  const { session } = useAuthStore();
  const currentUserId = session?.user?.id;
  
  // Filter following based on search query
  const filteredFollowing = following.filter(profile => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const username = profile.username?.toLowerCase() || '';
    const name = profile.name?.toLowerCase() || '';
    return username.includes(query) || name.includes(query);
  });
  
  useEffect(() => {
    fetchFollowing();
    fetchFollowingRelationships();
  }, [userId]);

  // Fetch who's following us to show "Follow back" button
  const fetchFollowingRelationships = async () => {
    if (!currentUserId) return;

    try {
      // Get users who are following us
      const { data: followersData, error: followersError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', currentUserId);

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
  
  async function fetchFollowing() {
    try {
      setLoading(true);
      
      if (!userId) return;
      
      // Fetch users who the current profile follows
      const { data, error } = await supabase
        .from('follows')
        .select(`
          following:profiles!follows_following_id_fkey (
            id, username, name, avatar_url
          )
        `)
        .eq('follower_id', userId);
        
      if (error) {
        console.error('Error fetching following:', error);
        return;
      }
      
      // Extract profiles from the nested structure
      const followingProfiles = data.map(item => item.following) as Omit<Following, 'is_following'>[];
      
      // For the current user, mark all as following since we're viewing their following list
      if (userId === currentUserId) {
        setFollowing(followingProfiles.map(profile => ({
          ...profile,
          is_following: true
        })));
        return;
      }
      
      // Otherwise, check which users the current user is following
      const followingWithFollowStatus = await Promise.all(
        followingProfiles.map(async (profile) => {
          // Skip checking for the current user
          if (profile.id === currentUserId) {
            return {
              ...profile,
              is_following: false // Don't show follow button for self
            };
          }
          
          // Check if current user follows this profile
          const { data: followCheck } = await supabase
            .from('follows')
            .select('id')
            .match({
              follower_id: currentUserId,
              following_id: profile.id
            })
            .maybeSingle();
            
          return {
            ...profile,
            is_following: !!followCheck
          };
        })
      );
      
      setFollowing(followingWithFollowStatus);
    } catch (error) {
      console.error('Error in following fetch:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function toggleFollow(followingId: string, currentlyFollowing: boolean) {
    if (!currentUserId || followingId === currentUserId) return;
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Optimistic update - update UI immediately
    setFollowing(following.map(profile => 
      profile.id === followingId 
        ? { ...profile, is_following: !currentlyFollowing }
        : profile
    ));
    
    try {
      if (currentlyFollowing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .match({
            follower_id: currentUserId,
            following_id: followingId
          });
      } else {
        // Follow
        await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: followingId
          });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      // Revert on error
      setFollowing(following.map(profile => 
        profile.id === followingId 
          ? { ...profile, is_following: currentlyFollowing }
          : profile
      ));
    }
  }
  
  if (loading && following.length === 0) {
    return (
      <View style={styles.container}>
        <UserListSkeleton count={8} showFollowButton={true} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <FlatList
        data={filteredFollowing}
        keyExtractor={(item) => item.id}
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
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
              >
                <IonIcon name="close-circle" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.followingItem}
            onPress={() => router.push(`/profile/${item.id}`)}
          >
              <CachedAvatar
                path={item.avatar_url}
                size={40}
                style={styles.profileImage}
              />
            <View style={styles.userInfo}>
              <Text style={styles.displayName}>{item.username}</Text>
              {item.name && <Text style={styles.name}>{item.name}</Text>}
            </View>
            
            {/* Don't show follow button for current user */}
            {item.id !== currentUserId && (
              <TouchableOpacity
                activeOpacity={0.5} 
                style={[
                  styles.followButton,
                  item.is_following && styles.followingButton
                ]}
                onPress={() => toggleFollow(item.id, item.is_following)}
              >
                <Text style={[
                  styles.followButtonText,
                  item.is_following && styles.followingButtonText
                ]}>
                  {item.is_following ? 'Following' : 
                   (followingBackUsers.has(item.id) ? 'Follow Back' : 'Follow')}
                </Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {searchQuery.trim() ? `No following found for "${searchQuery}"` : 'Not following anyone yet'}
          </Text>
        }
      />
    </View>
  );
}

// Use the same styles as followers screen
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
  iconInitial: {
    fontSize: 18,
    color: colors.primaryText,
    fontWeight: 'bold',
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
  }
});