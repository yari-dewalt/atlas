import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, TouchableWithoutFeedback, Keyboard, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { useAuthStore } from '../../../../stores/authStore';
import { useProfileStore } from '../../../../stores/profileStore';
import { supabase } from '../../../../lib/supabase';
import { useBannerStore, BANNER_MESSAGES } from '../../../../stores/bannerStore';
import { useSubscriptionStore } from '../../../../stores/subscriptionStore';
import { FREE_TIER_LIMITS } from '../../../../constants/subscription';

export default function UsernameSettingsScreen() {
  const router = useRouter();
  const { profile: authProfile, updateProfile } = useAuthStore();
  const { updateCurrentProfile } = useProfileStore();
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [usernameError, setUsernameError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const { isPro } = useSubscriptionStore();

  useEffect(() => {
    if (authProfile?.username) {
      setUsername(authProfile.username);
      setOriginalUsername(authProfile.username);
    }
  }, [authProfile]);

  const checkUsernameAvailability = async (value: string) => {
    if (value === originalUsername) {
      setUsernameAvailable(true);
      setUsernameError('');
      return true;
    }

    // Check username length
    if (!value || value.length < 3) {
      setUsernameAvailable(false);
      setUsernameError('Username must be at least 3 characters');
      return false;
    }

    if (value.length > 20) {
      setUsernameAvailable(false);
      setUsernameError('Username must be 20 characters or less');
      return false;
    }

    // Check if username contains only alphanumeric characters and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setUsernameAvailable(false);
      setUsernameError('Username can only contain letters, numbers, and underscores');
      return false;
    }

    setChecking(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', value.toLowerCase())
        .neq('id', authProfile?.id)
        .single();

      const isAvailable = !data;
      setUsernameAvailable(isAvailable);
      setUsernameError(isAvailable ? '' : 'Username is unavailable');
      return isAvailable;
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameError('Error checking username availability');
      return false;
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    if (!username) {
      const { showError } = useBannerStore.getState();
      showError('Please enter a username');
      return;
    }

    if (username === originalUsername) {
      router.back();
      return;
    }

    if (!usernameAvailable) {
      const { showError } = useBannerStore.getState();
      showError(usernameError);
      return;
    }

    if (!isPro() && authProfile?.username_last_changed_at) {
      const lastChanged = new Date(authProfile.username_last_changed_at);
      const daysSince = Math.floor((Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince < FREE_TIER_LIMITS.usernameChangeDays) {
        const { showWarning } = useBannerStore.getState();
        showWarning('Upgrade to Atlas Pro to change your username anytime', 0, {
          text: 'Upgrade',
          onPress: () => router.push('/(app)/(modals)/pro'),
        });
        return;
      }
    }

    setLoading(true);
    try {
      // Update profile in database
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({
          username: username.toLowerCase(),
          username_last_changed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', authProfile?.id);

      if (error) throw error;

      // Update local state
      if (updateProfile) {
        updateProfile({
          ...authProfile!,
          username: username.toLowerCase(),
          username_last_changed_at: nowIso,
        });
      }

      // Also update the profile store
      if (updateCurrentProfile) {
        updateCurrentProfile({
          username: username.toLowerCase(),
        });
      }
      
      const { showSuccess } = useBannerStore.getState();
      showSuccess('Username updated successfully');
      router.back();
    } catch (error) {
      console.error('Error updating username:', error);
      const { showError } = useBannerStore.getState();
      showError('Failed to update username. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = username !== originalUsername;

  const daysUntilNextChange = (() => {
    if (isPro() || !authProfile?.username_last_changed_at) return 0;
    const lastChanged = new Date(authProfile.username_last_changed_at);
    const daysSince = Math.floor((Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, FREE_TIER_LIMITS.usernameChangeDays - daysSince);
  })();

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false
        }} 
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Username</Text>
              <Text style={styles.sectionDescription}>
                Your username is how others can find and mention you on the platform.
              </Text>

              {!isPro() && (
                <View style={styles.cooldownNote}>
                  <Ionicons name="time-outline" size={13} color={colors.secondaryText} />
                  <Text style={styles.cooldownNoteText}>
                    {daysUntilNextChange > 0
                      ? `Next change available in ${daysUntilNextChange} day${daysUntilNextChange === 1 ? '' : 's'}`
                      : 'Usernames can only be changed once every 90 days'}
                  </Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    !usernameAvailable && styles.inputError
                  ]}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    checkUsernameAvailability(text);
                  }}
                  placeholder="Username"
                  placeholderTextColor={colors.placeholderText}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {username && username !== originalUsername && (
                  <View style={[
                    styles.statusIcon,
                    usernameAvailable ? styles.statusAvailable : styles.statusUnavailable
                  ]}>
                    <Ionicons 
                      name={usernameAvailable ? "checkmark" : "close"} 
                      size={16} 
                      color={usernameAvailable ? colors.success : colors.notification} 
                    />
                  </View>
                )}
              </View>
              
              {usernameError ? (
                <Text style={styles.errorText}>{usernameError}</Text>
              ) : username && username !== originalUsername && usernameAvailable ? (
                <Text style={styles.successText}>This username is available</Text>
              ) : null}
            </View>
            
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[
                styles.updateButton,
                (!hasChanges || !usernameAvailable) && styles.updateButtonDisabled
              ]}
              onPress={handleSave}
              disabled={loading || !hasChanges || !usernameAvailable}
            >
                <Text style={[
                  styles.updateButtonText,
                  (!hasChanges || !usernameAvailable) && styles.updateButtonTextDisabled
                ]}>
                  Update
                </Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    backgroundColor: colors.background,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 20,
    lineHeight: 20,
  },
  cooldownNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  cooldownNoteText: {
    fontSize: 12,
    color: colors.secondaryText,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.primaryText,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: colors.notification,
  },
  statusIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  statusAvailable: {
    backgroundColor: `${colors.success}33`,
  },
  statusUnavailable: {
    backgroundColor: `${colors.notification}33`,
  },
  errorText: {
    color: colors.notification,
    fontSize: 12,
    marginTop: 8,
  },
  successText: {
    color: colors.success,
    fontSize: 12,
    marginTop: 8,
  },
  updateButton: {
    backgroundColor: colors.brand,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  updateButtonDisabled: {
    opacity: 0.5,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  updateButtonTextDisabled: {
    color: colors.secondaryText,
  },
});
