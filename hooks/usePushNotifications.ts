import { useEffect } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { supabase } from '../lib/supabase';
import BackgroundTaskManager from '../utils/backgroundTaskManager';

/**
 * Hook to initialize push notifications when user logs in
 */
export const usePushNotifications = () => {
  const { 
    initializePushNotifications, 
    disablePushNotifications, 
    pushNotificationsEnabled,
    pushToken,
    error 
  } = useNotificationStore();

  // Effect to handle auth state changes (non-async)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Just log the auth state change, don't perform async operations here
        console.log('Push notifications: Auth state changed:', event, !!session);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Separate effect to handle push notification initialization
  useEffect(() => {
    const initializePushNotificationsAsync = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user && !pushNotificationsEnabled) {
          console.log('Initializing push notifications for authenticated user');
          await initializePushNotifications();
          
          // Register background task
          const taskManager = BackgroundTaskManager.getInstance();
          await taskManager.registerBackgroundFetch();
          console.log('Push notifications and background tasks initialized');
        } else if (!user && pushNotificationsEnabled) {
          console.log('User signed out, disabling push notifications');
          await disablePushNotifications();
          
          // Unregister background task
          const taskManager = BackgroundTaskManager.getInstance();
          await taskManager.unregisterBackgroundFetch();
          console.log('Push notifications and background tasks disabled');
        }
      } catch (error) {
        console.error('Error managing push notifications:', error);
      }
    };

    // Run the initialization
    initializePushNotificationsAsync();
  }, [initializePushNotifications, disablePushNotifications, pushNotificationsEnabled]);

  return {
    pushNotificationsEnabled,
    pushToken,
    error,
    initializePushNotifications,
    disablePushNotifications,
  };
};
