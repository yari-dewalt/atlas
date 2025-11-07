import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';

export default function ContentFilteringScreen() {
  const router = useRouter();
  const [hideReportedContent, setHideReportedContent] = useState(true);
  const [hideBlockedUsers, setHideBlockedUsers] = useState(true);
  const [filterSensitiveContent, setFilterSensitiveContent] = useState(false);
  const [autoModeration, setAutoModeration] = useState(false);



  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Content Filtering',
          headerBackVisible: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.primaryText,
          headerTitleStyle: {
            color: colors.primaryText,
          },
        }}
      />
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content Moderation</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Ionicons name="flag-outline" size={22} color={colors.primaryText} />
              <View style={styles.settingTextContent}>
                <Text style={styles.settingText}>Hide Reported Content</Text>
                <Text style={styles.settingDescription}>
                  Don't show posts that you have reported
                </Text>
              </View>
            </View>
            <Switch
              value={hideReportedContent}
              onValueChange={setHideReportedContent}
              trackColor={{ false: '#767577', true: colors.brand }}
              thumbColor={'#f4f3f4'}
            />
          </View>
          
          <View style={[styles.settingItem, styles.lastSettingItem]}>
            <View style={styles.settingTextContainer}>
              <Ionicons name="person-remove-outline" size={22} color={colors.primaryText} />
              <View style={styles.settingTextContent}>
                <Text style={styles.settingText}>Hide Blocked Users</Text>
                <Text style={styles.settingDescription}>
                  Don't show content from users you have blocked
                </Text>
              </View>
            </View>
            <Switch
              value={hideBlockedUsers}
              onValueChange={setHideBlockedUsers}
              trackColor={{ false: '#767577', true: colors.brand }}
              thumbColor={'#f4f3f4'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Automatic Filtering</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Ionicons name="eye-off-outline" size={22} color={colors.primaryText} />
              <View style={styles.settingTextContent}>
                <Text style={styles.settingText}>Filter Sensitive Content</Text>
                <Text style={styles.settingDescription}>
                  Hide posts that may contain sensitive material
                </Text>
              </View>
            </View>
            <Switch
              value={filterSensitiveContent}
              onValueChange={setFilterSensitiveContent}
              trackColor={{ false: '#767577', true: colors.brand }}
              thumbColor={'#f4f3f4'}
            />
          </View>
          
          <View style={[styles.settingItem, styles.lastSettingItem]}>
            <View style={styles.settingTextContainer}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.primaryText} />
              <View style={styles.settingTextContent}>
                <Text style={styles.settingText}>Auto Moderation</Text>
                <Text style={styles.settingDescription}>
                  Automatically hide content flagged by our moderation system
                </Text>
              </View>
            </View>
            <Switch
              value={autoModeration}
              onValueChange={setAutoModeration}
              trackColor={{ false: '#767577', true: colors.brand }}
              thumbColor={'#f4f3f4'}
            />
          </View>
        </View>

        {/* Footer note */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            Content filtering settings help you control what you see in your feeds. When you report content, our moderation team reviews it and takes appropriate action. Reported content may be hidden from your feed while under review.
          </Text>
        </View>
      </ScrollView>
    </View>
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
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 14,
    color: colors.secondaryText,
    lineHeight: 20,
  },
});
