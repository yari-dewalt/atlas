import { create } from 'zustand';
import { supabase } from '../lib/supabase';

type SubscriptionTier = 'free' | 'pro';
type PlanType = 'monthly' | 'yearly' | 'lifetime' | null;

type SubscriptionState = {
  tier: SubscriptionTier;
  expiresAt: string | null;
  planType: PlanType;
  isLoading: boolean;

  fetchSubscription: (userId: string) => Promise<void>;
  isPro: () => boolean;
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: 'free',
  expiresAt: null,
  planType: null,
  isLoading: false,

  fetchSubscription: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_expires_at')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Also fetch the latest subscription record for plan type
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('plan_type')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      set({
        tier: (data?.subscription_tier as SubscriptionTier) ?? 'free',
        expiresAt: data?.subscription_expires_at ?? null,
        planType: (subData?.plan_type as PlanType) ?? null,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  isPro: () => {
    const { tier, expiresAt } = get();
    if (tier !== 'pro') return false;
    if (!expiresAt) return true; // lifetime — no expiry
    return new Date(expiresAt) > new Date();
  },
}));
