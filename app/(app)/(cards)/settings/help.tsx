import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';

export default function HelpCenterScreen() {
  const router = useRouter();

  const handleSupportOptionPress = (type: 'contact' | 'bug' | 'feature') => {
    router.push(`/settings/support/${type}`);
  };

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false
        }} 
      />
      
      <View style={styles.container}>
        <ScrollView style={styles.scrollContainer}>
          {/* Support Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.settingItem}
              onPress={() => handleSupportOptionPress('contact')}
            >
              <View style={styles.settingTextContainer}>
                <Ionicons name="mail-outline" size={22} color={colors.primaryText} />
                <Text style={styles.settingText}>Contact Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>
            
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.settingItem}
              onPress={() => handleSupportOptionPress('bug')}
            >
              <View style={styles.settingTextContainer}>
                <Ionicons name="bug-outline" size={22} color={colors.primaryText} />
                <Text style={styles.settingText}>Report a Bug</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>
            
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[styles.settingItem, styles.lastSettingItem]}
              onPress={() => handleSupportOptionPress('feature')}
            >
              <View style={styles.settingTextContainer}>
                <Ionicons name="bulb-outline" size={22} color={colors.primaryText} />
                <Text style={styles.settingText}>Feature Request</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
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
  settingText: {
    fontSize: 16,
    color: colors.primaryText,
    marginLeft: 12,
  },
});
