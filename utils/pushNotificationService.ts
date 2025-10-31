import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure how notifications should be handled when the app is running
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationData {
  type: 'post_like' | 'follow' | 'routine_like' | 'routine_save' | 'comment_like' | 'comment_reply' | 'post_comment';
  recipientId: string;
  actorId: string;
  actorUsername?: string;
  actorAvatarUrl?: string;
  postId?: string;
  routineId?: string;
  commentId?: string;
  routineName?: string;
  postTitle?: string;
}

export interface BatchedNotificationContent {
  title: string;
  body: string;
  data: {
    type: string;
    recipientId: string;
    actors: Array<{
      id: string;
      username: string;
      avatarUrl?: string;
    }>;
    count: number;
    postId?: string;
    routineId?: string;
    commentId?: string;
  };
}

class PushNotificationService {
  private static instance: PushNotificationService;
  
  // Feature flag to enable/disable push notifications
  private static readonly PUSH_NOTIFICATIONS_ENABLED = false;
  
  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Register for push notifications and store token
   */
  async registerForPushNotifications(): Promise<string | null> {
    if (!PushNotificationService.PUSH_NOTIFICATIONS_ENABLED) {
      console.log('Push notifications are disabled');
      return null;
    }
    
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Ask for permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    try {
      // Get the push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '7c929c51-fee3-4a00-afa9-7c90f95cd9e7',
      });
      
      const token = tokenData.data;
      
      // Store token in user's profile
      await this.storePushToken(token);
      
      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  /**
   * Store push token in user's profile
   */
  private async storePushToken(token: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error storing push token:', error);
    }
  }

  /**
   * Remove push token (for logout)
   */
  async removePushToken(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ push_token: null })
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  }

  /**
   * Generate batch key for grouping similar notifications
   */
  private generateBatchKey(data: PushNotificationData): string {
    switch (data.type) {
      case 'post_like':
        return `post_like_${data.postId}`;
      case 'routine_like':
        return `routine_like_${data.routineId}`;
      case 'routine_save':
        return `routine_save_${data.routineId}`;
      case 'comment_like':
        return `comment_like_${data.commentId}`;
      case 'comment_reply':
        return `comment_reply_${data.commentId}`;
      case 'post_comment':
        return `post_comment_${data.postId}`;
      case 'follow':
        return `follow_${data.recipientId}`;
      default:
        return `${data.type}_${data.recipientId}`;
    }
  }

  /**
   * Create or update batched notification content
   */
  private createBatchedContent(
    type: string,
    actors: Array<{ id: string; username: string; avatarUrl?: string }>,
    count: number,
    additionalData?: any
  ): BatchedNotificationContent {
    const firstActor = actors[0];
    const hasMultipleActors = count > 1;

    let title = '';
    let body = '';

    switch (type) {
      case 'post_like':
        title = 'Atlas';
        if (hasMultipleActors) {
          body = `${firstActor.username} and ${count - 1} others liked your post`;
        } else {
          body = `${firstActor.username} liked your post`;
        }
        break;

      case 'routine_like':
        title = 'Atlas';
        if (hasMultipleActors) {
          body = `${firstActor.username} and ${count - 1} others liked your routine`;
        } else {
          body = `${firstActor.username} liked your routine`;
        }
        break;

      case 'routine_save':
        title = 'Atlas';
        if (hasMultipleActors) {
          body = `${firstActor.username} and ${count - 1} others saved your routine`;
        } else {
          body = `${firstActor.username} saved your routine`;
        }
        break;

      case 'comment_like':
        title = 'Atlas';
        if (hasMultipleActors) {
          body = `${firstActor.username} and ${count - 1} others liked your comment`;
        } else {
          body = `${firstActor.username} liked your comment`;
        }
        break;

      case 'comment_reply':
        title = 'Atlas';
        if (hasMultipleActors) {
          body = `${firstActor.username} and ${count - 1} others replied to your comment`;
        } else {
          body = `${firstActor.username} replied to your comment`;
        }
        break;

      case 'post_comment':
        title = 'Atlas';
        if (hasMultipleActors) {
          body = `${firstActor.username} and ${count - 1} others commented on your post`;
        } else {
          body = `${firstActor.username} commented on your post`;
        }
        break;

      case 'follow':
        title = 'Atlas';
        if (hasMultipleActors) {
          body = `${firstActor.username} and ${count - 1} others started following you`;
        } else {
          body = `${firstActor.username} started following you`;
        }
        break;

      default:
        title = 'Atlas';
        body = hasMultipleActors 
          ? `${firstActor.username} and ${count - 1} others interacted with your content`
          : `${firstActor.username} interacted with your content`;
    }

    return {
      title,
      body,
      data: {
        type,
        recipientId: additionalData?.recipientId || '',
        actors,
        count,
        ...additionalData,
      },
    };
  }

  /**
   * Queue a push notification (with batching and duplicate prevention)
   */
  async queuePushNotification(data: PushNotificationData): Promise<void> {
    if (!PushNotificationService.PUSH_NOTIFICATIONS_ENABLED) {
      console.log('Push notifications are disabled - skipping notification queue');
      return;
    }
    
    try {
      // Check if user has notifications enabled
      const notificationSettings = await this.getUserNotificationSettings(data.recipientId);
      if (!this.shouldSendNotification(data.type, notificationSettings)) {
        return;
      }

      // Generate batch key
      const batchKey = this.generateBatchKey(data);

      // Check if we already have a recent unsent notification for this exact event
      const { data: existingNotification, error: checkError } = await supabase
        .from('push_notifications')
        .select('id, created_at, content')
        .eq('user_id', data.recipientId)
        .eq('batch_key', batchKey)
        .is('sent_at', null)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Only check last 5 minutes
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing notifications:', checkError);
      }

      // If we found an existing notification, update it instead of creating a new one
      if (existingNotification) {
        console.log(`Updating existing notification for batch key: ${batchKey}`);
        
        // Use the RPC function to update with the new actor
        await supabase.rpc('create_or_update_push_notification', {
          p_user_id: data.recipientId,
          p_notification_type: data.type,
          p_content: this.createBatchedContent(
            data.type,
            [{
              id: data.actorId,
              username: data.actorUsername || 'Someone',
              avatarUrl: data.actorAvatarUrl,
            }],
            1,
            {
              recipientId: data.recipientId,
              postId: data.postId,
              routineId: data.routineId,
              commentId: data.commentId,
              routineName: data.routineName,
              postTitle: data.postTitle,
            }
          ),
          p_batch_key: batchKey,
          p_actor_id: data.actorId,
        });
        return;
      }

      // Create new notification
      const actor = {
        id: data.actorId,
        username: data.actorUsername || 'Someone',
        avatarUrl: data.actorAvatarUrl,
      };

      const baseContent = this.createBatchedContent(
        data.type,
        [actor],
        1,
        {
          recipientId: data.recipientId,
          postId: data.postId,
          routineId: data.routineId,
          commentId: data.commentId,
          routineName: data.routineName,
          postTitle: data.postTitle,
        }
      );

      // Store/update in database using the batching function
      await supabase.rpc('create_or_update_push_notification', {
        p_user_id: data.recipientId,
        p_notification_type: data.type,
        p_content: baseContent,
        p_batch_key: batchKey,
        p_actor_id: data.actorId,
      });

    } catch (error) {
      console.error('Error queueing push notification:', error);
    }
  }

  /**
   * Get user notification settings
   */
  private async getUserNotificationSettings(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Return default settings if none found
      return data || {
        follows: true,
        likes: true,
        comments: true,
        likes_on_comments: true,
        mentions_in_posts: true,
        mentions_in_comments: true,
        replies_on_comments: true,
      };
    } catch (error) {
      console.error('Error getting notification settings:', error);
      // Return conservative defaults on error
      return {
        follows: true,
        likes: true,
        comments: true,
        likes_on_comments: true,
        mentions_in_posts: true,
        mentions_in_comments: true,
        replies_on_comments: true,
      };
    }
  }

  /**
   * Check if notification should be sent based on user settings
   */
  private shouldSendNotification(type: string, settings: any): boolean {
    switch (type) {
      case 'follow':
        return settings.follows;
      case 'post_like':
      case 'routine_like':
        return settings.likes;
      case 'post_comment':
      case 'comment_reply':
        return settings.comments;
      case 'comment_like':
        return settings.likes_on_comments;
      case 'routine_save':
        return settings.likes; // Use likes setting for saves too
      default:
        return true;
    }
  }

  /**
   * Process and send queued notifications (should be called by background job)
   */
  async processQueuedNotifications(): Promise<void> {
    if (!PushNotificationService.PUSH_NOTIFICATIONS_ENABLED) {
      console.log('Push notifications are disabled - skipping notification processing');
      return;
    }
    
    try {
      // Get notifications that haven't been sent yet and are older than 5 seconds
      // (to allow for brief batching while keeping notifications fast)
      const { data: notifications, error } = await supabase
        .from('push_notifications')
        .select(`
          *,
          profiles!push_notifications_user_id_fkey (push_token)
        `)
        .is('sent_at', null)
        .is('failed_at', null) // Don't retry failed notifications automatically
        .lt('created_at', new Date(Date.now() - 5000).toISOString()) // 5 seconds ago
        .limit(50);

      if (error) throw error;

      for (const notification of notifications || []) {
        await this.sendSingleNotification(notification);
      }
    } catch (error) {
      console.error('Error processing queued notifications:', error);
    }
  }

  /**
   * Send a single notification
   */
  private async sendSingleNotification(notification: any): Promise<void> {
    try {
      // Double-check that this notification hasn't been sent already (race condition protection)
      const { data: currentNotification, error: checkError } = await supabase
        .from('push_notifications')
        .select('sent_at, failed_at')
        .eq('id', notification.id)
        .single();

      if (checkError || currentNotification?.sent_at || currentNotification?.failed_at) {
        console.log(`Notification ${notification.id} already processed, skipping`);
        return;
      }

      const pushToken = notification.profiles?.push_token;
      
      if (!pushToken) {
        // Mark as failed - no push token
        await supabase
          .from('push_notifications')
          .update({
            failed_at: new Date().toISOString(),
            error_message: 'No push token available',
          })
          .eq('id', notification.id)
          .is('sent_at', null) // Only update if not already sent
          .is('failed_at', null); // Only update if not already failed
        return;
      }

      // Mark as being processed to prevent duplicate sends
      const { error: processingError } = await supabase
        .from('push_notifications')
        .update({ 
          updated_at: new Date().toISOString() // Use updated_at as a processing lock
        })
        .eq('id', notification.id)
        .is('sent_at', null)
        .is('failed_at', null);

      if (processingError) {
        console.log(`Failed to lock notification ${notification.id} for processing`);
        return;
      }

      // Send the notification
      const message = {
        to: pushToken,
        sound: 'default',
        title: notification.content.title,
        body: notification.content.body,
        data: {
          ...notification.content.data,
          notificationId: notification.id, // Include notification ID for tracking
        },
        badge: await this.getUnreadCount(notification.user_id),
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();

      if (result.data?.status === 'ok') {
        // Mark as sent successfully
        await supabase
          .from('push_notifications')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', notification.id)
          .is('sent_at', null); // Only update if not already sent
      } else {
        // Mark as failed
        await supabase
          .from('push_notifications')
          .update({
            failed_at: new Date().toISOString(),
            error_message: result.data?.message || 'Unknown error',
          })
          .eq('id', notification.id)
          .is('sent_at', null) // Only update if not already sent
          .is('failed_at', null); // Only update if not already failed
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      
      // Mark as failed
      await supabase
        .from('push_notifications')
        .update({
          failed_at: new Date().toISOString(),
          error_message: error.message || 'Unknown error',
        })
        .eq('id', notification.id)
        .is('sent_at', null) // Only update if not already sent
        .is('failed_at', null); // Only update if not already failed
    }
  }

  /**
   * Get unread notification count for badge
   */
  private async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Handle notification response (when user taps notification)
   * 
   * Navigation Flow:
   * 1. First navigates to home route to ensure proper app state
   * 2. Then navigates to the specific content based on notification type:
   *    - post_like -> /post/[postId] then /post/[postId]/likes
   *    - post_comment/comment_like/comment_reply -> /post/[postId] then /post/[postId]/comments
   *    - routine_like/routine_save -> /routine/[routineId]  
   *    - follow -> /profile/[userId] (first actor's profile for batched notifications)
   * 
   * The two-step navigation for posts ensures proper back navigation flow.
   */
  handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data;
    
    console.log('Notification tapped:', data);
    
    // Mark as clicked in database
    if (data.notificationId) {
      supabase
        .from('push_notifications')
        .update({ clicked_at: new Date().toISOString() })
        .eq('id', data.notificationId)
        .then(({ error }) => {
          if (error) console.error('Error marking notification as clicked:', error);
        });
    }

    // Handle navigation based on notification type
    this.navigateFromNotification(data);
  }

  /**
   * Navigate to appropriate screen based on notification data
   */
  private navigateFromNotification(data: any): void {
    // Import router dynamically to avoid circular dependencies
    import('expo-router').then(({ router }) => {
      try {
        // First, ensure we're on the home route
        router.replace('/(app)/(tabs)/home');
        
        // Small delay to ensure home route is loaded before navigating
        setTimeout(() => {
          switch (data.type) {
            case 'post_like':
              if (data.postId) {
                // First navigate to the post, then to likes
                router.push(`/post/${data.postId}`);
                setTimeout(() => {
                  router.push(`/post/${data.postId}/likes`);
                }, 300);
              }
              break;
              
            case 'post_comment':
            case 'comment_like':
            case 'comment_reply':
              if (data.postId) {
                // First navigate to the post, then to comments
                router.push(`/post/${data.postId}`);
                setTimeout(() => {
                  router.push(`/post/${data.postId}/comments`);
                }, 300);
              }
              break;
              
            case 'routine_like':
            case 'routine_save':
              if (data.routineId) {
                router.push(`/routine/${data.routineId}`);
              }
              break;
              
            case 'follow':
              // Navigate to the actor's profile
              // For batched follow notifications, navigate to the first actor
              if (data.actors && data.actors.length > 0) {
                router.push(`/profile/${data.actors[0].id}`);
              }
              break;
              
            default:
              console.log('Unknown notification type for navigation:', data.type);
              break;
          }
        }, 100); // 100ms delay to ensure smooth navigation
        
      } catch (error) {
        console.error('Error navigating from notification:', error);
      }
    }).catch((error) => {
      console.error('Error importing router for notification navigation:', error);
    });
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners(): void {
    // Handle notifications when app is foregrounded
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    // Handle notification responses (when user taps notification)
    Notifications.addNotificationResponseReceivedListener((response) => {
      this.handleNotificationResponse(response);
    });
  }

  /**
   * Clean up old notifications and prevent stale duplicates (should be called periodically)
   */
  async cleanupOldNotifications(): Promise<void> {
    try {
      // Delete push notifications older than 30 days
      await supabase
        .from('push_notifications')
        .delete()
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Mark very old unsent notifications as failed to prevent them from being processed
      // (notifications older than 1 hour that are still unsent are likely stale)
      await supabase
        .from('push_notifications')
        .update({
          failed_at: new Date().toISOString(),
          error_message: 'Notification expired - too old to send',
        })
        .is('sent_at', null)
        .is('failed_at', null)
        .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // 1 hour ago

    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  }

  /**
   * Emergency method to clear all pending notifications for a user (use carefully)
   */
  async clearPendingNotifications(userId: string): Promise<void> {
    try {
      await supabase
        .from('push_notifications')
        .update({
          failed_at: new Date().toISOString(),
          error_message: 'Cleared by admin',
        })
        .eq('user_id', userId)
        .is('sent_at', null)
        .is('failed_at', null);
    } catch (error) {
      console.error('Error clearing pending notifications:', error);
    }
  }
}

export default PushNotificationService;
