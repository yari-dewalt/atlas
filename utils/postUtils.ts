import { supabase } from "../lib/supabase";
import { 
  createPostLikeNotification, 
  createCommentLikeNotification,
  createPostCommentNotification,
  createCommentReplyNotification 
} from "../stores/notificationStore";

export async function deletePost(postId: string, userId: string): Promise<void> {
  try {
    // Check if user has permission to delete this post
    const { data: post, error: checkError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();
    
    if (checkError) throw checkError;
    
    if (post.user_id !== userId) {
      throw new Error('You can only delete your own posts');
    }
    
    // First delete associated media from storage
    const { data: mediaItems, error: mediaFetchError } = await supabase
      .from('post_media')
      .select('storage_path')
      .eq('post_id', postId);
    
    if (mediaFetchError) throw mediaFetchError;
    
    // Delete each media file from storage
    for (const item of mediaItems || []) {
      if (item.storage_path) {
        const storagePath = item.storage_path.replace(/^.*\/user-content\//, '');
        const { error: storageError } = await supabase.storage
          .from('user-content')
          .remove([storagePath]);
          
        if (storageError) {
          console.error('Error deleting media from storage:', storageError);
          // Continue with deletion even if some files can't be removed
        }
      }
    }
    
    // Delete the post (cascade delete should handle related records)
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);
    
    if (deleteError) throw deleteError;
    
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
}

export async function updatePost(
  postId: string, 
  userId: string, 
  description: string,
  exercises?: any[],  // Add exercises parameter
  mediaToDelete?: string[]  // IDs of media to delete
): Promise<void> {
  try {
    // Check if user has permission to edit this post
    const { data: post, error: checkError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();
    
    if (checkError) throw checkError;
    
    if (post.user_id !== userId) {
      throw new Error('You can only edit your own posts');
    }
    
    // Update the post description
    const { error: updateError } = await supabase
      .from('posts')
      .update({ description: description })
      .eq('id', postId);
    
    if (updateError) throw updateError;
    
    // Handle exercise updates if provided
    if (exercises) {
      // First, get existing exercises to identify which ones to delete
      const { data: existingExercises, error: exercisesError } = await supabase
        .from('post_exercises')
        .select('id')
        .eq('post_id', postId);
      
      if (exercisesError) throw exercisesError;
      
      // Create a map of existing exercise IDs
      const existingIds = new Set(existingExercises.map(ex => ex.id));
      const updatedIds = new Set(exercises.filter(ex => ex.id && !ex.isNew).map(ex => ex.id));
      
      // Find IDs to delete (those in existing but not in updated)
      const idsToDelete = Array.from(existingIds).filter(id => !updatedIds.has(id as string));
      
      // Delete exercises that are removed
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('post_exercises')
          .delete()
          .in('id', idsToDelete);
        
        if (deleteError) throw deleteError;
      }
      
      // Update or insert exercises
      for (const exercise of exercises) {
        const exerciseData = {
          post_id: postId,
          name: exercise.name,
          sets: parseInt(exercise.sets) || null,
          reps: parseInt(exercise.reps) || null,
          weight: parseFloat(exercise.weight) || null,
          weight_unit: exercise.weightUnit || 'lbs',
          notes: exercise.notes || null
        };
        
        if (exercise.id && !exercise.isNew) {
          // Update existing exercise
          const { error: updateExError } = await supabase
            .from('post_exercises')
            .update(exerciseData)
            .eq('id', exercise.id);
          
          if (updateExError) throw updateExError;
        } else {
          // Insert new exercise
          const { error: insertError } = await supabase
            .from('post_exercises')
            .insert(exerciseData);
          
          if (insertError) throw insertError;
        }
      }
    }
    
    // Handle media deletion if provided
    if (mediaToDelete && mediaToDelete.length > 0) {
      // Get storage paths for the media to delete
      const { data: mediaItems, error: mediaFetchError } = await supabase
        .from('post_media')
        .select('id, storage_path')
        .in('id', mediaToDelete);
      
      if (mediaFetchError) throw mediaFetchError;
      
      // Delete each media file from storage
      for (const item of mediaItems || []) {
        if (item.storage_path) {
          const storagePath = item.storage_path.replace(/^.*\/user-content\//, '');
          const { error: storageError } = await supabase.storage
            .from('user-content')
            .remove([storagePath]);
            
          if (storageError) {
            console.error('Error deleting media from storage:', storageError);
            // Continue with deletion even if some files can't be removed
          }
        }
      }
      
      // Delete the media records from the database
      const { error: deleteMediaError } = await supabase
        .from('post_media')
        .delete()
        .in('id', mediaToDelete);
      
      if (deleteMediaError) throw deleteMediaError;
    }
    
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
}

export async function uploadPostMedia(
  postId: string,
  userId: string,
  mediaItems: any[]
): Promise<any[]> {
  const uploadedMedia = [];
  
  try {
    // Verify user owns the post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();
    
    if (postError) throw postError;
    
    if (post.user_id !== userId) {
      throw new Error('You can only add media to your own posts');
    }
    
    // Get the current highest order_index
    const { data: existingMedia, error: mediaError } = await supabase
      .from('post_media')
      .select('order_index')
      .eq('post_id', postId)
      .order('order_index', { ascending: false })
      .limit(1);
    
    let nextOrderIndex = 0;
    if (!mediaError && existingMedia && existingMedia.length > 0) {
      nextOrderIndex = (existingMedia[0].order_index || 0) + 1;
    }
    
    // Upload each media item
    for (let i = 0; i < mediaItems.length; i++) {
      const mediaItem = mediaItems[i];
      
      // Get file extension
      const fileExt = mediaItem.uri.split('.').pop().toLowerCase();
      const mediaType = mediaItem.type || (fileExt === 'mp4' ? 'video' : 'image');
      const fileName = `${userId}-${Date.now()}-${i}.${fileExt}`;
      const filePath = `posts/${fileName}`;
      
      // Convert URI to array buffer
      const response = await fetch(mediaItem.uri);
      const arraybuffer = await response.arrayBuffer();
      
      // Upload to storage
      const { data, error: uploadError } = await supabase.storage
        .from('user-content')
        .upload(filePath, arraybuffer, {
          contentType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
        });
      
      if (uploadError) throw uploadError;
      
      // Insert media record
      const { data: mediaRecord, error: mediaInsertError } = await supabase
        .from('post_media')
        .insert({
          post_id: postId,
          storage_path: data.path,
          media_type: mediaType,
          width: mediaItem.width || null,
          height: mediaItem.height || null,
          duration: mediaItem.duration || null,
          order_index: nextOrderIndex + i
        })
        .select('id, storage_path, media_type, width, height, duration, order_index')
        .single();
      
      if (mediaInsertError) throw mediaInsertError;
      
      uploadedMedia.push({
        id: mediaRecord.id,
        type: mediaRecord.media_type,
        uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/user-content/${mediaRecord.storage_path}`,
        width: mediaRecord.width,
        height: mediaRecord.height,
        duration: mediaRecord.duration,
      });
    }
    
    return uploadedMedia;
  } catch (error) {
    console.error('Error uploading post media:', error);
    throw error;
  }
}

export async function fetchPostById(postId: string, userId?: string) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        description,
        workout_id,
        created_at,
        likes_count,
        user_id,
        profiles:user_id(id, username, avatar_url, name),
        post_exercises(id, name, sets, reps, weight, weight_unit, notes),
        post_media(id, storage_path, media_type, width, height, duration, order_index)
      `)
      .eq('id', postId)
      .single();
    
    if (error) throw error;
    
    // Check if current user has liked this post
    let hasLiked = false;
    if (userId) {
      hasLiked = await checkIfUserLikedPost(data.id, userId);
    }
    
    // Format the post data
    return {
      id: data.id,
      title: data.title,
      workout_id: data.workout_id,
      user: {
        id: data.profiles.id,
        username: data.profiles.username,
        name: data.profiles.name,
        avatar_url: data.profiles.avatar_url
      },
      createdAt: data.created_at,
      text: data.description,
      exercises: data.post_exercises.map(exercise => ({
        id: exercise.id,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        unit: exercise.weight_unit,
        notes: exercise.notes
      })),
      media: data.post_media.map(media => ({
        id: media.id,
        type: media.media_type,
        uri: media.storage_path.startsWith('http') 
          ? media.storage_path 
          : `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/user-content/${media.storage_path}`,
        width: media.width,
        height: media.height,
        duration: media.duration,
        order_index: media.order_index
      })).sort((a, b) => a.order_index - b.order_index),
      likes: data.likes_count || 0,
      is_liked: hasLiked
    };
  } catch (error) {
    console.error('Error fetching post by ID:', error);
    throw error;
  }
}

export async function likePost(postId: string, userId: string) {
  try {
    // Check if user already liked this post
    const { data: existingLike, error: checkError } = await supabase
      .from('post_likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (checkError) {
      console.error("Error checking like status:", checkError);
      throw checkError;
    }
    
    // Get post author to send notification
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();
      
    if (postError) throw postError;
    
    if (existingLike) {
      // User already liked the post, so unlike it
      const { error: unlikeError } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
      
      if (unlikeError) throw unlikeError;
      
      // First get the current likes count
      const { data: postData, error: getError } = await supabase
        .from('posts')
        .select('likes_count')
        .eq('id', postId)
        .single();
      
      if (getError) throw getError;
      
      // Decrement the likes count directly
      const newCount = Math.max(0, (postData.likes_count || 0) - 1);
      const { error: updateError } = await supabase
        .from('posts')
        .update({ likes_count: newCount })
        .eq('id', postId);
      
      if (updateError) throw updateError;
      
      return { liked: false };
    } else {
      // User hasn't liked the post yet, so like it
      const { error: likeError } = await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: userId });
      
      if (likeError) throw likeError;
      
      // First get the current likes count
      const { data: postData, error: getError } = await supabase
        .from('posts')
        .select('likes_count')
        .eq('id', postId)
        .single();
      
      if (getError) throw getError;
      
      // Increment the likes count directly
      const newCount = (postData.likes_count || 0) + 1;
      const { error: updateError } = await supabase
        .from('posts')
        .update({ likes_count: newCount })
        .eq('id', postId);
      
      if (updateError) throw updateError;
      
      // Create notification for the post author (if not liking own post)
      if (post.user_id !== userId) {
        try {
          await createPostLikeNotification(post.user_id, userId, postId);
        } catch (notifError) {
          console.error('Error creating post like notification:', notifError);
          // Continue even if notification fails
        }
      }
      
      return { liked: true };
    }
  } catch (error) {
    console.error('Error toggling post like:', error);
    throw error;
  }
}

export async function checkIfUserLikedPost(postId: string, userId: string) {
  try {
    const { data, error } = await supabase
      .from('post_likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error("Error checking if user liked post:", error);
      throw error;
    }
    
    return !!data; // Returns true if the user liked the post, false otherwise
  } catch (error) {
    console.error('Error checking if user liked post:', error);
    return false; // Default to false if there's an error
  }
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  parent_id?: string;
  created_at: string;
  updated_at?: string;
  likes_count: number;
  is_liked?: boolean;
  pinned?: boolean;
  user?: {
    id: string;
    username: string;
    name?: string;
    avatar_url?: string;
  };
  replies?: Comment[];
  hotness?: number; // For internal sorting use
}
  
export async function fetchComments(postId: string, userId?: string): Promise<Comment[]> {
  try {
    // Fetch top-level comments (no parent_id)
    const { data: comments, error } = await supabase
    .from('post_comments')
    .select(`
      id,
      post_id,
      user_id,
      text,
      parent_id,
      created_at,
      updated_at,
      likes_count,
      pinned,
      profiles:user_id(id, username, name, avatar_url)
    `)
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('pinned', { ascending: false }) // Pinned comments first
    .order('created_at', { ascending: false }); // Then most recent
    
    if (error) throw error;

    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    const isPostOwner = userId && post && post.user_id === userId;
    
    // Format the comments
    const formattedComments = comments.map(comment => ({
      id: comment.id,
      post_id: comment.post_id,
      user_id: comment.user_id,
      text: comment.text,
      parent_id: comment.parent_id,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      likes_count: comment.likes_count,
      pinned: comment.pinned,
      user: {
        id: comment.profiles.id,
        username: comment.profiles.username,
        name: comment.profiles.name,
        avatar_url: comment.profiles.avatar_url
      },
      replies: []
    }));
    
    // Batch fetch all replies in a single query
    const commentIds = formattedComments.map(c => c.id);
    if (commentIds.length > 0) {
      const { data: allReplies, error: repliesError } = await supabase
        .from('post_comments')
        .select(`
          id,
          post_id,
          user_id,
          text,
          parent_id,
          created_at,
          updated_at,
          likes_count,
          profiles:user_id(id, username, name, avatar_url)
        `)
        .in('parent_id', commentIds)
        .order('created_at', { ascending: true });

      if (repliesError) throw repliesError;

      const repliesByParent = new Map<string, any[]>();
      for (const reply of allReplies ?? []) {
        const arr = repliesByParent.get(reply.parent_id) ?? [];
        arr.push({
          id: reply.id,
          post_id: reply.post_id,
          user_id: reply.user_id,
          text: reply.text,
          parent_id: reply.parent_id,
          created_at: reply.created_at,
          updated_at: reply.updated_at,
          likes_count: reply.likes_count,
          user: {
            id: reply.profiles.id,
            username: reply.profiles.username,
            name: reply.profiles.name,
            avatar_url: reply.profiles.avatar_url
          }
        });
        repliesByParent.set(reply.parent_id, arr);
      }

      for (const comment of formattedComments) {
        comment.replies = repliesByParent.get(comment.id) ?? [];
      }
    }
    
    // Check if current user has liked any of these comments
    if (userId) {
      const commentIds = [...formattedComments.map(c => c.id), 
        ...formattedComments.flatMap(c => c.replies?.map(r => r.id) || [])];
      
      const { data: likedComments, error: likesError } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', userId)
        .in('comment_id', commentIds);
      
      if (likesError) throw likesError;
      
      const likedCommentIds = new Set(likedComments.map(like => like.comment_id));
      
      // Mark comments as liked
      formattedComments.forEach(comment => {
        comment.is_liked = likedCommentIds.has(comment.id);
        comment.replies?.forEach(reply => {
          reply.is_liked = likedCommentIds.has(reply.id);
        });
      });
    }
    
    return sortCommentsBySmart(formattedComments, isPostOwner);
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
}

// Smart comment sorting algorithm
function sortCommentsBySmart(comments: Comment[], isPostOwner: boolean): Comment[] {
  // First separate pinned from non-pinned
  const pinnedComments = comments.filter(comment => comment.pinned);
  const unpinnedComments = comments.filter(comment => !comment.pinned);
  
  // Calculate a "hotness score" for each unpinned comment
  const now = new Date();
  unpinnedComments.forEach(comment => {
    const commentAge = (now.getTime() - new Date(comment.created_at).getTime()) / 3600000; // age in hours
    const likesWeight = comment.likes_count * 2; // Likes count heavily
    const repliesWeight = (comment.replies?.length || 0) * 3; // Replies count even more
    
    // Hacker News-style ranking algorithm
    // Score decreases as the comment gets older, but increases with engagement
    comment['hotness'] = (likesWeight + repliesWeight) / Math.pow((commentAge + 2), 1.5);
  });
  
  // Sort unpinned comments by hotness score
  unpinnedComments.sort((a, b) => b['hotness'] - a['hotness']);
  
  // Return pinned comments first, then hot comments
  return [...pinnedComments, ...unpinnedComments];
}

export async function addComment(
  postId: string, 
  userId: string, 
  text: string, 
  parentId?: string
): Promise<Comment> {
  try {
    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        text: text,
        parent_id: parentId || null
      })
      .select('id, created_at')
      .single();
    
    if (error) throw error;
    
    // Get user info for the commenter
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('id, username, name, avatar_url')
      .eq('id', userId)
      .single();
    
    if (userError) throw userError;
    
    // Create notification - determine the recipient and type
    if (parentId) {
      // This is a reply to another comment - notify that comment's author
      const { data: parentComment } = await supabase
        .from('post_comments')
        .select('user_id')
        .eq('id', parentId)
        .single();
        
      if (parentComment && parentComment.user_id !== userId) {
        try {
          await createCommentReplyNotification(parentComment.user_id, userId, data.id, postId);
        } catch (notifError) {
          console.error('Error creating comment reply notification:', notifError);
        }
      }
    } else {
      // This is a comment on a post - notify the post author
      const { data: post } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();
        
      if (post && post.user_id !== userId) {
        try {
          await createPostCommentNotification(post.user_id, userId, postId, data.id);
        } catch (notifError) {
          console.error('Error creating post comment notification:', notifError);
        }
      }
    }
    
    // Return formatted comment
    return {
      id: data.id,
      post_id: postId,
      user_id: userId,
      text: text,
      parent_id: parentId,
      created_at: data.created_at,
      likes_count: 0,
      is_liked: false,
      user: {
        id: userProfile.id,
        username: userProfile.username,
        name: userProfile.name,
        avatar_url: userProfile.avatar_url
      }
    };
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
}

export async function likeComment(commentId: string, userId: string): Promise<{ liked: boolean }> {
  try {
    // Check if already liked
    const { data: existingLike, error: checkError } = await supabase
      .from('comment_likes')
      .select('*')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (checkError) throw checkError;

    // Get comment info for notifications
    const { data: comment, error: commentError } = await supabase
      .from('post_comments')
      .select('user_id, text, post_id')
      .eq('id', commentId)
      .single();
    
    if (commentError) throw commentError;
    
    if (existingLike) {
      // Unlike - just delete the like, trigger will handle count update
      const { error: unlikeError } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId);
      
      if (unlikeError) throw unlikeError;
      
      return { liked: false };
    } else {
      // Like - just insert the like, trigger will handle count update
      const { error: likeError } = await supabase
        .from('comment_likes')
        .insert({ comment_id: commentId, user_id: userId });
      
      if (likeError) throw likeError;

      // Send notification if not liking own comment
      if (comment.user_id !== userId) {
        try {
          await createCommentLikeNotification(comment.user_id, userId, commentId, comment.post_id);
        } catch (notifError) {
          console.error('Error creating comment like notification:', notifError);
        }
      }
      
      return { liked: true };
    }
  } catch (error) {
    console.error('Error toggling comment like:', error);
    throw error;
  }
}

export async function deleteComment(commentId: string, userId: string, isPostOwner: boolean = false): Promise<void> {
  try {
    // Check if user is allowed to delete this comment (either post owner or comment owner)
    if (!isPostOwner) {
      const { data: comment, error: checkError } = await supabase
        .from('post_comments')
        .select('user_id')
        .eq('id', commentId)
        .single();
      
      if (checkError) throw checkError;
      
      if (comment.user_id !== userId) {
        throw new Error('You can only delete your own comments unless you are the post owner');
      }
    }
    
    // First delete any replies to this comment
    const { error: repliesError } = await supabase
      .from('post_comments')
      .delete()
      .eq('parent_id', commentId);
    
    if (repliesError) throw repliesError;
    
    // Then delete the comment itself
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
}

export async function editComment(commentId: string, userId: string, newText: string): Promise<Comment> {
  try {
    // Check if user is the comment owner
    const { data: comment, error: checkError } = await supabase
      .from('post_comments')
      .select('user_id, post_id')
      .eq('id', commentId)
      .single();
    
    if (checkError) throw checkError;
    
    if (comment.user_id !== userId) {
      throw new Error('You can only edit your own comments');
    }
    
    // Update the comment
    const { data, error } = await supabase
      .from('post_comments')
      .update({ 
        text: newText,
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select(`
        id,
        post_id,
        user_id,
        text,
        parent_id,
        created_at,
        updated_at,
        likes_count,
        pinned,
        profiles:user_id(id, username, name, avatar_url)
      `)
      .single();
    
    if (error) throw error;
    
    // Return the updated comment
    return {
      id: data.id,
      post_id: data.post_id,
      user_id: data.user_id,
      text: data.text,
      parent_id: data.parent_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
      likes_count: data.likes_count,
      pinned: data.pinned,
      user: {
        id: data.profiles.id,
        username: data.profiles.username,
        name: data.profiles.name,
        avatar_url: data.profiles.avatar_url
      }
    };
  } catch (error) {
    console.error('Error editing comment:', error);
    throw error;
  }
}

export async function pinComment(commentId: string, postId: string, userId: string): Promise<void> {
  try {
    // First verify the user is the post owner
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();
    
    if (postError) throw postError;
    
    if (post.user_id !== userId) {
      throw new Error('Only the post owner can pin comments');
    }
    
    // Unpin any currently pinned comments for this post
    // const { error: unpinError } = await supabase
    //   .from('post_comments')
    //   .update({ pinned: false })
    //   .eq('post_id', postId)
    //   .eq('pinned', true);
    
    // if (unpinError) throw unpinError;
    
    // Pin the selected comment
    const { error: pinError } = await supabase
      .from('post_comments')
      .update({ pinned: true })
      .eq('id', commentId);
    
    if (pinError) throw pinError;
    
  } catch (error) {
    console.error('Error pinning comment:', error);
    throw error;
  }
}

export async function unpinComment(commentId: string, postId: string, userId: string): Promise<void> {
  try {
    // First verify the user is the post owner
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();
    
    if (postError) throw postError;
    
    if (post.user_id !== userId) {
      throw new Error('Only the post owner can unpin comments');
    }
    
    // Unpin the comment
    const { error: unpinError } = await supabase
      .from('post_comments')
      .update({ pinned: false })
      .eq('id', commentId);
    
    if (unpinError) throw unpinError;
    
  } catch (error) {
    console.error('Error unpinning comment:', error);
    throw error;
  }
}

export function formatTimeAgo(timestamp: string): string {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInWeeks = Math.floor(diffInDays / 7);
    const diffInMonths = Math.floor(diffInDays / 30);
    const diffInYears = Math.floor(diffInDays / 365);

    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else if (diffInWeeks < 4) {
      return `${diffInWeeks}w ago`;
    } else if (diffInMonths < 12) {
      return `${diffInMonths}mo ago`;
    } else {
      return `${diffInYears}y ago`;
    }
  } catch (e) {
    console.error("Error formatting time ago:", e);
    return timestamp; // Return the original timestamp if parsing fails
  }
}

export function formatLikesCount(count: number): string {
  if (count < 1000) {
    return count.toString();
  } else if (count < 1000000) {
    const thousands = count / 1000;
    return thousands % 1 === 0 ? `${thousands}k` : `${thousands.toFixed(1)}k`;
  } else if (count < 1000000000) {
    const millions = count / 1000000;
    return millions % 1 === 0 ? `${millions}m` : `${millions.toFixed(1)}m`;
  } else {
    const billions = count / 1000000000;
    return billions % 1 === 0 ? `${billions}b` : `${billions.toFixed(1)}b`;
  }
}