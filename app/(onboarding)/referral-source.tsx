import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

type ReferralSource = 'app_store' | 'google_play' | 'social_media' | 'friend' | 'search' | 'advertisement' | 'other';

export default function ReferralSource() {
  const router = useRouter();
  const { session, fetchProfile } = useAuthStore();
  const [selectedSource, setSelectedSource] = useState<ReferralSource | null>(null);
  const [loading, setLoading] = useState(false);

  const sourceOptions = [
    {
      value: 'app_store' as ReferralSource,
      label: 'App Store',
      description: 'Found it browsing the App Store',
    },
    {
      value: 'google_play' as ReferralSource,
      label: 'Google Play Store',
      description: 'Found it browsing Google Play',
    },
    {
      value: 'social_media' as ReferralSource,
      label: 'Social Media',
      description: 'Instagram, TikTok, Twitter, etc.',
    },
    {
      value: 'friend' as ReferralSource,
      label: 'Friend or Family',
      description: 'Someone recommended it to me',
    },
    {
      value: 'search' as ReferralSource,
      label: 'Search Engine',
      description: 'Google, Bing, or other search',
    },
    {
      value: 'advertisement' as ReferralSource,
      label: 'Advertisement',
      description: 'Saw an ad online or elsewhere',
    },
    {
      value: 'other' as ReferralSource,
      label: 'Other',
      description: 'Something else',
    },
  ];

  const handleContinue = async () => {
    if (!selectedSource) {
      Alert.alert('Please Select', 'Choose how you heard about Atlas');
      return;
    }

    if (!session?.user) {
      Alert.alert('Error', 'No user session found');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          referral_source: selectedSource,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      await fetchProfile();
      router.push('/(onboarding)/complete');
    } catch (error) {
      console.error('Error updating referral source:', error);
      Alert.alert('Error', 'Failed to save information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={styles.progressSection}>
          <Text style={[styles.progressLabel, styles.activeLabel]} maxFontSizeMultiplier={1.3}>Username</Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} style={styles.checkmark} />
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <View style={styles.progressSection}>
          <Text style={[styles.progressLabel, styles.activeLabel]} maxFontSizeMultiplier={1.3}>Personal Info</Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} style={styles.checkmark} />
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <View style={styles.progressSection}>
          <Text style={[styles.progressLabel, styles.activeLabel]} maxFontSizeMultiplier={1.3}>Weight Unit</Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} style={styles.checkmark} />
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <View style={styles.progressSection}>
          <Text style={[styles.progressLabel, styles.activeLabel]} maxFontSizeMultiplier={1.3}>Experience</Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} style={styles.checkmark} />
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <View style={styles.progressSection}>
          <Text style={[styles.progressLabel, styles.activeLabel]} maxFontSizeMultiplier={1.3}>Source</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>How did you hear about Atlas?</Text>
          <Text style={styles.subtitle}>
            Help us understand how people discover our app
          </Text>
        </View>

        {/* Source Options */}
        <View style={styles.optionsContainer}>
          {sourceOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionCard,
                selectedSource === option.value && styles.selectedCard
              ]}
              onPress={() => setSelectedSource(option.value)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={[
                  styles.optionLabel,
                  selectedSource === option.value && styles.selectedLabel
                ]}>
                  {option.label}
                </Text>
                <View style={[
                  styles.radio,
                  selectedSource === option.value && styles.radioSelected
                ]}>
                  {selectedSource === option.value && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </View>
              <Text style={[
                styles.optionDescription,
                selectedSource === option.value && styles.selectedDescription
              ]}>
                {option.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.continueButton,
            !selectedSource && styles.disabledButton
          ]}
          onPress={handleContinue}
          disabled={!selectedSource || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[
              styles.continueButtonText,
              !selectedSource && styles.disabledButtonText
            ]}>
              Continue
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    top: 18,
  },
  chevron: {
    marginHorizontal: 8,
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
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
  optionsContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  optionCard: {
    borderWidth: 2,
    borderColor: colors.secondaryText,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.background,
  },
  selectedCard: {
    borderColor: colors.brand,
    backgroundColor: `${colors.brand}08`,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  selectedLabel: {
    color: colors.brand,
  },
  optionDescription: {
    fontSize: 13,
    color: colors.secondaryText,
    lineHeight: 18,
  },
  selectedDescription: {
    color: colors.primaryText,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.secondaryText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.brand,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
  },
  continueButton: {
    backgroundColor: colors.brand,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: colors.secondaryText,
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  disabledButtonText: {
    color: colors.secondaryText,
  },
});
