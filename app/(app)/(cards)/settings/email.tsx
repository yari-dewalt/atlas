import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, TouchableWithoutFeedback, Keyboard, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { useAuthStore } from '../../../../stores/authStore';
import { supabase } from '../../../../lib/supabase';
import { useBannerStore, BANNER_MESSAGES } from '../../../../stores/bannerStore';

export default function EmailSettingsScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user?.email) {
      setEmail(session.user.email);
      setOriginalEmail(session.user.email);
    }
  }, [session]);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSave = async () => {
    if (!email) {
      const { showError } = useBannerStore.getState();
      showError('Please enter an email address');
      return;
    }

    if (!isValidEmail(email)) {
      const { showError } = useBannerStore.getState();
      showError('Please enter a valid email address');
      return;
    }

    if (email === originalEmail) {
      router.back();
      return;
    }

    setLoading(true);
    try {
      // Update email in Supabase Auth
      const { error } = await supabase.auth.updateUser({
        email: email.toLowerCase()
      });
      
      if (error) throw error;
      
      const { showSuccess } = useBannerStore.getState();
      showSuccess('Confirmation email sent! Please check your inbox and click the link to complete the change.', 5000);
      router.back();
    } catch (error) {
      console.error('Error updating email:', error);
      const { showError } = useBannerStore.getState();
      showError('Failed to update email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = email !== originalEmail;
  const isValid = isValidEmail(email);

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
              <Text style={styles.sectionTitle}>Email Address</Text>
              <Text style={styles.sectionDescription}>
                Your email address is used for account recovery and important notifications. You'll need to verify any changes to your email.
              </Text>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    email && !isValid && styles.inputError
                  ]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor={colors.placeholderText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
                {email && email !== originalEmail && (
                  <View style={[
                    styles.statusIcon,
                    isValid ? styles.statusValid : styles.statusInvalid
                  ]}>
                    <Ionicons 
                      name={isValid ? "checkmark" : "close"} 
                      size={16} 
                      color={isValid ? colors.success : colors.notification} 
                    />
                  </View>
                )}
              </View>
              
              {email && !isValid && (
                <Text style={styles.errorText}>Please enter a valid email address</Text>
              )}
            </View>
            
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[
                styles.updateButton,
                (!hasChanges || !isValid) && styles.updateButtonDisabled
              ]}
              onPress={handleSave}
              disabled={loading || !hasChanges || !isValid}
            >
                <Text style={[
                  styles.updateButtonText,
                  (!hasChanges || !isValid) && styles.updateButtonTextDisabled
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
  statusValid: {
    backgroundColor: `${colors.success}33`,
  },
  statusInvalid: {
    backgroundColor: `${colors.notification}33`,
  },
  errorText: {
    color: colors.notification,
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
