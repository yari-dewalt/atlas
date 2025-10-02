# Global Banner System

The global banner system provides a consistent way to show feedback messages that slide in from the bottom of the screen above the tab bar. It supports different types of messages (success, error, info, warning) with optional action buttons.

## Features

- **Slide Animation**: Banners slide in from the bottom of the screen with a smooth animation
- **Auto-dismiss**: Banners automatically hide after a configurable duration
- **Action Buttons**: Optional action buttons with custom text and callbacks
- **Multiple Types**: Support for success (green checkmark), error (red X), info, and warning messages
- **Consistent Styling**: Matches the app's design system with proper colors and typography

## Usage

### Basic Messages

```typescript
import { useBannerStore, BANNER_MESSAGES } from '../stores/bannerStore';

// Show a simple success message
const { showSuccess } = useBannerStore.getState();
showSuccess(BANNER_MESSAGES.POST_CREATED);

// Show an error message
const { showError } = useBannerStore.getState();
showError(BANNER_MESSAGES.ERROR_SAVE_FAILED);
```

### Messages with Action Buttons

```typescript
// Success message with "View" action
const { showSuccess } = useBannerStore.getState();
showSuccess(
  BANNER_MESSAGES.POST_CREATED,
  4000, // Duration in milliseconds
  {
    text: 'View',
    onPress: () => router.push(`/post/${postId}`)
  }
);

// Error message with "Retry" action
const { showError } = useBannerStore.getState();
showError(
  'Failed to save post',
  4000,
  {
    text: 'Retry',
    onPress: () => handleRetry()
  }
);
```

### Custom Messages

```typescript
// Custom success message
showSuccess('Custom success message');

// Custom error with action
showError(
  'Something went wrong',
  5000,
  {
    text: 'Contact Support',
    onPress: () => router.push('/support')
  }
);
```

## Banner Types

### Success (Green with Checkmark)
- Used for successful actions like saving, creating, updating
- Default icon: `checkmark-circle`
- Color: Green (#10B981)

### Error (Red with X)
- Used for failed actions or destructive actions like deleting
- Default icon: `close-circle` 
- Color: Red (#EF4444)

### Warning (Amber with Warning Icon)
- Used for warnings or cautionary messages
- Default icon: `warning`
- Color: Amber (#F59E0B)

### Info (Brand Color with Info Icon)
- Used for informational messages
- Default icon: `information-circle`
- Color: Brand color

## Integration

The banner system is integrated into the main app layout (`app/(app)/_layout.tsx`) and will appear above the tab bar on all screens.

### Post Creation/Editing Example

```typescript
// After successfully creating a post
const { showSuccess } = useBannerStore.getState();
showSuccess(
  BANNER_MESSAGES.POST_CREATED,
  4000,
  {
    text: 'View',
    onPress: () => {
      router.dismiss(); // Close modal
      router.push(`/post/${newPostId}`); // Navigate to post
    }
  }
);
```

## API Reference

### Store Methods

- `showBanner(message, type?, duration?, action?)` - Show a banner with full control
- `showSuccess(message, duration?, action?)` - Show success banner
- `showError(message, duration?, action?)` - Show error banner  
- `showInfo(message, duration?, action?)` - Show info banner
- `showWarning(message, duration?, action?)` - Show warning banner
- `hideBanner()` - Manually hide the current banner

### Action Object

```typescript
interface BannerAction {
  text: string;      // Text to display on the action button
  onPress: () => void; // Callback when action is pressed
}
```

### Predefined Messages

Available in `BANNER_MESSAGES` constant:
- `POST_CREATED` - "Successfully created post"
- `POST_UPDATED` - "Successfully updated post"  
- `POST_DELETED` - "Post deleted"
- `WORKOUT_SAVED` - "Workout saved successfully!"
- `ERROR_SAVE_FAILED` - "Failed to save. Please try again."
- And many more...

## Styling

The banner automatically adapts to the app's color scheme and uses consistent styling with:
- Rounded corners (12px border radius)
- Drop shadow for elevation
- White text on colored backgrounds
- Action buttons with semi-transparent backgrounds
- Proper spacing and typography

## Position

Banners appear at the bottom of the screen, 90px from the bottom (above the tab bar) with 16px horizontal margins.
