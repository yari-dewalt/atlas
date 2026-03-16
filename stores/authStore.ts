import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type UserProfile = {
  id: string;
  username: string | null;
  name?: string | null;
  bio?: string | null;
  avatar_url: string | null;
  weight_unit?: 'lbs' | 'kg' | null;
  date_of_birth?: string | null;
  onboarding_completed?: boolean | null;
  email_verified?: boolean | null;
  subscription_tier?: 'free' | 'pro' | null;
  subscription_expires_at?: string | null;
};

type AuthState = {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  
  // Actions
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updatedProfile: UserProfile) => void;
  markOnboardingComplete: () => Promise<void>;
  markEmailVerified: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,
  
  setSession: (session) => set({ session }),
  
  setLoading: (loading) => set({ loading }),
  
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
  
  fetchProfile: async () => {
    const { session } = get();
    if (!session?.user) {
      set({ profile: null });
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, name, bio, avatar_url, weight_unit, date_of_birth, onboarding_completed, email_verified, subscription_tier, subscription_expires_at")
        .eq("id", session.user.id)
        .single();
      
      if (error) throw error;

      const profileWithId = data.id ? data : { ...data, id: session.user.id };
      
      set({ profile: profileWithId });
    } catch (error) {
      console.error("Error fetching profile:", error);
      set({ profile: null });
    }
  },

  updateProfile: (updatedProfile: UserProfile) => {
    set({ profile: updatedProfile });
  },

  markOnboardingComplete: async () => {
    const { session, profile } = get();
    if (!session?.user || !profile) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", session.user.id);

      if (error) throw error;

      // Update local state
      set({ 
        profile: { 
          ...profile, 
          onboarding_completed: true 
        } 
      });
    } catch (error) {
      console.error("Error marking onboarding complete:", error);
      throw error;
    }
  },

  markEmailVerified: async () => {
    const { session, profile } = get();
    if (!session?.user || !profile) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ email_verified: true })
        .eq("id", session.user.id);

      if (error) throw error;

      // Update local state
      set({ 
        profile: { 
          ...profile, 
          email_verified: true 
        } 
      });
    } catch (error) {
      console.error("Error marking email verified:", error);
      throw error;
    }
  },
}));