import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { autoFollowFounders } from '../../utils/founderUtils';

export default function Complete() {
  const router = useRouter();
  const { markOnboardingComplete, session } = useAuthStore();

  const handleStartUsing = async () => {
    // Auto-follow founders for new users after completing all onboarding steps
    if (session?.user) {
      try {
        await autoFollowFounders(session.user.id);
      } catch (founderError) {
        console.error('Error auto-following founders:', founderError);
        // Don't fail the onboarding if founder following fails
      }
    }

    // Mark onboarding as complete
    await markOnboardingComplete();
    
    // Navigate to the main app - this will trigger the auth flow to redirect properly
    router.replace('/(app)/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => router.dismissTo('/(onboarding)/username')} style={styles.progressSection}>
          <Text style={styles.progressLabel} maxFontSizeMultiplier={1.3}>Username</Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} style={styles.checkmark} />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <TouchableOpacity onPress={() => router.dismissTo('/(onboarding)/personal-info')} style={styles.progressSection}>
          <Text style={styles.progressLabel} maxFontSizeMultiplier={1.3}>Personal Info</Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} style={styles.checkmark} />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <View style={styles.progressSection}>
          <Text style={[styles.progressLabel, styles.activeLabel]} maxFontSizeMultiplier={1.3}>Get Started</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Animation Container */}
        <View style={styles.successContainer}>
          <Text style={styles.title}>You're All Set!</Text>
          <Text style={styles.subtitle}>
            Your account is ready and you can start tracking your fitness journey.
          </Text>
        </View>

        {/* Next Steps */}
        <View style={styles.nextStepsContainer}>
          <Text style={styles.nextStepsTitle}>What's Next?</Text>

          <View style={styles.stepsList}>
            <View style={styles.step}>
              <View style={styles.stepIcon}>
                <Ionicons name="add-circle" size={24} color={colors.brand} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Start Your First Workout</Text>
                <Text style={styles.stepDescription}>Log exercises and track your progress</Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepIcon}>
                <Ionicons name="people" size={24} color={colors.brand} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Connect with Others</Text>
                <Text style={styles.stepDescription}>Follow friends and share your journey</Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepIcon}>
                <Ionicons name="settings" size={24} color={colors.brand} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Customize Your Profile</Text>
                <Text style={styles.stepDescription}>Add a photo and complete your profile</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
                activeOpacity={0.5} style={styles.startButton} onPress={handleStartUsing}>
          <Text style={styles.startButtonText}>Start Using Atlas</Text>
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
    fontWeight: '500',
  },
  checkmark: {
    position: 'absolute',
    top: 18,
  },
  chevron: {
    marginHorizontal: 8,
    opacity: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.secondaryText,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  nextStepsContainer: {
    marginBottom: 24,
  },
  nextStepsTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 24,
    textAlign: 'center',
  },
  stepsList: {
    gap: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.brand}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.secondaryText,
    lineHeight: 20,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
  },
});
