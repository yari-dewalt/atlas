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
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { SUBSCRIPTION_PLANS, PlanId } from '../../../constants/subscription';
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
  const { session, profile } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [isLoading, setIsLoading] = useState(false);

  const isPro = profile?.subscription_tier === 'pro';
  const activePlan = SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlan)!;

  const renewalDate = profile?.subscription_expires_at
    ? new Date(profile.subscription_expires_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

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

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      `Are you sure you want to cancel your Pro subscription? You'll keep access until the end of your billing period.`,
      [
        { text: 'Keep Pro', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: () => {
            // TODO: implement cancellation
          },
        },
      ]
    );
  };

  if (isPro) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.root}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
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
              <View style={styles.activeChip}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primaryText} />
                <Text style={styles.activeChipText}>Active</Text>
              </View>
              {renewalDate && (
                <Text style={styles.renewalText}>Renews {renewalDate}</Text>
              )}
            </View>

            {/* Benefits comparison */}
            <View style={styles.manageComparisonTable}>
              {/* Header */}
              <View style={styles.comparisonRow}>
                <View style={styles.comparisonFeatureCol} />
                <Text style={styles.comparisonColHeader}>Free</Text>
                <View style={styles.manageProColHeader}>
                  <Text style={styles.comparisonProColHeader}>Pro</Text>
                </View>
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
                  <Text style={styles.manageFreVal}>{row.free}</Text>
                  <View style={styles.comparisonProCell}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.brand} />
                  </View>
                </View>
              ))}
            </View>

            {/* Cancel */}
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.notNowButton}
              onPress={handleCancelSubscription}
            >
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
            </TouchableOpacity>
            <Text style={styles.cancelNote}>
              You'll keep PRO access until the end of your billing period.
            </Text>
          </ScrollView>
        </View>
      </>
    );
  }

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
            <Text style={styles.heroDescription}>
              Get access to all PRO features and take your training to the next level.
            </Text>
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
                <View key={plan.id} style={styles.planCardWrapper}>
                  {/* Ribbon sits behind the card */}
                  {plan.savingsLabel && (
                    <View style={styles.savingsRibbon}>
                      <Text style={styles.savingsRibbonText}>{plan.savingsLabel}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.planCard, isSelected && styles.planCardSelected]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedPlan(plan.id);
                    }}
                  >
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
                </View>
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
          <Text style={styles.comparisonHeading}>PRO Features</Text>
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
    fontSize: 36,
    fontWeight: '700',
    color: colors.brand,
    marginTop: 4,
  },
  heroSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Plan selector
  planRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  planCardWrapper: {
    flex: 1,
    paddingTop: 14,
  },
  planCard: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.whiteOverlay,
    minHeight: 160,
  },
  planCardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.secondaryAccent,
  },
  savingsRibbon: {
    position: 'absolute',
    top: -6,
    left: 0,
    right: 0,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingBottom: 6,
  },
  savingsRibbonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryText,
    textTransform: 'uppercase',
  },
  planProLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brand,
  },
  planProLabelSelected: {
    color: colors.brand,
  },
  planLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryText,
    marginTop: 8,
  },
  planLabelSelected: {
    color: colors.primaryText,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.primaryText,
    marginTop: 16,
  },
  planPriceSelected: {
    color: colors.primaryText,
  },
  planBillingLabel: {
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: 'auto',
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
    marginTop: 8,
    color: colors.secondaryText,
  },
  // Pro member view
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.brand,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },
  activeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryText,
  },
  renewalText: {
    fontSize: 13,
    color: colors.secondaryText,
  },
  manageComparisonTable: {
    width: '100%',
    marginBottom: 32,
  },
  manageProColHeader: {
    width: 72,
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 6,
    paddingVertical: 3,
  },
  manageFreVal: {
    width: 72,
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: 'center',
    textDecorationLine: 'line-through',
    textDecorationColor: colors.secondaryText,
  },

  cancelButtonText: {
    fontSize: 16,
    color: colors.notification,
  },
  // Comparison table
  comparisonHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryText,
    marginTop: 36,
    marginBottom: 4,
  },
  comparisonTable: {
    width: '100%',
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
    color: colors.primaryText,
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
