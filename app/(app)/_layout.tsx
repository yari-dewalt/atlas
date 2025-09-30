import { router, Stack, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { View, Text, SafeAreaView, Pressable, StyleSheet, Animated, ActivityIndicator, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { useProfileStore } from '../../stores/profileStore';
import { useClubStore } from '../../stores/clubStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useMessageStore } from '../../stores/messagesStore';
import { useEditProfileStore } from '../../stores/editProfileStore';
import { useProgressStore } from '../../stores/progressStore';
import CachedAvatar from '../../components/CachedAvatar';

// Unified TopNavBar with dynamic content
const TopNavBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { profile: authProfile, session } = useAuthStore();
  const { currentProfile, followUser, isUserFollowed, loading } = useProfileStore();
  const { currentClub, fetchClubById } = useClubStore();
  const { unreadCount, fetchNotifications } = useNotificationStore();
  const { conversations } = useMessageStore();
  const [followButtonState, setFollowButtonState] = useState<'follow' | 'following' | 'hidden'>('follow');
  const [isFollowAnimating, setIsFollowAnimating] = useState(false);
  const [supportHasText, setSupportHasText] = useState(false);
  const [followingBackUsers, setFollowingBackUsers] = useState(new Set()); // Users who are following us
  const fadeAnim = useRef(new Animated.Value(1)).current;
  // Edit Profile Store
  const { hasChanges, isValid, isLoading, handleSave } = useEditProfileStore();
  
  // Progress Store
  const { progress, isVisible } = useProgressStore();
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);
  
  const totalUnreadMessages = conversations.reduce(
    (total, convo) => total + convo.unread_count, 
    0
  );
  
  // Get route information
  const isProfileRoute = pathname.includes('/profile');
  const isEditProfileRoute = pathname.includes('/profile/') && pathname.includes('/edit') && !pathname.includes('/settings');
  const isModalRoute = pathname.includes('editPost') || pathname.includes('editRoutine');
  const isPostRoute = pathname.includes('/post/');
  const isClubRoute = pathname.includes('/clubs/');
  const isExploreRoute = pathname.includes('/explore');
  const isRecentSearchesRoute = pathname.includes('/explore/recentSearches');
  const isNotificationRoute = pathname.includes('/notifications');
  const isMessagesRoute = pathname.includes('/messages');
  const isNewMessageRoute = pathname.includes('/newMessage');
  const isConversationRoute = pathname.includes('/conversation/');
  const isSettingsRoute = pathname.includes('/settings/');
  const isSupportRoute = pathname.includes('/settings/support/');
  const isWorkoutSpecificRoute = pathname.includes('/workout/');
  const isWorkoutMainRoute = pathname.includes('/workout') && !isWorkoutSpecificRoute && !pathname.includes('/workouts');
  const isWorkoutExploreRoute = pathname.includes('/workout/explore');
  const isRoutineSpecificRoute = pathname.includes('/routine/');
  const isEditRoutineRoute = pathname.includes('/editRoutine/');
  const isRoutineMainRoute = pathname.includes('/routines') && !isRoutineSpecificRoute;
  const isMainTab = !isProfileRoute && !isModalRoute && !isPostRoute && !isClubRoute && !isNotificationRoute && !isMessagesRoute && !isNewMessageRoute && !isConversationRoute && !isSettingsRoute && !isWorkoutSpecificRoute && !isRoutineMainRoute && !isRoutineSpecificRoute && !isEditRoutineRoute;

  useEffect(() => {
    if (session?.user?.id) {
      fetchNotifications();
      fetchFollowingRelationships();
    }
  }, [session?.user?.id]);

  // Fetch who's following us to show "Follow back" button
  const fetchFollowingRelationships = async () => {
    if (!session?.user?.id) return;

    try {
      // Import supabase dynamically to avoid import issues
      const { supabase } = await import('../../lib/supabase');
      
      // Get users who are following us
      const { data: followersData, error: followersError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', session.user.id);

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

  // Check support text state periodically when on support routes
  useEffect(() => {
    if (!isSupportRoute) {
      setSupportHasText(false);
      return;
    }

    const checkTextState = () => {
      try {
        let hasText = false;
        if (pathname.includes('/settings/support/contact')) {
          const contactModule = require('./(cards)/settings/support/contact');
          hasText = contactModule.getHasText ? contactModule.getHasText() : false;
        } else if (pathname.includes('/settings/support/bug')) {
          const bugModule = require('./(cards)/settings/support/bug');
          hasText = bugModule.getHasText ? bugModule.getHasText() : false;
        } else if (pathname.includes('/settings/support/feature')) {
          const featureModule = require('./(cards)/settings/support/feature');
          hasText = featureModule.getHasText ? featureModule.getHasText() : false;
        }
        setSupportHasText(hasText);
      } catch (error) {
        setSupportHasText(false);
      }
    };

    // Check immediately and then periodically
    checkTextState();
    const interval = setInterval(checkTextState, 100);

    return () => {
      clearInterval(interval);
      setSupportHasText(false);
    };
  }, [isSupportRoute, pathname]);
  
  // Get active tab name or screen title
  const getTitle = () => {
    if (isEditProfileRoute) {
      return 'Edit Profile';
    }
    
    if (isProfileRoute) {
      const isOwnProfile = userId && (
        userId === session?.user?.id || 
        userId === authProfile?.id
      );

      if (pathname.includes('/activity')) return 'Activity';
      if (pathname.includes('/settings')) return 'Settings';
      if (pathname.includes('/followers')) return 'Followers';
      if (pathname.includes('/following')) return 'Following';
      if (pathname.includes('/posts')) return 'Posts';
      if (pathname.includes('/clubs')) return 'Clubs';
      if (pathname.includes('/workouts')) return 'Workouts';
      if (pathname.includes('/routines')) return 'Routines';
      if (pathname.includes('/media')) return 'Media';

      if (isOwnProfile) return 'Profile';

      if (userId === currentProfile?.id) {
        return currentProfile?.username;
      }

      return '';
    }
    
    if (isModalRoute) {
      if (pathname.includes('editPost')) {
        if (pathname.includes('/new')) return 'New Post';
        return 'Edit Post';
      }
      if (pathname.includes('editRoutine')) return 'Edit Routine';
      return 'Modal';
    }

    if (isClubRoute) {
      if (pathname.includes('/settings')) return 'Settings';
      
      return currentClub?.name || 'Club';
    }

    if (isExploreRoute) {
      if (pathname.includes('/people')) return 'People to follow';
      if (pathname.includes('/clubs')) return 'Recommended Clubs';
      if (pathname.includes('/recentSearches')) return 'Recent Searches';

      return 'Explore';
    }

    if (isPostRoute) {
      if (pathname.includes('/comments')) return 'Comments';
      if (pathname.includes('/likes')) return 'Likes';
      return 'Post';
    }
    if (isNotificationRoute) return 'Notifications';
    if (isMessagesRoute) return 'Messages';
    if (isNewMessageRoute) return 'New Message';
    if (isWorkoutExploreRoute) return 'Explore Routines';
    if (isWorkoutSpecificRoute) {
      if (pathname.includes('/workout/official-routines')) return 'Official Routines';
      if (pathname.includes('/workout/search-community')) return 'Search Community';
      if (pathname.includes('/workout/most-liked')) return 'Most Liked';
      if (pathname.includes('/workout/most-used')) return 'Most Used';
      return 'Workout Details';
    }
    if (isWorkoutMainRoute) return 'Workout';
    if (isRoutineSpecificRoute) return 'Routine Details';
    if (isRoutineMainRoute) return 'Routines';

    if (isSettingsRoute) {
      if (pathname.includes('/settings/account')) return 'Account';
      if (pathname.includes('/settings/username')) return 'Username';
      if (pathname.includes('/settings/email')) return 'Email';
      if (pathname.includes('/settings/password')) return 'Password';
      if (pathname.includes('/settings/notifications')) return 'Notifications';
      if (pathname.includes('/settings/privacy')) return 'Privacy';
      if (pathname.includes('/settings/about')) return 'About';
      if (pathname.includes('/settings/help')) return 'Help Center';
      if (pathname.includes('/settings/support/contact')) return 'Contact Support';
      if (pathname.includes('/settings/support/bug')) return 'Report a Bug';
      if (pathname.includes('/settings/support/feature')) return 'Feature Request';
      return 'Settings';
    }

    if (isConversationRoute) {
      const matches = pathname.match(/\/conversation\/([^\/]+)/);
      const conversationId = matches ? matches[1] : null;
      const conversation = conversations.find(c => c.id === conversationId);
    
      if (conversation) {
        // Find the other participant (not the current user)
        const other = conversation.participants.find(
          p => p.id !== session?.user?.id
        );
        return other?.name || other?.username || 'Conversation';
      }
      return 'Conversation';
    }
    
    // Main tabs
    if (pathname.includes('/home')) return 'Home';
    if (pathname.includes('/clubs')) return 'Clubs';
    if (pathname.includes('/explore')) return 'Explore';

    return 'Atlas';
  };
  
  // Get profile user ID if on profile route
  const getProfileUserId = () => {
    if (!isProfileRoute) return null;
    const matches = pathname.match(/\/profile\/([^\/]+)/);
    return matches ? matches[1] : session?.user.id;
  };

  const getClubId = () => {
    if (!isClubRoute) return null;
    const matches = pathname.match(/\/clubs\/([^\/]+)/);
    return matches ? matches[1] : null;
  }

  const getRoutineId = () => {
    if (!isRoutineSpecificRoute) return null;
    const matches = pathname.match(/\/routine\/([^\/]+)/);
    return matches ? matches[1] : null;
  }
  
  const userId = getProfileUserId();
  const title = getTitle();
  const clubId = getClubId();
  const routineId = getRoutineId();

  useEffect(() => {
    if (isClubRoute && clubId) {
      // No need to pass session here since we just need the name
      fetchClubById(clubId as string);
    }
  }, [clubId, isClubRoute]);
  
  // Check if this is the main profile page (not a sub-page)
  const isMainProfilePage = isProfileRoute && 
    (pathname.endsWith(`/profile/${userId}`) || pathname.endsWith(`/profile/${userId}/index`) || pathname.endsWith('/profile'));
  
  const isMainClubPage = isClubRoute &&
    (pathname.endsWith(`/clubs/${clubId}`) || pathname.endsWith(`/clubs/${clubId}/index`) || pathname.endsWith('/clubs'));

  const isMainRoutinePage = isRoutineSpecificRoute &&
    (pathname.endsWith(`/routine/${routineId}`) || pathname.endsWith(`/routine/${routineId}/index`) || pathname.endsWith('/routine'));

  // Parse workoutId from the pathname for workout routes
  const workoutIdMatch = pathname.match(/\/workout\/([^\/]+)/);
  const workoutId = workoutIdMatch ? workoutIdMatch[1] : null;

  const isMainWorkoutPage = isWorkoutSpecificRoute &&
    (pathname.endsWith(`/workout/${workoutId}`) || pathname.endsWith(`/workout/${workoutId}/index`) || pathname.endsWith('/workout'));

  // Determine if we should show the follow button
  const shouldShowFollowButton = isProfileRoute && 
    !isMainProfilePage && 
    userId && 
    userId !== session?.user?.id && 
    userId !== authProfile?.id &&
    currentProfile &&
    !isUserFollowed(userId); // Use global follow state

  // Handle follow button press
  const handleFollowPress = async () => {
    if (isFollowAnimating || !userId || !session?.user?.id) return;
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setIsFollowAnimating(true);
    
    try {
      // Actually follow the user
      await followUser(userId, session.user.id);
      
      // Immediately hide the button after successful follow
      setFollowButtonState('hidden');
      setIsFollowAnimating(false);
    } catch (error) {
      console.error('Error following user:', error);
      // Reset button state on error
      setFollowButtonState('follow');
      setIsFollowAnimating(false);
    }
  };

  // Reset follow button state when route changes
  useEffect(() => {
    setFollowButtonState('follow');
    setIsFollowAnimating(false);
    fadeAnim.setValue(1);
  }, [pathname]);

  // Compute animated style for follow button
  const followButtonAnimatedStyle = {
    opacity: followButtonState === 'following' ? fadeAnim : 1
  };
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={ Platform.OS === 'ios' ? styles.header : styles.headerAndroid }>
        {/* LEFT SIDE */}
        {(
          <View style={styles.headerLeft}>
            {/* Back button for profile/modal routes */}
            {((isProfileRoute || isModalRoute || isPostRoute || isClubRoute || isNotificationRoute || isMessagesRoute || isNewMessageRoute || isConversationRoute || isSettingsRoute || isWorkoutSpecificRoute || isRoutineSpecificRoute) && !pathname.endsWith('/profile')) ? (
              <TouchableOpacity
                activeOpacity={0.5}
                style={styles.headerButton}
                onPress={() => router.back()}
              >
                <Ionicons
                  name={isModalRoute ? "close" : "chevron-back"} 
                  size={24} 
                  color={colors.primaryText} 
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.5}
                style={[styles.headerButton, Platform.OS === 'ios' ? '' : { marginTop: 0 }]}
                onPress={() => router.push('/editPost/new')}
              >
                <Ionicons 
                  name="create-outline"
                  size={24} 
                  color={colors.primaryText} 
                />
              </TouchableOpacity>
            )}
          </View>
        )}
        
        
        {/* CENTER - TITLE */}
        {isConversationRoute ? (() => {
          const matches = pathname.match(/\/conversation\/([^\/]+)/);
          const conversationId = matches ? matches[1] : null;
          const conversation = conversations.find(c => c.id === conversationId);
          if (conversation) {
            const other = conversation.participants.find(
              p => p.id !== session?.user?.id
            );
            if (other) {
              return (
                <TouchableOpacity
                  activeOpacity={0.5}
                  style={styles.convoTitleContainer}
                  onPress={() => router.push(`/profile/${other.id}`)}
                >
                  <CachedAvatar
                    path={other.avatar_url}
                    size={28}
                    style={styles.convoAvatar}
                  />
                  <Text style={styles.headerTitleUsername}>
                    {title}
                  </Text>
                </TouchableOpacity>
              );
            }
          }
          return <Text style={styles.headerTitle}>{title}</Text>;
        })(        ) : isProfileRoute && !isMainProfilePage ? (
          <View style={styles.profileSubrouteContainer}>
            <Text style={[styles.headerTitle, Platform.OS === 'ios' ? '' : { paddingBottom: 60 }]}>
              {title}
            </Text>
            {/* Only show username if it's not the current user's profile */}
            {userId === currentProfile?.id && userId !== authProfile?.id && (
              <Text style={[styles.profileUsername, Platform.OS === 'ios' ? '' : { marginTop: -21, marginBottom: 6 }]}>
                {currentProfile.username || 'User'}
              </Text>
            )}
          </View>
        ) : (
          <Text style={[styles.headerTitle, Platform.OS === 'ios' ? '' : { paddingBottom: 20 }]}>{title}</Text>
        )}
        
        {/* RIGHT SIDE */}
        <View style={styles.headerRight}>
          {/* Done button for edit profile */}
          {isEditProfileRoute && (
            <TouchableOpacity
              activeOpacity={0.5} 
              style={[
                styles.doneButton,
                (!hasChanges || !isValid) && styles.disabledButton
              ]}
              onPress={handleSave || (() => {})}
              disabled={!hasChanges || !isValid || isLoading}
            >
                <Text style={[
                  styles.doneButtonText,
                  (!hasChanges || !isValid) && styles.disabledText
                ]}>
                  Done
                </Text>
            </TouchableOpacity>
          )}

          {/* Send button for support routes */}
          {isSupportRoute && (
            <TouchableOpacity
              activeOpacity={0.5} 
              style={[
                styles.doneButton,
                !supportHasText && styles.disabledButton
              ]}
              onPress={async () => {
                if (!supportHasText) return;
                
                // Dynamically import the appropriate send handler
                try {
                  if (pathname.includes('/settings/support/contact')) {
                    const { getSendHandler } = await import('./(cards)/settings/support/contact');
                    const handler = getSendHandler();
                    if (handler) handler();
                  } else if (pathname.includes('/settings/support/bug')) {
                    const { getSendHandler } = await import('./(cards)/settings/support/bug');
                    const handler = getSendHandler();
                    if (handler) handler();
                  } else if (pathname.includes('/settings/support/feature')) {
                    const { getSendHandler } = await import('./(cards)/settings/support/feature');
                    const handler = getSendHandler();
                    if (handler) handler();
                  }
                } catch (error) {
                  console.error('Error calling send handler:', error);
                }
              }}
              disabled={!supportHasText}
            >
              <Text style={[
                styles.doneButtonText,
                !supportHasText && styles.disabledText
              ]}>
                Send
              </Text>
            </TouchableOpacity>
          )}

          {/* Follow button for profile subroutes */}
          {shouldShowFollowButton && followButtonState !== 'hidden' && (
            <Animated.View style={[
              styles.followButtonContainer,
              followButtonAnimatedStyle
            ]}>
              <TouchableOpacity
                activeOpacity={0.5}
                style={[
                  styles.followButton,
                  followButtonState === 'following' && styles.followingButton
                ]}
                onPress={handleFollowPress}
                disabled={isFollowAnimating}
              >
                <Text style={[
                  styles.followButtonText,
                  followButtonState === 'following' && styles.followingButtonText
                ]}>
                  {followButtonState === 'following' ? 'Following' : 
                   (followingBackUsers.has(userId) ? 'Follow Back' : 'Follow')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Profile settings button - only show for own profile */}
          {isMainProfilePage && userId && (userId === session?.user?.id || userId === authProfile?.id) && (
            <TouchableOpacity
              activeOpacity={0.5} 
              style={styles.headerButton}
              onPress={() => router.push(`/profile/${userId}/settings`)}
            >
              <Ionicons name="settings-outline" size={24} color={colors.primaryText} />
            </TouchableOpacity>
          )}

          {isMainClubPage && (
            <TouchableOpacity
              activeOpacity={0.5} 
              style={styles.headerButton}
              onPress={() => router.push(`/clubs/${clubId}/settings`)}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.primaryText} />
            </TouchableOpacity>
          )}

          {isMainRoutinePage && (
            <TouchableOpacity
              activeOpacity={0.5} 
              style={styles.headerButton}
              onPress={() => {
                // Call the global function to open routine options
                if ((global as any).openRoutineOptions) {
                  (global as any).openRoutineOptions();
                }
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.primaryText} />
            </TouchableOpacity>
          )}

          {isMainWorkoutPage && (
            <TouchableOpacity
              activeOpacity={0.5} 
              style={styles.headerButton}
              onPress={() => {
                // Call the global function to open workout options
                if ((global as any).openWorkoutOptions) {
                  (global as any).openWorkoutOptions();
                }
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.primaryText} />
            </TouchableOpacity>
          )}

          {isRecentSearchesRoute && (
            <TouchableOpacity
              activeOpacity={0.5} 
              style={styles.headerButton}
              onPress={() => {
                // Call the global clear all function
                if ((global as any).clearAllRecentSearches) {
                  (global as any).clearAllRecentSearches();
                }
              }}
            >
              <Text style={styles.clearAllText}>Clear all</Text>
            </TouchableOpacity>
          )}
          
          {/* Main tab action buttons */}
          {isMainTab && (
            <>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.headerButton}
                onPress={() => router.push('/messages')}
              >
                <Ionicons name="chatbox-outline" size={24} color={colors.primaryText} />
                {totalUnreadMessages > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>
                      {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.headerButton}
                onPress={() => router.push('/notifications')}
              >
                <Ionicons name="notifications-outline" size={24} color={colors.primaryText} />
                {unreadCount > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Progress Bar */}
        {isVisible && (
          <Animated.View 
            style={[
              styles.progressBar, 
              { width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '105%'],
                extrapolate: 'clamp',
              })}
            ]} 
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default function AppLayout() {
  const pathname = usePathname().toLowerCase();
  const isFullScreenModal = pathname.includes('editpost') || pathname.includes('editroutine') || pathname.includes('newworkout') || pathname.includes('custom') || pathname.includes('exercisedetails') || pathname.includes('exerciseselection') || pathname.includes('messages') || pathname.includes('newpost') || pathname.includes('newroutine') || pathname.includes('workoutsettings') || pathname.includes('saveworkout');
  
  return (
    <View style={styles.container}>
      {!(Platform.OS === 'android' && isFullScreenModal) && <TopNavBar />}

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen 
          name="(modals)" 
          options={{
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen 
          name="(cards)" 
          options={{
            presentation: 'card',
          }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    backgroundColor: colors.background,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: colors.background,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
  },
  headerAndroid: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: colors.primaryAccent,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 'auto',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 16,
    color: colors.primaryText,
    fontWeight: '500',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  headerTitleUsername: {
    fontSize: 16,
    color: colors.primaryText,
    textAlign: 'center',
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    zIndex: 1,
  },
  headerButton: {
    padding: 8,
  },
  badgeContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.brand,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.primaryText,
    fontSize: 10,
    fontWeight: 'bold',
  },
  clearAllText: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '500',
  },
  convoTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  profileSubrouteContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  profileUsername: {
    fontSize: 13,
    color: colors.primaryText,
    marginTop: 34,
  },
  convoAvatar: {
    marginRight: 8,
  },
  followButtonContainer: {
    // Container for follow button animation
    marginTop: 14,
  },
  followButton: {
    width: 120,
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    alignItems: 'center',
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
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.brand,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: colors.secondaryText,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 1,
    backgroundColor: colors.brand,
  },
});