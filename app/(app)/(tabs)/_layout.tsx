import { Tabs, usePathname, useRouter } from 'expo-router';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../../constants/colors';
import { View, Text, SafeAreaView, Pressable, StyleSheet, Image, TouchableOpacity, Alert, Platform } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import CachedAvatar from '../../../components/CachedAvatar';
import { useWorkoutStore } from '../../../stores/workoutStore';
import * as Haptics from 'expo-haptics';

// Global scroll references for each tab
const scrollRefs = {
  home: { current: null },
  explore: { current: null },
  workout: { current: null },
  clubs: { current: null },
  profile: { current: null }
};

// Function to set scroll ref for a specific tab
export const setTabScrollRef = (tabName, ref) => {
  if (scrollRefs[tabName]) {
    scrollRefs[tabName].current = ref;
  }
};

// Function to scroll to top for a specific tab
export const scrollToTop = (tabName) => {
  console.log(scrollRefs[tabName])
  if (scrollRefs[tabName]?.current) {
    console.log('Scrolling to top of', tabName);
    scrollRefs[tabName].current.scrollTo({ y: 0, animated: true });
  }
};

export default function AppLayout() {
  const [activeTab, setActiveTab] = useState('home');
  const [isProfileRoute, setIsProfileRoute] = useState(false);
  const { profile, session } = useAuthStore();
  const { activeWorkout, isPaused, workoutSettings, loadWorkoutState } = useWorkoutStore();
  
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    // Extract the screen name from the pathname
    const segments = pathname.split('/');
    const currentScreen = segments[segments.length - 1];
    
    // Check if this is a profile route (includes the profile path segment)
    const isInProfileSection = pathname.includes('/profile');
    
    if (isInProfileSection) {
      setIsProfileRoute(true);
    } else {
      setIsProfileRoute(false);

      
      // Update the active tab title for non-profile routes
      let title;
      switch(currentScreen) {
        case 'home':
          title = 'home';
          break;
        case 'explore':
          title = 'explore';
          break;
        case 'workout':
          title = 'workout';
          break;
        case 'clubs':
          title = 'clubs';
          break;
        case 'profile':
          title = 'profile';
          break;
        default:
          title = 'profile';
          break;
      }

      setActiveTab(title);
    }
  }, [pathname]);

  // Load saved workout state on app startup
  useEffect(() => {
    loadWorkoutState();
  }, []);
  
  // Handle tab press - scroll to top if already on that tab
  const handleTabPress = (tabName) => {
    if (activeTab === tabName || pathname.includes('/profile')) {
      console.log(tabName);
      scrollToTop(tabName);
    }
  };
  
  const createTabBarLabel = (label: string) => {
    return ({ focused }: { focused: boolean }) => (
      <Text 
        style={{ 
          fontWeight: focused ? '600' : '400',
          fontSize: 10,
          color: focused ? colors.brand : colors.primaryText,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    );
  };

  const createTabBarIcon = (IconComponent) => {
    return ({ color, focused }: { color: string, focused: boolean }) => (
      <View>
        {IconComponent({ color, focused })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Active Workout Indicator Bar */}
      {activeWorkout && (
        <View style={styles.workoutIndicatorContainer}>
          <View style={styles.workoutIndicatorBar}>
            <View style={styles.workoutIndicatorContent}>
              <View style={styles.workoutStatusSection}>
                <Text style={styles.workoutIndicatorText}>
                  Workout in Progress {isPaused ? '(Paused)' : ''}
                </Text>
              </View>
            </View>
            
            <View style={styles.workoutButtonsSection}>
              <TouchableOpacity 
                style={styles.workoutButton}
                onPress={() => {
                  // Navigate to workout or resume logic
                  router.push('/newWorkout');
                }}
                activeOpacity={0.7}
              >
                <IonIcon 
                  name="play" 
                  size={14} 
                  color={colors.brand} 
                />
                <Text style={styles.resumeButtonText}>Resume</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.workoutButton}
                onPress={() => {
                  Alert.alert(
                    "Discard Workout",
                    "Are you sure you want to discard this workout? This action cannot be undone.",
                    [
                      {
                        text: "Cancel",
                        style: "cancel"
                      },
                      {
                        text: "Discard",
                        style: "destructive",
                        onPress: () => {
                          // Import the endWorkout function from useWorkoutStore
                          const { endWorkout } = useWorkoutStore.getState();
                          endWorkout();
                        }
                      }
                    ]
                  );
                }}
                activeOpacity={0.7}
              >
                <IonIcon 
                  name="close" 
                  size={14} 
                  color={colors.notification} 
                />
                <Text style={styles.discardButtonText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.primaryText,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.background,
            elevation: 0,
            shadowOpacity: 0,
            height: 86,
            paddingBottom: 30,
            borderTopWidth: 1,
            borderTopColor: colors.whiteOverlayLight,
          },
          tabBarItemStyle: {
            padding: 5,
          }
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            tabBarLabel: createTabBarLabel('Home'),
            tabBarIcon: createTabBarIcon(({ color, focused }) => (
              <IonIcon name={focused ? "home" : "home-outline"} size={28} color={color} />
            )),
          }}
          listeners={{
            tabPress: (e) => {
              handleTabPress('home');
            }
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            tabBarLabel: createTabBarLabel('Explore'),
            tabBarIcon: createTabBarIcon(({ color, focused }) => (
              <IonIcon name={focused ? "globe-outline" : "globe-outline"} size={28} color={color} />
            )),
          }}
          listeners={{
            tabPress: (e) => {
              handleTabPress('explore');
            }
          }}
        />
        <Tabs.Screen
          name="workout"
          options={{
            tabBarLabel: createTabBarLabel('Workout'),
            tabBarIcon: createTabBarIcon(({ color, focused }) => (
              <IonIcon name={focused ? "barbell" : "barbell-outline"} size={28} color={color} />
            )),
          }}
          listeners={{
            tabPress: (e) => {
              handleTabPress('workout');
            }
          }}
        />
        <Tabs.Screen
          name="clubs/index"
          options={{
            tabBarLabel: createTabBarLabel('Clubs'),
            tabBarIcon: createTabBarIcon(({ color, focused }) => (
              <IonIcon name={focused ? "people" : "people-outline"} size={28} color={color} />
            )),
          }}
          listeners={{
            tabPress: (e) => {
              handleTabPress('clubs');
            }
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarLabel: createTabBarLabel('You'),
            tabBarIcon: ({ color, focused }) => (
              <View style={{ opacity: focused ? 1 : 0.7 }}>
                <CachedAvatar 
                  path={profile?.avatar_url}
                  size={28}
                  style={{ 
                    borderWidth: 2,
                    borderColor: focused ? colors.brand : 'transparent'
                  }}
                  fallbackIconColor={color}
                />
              </View>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              // Only provide haptic feedback if we're not already on the profile tab
              if (pathname !== '/profile') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              handleTabPress('profile');
            }
          }}
        />
        <Tabs.Screen
          name="clubs/[clubId]/index"
          options={{
            href: null
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  workoutIndicatorContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 85 : 86, // Position above the tab bar
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  workoutIndicatorBar: {
    width: Platform.OS === 'android' ? '100.2%' : '100%',
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderColor: colors.whiteOverlay,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  workoutIndicatorContent: {
    marginBottom: 12,
  },
  workoutStatusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutIndicatorText: {
    color: colors.secondaryText,
    fontSize: 15,
    fontWeight: '400',
  },
  workoutButtonsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  workoutButton: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resumeButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '400',
    marginLeft: 6,
  },
  discardButtonText: {
    color: colors.notification,
    fontSize: 14,
    fontWeight: '400',
    marginLeft: 6,
  },
});