/**
 * Global Banner System Usage Examples
 * 
 * The banner system provides a consistent way to show feedback messages
 * that slide in from the bottom of the screen above the tab bar.
 */

import { useBannerStore, BANNER_MESSAGES } from '../stores/bannerStore';

// Example usage in a component or utility function

export const BannerExamples = {
  // Success messages
  showWorkoutSaved: () => {
    const { showSuccess } = useBannerStore.getState();
    showSuccess(BANNER_MESSAGES.WORKOUT_SAVED);
  },

  showPostCreated: (postId: string, router: any) => {
    const { showSuccess } = useBannerStore.getState();
    showSuccess(
      BANNER_MESSAGES.POST_CREATED,
      4000,
      {
        text: 'View',
        onPress: () => router.push(`/post/${postId}`)
      }
    );
  },

  showRoutineSaved: () => {
    const { showSuccess } = useBannerStore.getState();
    showSuccess(BANNER_MESSAGES.ROUTINE_SAVED);
  },

  // Error messages
  showNetworkError: () => {
    const { showError } = useBannerStore.getState();
    showError(BANNER_MESSAGES.ERROR_NETWORK);
  },

  showSaveError: () => {
    const { showError } = useBannerStore.getState();
    showError(BANNER_MESSAGES.ERROR_SAVE_FAILED);
  },

  // Error with action (e.g., retry)
  showDeleteError: (retryCallback: () => void) => {
    const { showError } = useBannerStore.getState();
    showError(
      'Failed to delete item',
      4000,
      {
        text: 'Retry',
        onPress: retryCallback
      }
    );
  },

  // Custom messages
  showCustomSuccess: (message: string) => {
    const { showSuccess } = useBannerStore.getState();
    showSuccess(message);
  },

  showCustomError: (message: string) => {
    const { showError } = useBannerStore.getState();
    showError(message);
  },

  // Success with action button
  showSuccessWithAction: (message: string, actionText: string, actionCallback: () => void) => {
    const { showSuccess } = useBannerStore.getState();
    showSuccess(message, 4000, {
      text: actionText,
      onPress: actionCallback
    });
  },

  // With custom duration
  showLongMessage: () => {
    const { showInfo } = useBannerStore.getState();
    showInfo('This message will stay visible for 5 seconds', 5000);
  },

  // Hide banner manually (if needed)
  hideBanner: () => {
    const { hideBanner } = useBannerStore.getState();
    hideBanner();
  },
};

// Usage in async functions (e.g., when saving data)
export const saveWorkoutExample = async (workoutData: any) => {
  try {
    // Your save logic here
    await saveWorkoutToDatabase(workoutData);
    
    // Show success banner
    const { showSuccess } = useBannerStore.getState();
    showSuccess(BANNER_MESSAGES.WORKOUT_SAVED);
    
  } catch (error) {
    // Show error banner
    const { showError } = useBannerStore.getState();
    showError(BANNER_MESSAGES.ERROR_SAVE_FAILED);
  }
};

// Example with post creation showing View action
export const createPostExample = async (postData: any, router: any) => {
  try {
    const newPost = await createPostInDatabase(postData);
    
    // Show success banner with View action
    const { showSuccess } = useBannerStore.getState();
    showSuccess(
      BANNER_MESSAGES.POST_CREATED,
      4000,
      {
        text: 'View',
        onPress: () => router.push(`/post/${newPost.id}`)
      }
    );
    
  } catch (error) {
    const { showError } = useBannerStore.getState();
    showError(BANNER_MESSAGES.ERROR_SAVE_FAILED);
  }
};

// Example with delete action showing red X and Undo action
export const deleteItemExample = async (itemId: string, onUndo: () => void) => {
  try {
    await deleteItemFromDatabase(itemId);
    
    // Show delete confirmation with undo option
    const { showError } = useBannerStore.getState();
    showError(
      'Item deleted',
      4000,
      {
        text: 'Undo',
        onPress: onUndo
      }
    );
    
  } catch (error) {
    const { showError } = useBannerStore.getState();
    showError('Failed to delete item');
  }
};

// Usage in React components
export const ExampleComponent = () => {
  const { showSuccess, showError } = useBannerStore();

  const handleSave = async () => {
    try {
      // Your save logic
      await saveSomething();
      showSuccess('Item saved successfully!');
    } catch (error) {
      showError('Failed to save item');
    }
  };

  return (
    // Your component JSX
    null
  );
};

// Placeholder functions for examples
const saveWorkoutToDatabase = async (data: any) => {
  // Implementation would go here
};

const saveSomething = async () => {
  // Implementation would go here
};

const createPostInDatabase = async (data: any) => {
  // Implementation would go here
  return { id: 'new-post-id' };
};

const deleteItemFromDatabase = async (itemId: string) => {
  // Implementation would go here
};
