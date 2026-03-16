export type PlanId = 'monthly' | 'yearly' | 'lifetime';

export const SUBSCRIPTION_PLANS: {
  id: PlanId;
  label: string;
  price: number;
  priceDisplay: string;
  perMonthDisplay: string | null;
  savingsLabel: string | null;
  stripePriceId: string;
  isBestValue?: boolean;
}[] = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: 1.99,
    priceDisplay: '$1.99/mo',
    perMonthDisplay: null,
    savingsLabel: null,
    stripePriceId: 'price_1TBfqoE6Ov68b0Y9eu8Y47vL',
  },
  {
    id: 'yearly',
    label: 'Yearly',
    price: 19.99,
    priceDisplay: '$19.99/yr',
    perMonthDisplay: '$1.66/mo, billed yearly',
    savingsLabel: 'Save 16%',
    stripePriceId: 'price_1TBfrpE6Ov68b0Y9D9xiDRug',
    isBestValue: true,
  },
  {
    id: 'lifetime',
    label: 'Lifetime',
    price: 49.99,
    priceDisplay: '$49.99',
    perMonthDisplay: 'one-time payment',
    savingsLabel: null,
    stripePriceId: 'price_1TBfskE6Ov68b0Y9m9mfGwYZ',
  },
];

export const PRO_FEATURES: {
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    icon: 'list-outline',
    title: 'Unlimited Routines',
    description: 'Create as many routines as you need (free: max 4)',
  },
  {
    icon: 'barbell-outline',
    title: 'Unlimited Custom Exercises',
    description: 'Add any exercise to your library (free: max 7)',
  },
  {
    icon: 'time-outline',
    title: 'Full Activity History',
    description: 'Access your complete workout history (free: last 3 months)',
  },
  {
    icon: 'at-outline',
    title: 'Change Username Anytime',
    description: 'Update your username whenever you want (free: every 90 days)',
  },
];

export const FREE_TIER_LIMITS = {
  maxRoutines: 4,
  maxCustomExercises: 7,
  activityHistoryMonths: 3,
  usernameChangeDays: 90,
} as const;
