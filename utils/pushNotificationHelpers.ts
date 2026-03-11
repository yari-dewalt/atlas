import { supabase } from '../lib/supabase';

interface PushPayload {
  type: string;
  recipientId: string;
  actorId: string;
  actorUsername: string;
  actorAvatarUrl?: string;
  postId?: string;
  routineId?: string;
  commentId?: string;
  conversationId?: string;
  isTestToSelf?: boolean;
}

async function sendPushNotification(payload: PushPayload): Promise<void> {
  try {
    await supabase.functions.invoke('send-push-notification', { body: payload });
  } catch (error) {
    console.warn('[Push] Non-critical push error:', error);
  }
}

async function getActorInfo(actorId: string): Promise<{ username: string; avatar_url?: string }> {
  const { data } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', actorId)
    .single();
  return { username: data?.username ?? 'someone', avatar_url: data?.avatar_url };
}

export const sendPostLikePushNotification = async (
  recipientId: string,
  actorId: string,
  postId: string
): Promise<void> => {
  try {
    const actor = await getActorInfo(actorId);
    await sendPushNotification({
      type: 'post_like',
      recipientId,
      actorId,
      actorUsername: actor.username,
      actorAvatarUrl: actor.avatar_url,
      postId,
    });
  } catch (error) {
    console.warn('[Push] sendPostLikePushNotification error:', error);
  }
};

export const sendFollowPushNotification = async (
  recipientId: string,
  actorId: string
): Promise<void> => {
  try {
    const actor = await getActorInfo(actorId);
    await sendPushNotification({
      type: 'follow',
      recipientId,
      actorId,
      actorUsername: actor.username,
      actorAvatarUrl: actor.avatar_url,
    });
  } catch (error) {
    console.warn('[Push] sendFollowPushNotification error:', error);
  }
};

export const sendRoutineLikePushNotification = async (
  recipientId: string,
  actorId: string,
  routineId: string
): Promise<void> => {
  try {
    const actor = await getActorInfo(actorId);
    await sendPushNotification({
      type: 'routine_like',
      recipientId,
      actorId,
      actorUsername: actor.username,
      actorAvatarUrl: actor.avatar_url,
      routineId,
    });
  } catch (error) {
    console.warn('[Push] sendRoutineLikePushNotification error:', error);
  }
};

export const sendRoutineSavePushNotification = async (
  recipientId: string,
  actorId: string,
  routineId: string
): Promise<void> => {
  try {
    const actor = await getActorInfo(actorId);
    await sendPushNotification({
      type: 'routine_save',
      recipientId,
      actorId,
      actorUsername: actor.username,
      actorAvatarUrl: actor.avatar_url,
      routineId,
    });
  } catch (error) {
    console.warn('[Push] sendRoutineSavePushNotification error:', error);
  }
};

export const sendCommentLikePushNotification = async (
  recipientId: string,
  actorId: string,
  commentId: string,
  postId: string
): Promise<void> => {
  try {
    const actor = await getActorInfo(actorId);
    await sendPushNotification({
      type: 'comment_like',
      recipientId,
      actorId,
      actorUsername: actor.username,
      actorAvatarUrl: actor.avatar_url,
      commentId,
      postId,
    });
  } catch (error) {
    console.warn('[Push] sendCommentLikePushNotification error:', error);
  }
};

export const sendCommentReplyPushNotification = async (
  recipientId: string,
  actorId: string,
  commentId: string,
  postId: string
): Promise<void> => {
  try {
    const actor = await getActorInfo(actorId);
    await sendPushNotification({
      type: 'comment_reply',
      recipientId,
      actorId,
      actorUsername: actor.username,
      actorAvatarUrl: actor.avatar_url,
      commentId,
      postId,
    });
  } catch (error) {
    console.warn('[Push] sendCommentReplyPushNotification error:', error);
  }
};

export const sendPostCommentPushNotification = async (
  recipientId: string,
  actorId: string,
  postId: string,
  commentId: string
): Promise<void> => {
  try {
    const actor = await getActorInfo(actorId);
    await sendPushNotification({
      type: 'post_comment',
      recipientId,
      actorId,
      actorUsername: actor.username,
      actorAvatarUrl: actor.avatar_url,
      postId,
      commentId,
    });
  } catch (error) {
    console.warn('[Push] sendPostCommentPushNotification error:', error);
  }
};

export const sendDirectMessagePushNotification = async (
  recipientId: string,
  actorId: string,
  conversationId: string
): Promise<void> => {
  try {
    const actor = await getActorInfo(actorId);
    await sendPushNotification({
      type: 'direct_message',
      recipientId,
      actorId,
      actorUsername: actor.username,
      actorAvatarUrl: actor.avatar_url,
      conversationId,
    });
  } catch (error) {
    console.warn('[Push] sendDirectMessagePushNotification error:', error);
  }
};
