import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, TouchableWithoutFeedback, Keyboard, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { supabase } from '../../../../lib/supabase';
import { useBannerStore, BANNER_MESSAGES } from '../../../../stores/bannerStore';

export default function PasswordSettingsScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isValidPassword = (password: string) => {
    return password.length >= 8;
  };

  const handleSave = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      const { showError } = useBannerStore.getState();
      showError('Please fill in all password fields');
      return;
    }

    if (!isValidPassword(newPassword)) {
      const { showError } = useBannerStore.getState();
      showError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      const { showError } = useBannerStore.getState();
      showError('New password and confirmation do not match');
      return;
    }

    if (currentPassword === newPassword) {
      const { showError } = useBannerStore.getState();
      showError('Your new password must be different from your current password');
      return;
    }

    setLoading(true);
    try {
      // Update password in Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      const { showSuccess } = useBannerStore.getState();
      showSuccess('Your password has been successfully updated.');
      router.back();
    } catch (error) {
      console.error('Error updating password:', error);
      const { showError } = useBannerStore.getState();
      showError('Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasValidInput = currentPassword && newPassword && confirmPassword && 
                      isValidPassword(newPassword) && newPassword === confirmPassword;

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
          <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Change Password</Text>
              <Text style={styles.sectionDescription}>
                Enter your current password and choose a new password. Your new password must be at least 8 characters long.
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor={colors.placeholderText}
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                activeOpacity={0.5}
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons 
                      name={showCurrentPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color={colors.secondaryText} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      newPassword && !isValidPassword(newPassword) && styles.inputError
                    ]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={colors.placeholderText}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                activeOpacity={0.5}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons 
                      name={showNewPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color={colors.secondaryText} 
                    />
                  </TouchableOpacity>
                </View>
                {newPassword && !isValidPassword(newPassword) && (
                  <Text style={styles.errorText}>Password must be at least 8 characters long</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      confirmPassword && newPassword !== confirmPassword && styles.inputError
                    ]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.placeholderText}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                activeOpacity={0.5}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons 
                      name={showConfirmPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color={colors.secondaryText} 
                    />
                  </TouchableOpacity>
                </View>
                {confirmPassword && newPassword !== confirmPassword && (
                  <Text style={styles.errorText}>Passwords do not match</Text>
                )}
              </View>
            </View>
            
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[
                styles.updateButton,
                !hasValidInput && styles.updateButtonDisabled
              ]}
              onPress={handleSave}
              disabled={loading || !hasValidInput}
            >
                <Text style={[
                  styles.updateButtonText,
                  !hasValidInput && styles.updateButtonTextDisabled
                ]}>
                  Update
                </Text>
            </TouchableOpacity>
          </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
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
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 8,
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
  eyeButton: {
    padding: 4,
    marginLeft: 8,
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
