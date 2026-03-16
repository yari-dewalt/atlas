import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { SUBSCRIPTION_PLANS, PRO_FEATURES, PlanId } from '../../../../constants/subscription';
import { createCheckoutSession, openCheckout } from '../../../../utils/stripeService';
import { useAuthStore } from '../../../../stores/authStore';

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
        {/* Back button */}
        <TouchableOpacity
          activeOpacity={0.6}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primaryText} />
        </TouchableOpacity>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroWordmark}>✦ Atlas Pro</Text>
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
              return (
                <TouchableOpacity
                  key={plan.id}
                  activeOpacity={0.7}
                  style={[styles.planCard, isSelected && styles.planCardSelected]}
                  onPress={() => setSelectedPlan(plan.id)}
                >
                  {plan.isBestValue && (
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>BEST VALUE</Text>
                    </View>
                  )}
                  <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>
                    {plan.label}
                  </Text>
                  <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                    {plan.priceDisplay}
                  </Text>
                  {plan.perMonthDisplay && (
                    <Text style={styles.planPerMonth}>{plan.perMonthDisplay}</Text>
                  )}
                  {plan.savingsLabel && (
                    <Text style={styles.planSavings}>{plan.savingsLabel}</Text>
                  )}
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
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.ctaText}>Get Atlas Pro</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.ctaPrice}>{activePlan.priceDisplay}</Text>

          {/* Restore */}
          <TouchableOpacity
            activeOpacity={0.6}
            style={styles.restoreButton}
            onPress={() => Alert.alert('Restore Purchases', 'This feature is coming soon.')}
          >
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>
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
  backButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 100,
    paddingBottom: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  // Hero
  hero: {
    alignItems: 'center',
    marginBottom: 36,
  },
  heroWordmark: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.brand,
    letterSpacing: 1,
    marginBottom: 8,
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
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.whiteOverlay,
    minHeight: 110,
    justifyContent: 'center',
  },
  planCardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.secondaryAccent,
  },
  bestValueBadge: {
    backgroundColor: colors.brand,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  bestValueText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.background,
    letterSpacing: 0.5,
  },
  planLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondaryText,
    marginBottom: 4,
  },
  planLabelSelected: {
    color: colors.primaryText,
  },
  planPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.secondaryText,
  },
  planPriceSelected: {
    color: colors.brand,
  },
  planPerMonth: {
    fontSize: 10,
    color: colors.secondaryText,
    marginTop: 3,
    textAlign: 'center',
  },
  planSavings: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.brand,
    marginTop: 2,
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
    fontSize: 17,
    fontWeight: '700',
    color: colors.background,
  },
  ctaPrice: {
    fontSize: 13,
    color: colors.secondaryText,
    marginBottom: 24,
  },
  // Restore
  restoreButton: {
    paddingVertical: 8,
  },
  restoreText: {
    fontSize: 13,
    color: colors.secondaryText,
    textDecorationLine: 'underline',
  },
});
