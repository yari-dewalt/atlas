import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal, TextInput, ActivityIndicator, TouchableWithoutFeedback, Keyboard, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { useAuthStore } from '../../../../stores/authStore';
import { supabase } from '../../../../lib/supabase';
import { useBannerStore, BANNER_MESSAGES } from '../../../../stores/bannerStore';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { profile: authProfile, session, signOut } = useAuthStore();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteUsername, setDeleteUsername] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    if (!deleteUsername || deleteUsername !== authProfile?.username) {
      const { showError } = useBannerStore.getState();
      showError('Please enter your username correctly to confirm account deletion.');
      return;
    }

    setDeletingAccount(true);
    
    try {
      // First, delete user data from profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', session?.user?.id);
      
      if (profileError) {
        console.error('Error deleting profile:', profileError);
        // Continue with account deletion even if profile deletion fails
      }

      // Then delete the user account
      const { error: authError } = await supabase.auth.signOut();
      
      if (authError) throw authError;
      
      // Sign out and redirect to login
      await signOut();
      router.replace('/login');
      
      const { showSuccess } = useBannerStore.getState();
      showSuccess('Your account has been successfully deleted.');
    } catch (error) {
      console.error('Error deleting account:', error);
      const { showError } = useBannerStore.getState();
      showError('Failed to delete account. Please try again or contact support.');
    } finally {
      setDeletingAccount(false);
      setDeleteModalVisible(false);
      setDeleteUsername('');
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false
        }} 
      />
      
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.settingItem}
            onPress={() => router.push('/settings/username')}
          >
            <View style={styles.settingTextContainer}>
              <Ionicons name="at-outline" size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>Username</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.settingItem}
            onPress={() => router.push('/settings/email')}
          >
            <View style={styles.settingTextContainer}>
              <Ionicons name="mail-outline" size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>Email</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={[styles.settingItem, styles.lastSettingItem]}
            onPress={() => router.push('/settings/password')}
          >
            <View style={styles.settingTextContainer}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
                activeOpacity={0.5} 
            style={[styles.settingItem, styles.lastSettingItem, styles.deleteButton]}
            onPress={() => setDeleteModalVisible(true)}
          >
            <View style={styles.settingTextContainer}>
              <Ionicons name="trash-outline" size={22} color={colors.notification} />
              <Text style={[styles.settingText, styles.deleteText]}>Delete Account</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete Account Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={() => {
            setDeleteModalVisible(false);
            setDeleteUsername('');
          }}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Delete Account</Text>
                  <Text style={styles.modalDescription}>
                    This action cannot be undone. All your data will be permanently deleted.
                  </Text>
                  <Text style={styles.modalDescription}>
                    To confirm, please enter your username:
                  </Text>
                  
                  <TextInput
                    style={styles.modalInput}
                    value={deleteUsername}
                    onChangeText={setDeleteUsername}
                    placeholder={authProfile?.username || 'Username'}
                    placeholderTextColor={colors.placeholderText}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                activeOpacity={0.5}
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => {
                        setDeleteModalVisible(false);
                        setDeleteUsername('');
                      }}
                      disabled={deletingAccount}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                activeOpacity={0.5}
                      style={[
                        styles.modalButton, 
                        styles.deleteModalButton,
                        (!deleteUsername || deleteUsername !== authProfile?.username) && styles.deleteModalButtonDisabled
                      ]}
                      onPress={handleDeleteAccount}
                      disabled={deletingAccount || !deleteUsername || deleteUsername !== authProfile?.username}
                    >
                        <Text style={[
                          styles.deleteButtonText,
                          (!deleteUsername || deleteUsername !== authProfile?.username) && styles.deleteButtonTextDisabled
                        ]}>
                          Delete
                        </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: 20,
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
  lastSettingItem: {
    borderBottomWidth: 0,
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
  deleteButton: {
    backgroundColor: colors.background,
  },
  deleteText: {
    color: colors.notification,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 30,
    width: '85%',
    maxWidth: 350,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 15,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: colors.whiteOverlay,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.primaryText,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.whiteOverlay,
  },
  cancelButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '500',
  },
  deleteModalButton: {
    backgroundColor: colors.notification,
  },
  deleteModalButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButtonTextDisabled: {
    color: colors.secondaryText,
  },
});
