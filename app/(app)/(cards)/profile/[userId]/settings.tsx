import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../../constants/colors';
import { useAuthStore } from '../../../../../stores/authStore';
import { useProfileStore } from '../../../../../stores/profileStore';
import { useOnboardingStore } from '../../../../../stores/onboardingStore';
import { supabase } from '../../../../../lib/supabase';
import CachedAvatar from '../../../../../components/CachedAvatar';

export default function SettingsScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const { profile: authProfile, session, signOut } = useAuthStore();
  const { currentProfile, isCurrentUser } = useProfileStore();
  const { resetOnboarding } = useOnboardingStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Handle signing out
  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/');
          }
        }
      ]
    );
  };

  // Handle resetting onboarding (developer option)
  const handleResetOnboarding = async () => {
    Alert.alert(
      'Reset Onboarding',
      'This will reset the onboarding flow and you\'ll see it again on next app launch. This is for testing purposes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetOnboarding();
            Alert.alert('Done', 'Onboarding has been reset. Restart the app to see the onboarding flow.');
          }
        }
      ]
    );
  };

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Settings',
          headerLeft: () => (
            <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.primaryText} />
            </TouchableOpacity>
          )
        }} 
      />
      
      <ScrollView style={styles.container}>
        {isCurrentUser && (
          // Current user settings
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.settingItem}
                onPress={() => router.push(`/profile/${currentProfile.id}/edit`)}
              >
                <View style={styles.settingTextContainer}>
                  <Ionicons name="person-circle-outline" size={22} color={colors.primaryText} />
                  <Text style={styles.settingText}>Profile</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
              
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.settingItem}
                onPress={() => router.push('/settings/account')}
              >
                <View style={styles.settingTextContainer}>
                  <Ionicons name="key-outline" size={22} color={colors.primaryText} />
                  <Text style={styles.settingText}>Account</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>App</Text>
              
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.settingItem}
                onPress={() => router.push('/workoutSettings')}
              >
                <View style={styles.settingTextContainer}>
                  <Ionicons name="barbell-outline" size={22} color={colors.primaryText} />
                  <Text style={styles.settingText}>Workout Settings</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
              
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.settingItem}
                onPress={() => router.push('/settings/notifications')}
              >
                <View style={styles.settingTextContainer}>
                  <Ionicons name="notifications-outline" size={22} color={colors.primaryText} />
                  <Text style={styles.settingText}>Notifications</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
              
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.settingItem}
                onPress={() => router.push('/settings/privacy')}
              >
                <View style={styles.settingTextContainer}>
                  <Ionicons name="shield-outline" size={22} color={colors.primaryText} />
                  <Text style={styles.settingText}>Privacy</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
              
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.settingItem}
                onPress={() => router.push('/settings/content-filtering')}
              >
                <View style={styles.settingTextContainer}>
                  <Ionicons name="eye-off-outline" size={22} color={colors.primaryText} />
                  <Text style={styles.settingText}>Content Filtering</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Help</Text>
              
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.settingItem}
                onPress={() => router.push('/settings/about')}
              >
                <View style={styles.settingTextContainer}>
                  <Ionicons name="information-circle-outline" size={22} color={colors.primaryText} />
                  <Text style={styles.settingText}>About</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
              
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.settingItem}
                onPress={() => {
                  console.log('Navigating to help center');
                  router.push('/settings/help');
                }}
              >
                <View style={styles.settingTextContainer}>
                  <Ionicons name="help-circle-outline" size={22} color={colors.primaryText} />
                  <Text style={styles.settingText}>Help Center</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>
            
            {/* Developer Section */}
            {/* <View style={styles.section}>
              <Text style={styles.sectionTitle}>Developer</Text>
              
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.settingItem}
                onPress={handleResetOnboarding}
              >
                <View style={styles.settingTextContainer}>
                  <Ionicons name="refresh-outline" size={22} color={colors.notification} />
                  <Text style={[styles.settingText, { color: colors.notification }]}>Reset Onboarding</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            </View> */}
            
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
  section: {
    marginBottom: 24,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.secondaryText,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  settingTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    color: colors.primaryText,
    marginLeft: 12,
  },
  warningText: {
    color: colors.notification,
  },
  destructiveText: {
    color: colors.notification,
  },
  normalText: {
    color: colors.primaryText,
  },
  backButton: {
    marginLeft: 16,
  },
  activityIndicator: {
    marginLeft: 10,
  },
  signOutButton: {
    justifyContent: 'center',
    padding: 10,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.notification || 'red',
    textAlign: 'center',
  },
});