import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { SUBSCRIPTION_PLANS, PRO_FEATURES, PlanId } from '../../../constants/subscription';
import { createCheckoutSession, openCheckout } from '../../../utils/stripeService';
import { useAuthStore } from '../../../stores/authStore';

const COMPARISON_ROWS: { feature: string; free: string }[] = [
  { feature: 'Unlimited Routines', free: '4 max' },
  { feature: 'Unlimited Custom Exercises', free: '7 max' },
  { feature: 'Full Activity History', free: '3 months' },
  { feature: 'Change Username Anytime', free: 'Every 90 days' },
];

export default function ProScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [isLoading, setIsLoading] = useState(false);

  const activePlan = SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlan)!;

  const handleSubscribe = async () => {
    if (!session?.user) {
      Alert.alert('Error', 'You must be logged in to subscribe.');
      return;
    }

    setIsLoading(true);
    try {
      const url = await createCheckoutSession(selectedPlan, session.user.id);
      await openCheckout(url);
    } catch (err) {
      Alert.alert('Error', 'Unable to start checkout. Please try again later.');
      console.error('[ProScreen] checkout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.root}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Close button */}
          <TouchableOpacity
            activeOpacity={0.6}
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={30} color={colors.primaryText} />
          </TouchableOpacity>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroWordmarkRow}>
              <Image
                source={require('../../../assets/logo/word.png')}
                style={styles.wordImage}
                resizeMode="contain"
              />
              <Text style={styles.proText}>PRO</Text>
            </View>
            <Text style={styles.heroSubtitle}>Unlock your full potential</Text>
          </View>

          {/* Features */}
          <View style={styles.featuresList}>
            {PRO_FEATURES.map((feature) => (
              <View key={feature.title} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon as any} size={22} color={colors.brand} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={colors.brand} />
              </View>
            ))}
          </View>

          {/* Plan selector */}
          <View style={styles.planRow}>
            {SUBSCRIPTION_PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              const billingLabel =
                plan.id === 'monthly'
                  ? 'Billed monthly'
                  : plan.id === 'yearly'
                    ? 'Billed yearly'
                    : 'Pay once';
              return (
                <TouchableOpacity
                  key={plan.id}
                  activeOpacity={0.7}
                  style={[styles.planCard, isSelected && styles.planCardSelected]}
                  onPress={() => setSelectedPlan(plan.id)}
                >
                  {/* Corner savings ribbon */}
                  {plan.savingsLabel && (
                    <View style={styles.savingsRibbon}>
                      <Text style={styles.savingsRibbonText}>{plan.savingsLabel}</Text>
                    </View>
                  )}

                  <Text style={[styles.planProLabel, isSelected && styles.planProLabelSelected]}>
                    PRO
                  </Text>
                  <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>
                    {plan.label.toUpperCase()}
                  </Text>
                  <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                    ${plan.price.toFixed(2)}
                  </Text>
                  <Text style={styles.planBillingLabel}>{billingLabel}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* CTA */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.ctaButton}
            onPress={handleSubscribe}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.ctaText}>Subscribe to {activePlan.label} plan</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.6}
            style={styles.notNowButton}
            onPress={() => router.back()}
          >
            <Text style={styles.notNowText}>Not now</Text>
          </TouchableOpacity>

          <Text style={styles.cancelNote}>Cancel your subscription at any time.</Text>

          {/* Comparison table */}
          <View style={styles.comparisonTable}>
            {/* Header */}
            <View style={[styles.comparisonRow]}>
              <View style={styles.comparisonFeatureCol} />
              <Text style={styles.comparisonColHeader}>Free</Text>
              <Text style={styles.comparisonProColHeader}>Pro</Text>
            </View>

            {COMPARISON_ROWS.map((row, i) => (
              <View
                key={row.feature}
                style={[
                  styles.comparisonRow,
                  i < COMPARISON_ROWS.length - 1 && styles.comparisonRowBorder,
                ]}
              >
                <Text style={styles.comparisonFeature}>{row.feature}</Text>
                <Text style={styles.comparisonFreeVal}>{row.free}</Text>
                <View style={styles.comparisonProCell}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.brand} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 56,
    paddingBottom: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  // Hero
  hero: {
    alignItems: 'center',
    marginBottom: 36,
  },
  heroWordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  wordImage: {
    height: 100,
    width: 150,
  },
  proText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.brand,
    marginLeft: 6,
  },
  heroSubtitle: {
    fontSize: 16,
    color: colors.secondaryText,
  },
  // Features
  featuresList: {
    width: '100%',
    marginBottom: 28,
    backgroundColor: colors.primaryAccent,
    borderRadius: 14,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  featureIcon: {
    width: 36,
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  // Plan selector
  planRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  planCard: {
    flex: 1,
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.whiteOverlay,
    minHeight: 140,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.secondaryAccent,
  },
  savingsRibbon: {
    position: 'absolute',
    top: 14,
    right: -22,
    width: 80,
    backgroundColor: colors.brand,
    paddingVertical: 4,
    alignItems: 'center',
    transform: [{ rotate: '45deg' }],
  },
  savingsRibbonText: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.background,
    letterSpacing: 0.3,
  },
  planProLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brand,
    letterSpacing: 1,
    marginBottom: 2,
  },
  planProLabelSelected: {
    color: colors.brand,
  },
  planLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryText,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  planLabelSelected: {
    color: colors.primaryText,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 6,
  },
  planPriceSelected: {
    color: colors.primaryText,
  },
  planBillingLabel: {
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: 'center',
  },
  // CTA
  ctaButton: {
    width: '100%',
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  notNowButton: {
    paddingVertical: 12,
  },
  notNowText: {
    fontSize: 16,
    color: colors.brand,
  },
  cancelNote: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  // Comparison table
  comparisonTable: {
    width: '100%',
    marginTop: 36,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  comparisonRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  comparisonFeatureCol: {
    flex: 2,
  },
  comparisonColHeader: {
    width: 72,
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondaryText,
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  comparisonProColHeader: {
    width: 72,
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand,
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  comparisonFeature: {
    flex: 2,
    fontSize: 13,
    color: colors.primaryText,
    fontWeight: '500',
  },
  comparisonFreeVal: {
    width: 72,
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: 'center',
  },
  comparisonProCell: {
    width: 72,
    alignItems: 'center',
  },
});
