import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import PushNotificationService from '../utils/pushNotificationService';

export type NotificationType = 
  | 'post_like'
  | 'follow'
  | 'routine_like'
  | 'routine_save'
  | 'comment_like'
  | 'comment_reply'
  | 'post_comment';

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: NotificationType;
  post_id?: string;
  routine_id?: string;
  comment_id?: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  updated_at: string;
  
  // Joined data
  actor?: {
    id: string;
    username: string;
    avatar_url?: string;
    full_name?: string;
  };
  post?: {
    id: string;
    title?: string;
    description?: string;
    media?: {
      id: string;
      storage_path: string;
      media_type: string;
      width?: number;
      height?: number;
      duration?: number;
      order_index: number;
    }[];
  };
  routine?: {
    id: string;
    name: string;
    description?: string;
  };
  comment?: {
    id: string;
    text: string;
  };
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  
  // Push notification state
  pushToken: string | null;
  pushNotificationsEnabled: boolean;
  
  // Actions
  fetchNotifications: (userId?: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId?: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAllNotifications: (userId?: string) => Promise<void>;
  createNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'updated_at' | 'read'>) => Promise<void>;
  
  // Push notification actions
  initializePushNotifications: () => Promise<void>;
  disablePushNotifications: () => Promise<void>;
  
  // Real-time subscription
  subscribeToNotifications: (userId: string) => () => void;
  
  // Helper methods
  getUnreadCount: () => number;
  getNotificationsByType: (type: NotificationType) => Notification[];
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  pushToken: null,
  pushNotificationsEnabled: false,

  fetchNotifications: async (userId?: string) => {
    try {
      set({ loading: true, error: null });

      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;

      if (!targetUserId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:actor_id (
            id,
            username,
            avatar_url,
            name
          ),
          post:post_id (
            id,
            title,
            description,
            media:post_media (
              id,
              storage_path,
              media_type,
              width,
              height,
              duration,
              order_index
            )
          ),
          routine:routine_id (
            id,
            name
          ),
          comment:comment_id (
            id,
            text
          )
        `)
        .eq('recipient_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      const notifications = data || [];
      const unreadCount = notifications.filter(n => !n.read).length;

      set({ 
        notifications,
        unreadCount,
        loading: false 
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      set({ 
        error: error.message || 'Failed to fetch notifications',
        loading: false 
      });
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        throw error;
      }

      // Update local state
      set(state => ({
        notifications: state.notifications.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      set({ error: error.message || 'Failed to mark notification as read' });
    }
  },

  markAllAsRead: async (userId?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;

      if (!targetUserId) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('recipient_id', targetUserId)
        .eq('read', false);

      if (error) {
        throw error;
      }

      // Update local state
      set(state => ({
        notifications: state.notifications.map(notification => ({
          ...notification,
          read: true
        })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      set({ error: error.message || 'Failed to mark all notifications as read' });
    }
  },

  deleteNotification: async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        throw error;
      }

      // Update local state
      set(state => {
        const notificationToDelete = state.notifications.find(n => n.id === notificationId);
        const wasUnread = notificationToDelete && !notificationToDelete.read;
        
        return {
          notifications: state.notifications.filter(n => n.id !== notificationId),
          unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
        };
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      set({ error: error.message || 'Failed to delete notification' });
    }
  },

  clearAllNotifications: async (userId?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;

      if (!targetUserId) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('recipient_id', targetUserId);

      if (error) {
        throw error;
      }

      set({ 
        notifications: [],
        unreadCount: 0 
      });
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      set({ error: error.message || 'Failed to clear all notifications' });
    }
  },

  createNotification: async (notification: Omit<Notification, 'id' | 'created_at' | 'updated_at' | 'read'>) => {
    try {
      const { data, error } = await supabase.rpc('create_notification', {
        p_recipient_id: notification.recipient_id,
        p_actor_id: notification.actor_id,
        p_type: notification.type,
        p_post_id: notification.post_id || null,
        p_routine_id: notification.routine_id || null,
        p_comment_id: notification.comment_id || null,
        p_title: notification.title || null,
        p_message: notification.message || null
      });

      if (error) {
        throw error;
      }

      // Optionally refresh notifications for the recipient
      // This could be optimized to just add the new notification to the local state
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id === notification.recipient_id) {
        get().fetchNotifications();
      }
    } catch (error) {
      console.error('Error creating notification:', error);
      set({ error: error.message || 'Failed to create notification' });
    }
  },

  subscribeToNotifications: (userId: string) => {
    const subscription = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        async (payload) => {      
          if (payload.eventType === 'INSERT') {
            // For new notifications, fetch the complete data with joins
            try {
              const { data, error } = await supabase
                .from('notifications')
                .select(`
                  *,
                  actor:actor_id (
                    id,
                    username,
                    avatar_url,
                    name
                  ),
                  post:post_id (
                    id,
                    title,
                    description,
                    media:post_media (
                      id,
                      storage_path,
                      media_type,
                      width,
                      height,
                      duration,
                      order_index
                    )
                  ),
                  routine:routine_id (
                    id,
                    name
                  ),
                  comment:comment_id (
                    id,
                    text
                  )
                `)
                .eq('id', payload.new.id)
                .single();

              if (!error && data) {
                // Add the complete notification to the top of the list
                set(state => ({
                  notifications: [data, ...state.notifications],
                  unreadCount: state.unreadCount + 1
                }));
              }
            } catch (error) {
              console.error('Error fetching new notification details:', error);
              // Fallback to just adding the raw notification
              const newNotification = payload.new as Notification;
              set(state => ({
                notifications: [newNotification, ...state.notifications],
                unreadCount: state.unreadCount + 1
              }));
            }
          } else if (payload.eventType === 'UPDATE') {
            // For updates, we can just update the existing notification
            const updatedNotification = payload.new as Notification;
            set(state => {
              const prev = state.notifications.find(n => n.id === updatedNotification.id);
              const readChanged = prev?.read !== updatedNotification.read;
              const unreadDelta = readChanged ? (updatedNotification.read ? -1 : 1) : 0;
              return {
                notifications: state.notifications.map(n =>
                  n.id === updatedNotification.id ? { ...n, ...updatedNotification } : n
                ),
                unreadCount: Math.max(0, state.unreadCount + unreadDelta),
              };
            });
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted notification
            const deletedId = payload.old.id;
            set(state => {
              const deletedNotification = state.notifications.find(n => n.id === deletedId);
              const wasUnread = deletedNotification && !deletedNotification.read;
              
              return {
                notifications: state.notifications.filter(n => n.id !== deletedId),
                unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
              };
            });
          }
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
    };
  },

  getUnreadCount: () => {
    return get().unreadCount;
  },

  getNotificationsByType: (type: NotificationType) => {
    return get().notifications.filter(n => n.type === type);
  },

  initializePushNotifications: async () => {
    try {
      const pushService = PushNotificationService.getInstance();
      
      // Set up notification listeners
      pushService.setupNotificationListeners();
      
      // Register for push notifications
      const token = await pushService.registerForPushNotifications();
      
      if (token) {
        set({ 
          pushToken: token, 
          pushNotificationsEnabled: true,
          error: null 
        });
      } else {
        set({ 
          pushNotificationsEnabled: false,
          error: 'Failed to register for push notifications' 
        });
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      set({ 
        pushNotificationsEnabled: false,
        error: error.message || 'Failed to initialize push notifications' 
      });
    }
  },

  disablePushNotifications: async () => {
    try {
      const pushService = PushNotificationService.getInstance();
      await pushService.removePushToken();
      
      set({ 
        pushToken: null, 
        pushNotificationsEnabled: false,
        error: null 
      });
    } catch (error) {
      console.error('Error disabling push notifications:', error);
      set({ 
        error: error.message || 'Failed to disable push notifications' 
      });
    }
  },
}));

// Helper functions for creating notifications
import {
  sendPostLikePushNotification,
  sendFollowPushNotification,
  sendRoutineLikePushNotification,
  sendRoutineSavePushNotification,
  sendCommentLikePushNotification,
  sendCommentReplyPushNotification,
  sendPostCommentPushNotification,
} from '../utils/pushNotificationHelpers';

export const createPostLikeNotification = async (
  recipientId: string,
  actorId: string,
  postId: string
) => {
  const store = useNotificationStore.getState();
  await store.createNotification({
    recipient_id: recipientId,
    actor_id: actorId,
    type: 'post_like',
    post_id: postId,
    title: '',
    message: ''
  });
  
  // Send push notification
  await sendPostLikePushNotification(recipientId, actorId, postId);
};

export const createFollowNotification = async (
  recipientId: string,
  actorId: string
) => {
  const store = useNotificationStore.getState();
  await store.createNotification({
    recipient_id: recipientId,
    actor_id: actorId,
    type: 'follow',
    title: '',
    message: ''
  });
  
  // Send push notification
  await sendFollowPushNotification(recipientId, actorId);
};

export const createRoutineLikeNotification = async (
  recipientId: string,
  actorId: string,
  routineId: string
) => {
  const store = useNotificationStore.getState();
  await store.createNotification({
    recipient_id: recipientId,
    actor_id: actorId,
    type: 'routine_like',
    routine_id: routineId,
    title: '',
    message: ''
  });
  
  // Send push notification
  await sendRoutineLikePushNotification(recipientId, actorId, routineId);
};

export const createRoutineSaveNotification = async (
  recipientId: string,
  actorId: string,
  routineId: string
) => {
  const store = useNotificationStore.getState();
  await store.createNotification({
    recipient_id: recipientId,
    actor_id: actorId,
    type: 'routine_save',
    routine_id: routineId,
    title: '',
    message: ''
  });
  
  // Send push notification
  await sendRoutineSavePushNotification(recipientId, actorId, routineId);
};

export const createCommentLikeNotification = async (
  recipientId: string,
  actorId: string,
  commentId: string
) => {
  const store = useNotificationStore.getState();
  await store.createNotification({
    recipient_id: recipientId,
    actor_id: actorId,
    type: 'comment_like',
    comment_id: commentId,
    title: '',
    message: ''
  });
  
  // Send push notification
  await sendCommentLikePushNotification(recipientId, actorId, commentId);
};

export const createCommentReplyNotification = async (
  recipientId: string,
  actorId: string,
  commentId: string
) => {
  const store = useNotificationStore.getState();
  await store.createNotification({
    recipient_id: recipientId,
    actor_id: actorId,
    type: 'comment_reply',
    comment_id: commentId,
    title: '',
    message: ''
  });
  
  // Send push notification
  await sendCommentReplyPushNotification(recipientId, actorId, commentId);
};

export const createPostCommentNotification = async (
  recipientId: string,
  actorId: string,
  postId: string,
  commentId: string
) => {
  const store = useNotificationStore.getState();
  await store.createNotification({
    recipient_id: recipientId,
    actor_id: actorId,
    type: 'post_comment',
    post_id: postId,
    comment_id: commentId,
    title: '',
    message: ''
  });
  
  // Send push notification
  await sendPostCommentPushNotification(recipientId, actorId, postId, commentId);
};
