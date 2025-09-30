# Progress Bar System

A global progress bar system for showing loading states across the entire app. The progress bar appears at the bottom of the navbar and fills with the brand color to indicate progress.

## Usage

### Basic Loading (Unknown Duration)

For operations where you don't know the exact progress:

```typescript
import { progressUtils, PROGRESS_LABELS } from '../stores/progressStore';

const handleSavePost = async () => {
  // Start loading with a label
  const loadingInterval = progressUtils.startLoading(PROGRESS_LABELS.SAVING_POST);
  
  try {
    // Your async operation
    await savePostToDatabase();
    
    // Complete the loading
    progressUtils.completeLoading();
    
  } catch (error) {
    // Cancel loading on error
    progressUtils.cancelLoading();
  }
};
```

### Step-by-Step Progress (Known Steps)

For operations with known steps:

```typescript
import { progressUtils, PROGRESS_LABELS } from '../stores/progressStore';

const handleUploadPost = async () => {
  try {
    // Step 1: Process images
    progressUtils.stepProgress(1, 4, PROGRESS_LABELS.PROCESSING_IMAGE);
    await processImages();
    
    // Step 2: Upload media
    progressUtils.stepProgress(2, 4, PROGRESS_LABELS.UPLOADING_MEDIA);
    await uploadMedia();
    
    // Step 3: Create post
    progressUtils.stepProgress(3, 4, PROGRESS_LABELS.SAVING_POST);
    await createPost();
    
    // Step 4: Complete
    progressUtils.stepProgress(4, 4, 'Complete');
    
    // Auto-hide after completion
    setTimeout(() => progressUtils.completeLoading(), 500);
    
  } catch (error) {
    progressUtils.cancelLoading();
  }
};
```

### Manual Progress Control

For fine-grained control:

```typescript
import { useProgressStore } from '../stores/progressStore';

const handleCustomOperation = async () => {
  const { showProgress, updateProgress, hideProgress } = useProgressStore.getState();
  
  try {
    showProgress('Processing...');
    
    // Update progress manually
    updateProgress(25);
    await step1();
    
    updateProgress(50);
    await step2();
    
    updateProgress(75);
    await step3();
    
    updateProgress(100);
    
    // Hide after brief delay
    setTimeout(hideProgress, 300);
    
  } catch (error) {
    hideProgress();
  }
};
```

### Using in React Components

You can also use the progress store directly in components:

```typescript
import { useProgressStore } from '../stores/progressStore';

const MyComponent = () => {
  const { showProgress, updateProgress, hideProgress } = useProgressStore();
  
  const handleAction = async () => {
    showProgress('Loading...');
    
    // Your logic here
    
    hideProgress();
  };
  
  return (
    <Button onPress={handleAction}>
      Do Something
    </Button>
  );
};
```

## API Reference

### progressUtils

- `startLoading(label?: string)`: Start indeterminate loading with smooth animation
- `completeLoading()`: Complete loading and hide progress bar
- `stepProgress(currentStep, totalSteps, label?)`: Set progress based on current step
- `cancelLoading()`: Immediately hide progress bar

### useProgressStore

- `showProgress(label?: string)`: Show progress bar at 0%
- `updateProgress(progress: number)`: Update progress (0-100)
- `setProgress(progress: number, label?: string)`: Set progress and label
- `hideProgress()`: Hide progress bar
- `reset()`: Reset all state

### Pre-defined Labels

Use `PROGRESS_LABELS` constants for consistent messaging:

- `PROGRESS_LABELS.SAVING_POST`
- `PROGRESS_LABELS.EDITING_POST`
- `PROGRESS_LABELS.SAVING_WORKOUT`
- `PROGRESS_LABELS.UPDATING_WORKOUT`
- `PROGRESS_LABELS.DELETING_WORKOUT`
- `PROGRESS_LABELS.SAVING_ROUTINE`
- `PROGRESS_LABELS.UPDATING_ROUTINE`
- `PROGRESS_LABELS.DELETING_ROUTINE`
- `PROGRESS_LABELS.UPLOADING_MEDIA`
- `PROGRESS_LABELS.PROCESSING_IMAGE`
- `PROGRESS_LABELS.PROCESSING_VIDEO`
- `PROGRESS_LABELS.SYNCING_DATA`
- `PROGRESS_LABELS.LOADING`

## Implementation Details

- The progress bar appears at the bottom of the navbar
- Uses the app's brand color (`colors.brand`)
- Smooth animations using React Native's Animated API
- Auto-hides when reaching 100%
- Thread-safe with proper state management
- Works across all screens and modals
