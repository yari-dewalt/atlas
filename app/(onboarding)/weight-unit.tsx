import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

type WeightUnit = 'lbs' | 'kg';

export default function WeightUnit() {
  const router = useRouter();
  const { session, fetchProfile } = useAuthStore();
  const [selectedUnit, setSelectedUnit] = useState<WeightUnit | null>(null);
  const [loading, setLoading] = useState(false);

  const weightOptions = [
    {
      value: 'lbs' as WeightUnit,
      label: 'Pounds (lbs)',
      description: 'Imperial system',
      icon: 'fitness' as const,
    },
    {
      value: 'kg' as WeightUnit,
      label: 'Kilograms (kg)',
      description: 'Metric system',
      icon: 'fitness' as const,
    },
  ];

  const handleContinue = async () => {
    if (!selectedUnit) {
      Alert.alert('Please Select', 'Choose your preferred weight unit');
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
          weight_unit: selectedUnit,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Refresh profile data
      await fetchProfile();
      
      router.push('/(onboarding)/workout-experience');
    } catch (error) {
      console.error('Error updating weight unit:', error);
      Alert.alert('Error', 'Failed to save preference. Please try again.');
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
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel} maxFontSizeMultiplier={1.3}>Experience</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel} maxFontSizeMultiplier={1.3}>Source</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="scale" size={32} color={colors.brand} />
          </View>
          <Text style={styles.title}>Weight Unit Preference</Text>
          <Text style={styles.subtitle}>
            Choose your preferred unit for tracking weights in workouts
          </Text>
        </View>

        {/* Weight Unit Options */}
        <View style={styles.optionsContainer}>
          {weightOptions.map((option) => (
            <TouchableOpacity
                activeOpacity={0.5}
              key={option.value}
              style={[
                styles.optionCard,
                selectedUnit === option.value && styles.optionCardSelected,
              ]}
              onPress={() => setSelectedUnit(option.value)}
            >
              <View style={styles.optionContent}>
                <View style={styles.optionLeft}>
                  <View style={[
                    styles.optionIcon,
                    selectedUnit === option.value && styles.optionIconSelected,
                  ]}>
                    <Ionicons
                      name={option.icon}
                      size={24}
                      color={selectedUnit === option.value ? colors.primaryText : colors.brand}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[
                      styles.optionLabel,
                      selectedUnit === option.value && styles.optionLabelSelected,
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {option.description}
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.radioButton,
                  selectedUnit === option.value && styles.radioButtonSelected,
                ]}>
                  {selectedUnit === option.value && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.brand} />
          <Text style={styles.infoText}>
            You can change this preference later in your profile settings
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
                activeOpacity={0.5} 
          style={[styles.continueButton, !selectedUnit && styles.continueButtonDisabled]} 
          onPress={handleContinue}
          disabled={!selectedUnit || loading}
        >
            <>
              <Text style={[styles.continueButtonText, !selectedUnit && styles.continueButtonTextDisabled]}>
                Continue
              </Text>
              <Ionicons 
                name="arrow-forward" 
                size={20} 
                color={selectedUnit ? colors.primaryText : colors.secondaryText} 
              />
            </>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.brand}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
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
    gap: 16,
    marginBottom: 32,
  },
  optionCard: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primaryAccent,
    padding: 20,
  },
  optionCardSelected: {
    borderColor: colors.brand,
    backgroundColor: `${colors.brand}10`,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.brand}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionIconSelected: {
    backgroundColor: colors.brand,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: colors.primaryText,
  },
  optionDescription: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.secondaryText,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.brand,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brand,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAccent,
    borderRadius: 8,
    padding: 16,
    marginBottom: 40,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.secondaryText,
    lineHeight: 20,
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
    fontWeight: '600',
    color: colors.primaryText,
  },
  continueButtonTextDisabled: {
    color: colors.secondaryText,
  },
});
