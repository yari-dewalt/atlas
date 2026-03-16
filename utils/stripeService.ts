import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';

// TODO: Set STRIPE_PUBLISHABLE_KEY when adding native Stripe SDK
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51TBf8hE6Ov68b0Y9IloxfnqZKgEFD3AhTCvlTd1mjmTdsWQyGfF7qGABUPDEbGtiqQ4liMg0pZHgozfhsfdM8xVZ004Lgc31Aw';

// TODO: Supabase Edge Function URL is auto-resolved via the Supabase client
// Function name: create-checkout-session

type PlanType = 'monthly' | 'yearly' | 'lifetime';

/**
 * Calls the create-checkout-session Edge Function and returns the Stripe Checkout URL.
 */
export async function createCheckoutSession(
  planType: PlanType,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { planType, userId },
  });

  if (error) throw new Error(`Failed to create checkout session: ${error.message}`);
  if (!data?.url) throw new Error('No checkout URL returned from server');

  return data.url as string;
}

/**
 * Opens the Stripe Checkout URL in an in-app browser session.
 * Uses openAuthSessionAsync so the app regains focus when the user finishes.
 */
export async function openCheckout(url: string): Promise<WebBrowser.WebBrowserAuthSessionResult> {
  return WebBrowser.openAuthSessionAsync(url, 'atlas://');
}

/**
 * Stub for restoring purchases (e.g. after reinstall).
 * TODO: Implement by calling a restore-purchases Edge Function that
 *       re-checks active Stripe subscriptions for the user and syncs
 *       subscription_tier back to the profiles table.
 */
export async function restorePurchases(_userId: string): Promise<void> {
  // TODO: Implement restore purchases
  console.warn('[stripeService] restorePurchases not yet implemented');
}
