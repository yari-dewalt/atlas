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

export default function RecommendedClubs() {
  const router = useRouter();
  const { session } = useAuthStore();
  
  const [suggestedClubs, setSuggestedClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMoreClubs, setHasMoreClubs] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const CLUBS_PER_PAGE = 20;
  
  useEffect(() => {
    if (session?.user?.id) {
      loadSuggestedClubs();
    }
  }, [session?.user?.id]);
  
  const loadSuggestedClubs = async (reset = true) => {
    if (!session?.user?.id) return;
    
    try {
      if (reset) {
        setLoading(true);
        setPage(0);
      } else {
        setLoadingMore(true);
      }
      
      const currentPage = reset ? 0 : page;
      
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
          description,
          avatar_url,
          privacy_level,
          creator_id,
          created_at,
          members:club_members(count)
        `)
        .eq('privacy_level', 'public') // Only suggest public clubs
        .not('id', 'in', `(${memberClubIds.length > 0 ? memberClubIds.join(',') : '0'})`)
        .range(currentPage * CLUBS_PER_PAGE, (currentPage + 1) * CLUBS_PER_PAGE - 1)
        .order('created_at', { ascending: false });
        
      if (clubsError) throw clubsError;
      
      // Calculate member count for each club
      const clubsWithCounts = clubs.map(club => ({
        ...club,
        member_count: club.members.length > 0 ? club.members[0].count : 0,
        isJoined: false
      }));
      
      // Sort by member count
      clubsWithCounts.sort((a, b) => b.member_count - a.member_count);
      
      if (reset) {
        setSuggestedClubs(clubsWithCounts);
      } else {
        setSuggestedClubs(prev => [...prev, ...clubsWithCounts]);
      }
      
      // Update pagination state
      setPage(currentPage + 1);
      setHasMoreClubs(clubs.length === CLUBS_PER_PAGE);
      
    } catch (error) {
      console.error("Error fetching suggested clubs:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
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
    } catch (error) {
      console.error("Error joining club:", error);
    }
  };
  
  const renderClubItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.5} 
      style={styles.clubItem}
      onPress={() => router.push(`/clubs/${item.id}`)}
    >
      <View style={styles.clubHeader}>
        {item.avatar_url ? (
          <CachedAvatar
            path={item.avatar_url}
            size={60}
            style={styles.clubAvatar}
          />
        ) : (
          <View style={styles.clubAvatarPlaceholder}>
            <Text style={styles.clubInitial}>{item.name.charAt(0)}</Text>
          </View>
        )}
        
        <View style={styles.clubInfo}>
          <Text style={styles.clubName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.memberCount}>{item.member_count} members</Text>
          <Text style={styles.privacyTag}>
            {item.privacy_level === 'public' ? 'Public' : 'Private'}
          </Text>
        </View>
        
        <TouchableOpacity
          activeOpacity={0.5} 
          style={[
            styles.joinButton, 
            item.isJoined && styles.joinedButton
          ]}
          onPress={() => handleJoinClub(item.id)}
          disabled={item.isJoined}
        >
          <Text style={styles.joinButtonText}>
            {item.isJoined ? 'Joined' : 'Join'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {item.description && (
        <Text style={styles.clubDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
    </TouchableOpacity>
  );
  
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSuggestedClubs(true);
    setRefreshing(false);
  }, []);
  
  const handleLoadMore = () => {
    if (!loadingMore && hasMoreClubs) {
      loadSuggestedClubs(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Recommended Clubs',
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
          <Text style={styles.loadingText}>Discovering clubs for you...</Text>
        </View>
      ) : (
        <FlashList
          data={suggestedClubs}
          keyExtractor={(item) => item.id}
          renderItem={renderClubItem}
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
              <IonIcon name="people-circle-outline" size={56} color={colors.secondaryText} />
              <Text style={styles.emptyText}>No recommended clubs found</Text>
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
  clubItem: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  clubAvatar: {
    marginRight: 16,
  },
  clubAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.secondaryAccent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  clubInitial: {
    fontSize: 28,
    color: colors.primaryText,
    fontWeight: 'bold',
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 4,
  },
  privacyTag: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: '600',
  },
  clubDescription: {
    fontSize: 14,
    color: colors.secondaryText,
    lineHeight: 20,
  },
  joinButton: {
    backgroundColor: colors.brand,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginLeft: 8,
  },
  joinedButton: {
    backgroundColor: colors.primaryAccent,
    borderWidth: 1,
    borderColor: colors.secondaryText,
  },
  joinButtonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
    fontSize: 14,
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