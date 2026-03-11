import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useOnboardingStore } from '../../stores/onboardingStore';

export default function Username() {
  const router = useRouter();
  const { session, fetchProfile, profile } = useAuthStore();
  const { setInOnboardingFlow } = useOnboardingStore();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Ref to store the timeout ID for cleanup
  const timeoutRef = React.useRef<number | null>(null);

  // Pre-populate username if user already has one from previous incomplete onboarding
  // Only do this once on initial load, not when user clears the field
  React.useEffect(() => {
    if (profile?.username && !hasInitialized) {
      // Don't pre-populate - always start with empty for better UX
      // setUsername(profile.username);
      // setIsAvailable(true);
      setHasInitialized(true);
    } else if (!profile?.username && !hasInitialized) {
      setHasInitialized(true);
    }
  }, [profile?.username, hasInitialized]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setIsAvailable(null);
      return;
    }

    setChecking(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, id')
        .eq('username', usernameToCheck.toLowerCase())
        .maybeSingle();

      if (error) throw error;
      
      // Available if no existing user found, OR if the existing user is the current user
      const isCurrentUser = data?.id === session?.user?.id;
      setIsAvailable(!data || isCurrentUser);
    } catch (error) {
      console.error('Error checking username:', error);
      setIsAvailable(null);
    } finally {
      setChecking(false);
    }
  };

  const handleUsernameChange = (text: string) => {
    // Clear any existing timeout to prevent stacking requests
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Only allow alphanumeric characters and underscores
    const cleanText = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleanText);
    
    // Reset availability state when user types
    setIsAvailable(null);
    setChecking(false);
    
    // Don't check if we had to clean the input or if too short
    if (cleanText !== text || cleanText.length < 3) return;
    
    // Set checking state immediately for better UX
    setChecking(true);
    
    timeoutRef.current = setTimeout(() => {
      checkUsernameAvailability(cleanText);
      timeoutRef.current = null;
    }, 800); // Increased delay for less flickering
  };

  const handleContinue = async () => {
    if (!username || username.length < 3) {
      Alert.alert('Invalid Username', 'Username must be at least 3 characters long');
      return;
    }

    if (isAvailable !== true) {
      Alert.alert('Username Unavailable', 'Please choose a different username');
      return;
    }

    if (!session?.user) {
      Alert.alert('Error', 'No user session found');
      return;
    }

    setLoading(true);
    try {
      // Set that we're actively in the onboarding flow
      setInOnboardingFlow(true);
      
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          username: username.toLowerCase(),
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      
      router.push('/(onboarding)/personal-info');
    } catch (error) {
      console.error('Error updating username:', error);
      Alert.alert('Error', 'Failed to save username. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isValidUsername = username.length >= 3 && isAvailable === true && !checking;

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={styles.progressSection}>
          <Text style={[styles.progressLabel, styles.activeLabel]} maxFontSizeMultiplier={1.3}>Username</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel} maxFontSizeMultiplier={1.3}>Personal Info</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel} maxFontSizeMultiplier={1.3}>Get Started</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Create your username</Text>
              <Text style={styles.subtitle}>
                This is how other users will find and identify you
              </Text>
            </View>

            {/* Username Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Username</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.atSymbol}>@</Text>
                <TextInput
                  style={styles.textInput}
                  value={username}
                  onChangeText={handleUsernameChange}
                  placeholder="your_username"
                  placeholderTextColor={colors.secondaryText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                />
                {checking && username.length >= 3 && (
                  <ActivityIndicator size="small" color={colors.brand} style={styles.statusIcon} />
                )}
                {!checking && isAvailable === true && (
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={styles.statusIcon} />
                )}
                {!checking && isAvailable === false && username.length >= 3 && (
                  <Ionicons name="close-circle" size={20} color="#F44336" style={styles.statusIcon} />
                )}
              </View>

              {/* Status Messages */}
              {username.length > 0 && username.length < 3 && (
                <Text style={styles.errorText}>Username must be at least 3 characters</Text>
              )}
              {isAvailable === false && (
                <Text style={styles.errorText}>Username is not available</Text>
              )}
              {isAvailable === true && (
                <Text style={styles.successText}>Username is available!</Text>
              )}

              <Text style={styles.helperText}>
                Use only letters, numbers, and underscores
              </Text>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            activeOpacity={0.5}
            style={[styles.continueButton, !isValidUsername && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!isValidUsername || loading || checking}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <Text style={[styles.continueButtonText, !isValidUsername && styles.continueButtonTextDisabled]}>
                Continue
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  progressSection: {
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: 'center',
  },
  activeLabel: {
    color: colors.brand,
    fontWeight: '500',
  },
  chevron: {
    marginHorizontal: 8,
    opacity: 0.5,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.secondaryText,
    textAlign: 'center',
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
    paddingHorizontal: 16,
    height: 52,
  },
  atSymbol: {
    fontSize: 16,
    color: colors.secondaryText,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: colors.primaryText,
    paddingVertical: 0,
  },
  statusIcon: {
    marginLeft: 8,
  },
  errorText: {
    fontSize: 14,
    color: colors.notification,
    marginTop: 8,
  },
  successText: {
    fontSize: 14,
    color: colors.success,
    marginTop: 8,
  },
  helperText: {
    fontSize: 14,
    color: colors.secondaryText,
    marginTop: 8,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: colors.primaryAccent,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
  },
  continueButtonTextDisabled: {
    color: colors.secondaryText,
  },
});
