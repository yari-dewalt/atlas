import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';

export const pushNotificationTesting = {
  async scheduleLocalNotification(title: string, body: string, data?: object): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {}, sound: 'default' },
      trigger: null,
    });
  },

  async sendTestPushToSelf(type = 'post_like'): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();

    await supabase.functions.invoke('send-push-notification', {
      body: {
        type,
        recipientId: user.id,
        actorId: user.id,
        actorUsername: profile?.username ?? 'you',
        actorAvatarUrl: profile?.avatar_url,
        isTestToSelf: true,
      },
    });
  },

  async getCurrentPushToken(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', user.id)
      .single();

    return data?.push_token ?? null;
  },
};

if (__DEV__) {
  (global as any).pushTest = pushNotificationTesting;
}

export default pushNotificationTesting;
