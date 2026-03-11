import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { useAuthStore } from '../../../../stores/authStore';
import { useNotificationStore } from '../../../../stores/notificationStore';
import { supabase } from '../../../../lib/supabase';
import { pushNotificationTesting } from '../../../../utils/pushNotificationTesting';

interface NotificationSettings {
  // Profile notifications
  follows: boolean;
  
  // Post notifications
  likes: boolean;
  comments: boolean;
  likes_on_comments: boolean;
  mentions_in_posts: boolean;
  mentions_in_comments: boolean;
  replies_on_comments: boolean;
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { session, profile } = useAuthStore();
  const {
    pushNotificationsEnabled,
    pushToken,
    initializePushNotifications,
    disablePushNotifications,
  } = useNotificationStore();
  
  const [loading, setLoading] = useState(true);
  const [testingNotifications, setTestingNotifications] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    follows: true,
    likes: true,
    comments: true,
    likes_on_comments: true,
    mentions_in_posts: true,
    mentions_in_comments: true,
    replies_on_comments: true,
  });

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', session?.user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" error
        throw error;
      }

      if (data) {
        setSettings({
          follows: data.follows ?? true,
          likes: data.likes ?? true,
          comments: data.comments ?? true,
          likes_on_comments: data.likes_on_comments ?? true,
          mentions_in_posts: data.mentions_in_posts ?? true,
          mentions_in_comments: data.mentions_in_comments ?? true,
          replies_on_comments: data.replies_on_comments ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const saveNotificationSettings = async (newSettings: NotificationSettings) => {
    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: session?.user?.id,
          ...newSettings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving notification settings:', error);
        // Optionally show a toast or subtle error indication
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
      // Optionally show a toast or subtle error indication
    }
  };

  const handleToggle = (key: keyof NotificationSettings) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    };
    
    // Optimistically update the UI immediately
    setSettings(newSettings);
    
    // Save to database in the background (fire and forget)
    saveNotificationSettings(newSettings);
  };

  const handlePushNotificationToggle = async (value: boolean) => {
    try {
      if (value) {
        await initializePushNotifications();
      } else {
        await disablePushNotifications();
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      Alert.alert(
        'Error',
        'Failed to update push notification settings. Please check your device settings and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Notifications',
          headerBackTitle: 'Settings',
        }} 
      />
      
      <ScrollView style={styles.container}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Ionicons name="person-add-outline" size={22} color={colors.primaryText} />
              <View style={styles.settingTextContent}>
                <Text style={styles.settingText}>Follows</Text>
                <Text style={styles.settingDescription}>When someone follows you</Text>
              </View>
            </View>
            <Switch
              value={settings.follows}
              onValueChange={() => handleToggle('follows')}
              trackColor={{ false: '#767577', true: colors.brand }}
              thumbColor={'#f4f3f4'}
            />
          </View>
        </View>

        {/* Posts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Posts</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Ionicons name="heart-outline" size={22} color={colors.primaryText} />
              <View style={styles.settingTextContent}>
                <Text style={styles.settingText}>Likes</Text>
                <Text style={styles.settingDescription}>When someone likes your post</Text>
              </View>
            </View>
            <Switch
              value={settings.likes}
              onValueChange={() => handleToggle('likes')}
              trackColor={{ false: '#767577', true: colors.brand }}
              thumbColor={'#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Ionicons name="chatbubble-outline" size={22} color={colors.primaryText} />
              <View style={styles.settingTextContent}>
                <Text style={styles.settingText}>Comments</Text>
                <Text style={styles.settingDescription}>When someone comments on your post</Text>
              </View>
            </View>
            <Switch
              value={settings.comments}
              onValueChange={() => handleToggle('comments')}
              trackColor={{ false: '#767577', true: colors.brand }}
              thumbColor={'#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Ionicons name="heart-outline" size={22} color={colors.primaryText} />
              <View style={styles.settingTextContent}>
                <Text style={styles.settingText}>Likes on Comments</Text>
                <Text style={styles.settingDescription}>When someone likes your comment</Text>
              </View>
            </View>
            <Switch
              value={settings.likes_on_comments}
              onValueChange={() => handleToggle('likes_on_comments')}
              trackColor={{ false: '#767577', true: colors.brand }}
              thumbColor={'#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Ionicons name="at-outline" size={22} color={colors.primaryText} />
              <View style={styles.settingTextContent}>
                <Text style={styles.settingText}>Mentions in Posts</Text>
                <Text style={styles.settingDescription}>When someone mentions you in a post</Text>
              </View>
            </View>
            <Switch
              value={settings.mentions_in_posts}
              onValueChange={() => handleToggle('mentions_in_posts')}
              trackColor={{ false: '#767577', true: colors.brand }}
              thumbColor={'#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Ionicons name="at-outline" size={22} color={colors.primaryText} />
              <View style={styles.settingTextContent}>
                <Text style={styles.settingText}>Mentions in Comments</Text>
                <Text style={styles.settingDescription}>When someone mentions you in a comment</Text>
              </View>
            </View>
            <Switch
              value={settings.mentions_in_comments}
              onValueChange={() => handleToggle('mentions_in_comments')}
              trackColor={{ false: '#767577', true: colors.brand }}
              thumbColor={'#f4f3f4'}
            />
          </View>
          
          <View style={[styles.settingItem, styles.lastSettingItem]}>
            <View style={styles.settingTextContainer}>
              <Ionicons name="return-down-forward-outline" size={22} color={colors.primaryText} />
              <View style={styles.settingTextContent}>
                <Text style={styles.settingText}>Replies on Comments</Text>
                <Text style={styles.settingDescription}>When someone replies to your comment</Text>
              </View>
            </View>
            <Switch
              value={settings.replies_on_comments}
              onValueChange={() => handleToggle('replies_on_comments')}
              trackColor={{ false: '#767577', true: colors.brand }}
              thumbColor={'#f4f3f4'}
            />
          </View>
        </View>

        {/* Push Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Ionicons name="notifications-outline" size={22} color={colors.primaryText} />
              <View style={styles.settingTextContent}>
                <Text style={styles.settingText}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  {pushNotificationsEnabled 
                    ? "Receive notifications when the app is closed" 
                    : "Enable push notifications to get alerts when the app is closed"
                  }
                </Text>
              </View>
            </View>
            <Switch
              value={pushNotificationsEnabled}
              onValueChange={handlePushNotificationToggle}
              trackColor={{ false: '#767577', true: colors.brand }}
              thumbColor={'#f4f3f4'}
            />
          </View>
        </View>

        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dev Tools</Text>
            <Text style={styles.testDescription}>
              Push token: {pushToken ? `${pushToken.slice(0, 24)}…` : 'none'}
            </Text>

            <TouchableOpacity
              style={[styles.testButtonFull, testingNotifications && styles.testButtonDisabled]}
              onPress={async () => {
                setTestingNotifications(true);
                try {
                  await pushNotificationTesting.scheduleLocalNotification('Atlas', 'Test notification');
                } finally {
                  setTestingNotifications(false);
                }
              }}
              disabled={testingNotifications}
            >
              <Ionicons name="notifications-outline" size={18} color={colors.primaryText} />
              <Text style={styles.testButtonText}>Send local notification</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.testButtonFull, testingNotifications && styles.testButtonDisabled]}
              onPress={async () => {
                setTestingNotifications(true);
                try {
                  await pushNotificationTesting.sendTestPushToSelf();
                  Alert.alert('Sent', 'Test push notification sent to this device.');
                } catch (err) {
                  Alert.alert('Error', String(err));
                } finally {
                  setTestingNotifications(false);
                }
              }}
              disabled={testingNotifications}
            >
              <Ionicons name="paper-plane-outline" size={18} color={colors.primaryText} />
              <Text style={styles.testButtonText}>Send test push to self</Text>
            </TouchableOpacity>

            {testingNotifications && (
              <View style={styles.testingIndicator}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text style={styles.testingText}>Sending…</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer note */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            In-app notification settings control what notifications you receive. Push notifications can also be managed in your device settings.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
  },
  lastSettingItem: {
    borderBottomWidth: 0,
  },
  settingTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContent: {
    marginLeft: 12,
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    color: colors.primaryText,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.secondaryText,
    lineHeight: 18,
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: colors.secondaryText,
    lineHeight: 16,
    textAlign: 'center',
  },
  testDescription: {
    fontSize: 14,
    color: colors.secondaryText,
    paddingHorizontal: 20,
    paddingBottom: 16,
    lineHeight: 18,
  },
  testButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  testButtonDisabled: {
    opacity: 0.5,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryText,
  },
  testingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  testingText: {
    fontSize: 14,
    color: colors.secondaryText,
  },
});
