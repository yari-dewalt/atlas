import PushNotificationService from './pushNotificationService';
import { supabase } from '../lib/supabase';
import {
  sendPostLikePushNotification,
  sendFollowPushNotification,
  sendRoutineLikePushNotification,
  sendRoutineSavePushNotification,
  sendCommentLikePushNotification,
  sendCommentReplyPushNotification,
  sendPostCommentPushNotification,
} from './pushNotificationHelpers';

/**
 * Test utilities for push notifications
 * Use these functions to test your push notification system
 */

export const testPushNotifications = {
  /**
   * Test a post like notification
   */
  async testPostLike(recipientId: string, actorId: string, postId: string) {
    console.log('Testing post like notification...');
    await sendPostLikePushNotification(recipientId, actorId, postId);
    console.log('Post like notification queued');
  },

  /**
   * Test a follow notification
   */
  async testFollow(recipientId: string, actorId: string) {
    console.log('Testing follow notification...');
    await sendFollowPushNotification(recipientId, actorId);
    console.log('Follow notification queued');
  },

  /**
   * Test a routine like notification
   */
  async testRoutineLike(recipientId: string, actorId: string, routineId: string) {
    console.log('Testing routine like notification...');
    await sendRoutineLikePushNotification(recipientId, actorId, routineId);
    console.log('Routine like notification queued');
  },

  /**
   * Test a routine save notification
   */
  async testRoutineSave(recipientId: string, actorId: string, routineId: string) {
    console.log('Testing routine save notification...');
    await sendRoutineSavePushNotification(recipientId, actorId, routineId);
    console.log('Routine save notification queued');
  },

  /**
   * Test a comment like notification
   */
  async testCommentLike(recipientId: string, actorId: string, commentId: string) {
    console.log('Testing comment like notification...');
    await sendCommentLikePushNotification(recipientId, actorId, commentId);
    console.log('Comment like notification queued');
  },

  /**
   * Test a comment reply notification
   */
  async testCommentReply(recipientId: string, actorId: string, commentId: string) {
    console.log('Testing comment reply notification...');
    await sendCommentReplyPushNotification(recipientId, actorId, commentId);
    console.log('Comment reply notification queued');
  },

  /**
   * Test a post comment notification
   */
  async testPostComment(recipientId: string, actorId: string, postId: string, commentId: string) {
    console.log('Testing post comment notification...');
    await sendPostCommentPushNotification(recipientId, actorId, postId, commentId);
    console.log('Post comment notification queued');
  },

  /**
   * Process all queued notifications immediately (for testing)
   */
  async processQueue() {
    console.log('Processing notification queue...');
    const pushService = PushNotificationService.getInstance();
    await pushService.processQueuedNotifications();
    console.log('Queue processed');
  },

  /**
   * Test multiple notifications to see batching in action
   */
  async testBatching(recipientId: string, actorIds: string[], postId: string) {
    console.log('Testing notification batching...');
    
    // Send multiple like notifications rapidly
    for (const actorId of actorIds) {
      await sendPostLikePushNotification(recipientId, actorId, postId);
      // Small delay to simulate real-world timing
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Queued ${actorIds.length} like notifications for batching`);
    console.log('Wait 30 seconds then call processQueue() to see batched result');
  },

  /**
   * Test duplicate prevention - send same notification multiple times rapidly
   */
  async testDuplicatePrevention(recipientId: string, actorId: string, postId: string) {
    console.log('Testing duplicate prevention...');
    console.log('Sending 5 identical post like notifications rapidly...');
    
    // Send the same notification 5 times rapidly
    for (let i = 0; i < 5; i++) {
      await sendPostLikePushNotification(recipientId, actorId, postId);
      console.log(`Sent notification ${i + 1}/5`);
      await new Promise(resolve => setTimeout(resolve, 50)); // Very small delay
    }
    
    console.log('All notifications queued. Check database - should only have 1 notification.');
    console.log('Run processQueue() after 5 seconds to send it.');
  },

  /**
   * Test fast delivery (5 second batching)
   */
  async testFastDelivery(recipientId: string, actorId: string, postId: string) {
    console.log('Testing fast delivery...');
    await sendPostLikePushNotification(recipientId, actorId, postId);
    console.log('Notification queued. It should be sent automatically in ~5 seconds.');
    
    // Set up a timer to show when it should be sent
    setTimeout(() => {
      console.log('⏰ Notification should be sent around now (5 seconds elapsed)');
    }, 5000);
  },

  /**
   * Get current user ID for easy testing
   */
  async getCurrentUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log(`Current user ID: ${user.id}`);
      return user.id;
    } else {
      console.log('No user logged in');
      return null;
    }
  },

  /**
   * View pending notifications for debugging
   */
  async viewPendingNotifications(userId?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      console.log('No user ID provided and no user logged in');
      return;
    }

    const { data: notifications, error } = await supabase
      .from('push_notifications')
      .select('*')
      .eq('user_id', targetUserId)
      .is('sent_at', null)
      .is('failed_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    console.log(`Found ${notifications?.length || 0} pending notifications for user ${targetUserId}:`);
    notifications?.forEach((notif, index) => {
      console.log(`${index + 1}. ${notif.notification_type} - ${notif.batch_key} (${notif.created_at})`);
    });
  },

  /**
   * Clean up test data
   */
  async cleanup() {
    console.log('Cleaning up test notifications...');
    const pushService = PushNotificationService.getInstance();
    await pushService.cleanupOldNotifications();
    console.log('Cleanup complete');
  },

  /**
   * Clear all pending notifications for current user (emergency)
   */
  async clearMyPendingNotifications() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No user logged in');
      return;
    }

    const pushService = PushNotificationService.getInstance();
    await pushService.clearPendingNotifications(user.id);
    console.log('Cleared all pending notifications for current user');
  },
};

// Export for easy testing in development
if (__DEV__) {
  // Make test functions available globally in development
  (global as any).testPushNotifications = testPushNotifications;
  console.log('Push notification test utilities available as global.testPushNotifications');
}

export default testPushNotifications;
