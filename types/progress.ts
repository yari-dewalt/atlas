// Types for the progress store and utility functions

export interface ProgressState {
  isVisible: boolean;
  progress: number; // 0-100
  label?: string;
}

export interface ProgressActions {
  showProgress: (label?: string) => void;
  updateProgress: (progress: number) => void;
  setProgress: (progress: number, label?: string) => void;
  hideProgress: () => void;
  reset: () => void;
}

export interface ProgressUtils {
  startLoading: (label?: string) => NodeJS.Timeout;
  completeLoading: () => void;
  stepProgress: (currentStep: number, totalSteps: number, label?: string) => void;
  cancelLoading: () => void;
}

// Common progress labels
export const PROGRESS_LABELS = {
  SAVING_POST: 'Saving post...',
  EDITING_POST: 'Updating post...',
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

export type ProgressLabel = typeof PROGRESS_LABELS[keyof typeof PROGRESS_LABELS];
