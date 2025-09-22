import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Linking, TouchableOpacity, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { XIcon } from '../../../../components/icons/XIcon';
import { ThreadsIcon } from '../../../../components/icons/ThreadsIcon';
import { BlueskyIcon } from '../../../../components/icons/BlueskyIcon';

export default function AboutScreen() {
  const router = useRouter();

  const handleSocialPress = (platform: string, url: string) => {
    Linking.openURL(url).catch((err) => {
      console.error('Error opening URL:', err);
      Alert.alert('Error', 'Unable to open link. Please try again.');
    });
  };

  const handleEmailPress = () => {
    const emailUrl = 'mailto:atlasfitbusiness@gmail.com';
    Linking.openURL(emailUrl).catch((err) => {
      console.error('Error opening email:', err);
      Alert.alert('Error', 'Unable to open email app. Please try again.');
    });
  };

  const handlePolicyPress = (type: 'privacy' | 'terms') => {
    const route = type === 'privacy' ? '/settings/privacy-policy' : '/settings/terms-conditions';
    router.push(route);
  };

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false
        }} 
      />
      
      <ScrollView style={styles.container}>
        {/* Atlas Logo Banner */}
        <View style={styles.bannerContainer}>
          <Image 
            source={require('../../../../assets/logo/word.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Social Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social</Text>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.settingItem}
            onPress={() => handleSocialPress('YouTube', 'https://youtube.com/@atlasfitnessapp')}
          >
            <View style={styles.settingTextContainer}>
              <Ionicons name="logo-youtube" size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>YouTube</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.settingItem}
            onPress={() => handleSocialPress('Instagram', 'https://instagram.com/atlasfitness.app')}
          >
            <View style={styles.settingTextContainer}>
              <Ionicons name="logo-instagram" size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>Instagram</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.settingItem}
            onPress={() => handleSocialPress('TikTok', 'https://tiktok.com/@atlasfitness.app')}
          >
            <View style={styles.settingTextContainer}>
              <Ionicons name="logo-tiktok" size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>TikTok</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.settingItem}
            onPress={() => handleSocialPress('X', 'https://x.com/atlasfitnessapp')}
          >
            <View style={styles.settingTextContainer}>
              <XIcon size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>X</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.settingItem}
            onPress={() => handleSocialPress('Threads', 'https://threads.net/@atlasfitness.app')}
          >
            <View style={styles.settingTextContainer}>
              <ThreadsIcon size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>Threads</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={[styles.settingItem, styles.lastSettingItem]}
            onPress={() => handleSocialPress('Bluesky', 'https://bsky.app/profile/atlasfitness.bsky.social')}
          >
            <View style={styles.settingTextContainer}>
              <BlueskyIcon size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>Bluesky</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
        </View>

        {/* Contact Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.settingItem}
            onPress={() => handleSocialPress('Website', 'https://atlasfit.net')}
          >
            <View style={styles.settingTextContainer}>
              <Ionicons name="globe-outline" size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>atlasfit.net</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={[styles.settingItem, styles.lastSettingItem]}
            onPress={handleEmailPress}
          >
            <View style={styles.settingTextContainer}>
              <Ionicons name="mail-outline" size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>atlasfitbusiness@gmail.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
        </View>

        {/* Policies Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Policies</Text>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.settingItem}
            onPress={() => handlePolicyPress('privacy')}
          >
            <View style={styles.settingTextContainer}>
              <Ionicons name="shield-outline" size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={[styles.settingItem, styles.lastSettingItem]}
            onPress={() => handlePolicyPress('terms')}
          >
            <View style={styles.settingTextContainer}>
              <Ionicons name="document-text-outline" size={22} color={colors.primaryText} />
              <Text style={styles.settingText}>Terms & Conditions</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
        </View>

        {/* Version Number */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
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
  bannerContainer: {
    height: 120,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 200,
    height: 100,
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
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 24,
  },
  versionText: {
    fontSize: 14,
    color: colors.secondaryText,
    fontWeight: '500',
  },
});
