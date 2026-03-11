import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Must use physical device for push notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '7c929c51-fee3-4a00-afa9-7c90f95cd9e7',
    });
    const token = tokenData.data;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
    }

    return token;
  } catch (error) {
    console.error('[Push] Error getting push token:', error);
    return null;
  }
}

export async function removePushToken(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update({ push_token: null }).eq('id', user.id);
  } catch (error) {
    console.error('[Push] Error removing push token:', error);
  }
}

export function setupNotificationHandlers(): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log('[Push] Notification received:', notification.request.content.title);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationTap(response.notification.request.content.data as Record<string, any>);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

export function handleNotificationTap(data: Record<string, any>): void {
  import('expo-router').then(({ router }) => {
    try {
      router.replace('/(app)/(tabs)/home');

      setTimeout(() => {
        switch (data.type) {
          case 'post_like':
            if (data.postId) {
              router.push(`/post/${data.postId}`);
              setTimeout(() => router.push(`/post/${data.postId}/likes`), 300);
            }
            break;
          case 'post_comment':
          case 'comment_like':
          case 'comment_reply':
            if (data.postId) {
              router.push(`/post/${data.postId}`);
              setTimeout(() => router.push(`/post/${data.postId}/comments`), 300);
            }
            break;
          case 'routine_like':
          case 'routine_save':
            if (data.routineId) {
              router.push(`/routine/${data.routineId}`);
            }
            break;
          case 'follow':
            if (data.actorId) {
              router.push(`/profile/${data.actorId}`);
            }
            break;
          case 'direct_message':
            router.push('/(app)/(tabs)/messages');
            break;
          default:
            console.log('[Push] Unknown notification type:', data.type);
        }
      }, 100);
    } catch (error) {
      console.error('[Push] Navigation error:', error);
    }
  }).catch((error) => {
    console.error('[Push] Error importing router:', error);
  });
}
