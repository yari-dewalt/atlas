import { Tabs, usePathname, useRouter } from 'expo-router';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../../constants/colors';
import { View, Text, SafeAreaView, Pressable, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import CachedAvatar from '../../../components/CachedAvatar';
import { useWorkoutStore } from '../../../stores/workoutStore';

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
  if (scrollRefs[tabName]?.current) {
    scrollRefs[tabName].current.scrollTo({ y: 0, animated: true });
  }
};

export default function AppLayout() {
  const [activeTab, setActiveTab] = useState('home');
  const [isProfileRoute, setIsProfileRoute] = useState(false);
  const { profile, session } = useAuthStore();
  const { activeWorkout, isPaused } = useWorkoutStore();
  
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
          title = 'home';
      }
      
      setActiveTab(title);
    }
  }, [pathname]);
  
  // Handle tab press - scroll to top if already on that tab
  const handleTabPress = (tabName) => {
    if (activeTab === tabName) {
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
              <View>
                <IonIcon name={focused ? "barbell" : "barbell-outline"} size={28} color={color} />
                {activeWorkout && (
                  <View style={styles.workoutIndicator}>
                    {isPaused ? (
                      <IonIcon name="pause" size={10} color="#000" />
                    ) : (
                      <IonIcon name="time" size={10} color="#000" />
                    )}
                  </View>
                )}
              </View>
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
  safeArea: {
    backgroundColor: colors.secondaryAccent,
  },
  header: {
    height: 50, // Increased height a bit for better spacing
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.secondaryAccent,
    position: 'relative', // Important for absolute positioning of title
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    // No margins needed - it will naturally align to the left
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primaryText,
    position: 'absolute', // Position absolutely to center perfectly
    left: 0,
    right: 0,
    textAlign: 'center', // Center the text
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto', // Push to the far right
  },
  headerButton: {
    padding: 8,
  },
  atlasLogo: {
    color: colors.primaryText,
    fontSize: 20,
    fontWeight: 'bold',
  },
  workoutIndicator: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: colors.brand,
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.secondaryAccent,
  },
});