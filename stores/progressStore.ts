import { create } from 'zustand';

// Pre-defined progress labels for consistency
export const PROGRESS_LABELS = {
  SAVING_POST: 'Saving post...',
  EDITING_POST: 'Updating post...',
  DELETING_POST: 'Deleting post...',
  SAVING_WORKOUT: 'Saving workout...',
  UPDATING_WORKOUT: 'Updating workout...',
  DELETING_WORKOUT: 'Deleting workout...',
  SAVING_ROUTINE: 'Saving routine...',
  UPDATING_ROUTINE: 'Updating routine...',
  DELETING_ROUTINE: 'Deleting routine...',
  UPLOADING_MEDIA: 'Uploading media...',
  PROCESSING_IMAGE: 'Processing image...',
  PROCESSING_VIDEO: 'Processing video...',
  SYNCING_DATA: 'Syncing data...',
  LOADING: 'Loading...',
} as const;

interface ProgressState {
  isVisible: boolean;
  progress: number; // 0-100
  label?: string;
  
  // Actions
  showProgress: (label?: string) => void;
  updateProgress: (progress: number) => void;
  setProgress: (progress: number, label?: string) => void;
  hideProgress: () => void;
  reset: () => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  isVisible: false,
  progress: 0,
  label: undefined,

  showProgress: (label?: string) => set({
    isVisible: true,
    progress: 0,
    label
  }),

  updateProgress: (progress: number) => set((state) => ({
    progress: Math.min(100, Math.max(0, progress)),
    // Auto-hide when reaching 100%
    isVisible: progress < 100 ? state.isVisible : false
  })),

  setProgress: (progress: number, label?: string) => set({
    isVisible: true,
    progress: Math.min(100, Math.max(0, progress)),
    label
  }),

  hideProgress: () => set({
    isVisible: false,
    progress: 0,
    label: undefined
  }),

  reset: () => set({
    isVisible: false,
    progress: 0,
    label: undefined
  })
}));

// Utility functions for common loading patterns
export const progressUtils = {
  // For simple loading without specific progress tracking
  startLoading: (label?: string) => {
    const { showProgress, updateProgress } = useProgressStore.getState();
    showProgress(label);
    
    // Simulate progress with a smooth animation
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 15 + 5; // Random increment between 5-20
      if (currentProgress >= 90) {
        currentProgress = 90; // Stop at 90% until manually completed
        clearInterval(interval);
      }
      updateProgress(currentProgress);
    }, 150);
    
    return interval;
  },

  // Complete the loading (jump to 100%)
  completeLoading: () => {
    const { updateProgress } = useProgressStore.getState();
    updateProgress(100);
    
    // Hide after a brief delay to show completion
    setTimeout(() => {
      useProgressStore.getState().hideProgress();
    }, 300);
  },

  // For operations with known steps
  stepProgress: (currentStep: number, totalSteps: number, label?: string) => {
    const { setProgress } = useProgressStore.getState();
    const progress = (currentStep / totalSteps) * 100;
    setProgress(progress, label);
  },

  // Cancel loading
  cancelLoading: () => {
    const { hideProgress } = useProgressStore.getState();
    hideProgress();
  }
};
