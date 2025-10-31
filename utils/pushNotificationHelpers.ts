import PushNotificationService from './pushNotificationService';
import { supabase } from '../lib/supabase';

/**
 * Helper functions to send push notifications for different actions
 * These integrate with your existing notification creation helpers
 */

// Feature flag to enable/disable push notifications
const PUSH_NOTIFICATIONS_ENABLED = false;

export const sendPostLikePushNotification = async (
  recipientId: string,
  actorId: string,
  postId: string
) => {
  if (!PUSH_NOTIFICATIONS_ENABLED) {
    console.log('Push notifications are disabled - skipping post like notification');
    return;
  }
  
  try {
    // Get actor info
    const { data: actor } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', actorId)
      .single();

    // Get post info
    const { data: post } = await supabase
      .from('posts')
      .select('title, description')
      .eq('id', postId)
      .single();

    const pushService = PushNotificationService.getInstance();
    await pushService.queuePushNotification({
      type: 'post_like',
      recipientId,
      actorId,
      actorUsername: actor?.username,
      actorAvatarUrl: actor?.avatar_url,
      postId,
      postTitle: post?.title || post?.description?.substring(0, 50),
    });
  } catch (error) {
    console.error('Error sending post like push notification:', error);
  }
};

export const sendFollowPushNotification = async (
  recipientId: string,
  actorId: string
) => {
  if (!PUSH_NOTIFICATIONS_ENABLED) {
    console.log('Push notifications are disabled - skipping follow notification');
    return;
  }
  
  try {
    // Get actor info
    const { data: actor } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', actorId)
      .single();

    const pushService = PushNotificationService.getInstance();
    await pushService.queuePushNotification({
      type: 'follow',
      recipientId,
      actorId,
      actorUsername: actor?.username,
      actorAvatarUrl: actor?.avatar_url,
    });
  } catch (error) {
    console.error('Error sending follow push notification:', error);
  }
};

export const sendRoutineLikePushNotification = async (
  recipientId: string,
  actorId: string,
  routineId: string
) => {
  if (!PUSH_NOTIFICATIONS_ENABLED) {
    console.log('Push notifications are disabled - skipping routine like notification');
    return;
  }
  
  try {
    // Get actor info
    const { data: actor } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', actorId)
      .single();

    // Get routine info
    const { data: routine } = await supabase
      .from('routines')
      .select('name')
      .eq('id', routineId)
      .single();

    const pushService = PushNotificationService.getInstance();
    await pushService.queuePushNotification({
      type: 'routine_like',
      recipientId,
      actorId,
      actorUsername: actor?.username,
      actorAvatarUrl: actor?.avatar_url,
      routineId,
      routineName: routine?.name,
    });
  } catch (error) {
    console.error('Error sending routine like push notification:', error);
  }
};

export const sendRoutineSavePushNotification = async (
  recipientId: string,
  actorId: string,
  routineId: string
) => {
  if (!PUSH_NOTIFICATIONS_ENABLED) {
    console.log('Push notifications are disabled - skipping routine save notification');
    return;
  }
  
  try {
    // Get actor info
    const { data: actor } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', actorId)
      .single();

    // Get routine info
    const { data: routine } = await supabase
      .from('routines')
      .select('name')
      .eq('id', routineId)
      .single();

    const pushService = PushNotificationService.getInstance();
    await pushService.queuePushNotification({
      type: 'routine_save',
      recipientId,
      actorId,
      actorUsername: actor?.username,
      actorAvatarUrl: actor?.avatar_url,
      routineId,
      routineName: routine?.name,
    });
  } catch (error) {
    console.error('Error sending routine save push notification:', error);
  }
};

export const sendCommentLikePushNotification = async (
  recipientId: string,
  actorId: string,
  commentId: string
) => {
  if (!PUSH_NOTIFICATIONS_ENABLED) {
    console.log('Push notifications are disabled - skipping comment like notification');
    return;
  }
  
  try {
    // Get actor info
    const { data: actor } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', actorId)
      .single();

    // Get comment info to find the associated post
    const { data: comment } = await supabase
      .from('comments')
      .select('post_id')
      .eq('id', commentId)
      .single();

    const pushService = PushNotificationService.getInstance();
    await pushService.queuePushNotification({
      type: 'comment_like',
      recipientId,
      actorId,
      actorUsername: actor?.username,
      actorAvatarUrl: actor?.avatar_url,
      commentId,
      postId: comment?.post_id, // Include postId for navigation
    });
  } catch (error) {
    console.error('Error sending comment like push notification:', error);
  }
};

export const sendCommentReplyPushNotification = async (
  recipientId: string,
  actorId: string,
  commentId: string
) => {
  if (!PUSH_NOTIFICATIONS_ENABLED) {
    console.log('Push notifications are disabled - skipping comment reply notification');
    return;
  }
  
  try {
    // Get actor info
    const { data: actor } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', actorId)
      .single();

    // Get comment info to find the associated post
    const { data: comment } = await supabase
      .from('comments')
      .select('post_id')
      .eq('id', commentId)
      .single();

    const pushService = PushNotificationService.getInstance();
    await pushService.queuePushNotification({
      type: 'comment_reply',
      recipientId,
      actorId,
      actorUsername: actor?.username,
      actorAvatarUrl: actor?.avatar_url,
      commentId,
      postId: comment?.post_id, // Include postId for navigation
    });
  } catch (error) {
    console.error('Error sending comment reply push notification:', error);
  }
};

export const sendPostCommentPushNotification = async (
  recipientId: string,
  actorId: string,
  postId: string,
  commentId: string
) => {
  if (!PUSH_NOTIFICATIONS_ENABLED) {
    console.log('Push notifications are disabled - skipping post comment notification');
    return;
  }
  
  try {
    // Get actor info
    const { data: actor } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', actorId)
      .single();

    // Get post info
    const { data: post } = await supabase
      .from('posts')
      .select('title, description')
      .eq('id', postId)
      .single();

    const pushService = PushNotificationService.getInstance();
    await pushService.queuePushNotification({
      type: 'post_comment',
      recipientId,
      actorId,
      actorUsername: actor?.username,
      actorAvatarUrl: actor?.avatar_url,
      postId,
      commentId,
      postTitle: post?.title || post?.description?.substring(0, 50),
    });
  } catch (error) {
    console.error('Error sending post comment push notification:', error);
  }
};
