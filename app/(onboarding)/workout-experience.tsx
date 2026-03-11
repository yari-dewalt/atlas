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

type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export default function WorkoutExperience() {
  const router = useRouter();
  const { session, fetchProfile } = useAuthStore();
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel | null>(null);
  const [loading, setLoading] = useState(false);

  const experienceOptions = [
    {
      value: 'beginner' as ExperienceLevel,
      label: 'Beginner',
      description: 'New to working out or getting back into it',
    },
    {
      value: 'intermediate' as ExperienceLevel,
      label: 'Intermediate',
      description: 'Been working out regularly for 6+ months',
    },
    {
      value: 'advanced' as ExperienceLevel,
      label: 'Advanced',
      description: 'Experienced with various training methods',
    },
    {
      value: 'expert' as ExperienceLevel,
      label: 'Expert',
      description: 'Professional or competitive athlete',
    },
  ];

  const handleContinue = async () => {
    if (!selectedExperience) {
      Alert.alert('Please Select', 'Choose your workout experience level');
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
          workout_experience: selectedExperience,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      await fetchProfile();
      router.push('/(onboarding)/referral-source');
    } catch (error) {
      console.error('Error updating workout experience:', error);
      Alert.alert('Error', 'Failed to save workout experience. Please try again.');
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
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel} maxFontSizeMultiplier={1.3}>Source</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>What's your workout experience?</Text>
          <Text style={styles.subtitle}>
            This helps us personalize your experience and recommend appropriate content
          </Text>
        </View>

        {/* Experience Options */}
        <View style={styles.optionsContainer}>
          {experienceOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionCard,
                selectedExperience === option.value && styles.selectedCard
              ]}
              onPress={() => setSelectedExperience(option.value)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={[
                  styles.optionLabel,
                  selectedExperience === option.value && styles.selectedLabel
                ]}>
                  {option.label}
                </Text>
                <View style={[
                  styles.radio,
                  selectedExperience === option.value && styles.radioSelected
                ]}>
                  {selectedExperience === option.value && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </View>
              <Text style={[
                styles.optionDescription,
                selectedExperience === option.value && styles.selectedDescription
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
            !selectedExperience && styles.disabledButton
          ]}
          onPress={handleContinue}
          disabled={!selectedExperience || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[
              styles.continueButtonText,
              !selectedExperience && styles.disabledButtonText
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
    gap: 16,
  },
  optionCard: {
    borderWidth: 2,
    borderColor: colors.secondaryText,
    borderRadius: 12,
    padding: 20,
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
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
  },
  selectedLabel: {
    color: colors.brand,
  },
  optionDescription: {
    fontSize: 14,
    color: colors.secondaryText,
    lineHeight: 20,
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
