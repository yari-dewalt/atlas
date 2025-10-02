import { create } from 'zustand';

// Pre-defined banner types and messages
export const BANNER_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
} as const;

export const BANNER_MESSAGES = {
  WORKOUT_SAVED: 'Workout saved successfully!',
  WORKOUT_UPDATED: 'Workout updated successfully!',
  WORKOUT_DELETED: 'Workout deleted',
  POST_CREATED: 'Successfully created post',
  POST_UPDATED: 'Successfully updated post',
  POST_DELETED: 'Post deleted',
  ROUTINE_SAVED: 'Routine saved successfully!',
  ROUTINE_UPDATED: 'Routine updated successfully!',
  ROUTINE_DELETED: 'Routine deleted',
  PROFILE_UPDATED: 'Profile updated successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
  MEDIA_UPLOADED: 'Media uploaded successfully!',
  ERROR_GENERIC: 'Something went wrong. Please try again.',
  ERROR_NETWORK: 'Network error. Check your connection.',
  ERROR_SAVE_FAILED: 'Failed to save. Please try again.',
} as const;

type BannerType = typeof BANNER_TYPES[keyof typeof BANNER_TYPES];

interface BannerAction {
  text: string;
  onPress: () => void;
}

interface BannerState {
  isVisible: boolean;
  message: string;
  type: BannerType;
  duration?: number; // Auto-hide duration in milliseconds
  action?: BannerAction; // Optional action button
  
  // Actions
  showBanner: (message: string, type?: BannerType, duration?: number, action?: BannerAction) => void;
  showSuccess: (message: string, duration?: number, action?: BannerAction) => void;
  showError: (message: string, duration?: number, action?: BannerAction) => void;
  showInfo: (message: string, duration?: number, action?: BannerAction) => void;
  showWarning: (message: string, duration?: number, action?: BannerAction) => void;
  hideBanner: () => void;
}

export const useBannerStore = create<BannerState>((set, get) => ({
  isVisible: false,
  message: '',
  type: BANNER_TYPES.INFO,
  duration: 3000, // Default 3 seconds
  action: undefined,

  showBanner: (message: string, type: BannerType = BANNER_TYPES.INFO, duration = 3000, action?: BannerAction) => {
    set({
      isVisible: true,
      message,
      type,
      duration,
      action
    });

    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        const currentState = get();
        // Only hide if this is still the same message (prevents hiding newer banners)
        if (currentState.isVisible && currentState.message === message) {
          set({ isVisible: false, action: undefined });
        }
      }, duration);
    }
  },

  showSuccess: (message: string, duration = 3000, action?: BannerAction) => {
    get().showBanner(message, BANNER_TYPES.SUCCESS, duration, action);
  },

  showError: (message: string, duration = 4000, action?: BannerAction) => {
    get().showBanner(message, BANNER_TYPES.ERROR, duration, action);
  },

  showInfo: (message: string, duration = 3000, action?: BannerAction) => {
    get().showBanner(message, BANNER_TYPES.INFO, duration, action);
  },

  showWarning: (message: string, duration = 3500, action?: BannerAction) => {
    get().showBanner(message, BANNER_TYPES.WARNING, duration, action);
  },

  hideBanner: () => set({ isVisible: false, action: undefined }),
}));
