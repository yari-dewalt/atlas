import { useEffect } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { supabase } from '../lib/supabase';
import { setupNotificationHandlers } from '../utils/pushNotificationService';

export function usePushNotifications() {
  const { pushToken, pushNotificationsEnabled, initializePushNotifications } = useNotificationStore();

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await initializePushNotifications();
      cleanup = setupNotificationHandlers();
    })();

    return () => cleanup?.();
  }, []);

  return { pushToken, pushNotificationsEnabled };
}
