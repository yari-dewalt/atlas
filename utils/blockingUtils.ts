import { supabase } from '../lib/supabase';

/**
 * Block a user
 */
export async function blockUser(blockedUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('block_user', {
      p_blocked_id: blockedUserId
    });

    if (error) {
      console.error('Error blocking user:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error blocking user:', error);
    return { success: false, error: 'Failed to block user' };
  }
}

/**
 * Unblock a user
 */
export async function unblockUser(blockedUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('unblock_user', {
      p_blocked_id: blockedUserId
    });

    if (error) {
      console.error('Error unblocking user:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error unblocking user:', error);
    return { success: false, error: 'Failed to unblock user' };
  }
}

/**
 * Check if a user is blocked
 */
export async function checkIfUserBlocked(userId: string, blockedUserId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_user_blocked', {
      p_user_id: userId,
      p_blocked_id: blockedUserId
    });

    if (error) {
      console.error('Error checking block status:', error);
      return false;
    }

    return data || false;
  } catch (error) {
    console.error('Error checking block status:', error);
    return false;
  }
}

/**
 * Get list of blocked users for current user
 */
export async function getBlockedUsers(): Promise<{ data: any[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('user_blocks')
      .select(`
        id,
        blocked_id,
        created_at,
        profiles:blocked_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blocked users:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [] };
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    return { data: [], error: 'Failed to fetch blocked users' };
  }
}

/**
 * Check if current user has blocked a specific user
 */
export async function isUserBlockedByMe(userId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', userId)
      .limit(1);

    if (error) {
      console.error('Error checking if user is blocked:', error);
      return false;
    }

    return (data && data.length > 0) || false;
  } catch (error) {
    console.error('Error checking if user is blocked:', error);
    return false;
  }
}
