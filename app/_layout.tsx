import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import { ActivityIndicator, View, Text, Animated, StyleSheet, Image, Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import { useNotificationStore } from '../stores/notificationStore';
import { usePushNotifications } from '../hooks/usePushNotifications';
import * as ScreenOrientation from 'expo-screen-orientation';
import { colors } from '../constants/colors';
import { StatusBar } from 'react-native';
import { Audio } from 'expo-av';

// Root layout component
export default function RootLayout() {
  // Get state and actions from auth store
  const { session, loading, setSession, setLoading, fetchProfile, profile, updateProfile } = useAuthStore();
  const { fetchNotifications, subscribeToNotifications } = useNotificationStore();
  
  // Initialize push notifications
  usePushNotifications();
  
  const segments = useSegments();
  const router = useRouter();
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Check if the path is in different groups
  const inAppGroup = segments[0] === '(app)';
  const inAuthGroup = segments[0] === '(auth)';
  const inOnboardingGroup = segments[0] === '(onboarding)';
  const inLegalGroup = segments[0] === '(legal)';

  useEffect(() => {
    // Lock screen orientation to portrait
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
      .catch(error => {
        console.error('Failed to lock screen orientation:', error);
      });

    if (Platform.OS === 'ios') {
      Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    }

    // Setup auth state listener
    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        await fetchProfile();
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, updatedSession) => {
        setSession(updatedSession);
        if (updatedSession) {
          fetchProfile();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Setup notification subscription when user is authenticated
  useEffect(() => {
    if (session?.user?.id) {
      // Fetch initial notifications
      fetchNotifications();
      
      // Subscribe to real-time notifications
      const unsubscribe = subscribeToNotifications(session.user.id);
      
      // Clean up subscription
      return () => unsubscribe();
    }
  }, [session?.user?.id, fetchNotifications, subscribeToNotifications]);

  // Handle routing based on auth state and onboarding status
  useEffect(() => {
    if (loading) return; // Only check auth loading

    // Allow legal pages to be accessed from anywhere
    if (inLegalGroup) return;

    if (!session) {
      // No session - redirect to auth (but allow legal pages)
      if (!inAuthGroup) {
        router.replace('/(auth)/auth');
      }
    } else {
      const currentPath = segments.join('/');
      // Has session - check email verification first, then onboarding status
      if (currentPath.includes('verification') || currentPath.includes('resetPassword') || currentPath.includes('newPassword')) {
        return; // Let password reset flow complete
      }
      if (profile && profile.email_verified !== true) {
        // Don't sign out if user is currently on verification or password reset screens
        if (currentPath.includes('verification')) {
          return; // Let verification/password reset process complete
        }
        // Sign out users with unverified emails to prevent session persistence
        supabase.auth.signOut();
        updateProfile(null);
        return;
      } else if (profile && profile.onboarding_completed !== true) {
        // Email verified but needs onboarding or is currently in the flow
        if (!inOnboardingGroup) {
          router.replace('/(onboarding)/welcome');
        }
      } else if (profile && profile.onboarding_completed === true && profile.email_verified === true) {
        // Email verified and onboarding complete - redirect to app
        if (!inAppGroup) {
          router.replace('/(app)/(tabs)/home');
        }
      }
    }
  }, [session, segments, loading, profile]);

  // Handle fade-in animation when loading completes
  useEffect(() => {
    if (!loading) {
      // Fade out logo
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        // Fade in content
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    } else {
      // Show logo
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim, contentOpacity]);

  // Show loading screen with Atlas logo
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.logoContainer, { opacity: fadeAnim }]}>
          <Image 
            source={require('../assets/logo/word.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    );
  }

  // No need for Context.Provider when using Zustand
  return (
    <>
      <StatusBar translucent backgroundColor="transparent" />
      <Animated.View style={[styles.container, { opacity: contentOpacity }]}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(legal)" />
          <Stack.Screen name="(onboarding)" />
        </Stack>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 400,
    height: 180,
  },
});