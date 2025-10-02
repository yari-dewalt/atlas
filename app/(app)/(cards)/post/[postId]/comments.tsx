import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, FlatList, Alert, Animated, Keyboard, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons as IonIcon, AntDesign } from '@expo/vector-icons';
import { supabase } from '../../../../../lib/supabase';
import Post from '../../../../../components/Post/Post';
import CachedAvatar from '../../../../../components/CachedAvatar';
import PostCommentsSkeleton from '../../../../../components/PostCommentsSkeleton';
import { colors } from '../../../../../constants/colors';
import { useAuthStore } from '../../../../../stores/authStore';
import { fetchComments, addComment, formatTimeAgo, formatLikesCount, likePost, checkIfUserLikedPost, likeComment, deleteComment, editComment } from '../../../../../utils/postUtils';
import * as Haptics from 'expo-haptics';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useBannerStore, BANNER_MESSAGES } from '../../../../../stores/bannerStore';

export default function PostCommentsScreen() {
  const { postId, focus } = useLocalSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [likesData, setLikesData] = useState(null);
  const [replying, setReplying] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [likingCommentId, setLikingCommentId] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editedCommentText, setEditedCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [visibleRepliesMap, setVisibleRepliesMap] = useState(new Map());
  const [showOptionsFor, setShowOptionsFor] = useState(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [overlayOpacity] = useState(new Animated.Value(0));
  const [inputHeight, setInputHeight] = useState(36);
  const [shouldAutoFocus, setShouldAutoFocus] = useState(focus === 'true');
  const [selectedComment, setSelectedComment] = useState(null);
  const REPLIES_BATCH_SIZE = 5;
  const { profile, session } = useAuthStore();
  const inputRef = useRef(null);
  
  // Bottom sheet
  const commentOptionsBottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['25%'], []);
  
  // Backdrop component
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        enableTouchThrough={false}
      />
    ),
    []
  );

  useEffect(() => {
    if (postId) {
      fetchPostAndComments();
    }
  }, [postId]);

  // Auto-focus input if focus parameter is true
  useEffect(() => {
    if (focus === 'true' && !isLoading) {
      // Small delay to ensure the component is fully rendered
      setTimeout(() => {
        setIsInputFocused(true);
        inputRef.current?.focus();
      }, 300);
    }
  }, [focus, isLoading]);

  // Close options menu when user taps outside
  useEffect(() => {
    const closeOptions = () => setShowOptionsFor(null);
    return closeOptions;
  }, []);

  // Handle overlay animation
  useEffect(() => {
    if (isInputFocused) {
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isInputFocused]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setIsInputFocused(false);
    setShouldAutoFocus(false); // Prevent auto-refocus when dismissing
    // Don't cancel reply when dismissing keyboard - preserve reply state
  };

  const fetchPostAndComments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch post data
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(`
          id,
          description,
          title,
          created_at,
          likes_count,
          user_id,
          workout_id,
          profiles:user_id(id, username, avatar_url, full_name),
          post_likes(count),
          post_comments(count),
          post_media(id, storage_path, media_type, width, height, duration, order_index)
        `)
        .eq('id', postId)
        .single();
      
      if (postError) {
        throw postError;
      }

      if (postData) {
        // Fetch the profile data separately
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, full_name')
          .eq('id', postData.user_id)
          .single();
        
        if (profileError) {
          console.log('Profile fetch error:', profileError);
        }

        let hasLiked = false;
        if (session?.user?.id) {
          hasLiked = await checkIfUserLikedPost(postData.id, session.user.id);
        }

        // Transform the post data (simplified version without media gallery)
        const formattedPost = {
          id: postData.id,
          user: {
            id: profileData?.id,
            username: profileData?.username,
            full_name: profileData?.full_name,
            avatar_url: profileData?.avatar_url
          },
          createdAt: postData.created_at,
          title: postData.title,
          text: postData.description,
          workout_id: postData.workout_id,
          media: postData.post_media ? postData.post_media.map(media => ({
            id: media.id,
            type: media.media_type,
            uri: media.storage_path.startsWith('http') 
              ? media.storage_path 
              : `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/user-content/${media.storage_path}`,
            width: media.width,
            height: media.height,
            duration: media.duration,
            order_index: media.order_index
          })).sort((a, b) => a.order_index - b.order_index) : [],
          likes: postData.likes_count || (postData.post_likes?.[0]?.count || 0),
          is_liked: hasLiked,
          comments: []
        };
        
        setPost(formattedPost);
        setLikesCount(formattedPost.likes);

        // Check if user has liked this post
        if (session?.user?.id) {
          const hasLiked = await checkIfUserLikedPost(postData.id, session.user.id);
          setLiked(hasLiked);
        }

        // Fetch likes data for display
        if (postData.likes_count > 0) {
          try {
            const { data: likes, error: likesError } = await supabase
              .from('post_likes')
              .select(`
                user_id,
                created_at,
                profiles:user_id (
                  id,
                  username,
                  full_name,
                  avatar_url
                )
              `)
              .eq('post_id', postData.id)
              .order('created_at', { ascending: false })
              .limit(3);

            if (!likesError && likes && likes.length > 0) {
              // Filter out current user from display
              const filteredLikes = likes.filter(like => like.user_id !== session?.user?.id);
              
              setLikesData({
                totalCount: postData.likes_count,
                recentLikes: filteredLikes.slice(0, 3)
              });
            }
          } catch (error) {
            console.error('Error fetching likes data:', error);
          }
        }

        // Fetch comments
        const commentsData = await fetchComments(postId as string, session?.user?.id);
        setComments(commentsData || []);
        setCommentsCount(commentsData?.length || 0);
      } else {
        setPost(null);
        setError('Post not found');
      }
    } catch (err) {
      console.error('Error fetching post and comments:', err);
      setError(err.message || 'Failed to load post and comments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !session?.user?.id || isSubmitting) return;

    const parentId = replyingTo ? replyingTo.id : undefined;
    const commentText = newComment.trim();
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    
    // Create optimistic comment data
    const optimisticComment = {
      id: tempId,
      text: commentText,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: session.user.id,
      post_id: postId as string,
      parent_id: parentId,
      likes_count: 0,
      is_liked: false,
      user: {
        id: session.user.id,
        username: profile?.username || session.user.user_metadata?.username,
        full_name: profile?.name || session.user.user_metadata?.full_name,
        avatar_url: profile?.avatar_url || session.user.user_metadata?.avatar_url
      },
      replies: []
    };

    // Immediately update UI with optimistic comment
    if (replyingTo) {
      // Add optimistic reply
      setComments(prevComments => 
        prevComments.map(comment => {
          if (comment.id === replyingTo.id) {
            return {
              ...comment,
              replies: [...(comment.replies || []), optimisticComment]
            };
          }
          return comment;
        })
      );
    } else {
      // Add optimistic top-level comment
      setComments(prevComments => [optimisticComment, ...prevComments]);
      setCommentsCount(prev => prev + 1);
    }

    // Clear input immediately for better UX
    Keyboard.dismiss();
    setIsSubmitting(true);
    setNewComment('');
    setReplying(false);
    setReplyingTo(null);
    setShouldAutoFocus(false);
    setInputHeight(36); // Reset input height

    try {
      // Make the actual API call
      const newCommentData = await addComment(
        postId as string, 
        session.user.id, 
        commentText, 
        parentId
      );
      
      // Replace optimistic comment with real data
      if (replyingTo) {
        setComments(prevComments => 
          prevComments.map(comment => {
            if (comment.id === replyingTo.id) {
              return {
                ...comment,
                replies: (comment.replies || []).map(reply => 
                  reply.id === tempId ? newCommentData : reply
                )
              };
            }
            return comment;
          })
        );
      } else {
        setComments(prevComments => 
          prevComments.map(comment => 
            comment.id === tempId ? newCommentData : comment
          )
        );
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      const { showError } = useBannerStore.getState();
      showError('Failed to add comment');
      
      // Remove optimistic comment on error
      if (replyingTo) {
        setComments(prevComments => 
          prevComments.map(comment => {
            if (comment.id === replyingTo.id) {
              return {
                ...comment,
                replies: (comment.replies || []).filter(reply => reply.id !== tempId)
              };
            }
            return comment;
          })
        );
      } else {
        setComments(prevComments => prevComments.filter(comment => comment.id !== tempId));
        setCommentsCount(prev => Math.max(0, prev - 1));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLiked = async () => {
    if (!session?.user?.id) {
      const { showInfo } = useBannerStore.getState();
      showInfo('Please sign in to like posts');
      return;
    }
    
    setIsLikeLoading(true);
    
    try {
      // Add haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Optimistically update UI
      const newLikedState = !liked;
      setLiked(newLikedState);
      setLikesCount(prevCount => newLikedState ? prevCount + 1 : Math.max(0, prevCount - 1));
      
      // Make the actual API call
      const result = await likePost(postId as string, session.user.id);
      
      // If something went wrong, revert to the previous state
      if (result.liked !== newLikedState) {
        setLiked(result.liked);
        setLikesCount(prevCount => result.liked ? prevCount + 1 : Math.max(0, prevCount - 1));
      }

      // Refresh likes data if we have likes
      if (result.liked || likesCount > 1) {
        try {
          const newLikesCount = result.liked ? likesCount : Math.max(0, likesCount - 1);
          const { data: likes, error: likesError } = await supabase
            .from('post_likes')
            .select(`
              user_id,
              created_at,
              profiles:user_id (
                id,
                username,
                full_name,
                avatar_url
              )
            `)
            .eq('post_id', postId as string)
            .order('created_at', { ascending: false })
            .limit(3);

          if (!likesError && likes && likes.length > 0) {
            // Filter out current user from display
            const filteredLikes = likes.filter(like => like.user_id !== session?.user?.id);
            
            setLikesData({
              totalCount: newLikesCount,
              recentLikes: filteredLikes.slice(0, 3)
            });
          } else if (!result.liked) {
            setLikesData(null);
          }
        } catch (error) {
          console.error('Error refreshing likes data:', error);
        }
      } else if (!result.liked) {
        setLikesData(null);
      }
    } catch (error) {
      // If there's an error, revert to the previous state
      console.error('Error toggling like:', error);
      setLiked(!liked);
      setLikesCount(prevCount => liked ? prevCount + 1 : Math.max(0, prevCount - 1));
      const { showError } = useBannerStore.getState();
      showError('Failed to update like status. Please try again.');
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleLikeComment = async (comment) => {
    if (!session?.user?.id) {
      const { showInfo } = useBannerStore.getState();
      showInfo('Please sign in to like comments');
      return;
    }
    
    setLikingCommentId(comment.id);
    try {
      // Add haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Optimistically update UI
      const newLikedState = !comment.is_liked;
      
      // Update the comment in state
      const updateComment = (c) => {
        if (c.id === comment.id) {
          return {
            ...c,
            is_liked: newLikedState,
            likes_count: newLikedState ? c.likes_count + 1 : Math.max(0, c.likes_count - 1)
          };
        }
        
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map(updateComment)
          };
        }
        
        return c;
      };
      
      setComments(prev => prev.map(updateComment));
      
      // Make the API call
      const result = await likeComment(comment.id, session.user.id);
      
      // If something went wrong, revert the UI
      if (result.liked !== newLikedState) {
        setComments(prev => prev.map(c => {
          if (c.id === comment.id) {
            return {
              ...c,
              is_liked: result.liked,
              likes_count: result.liked ? c.likes_count + 1 : Math.max(0, c.likes_count - 1)
            };
          }
          
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map(r => {
                if (r.id === comment.id) {
                  return {
                    ...r,
                    is_liked: result.liked,
                    likes_count: result.liked ? r.likes_count + 1 : Math.max(0, r.likes_count - 1)
                  };
                }
                return r;
              })
            };
          }
          
          return c;
        }));
      }
    } catch (error) {
      console.error('Error liking comment:', error);
      const { showError } = useBannerStore.getState();
      showError('Failed to update like status');
    } finally {
      setLikingCommentId(null);
    }
  };

  const startReplying = (comment) => {
    // Add haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setReplying(true);
    setReplyingTo(comment);
    setShouldAutoFocus(true);
    // Don't clear existing text when starting to reply
    
    // Focus the input and show keyboard with a small delay
    setTimeout(() => {
      setIsInputFocused(true);
      inputRef.current?.focus();
    }, 100);
  };

  const showCommentOptions = (comment) => {
    setSelectedComment(comment);
    setShowOptionsFor(null); // Clear any existing dropdown
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    commentOptionsBottomSheetRef.current?.expand();
  };

  const handleCommentAction = (action: 'edit' | 'delete') => {
    if (!selectedComment) return;
    
    commentOptionsBottomSheetRef.current?.close();
    
    if (action === 'edit') {
      startEditingComment(selectedComment);
    } else if (action === 'delete') {
      handleDeleteComment(selectedComment);
    }
    
    setSelectedComment(null);
  };

  const cancelReply = () => {
    // Add haptic feedback for canceling reply
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setReplying(false);
    setReplyingTo(null);
    setShouldAutoFocus(false);
    // Don't clear the text when canceling reply - preserve user's typed content
    setInputHeight(36); // Reset input height
  };

  const handleDeleteComment = async (comment) => {
    if (!session?.user?.id) return;
    
    // Check if user has permission to delete this comment
    const isPostOwner = session.user.id === post?.user?.id;
    const canDelete = isPostOwner || comment.user_id === session.user.id;
    
    if (!canDelete) {
      const { showError } = useBannerStore.getState();
      showError('You do not have permission to delete this comment');
      return;
    }
    
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteComment(comment.id, session.user.id, isPostOwner);
              
              // Update the UI
              if (comment.parent_id) {
                // Remove reply from parent comment
                setComments(prev => 
                  prev.map(c => {
                    if (c.id === comment.parent_id) {
                      return {
                        ...c,
                        replies: c.replies?.filter(r => r.id !== comment.id) || []
                      };
                    }
                    return c;
                  })
                );
              } else {
                // Remove top-level comment
                setComments(prev => prev.filter(c => c.id !== comment.id));
                setCommentsCount(prev => Math.max(0, prev - 1));
              }
              setShowOptionsFor(null);
              
              // Show success banner
              const { showSuccess } = useBannerStore.getState();
              showSuccess('Comment deleted successfully');
            } catch (error) {
              console.error('Error deleting comment:', error);
              const { showError } = useBannerStore.getState();
              showError('Failed to delete comment');
            }
          }
        }
      ]
    );
  };

  const startEditingComment = (comment) => {
    if (!session?.user?.id || comment.user_id !== session.user.id) return;
    
    setEditingCommentId(comment.id);
    setEditedCommentText(comment.text);
    setIsEditing(true);
    setShowOptionsFor(null);
  };
  
  const cancelEditing = () => {
    if (isSaving) return; // Don't cancel if we're in the middle of saving
    setEditingCommentId(null);
    setEditedCommentText('');
    setIsEditing(false);
  };
  
  const saveEditedComment = async () => {
    if (!session?.user?.id || !editingCommentId || !editedCommentText.trim()) return;
    
    // Optimistically update the UI first
    const optimisticText = editedCommentText.trim();
    const currentTime = new Date().toISOString();
    setComments(prev => 
      prev.map(c => {
        if (c.id === editingCommentId) {
          return {
            ...c,
            text: optimisticText,
            updated_at: currentTime
          };
        }
        
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map(r => {
              if (r.id === editingCommentId) {
                return {
                  ...r,
                  text: optimisticText,
                  updated_at: currentTime
                };
              }
              return r;
            })
          };
        }
        
        return c;
      })
    );
    
    // Reset editing state immediately for better UX
    setEditingCommentId(null);
    setEditedCommentText('');
    setIsEditing(false);
    
    setIsSaving(true);
    try {
      const updatedComment = await editComment(editingCommentId, session.user.id, optimisticText);
      
      // Update the UI with the server response (in case there are any differences)
      setComments(prev => 
        prev.map(c => {
          if (c.id === editingCommentId) {
            return {
              ...c,
              text: updatedComment.text,
              updated_at: updatedComment.updated_at
            };
          }
          
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map(r => {
                if (r.id === editingCommentId) {
                  return {
                    ...r,
                    text: updatedComment.text,
                    updated_at: updatedComment.updated_at
                  };
                }
                return r;
              })
            };
          }
          
          return c;
        })
      );
      
      // Show success banner
      const { showSuccess } = useBannerStore.getState();
      showSuccess('Comment updated successfully');
    } catch (error) {
      console.error('Error editing comment:', error);
      const { showError } = useBannerStore.getState();
      showError('Failed to update comment');
      
      // Revert the optimistic update on error
      setComments(prev => 
        prev.map(c => {
          if (c.id === editingCommentId) {
            return {
              ...c,
              text: editedCommentText // Revert to original text
            };
          }
          
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map(r => {
                if (r.id === editingCommentId) {
                  return {
                    ...r,
                    text: editedCommentText // Revert to original text
                  };
                }
                return r;
              })
            };
          }
          
          return c;
        })
      );
      
      // Re-enter editing mode with the original text
      setEditingCommentId(editingCommentId);
      setEditedCommentText(editedCommentText);
      setIsEditing(true);
    } finally {
      setIsSaving(false);
    }
  };

  const showMoreReplies = (commentId, totalReplies) => {
    setVisibleRepliesMap(prev => {
      const newMap = new Map(prev);
      const currentlyVisible = prev.get(commentId) || 0;
      const newVisible = Math.min(currentlyVisible + REPLIES_BATCH_SIZE, totalReplies);
      newMap.set(commentId, newVisible);
      return newMap;
    });
  };
  
  const hideAllReplies = (commentId) => {
    setVisibleRepliesMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(commentId);
      return newMap;
    });
  };

  // Helper function to check if a comment was edited
  const isCommentEdited = (comment) => {
    if (!comment.updated_at || !comment.created_at) return false;
    const created = new Date(comment.created_at);
    const updated = new Date(comment.updated_at);
    // Consider edited if updated time is more than 5 seconds after created time
    return updated.getTime() - created.getTime() > 5000;
  };

  const renderComment = ({ item: comment }) => {
    const isPostOwner = session?.user?.id === post?.user?.id;
    const isCommentOwner = session?.user?.id === comment.user_id;
    const canEdit = isCommentOwner;
    const canDelete = isCommentOwner || isPostOwner;
    
    // Get the total number of replies
    const totalReplies = comment.replies?.length || 0;
    const showAllReplies = totalReplies <= 3;
    
    // Determine how many replies to show
    const visibleRepliesCount = visibleRepliesMap.get(comment.id) || 0;
    
    // Get the replies to show based on the visible count
    const repliesToShow = totalReplies > 0
      ? (showAllReplies 
        ? comment.replies 
        : comment.replies?.slice(0, visibleRepliesCount) || [])
      : [];
    
    // Calculate remaining replies
    const remainingReplies = totalReplies - visibleRepliesCount;
    
    // Button for showing initial replies when none are visible yet
    const initialRepliesButton = () => (
      totalReplies > 3 ? (
        <TouchableOpacity
                activeOpacity={0.5} 
          style={styles.showRepliesButton}
          onPress={() => showMoreReplies(comment.id, totalReplies)}
        >
          <View style={styles.showRepliesContainer}>
            <Text style={styles.showRepliesText}>
              Show {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
            </Text>
            <IonIcon 
              name="chevron-down" 
              size={16} 
              color={colors.secondaryText}
            />
          </View>
        </TouchableOpacity>
      ) : null
    );
    
    // Button for showing more replies or hiding all replies
    const moreRepliesButton = () => (
      totalReplies > 3 ? (
        <TouchableOpacity
                activeOpacity={0.5} 
          style={styles.showRepliesButton}
          onPress={() => {
            if (remainingReplies > 0) {
              showMoreReplies(comment.id, totalReplies);
            } else {
              hideAllReplies(comment.id);
            }
          }}
        >
          <View style={styles.showRepliesContainer}>
            {remainingReplies === 0 ? (
              <Text style={styles.showRepliesText}>Hide replies</Text>
            ) : (
              <Text style={styles.showRepliesText}>
                Show {remainingReplies} more {remainingReplies === 1 ? 'reply' : 'replies'}
              </Text>
            )}
            <IonIcon 
              name={remainingReplies === 0 ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={colors.secondaryText}
            />
          </View>
        </TouchableOpacity>
      ) : null
    );

    const renderReply = (reply) => (
      <View key={reply.id} style={styles.replyItem}>
        <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.push(`/profile/${reply.user.id}`)}>
          <CachedAvatar 
            path={reply.user?.avatar_url} 
            size={28} 
            style={styles.replyAvatar}
          />
        </TouchableOpacity>
        <View style={[
          styles.replyContent,
          editingCommentId === reply.id && styles.replyContentEditing
        ]}>
          <View style={styles.replyHeader}>
            <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.push(`/profile/${reply.user.id}`)}>
              <Text style={styles.replyUsername}>{reply.user.username}</Text>
            </TouchableOpacity>
            <Text style={styles.replyTime}>
              {formatTimeAgo(reply.created_at)}
              {isCommentEdited(reply) && <Text style={styles.editedText}> (edited)</Text>}
            </Text>
            {(isCommentOwner && reply.user_id === session?.user?.id) || isPostOwner ? (
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.optionsButton}
                onPress={() => showCommentOptions(reply)}
              >
                <IonIcon name="ellipsis-horizontal" size={16} color={colors.secondaryText} />
              </TouchableOpacity>
            ) : null}
            <View style={styles.replyInlineLikes}>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.replyLikeButton}
                onPress={() => handleLikeComment(reply)}
                disabled={likingCommentId === reply.id}
              >
                <IonIcon 
                  name={reply.is_liked ? "heart" : "heart-outline"} 
                  size={14} 
                  color={reply.is_liked ? colors.notification : colors.primaryText} 
                />
                {reply.likes_count > 0 && (
                  <Text style={styles.replyLikesText}>
                    {formatLikesCount(reply.likes_count)}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          
          {editingCommentId === reply.id ? (
            <TextInput
              style={styles.replyTextEditable}
              value={editedCommentText}
              onChangeText={setEditedCommentText}
              multiline
              autoFocus
              keyboardType="twitter"
            />
          ) : (
            <Text style={styles.replyText}>{reply.text}</Text>
          )}
          
          <View style={styles.commentActions}>
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.replyActionButton}
              onPress={() => startReplying(comment)}
            >
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>
            {editingCommentId === reply.id && (
              <>
                <TouchableOpacity
                activeOpacity={0.5} 
                  style={styles.replyActionButton}
                  onPress={cancelEditing}
                  disabled={isSaving}
                >
                  <Text style={styles.actionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                activeOpacity={0.5} 
                  style={styles.replyActionButton}
                  onPress={saveEditedComment}
                  disabled={isSaving}
                >
                  <Text style={styles.saveActionText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );

    return (
      <View style={[
        styles.commentItem, 
        replying && replyingTo?.id === comment.id && styles.commentItemHighlighted,
        editingCommentId === comment.id && styles.commentItemEditing
      ]}>
        <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.push(`/profile/${comment.user.id}`)}>
          <CachedAvatar 
            path={comment.user?.avatar_url} 
            size={36} 
            style={styles.commentAvatar}
          />
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.push(`/profile/${comment.user.id}`)}>
              <Text style={styles.commentUsername}>{comment.user.username}</Text>
            </TouchableOpacity>
            <Text style={styles.commentTime}>
              {formatTimeAgo(comment.created_at)}
              {isCommentEdited(comment) && <Text style={styles.editedText}> (edited)</Text>}
            </Text>
            {canEdit || canDelete ? (
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.optionsButton}
                onPress={() => showCommentOptions(comment)}
              >
                <IonIcon name="ellipsis-horizontal" size={16} color={colors.secondaryText} />
              </TouchableOpacity>
            ) : null}
            <View style={styles.commentInlineLikes}>
              <TouchableOpacity
                activeOpacity={0.5} 
                style={styles.commentLikeButton}
                onPress={() => handleLikeComment(comment)}
                disabled={likingCommentId === comment.id}
              >
                <IonIcon 
                  name={comment.is_liked ? "heart" : "heart-outline"} 
                  size={14} 
                  color={comment.is_liked ? colors.notification : colors.primaryText} 
                />
                {comment.likes_count > 0 && (
                  <Text style={styles.commentLikesText}>
                    {formatLikesCount(comment.likes_count)}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          
          {editingCommentId === comment.id ? (
            <TextInput
              style={styles.commentTextEditable}
              value={editedCommentText}
              onChangeText={setEditedCommentText}
              multiline
              autoFocus
              keyboardType="twitter"
            />
          ) : (
            <Text style={styles.commentText}>{comment.text}</Text>
          )}
          
          <View style={styles.commentActions}>
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.commentActionButton}
              onPress={() => startReplying(comment)}
            >
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>
            {editingCommentId === comment.id && (
              <>
                <TouchableOpacity
                activeOpacity={0.5} 
                  style={styles.commentActionButton}
                  onPress={cancelEditing}
                  disabled={isSaving}
                >
                  <Text style={styles.actionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                activeOpacity={0.5} 
                  style={styles.commentActionButton}
                  onPress={saveEditedComment}
                  disabled={isSaving}
                >
                  <Text style={styles.saveActionText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Show replies section */}
          {totalReplies > 0 && !showAllReplies && visibleRepliesCount === 0 && initialRepliesButton()}
          
          {totalReplies > 0 && (showAllReplies || visibleRepliesCount > 0) && (
            <View style={styles.repliesContainer}>
              {repliesToShow.map(renderReply)}
              {!showAllReplies && moreRepliesButton()}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return <PostCommentsSkeleton />;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
                activeOpacity={0.5} 
          style={styles.retryButton}
          onPress={fetchPostAndComments}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureHandlerRoot}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
      {/* Dark overlay when input is focused only */}
      {isInputFocused && (
        <Animated.View 
          style={[
            styles.darkOverlay, 
            { opacity: overlayOpacity }
          ]}
        >
          <TouchableOpacity
                activeOpacity={0.5} 
            style={styles.overlayPressable}
            onPress={dismissKeyboard}
          />
        </Animated.View>
      )}
      
      <FlatList
        data={[
          { type: 'post', data: post }, 
          ...(comments.length === 0 ? [{ type: 'empty', data: null }] : []),
          ...comments.map(comment => ({ type: 'comment', data: comment }))
        ]}
        renderItem={({ item }) => {
          if (item.type === 'post') {
            return (
              <View style={styles.postContainer}>
                {/* Simplified Post Header */}
                <View style={styles.postHeader}>
                  <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.push(`/profile/${post.user.id}`)}>
                    <CachedAvatar 
                      path={post.user?.avatar_url} 
                      size={40} 
                    />
                  </TouchableOpacity>
                  <View style={styles.postHeaderInfo}>
                    <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.push(`/profile/${post.user.id}`)}>
                      <Text style={styles.postUsername}>{post.user.username}</Text>
                    </TouchableOpacity>
                    <Text style={styles.postDate}>{formatTimeAgo(post.createdAt)}</Text>
                  </View>
                </View>

                {/* Post Title */}
                {post.title && (
                  <Text style={styles.postTitle}>{post.title}</Text>
                )}

                {/* Post Text */}
                {post.text && (
                  <Text style={styles.postText} numberOfLines={3}>
                    {post.text}
                  </Text>
                )}

                {/* Action Buttons */}
                <View style={styles.buttonsContainer}>
                  <View style={styles.leftSection}>
                    <TouchableOpacity
                activeOpacity={0.5} 
                      onPress={toggleLiked} 
                      disabled={isLikeLoading}
                      style={styles.likeButton}
                    >
                      <IonIcon 
                        name={liked ? "heart" : "heart-outline"} 
                        size={26} 
                        color={liked ? colors.notification : colors.primaryText} 
                      />
                    </TouchableOpacity>
                    
                    {/* Likes section with avatars */}
                    {likesCount > 0 && (
                      <TouchableOpacity
                activeOpacity={0.5} 
                        style={styles.likesSection}
                        onPress={() => router.push(`/post/${postId}/likes`)}
                      >
                        {likesData && (
                          <View style={styles.likesAvatarsContainer}>
                            {likesData.recentLikes?.slice(0, 3).map((like, index) => (
                              <View 
                                key={like.user_id} 
                                style={[
                                  styles.likeAvatar,
                                  index === 0 ? styles.likeAvatarFirst : styles.likeAvatarOverlap
                                ]}
                              >
                                <CachedAvatar
                                  path={like.profiles?.avatar_url}
                                  size={20}
                                  style={styles.likeAvatarBorder}
                                />
                              </View>
                            ))}
                          </View>
                        )}
                        <Text style={styles.likesText}>
                          {likesCount} {likesCount === 1 ? 'like' : 'likes'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <View style={styles.rightSection}>
                    <Text style={styles.commentCount}>
                      {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          } else if (item.type === 'empty') {
            return (
              <View style={styles.emptyCommentsContainer}>
                <View style={styles.emptyCommentsIcon}>
                  <IonIcon name="chatbubble-outline" size={32} color={colors.secondaryText} />
                </View>
                <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
                <Text style={styles.emptyCommentsSubtitle}>Be the first to share your thoughts!</Text>
              </View>
            );
          } else {
            return renderComment({ item: item.data });
          }
        }}
        keyExtractor={(item, index) => {
          if (item.type === 'post') return 'post';
          if (item.type === 'empty') return 'empty';
          return item.data.id;
        }}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Comment Input - Hide when editing */}
      {!editingCommentId && (
        <View style={[styles.addCommentContainer, isInputFocused && styles.addCommentContainerFocused]}>
          {replying && replyingTo && (
            <View style={[
              styles.replyingToContainer,
              isInputFocused && styles.replyingToContainerFocused
            ]}>
              <Text style={styles.replyingToText}>
                Replying to {replyingTo.user?.username}
              </Text>
              <TouchableOpacity
                activeOpacity={0.5} onPress={cancelReply}>
                <IonIcon name="close" size={16} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>
          )}
        
        <View style={styles.inputRow}>
          <CachedAvatar 
            path={session?.user?.user_metadata?.avatar_url || profile?.avatar_url} 
            size={36} 
            style={styles.avatarTopAligned}
          />
          <View style={[
            styles.inputContainer, 
            isInputFocused && styles.inputContainerFocused,
            replying && styles.inputContainerConnected,
            { height: inputHeight }
          ]}>
            <TextInput
              ref={inputRef}
              style={[styles.commentInput]}
              placeholder={replying ? "Add a reply..." : "Add a comment..."}
              placeholderTextColor={colors.secondaryText}
              value={newComment}
              onChangeText={setNewComment}
              onContentSizeChange={(event) => {
                const newHeight = Math.max(36, Math.min(120, event.nativeEvent.contentSize.height + 16));
                setInputHeight(newHeight);
              }}
              onFocus={() => {
                setIsInputFocused(true);
                setShouldAutoFocus(false); // Clear auto-focus once manually focused
              }}
              onBlur={() => setIsInputFocused(false)}
              multiline
              maxLength={500}
              autoFocus={shouldAutoFocus}
              keyboardType="twitter"
            />
          </View>
          
          {/* Send button outside input container */}
          {isInputFocused && (
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
              onPress={handleAddComment}
              disabled={!newComment.trim() || isSubmitting}
            >
                <IonIcon 
                  name={newComment.trim() ? "send" : "send-outline"} 
                  size={20} 
                  color={newComment.trim() ? colors.primaryText : colors.secondaryText} 
                />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Emoji bar under input when focused */}
        {isInputFocused && (
          <View style={styles.emojiBarBelow}>
            {['😀', '😍', '👍', '❤️', '😢', '😮', '😡'].map((emoji, index) => (
              <TouchableOpacity
                activeOpacity={0.5}
                key={index}
                style={styles.emojiButton}
                onPress={() => setNewComment(prev => prev + emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        </View>
      )}
      </KeyboardAvoidingView>

      {/* Comment Options Bottom Sheet */}
            <View style={styles.bottomSheetContainer}>
        <BottomSheet
          ref={commentOptionsBottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          backdropComponent={renderBackdrop}
          enablePanDownToClose
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetIndicator}
        >
          <BottomSheetView style={styles.bottomSheetModalContent}>
            <Text style={styles.bottomSheetTitle}>Comment Options</Text>
            <Text style={styles.bottomSheetSubtitle}>Choose an action for this comment</Text>
            
            <View style={styles.bottomSheetContent}>
              {selectedComment && session?.user?.id === selectedComment.user_id && (
                <TouchableOpacity
                activeOpacity={0.5}
                  style={styles.bottomSheetOption}
                  onPress={() => handleCommentAction('edit')}
                >
                  <View style={styles.bottomSheetOptionIcon}>
                    <IonIcon name="pencil" size={20} color={colors.primaryText} />
                  </View>
                  <View style={styles.bottomSheetOptionTextContainer}>
                    <Text style={styles.bottomSheetOptionText}>Edit Comment</Text>
                  </View>
                </TouchableOpacity>
              )}
              
              {selectedComment && (
                (session?.user?.id === selectedComment.user_id) || 
                (session?.user?.id === post?.user?.id)
              ) && (
                <TouchableOpacity
                activeOpacity={0.5}
                  style={styles.bottomSheetOption}
                  onPress={() => handleCommentAction('delete')}
                >
                  <View style={[styles.bottomSheetOptionIcon, styles.deleteIconBackground]}>
                    <IonIcon name="trash" size={20} color={colors.notification || '#ff4a4a'} />
                  </View>
                  <View style={styles.bottomSheetOptionTextContainer}>
                    <Text style={[styles.bottomSheetOptionText, styles.deleteOptionText]}>Delete Comment</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </BottomSheetView>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}const styles = StyleSheet.create({
  gestureHandlerRoot: {
    flex: 1,
  },
  bottomSheetContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    pointerEvents: 'box-none', // Allows touches to pass through when bottom sheet is closed
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  darkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay || 'rgba(0, 0, 0, 0.3)',
    zIndex: 1,
  },
  overlayPressable: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.secondaryAccent,
  },
  errorText: {
    fontSize: 16,
    color: colors.notification,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 20,
  },
  postContainer: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
        borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  postHeaderInfo: {
    flex: 1,
  },
  postUsername: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 2,
  },
  postDate: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 8,
  },
  postText: {
    fontSize: 14,
    color: colors.primaryText,
    lineHeight: 20,
    marginBottom: 12,
  },
  buttonsContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  likeButton: {
    padding: 4,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  commentCount: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  likesSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  likesAvatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeAvatar: {
    borderWidth: 2,
    borderColor: colors.primaryAccent,
    borderRadius: 12,
  },
  likeAvatarFirst: {
    marginLeft: 0,
  },
  likeAvatarOverlap: {
    marginLeft: -8,
  },
  likeAvatarBorder: {
    borderWidth: 2,
    borderColor: colors.primaryAccent,
  },
  likesText: {
    fontSize: 14,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  commentItemHighlighted: {
    backgroundColor: colors.whiteOverlay || 'rgba(255, 255, 255, 0.08)',
  },
  commentItemEditing: {
    backgroundColor: colors.primaryAccent,
  },
  commentAvatar: {
    marginTop: 2,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  commentInlineLikes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  commentLikeButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 4,
    position: 'relative',
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryText,
  },
  commentTime: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  commentText: {
    fontSize: 14,
    color: colors.primaryText,
    lineHeight: 18,
    marginBottom: 8,
  },
  repliesContainer: {
    marginTop: 12,
    paddingLeft: 12,
  },
  replyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  replyAvatar: {
    marginTop: 2,
  },
  replyContent: {
    flex: 1,
  },
  replyContentEditing: {
    backgroundColor: colors.secondaryAccent,
    borderRadius: 8,
    padding: 8,
    marginLeft: -8,
    marginRight: -8,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  replyInlineLikes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
  },
  replyLikeButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 4,
  },
  replyUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryText,
  },
  replyTime: {
    fontSize: 11,
    color: colors.secondaryText,
  },
  replyText: {
    fontSize: 13,
    color: colors.primaryText,
    lineHeight: 16,
    marginBottom: 6,
  },
  addCommentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 32,
    backgroundColor: colors.background,
    borderTopWidth: 0.5,
    borderTopColor: colors.whiteOverlay,
    zIndex: 1,
  },
  addCommentContainerFocused: {
    borderTopWidth: 1,
    borderTopColor: colors.whiteOverlay,
    paddingTop: 8,
  },
  emojiBarBelow: {
    flexDirection: 'row',
    paddingVertical: 8,
    justifyContent: 'space-between',
    marginTop: 8,
    marginHorizontal: -16,
    borderTopWidth: 0.5,
    borderTopColor: colors.whiteOverlay,
  },
  emojiButton: {
    padding: 6,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 20,
  },
  replyingToContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: colors.primaryAccent,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.whiteOverlay,
    marginBottom: -4,
    marginLeft: 48,
  },
  replyingToContainerFocused: {
    marginRight: 42, // Account for send button width (30) + gap (12)
  },
  replyingToText: {
    fontSize: 12,
    color: colors.secondaryText,
    opacity: 0.8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarTopAligned: {
    marginTop: 4,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: colors.primaryAccent,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.whiteOverlay,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 36,
  },
  inputContainerConnected: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  inputContainerFocused: {
    borderColor: colors.primaryText,
    borderWidth: 0.5,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: colors.primaryText,
    textAlignVertical: 'top',
    minHeight: 20,
  },
  sendButton: {
    width: 30,
    height: 30,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: -4,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyActionButton: {
  },
  actionText: {
    fontWeight: 'bold',
    color: colors.secondaryText,
    fontSize: 12,
    marginLeft: 4,
  },
  saveActionText: {
    fontWeight: 'bold',
    color: colors.brand,
    fontSize: 12,
    marginLeft: 0,
  },
  optionsButton: {
    padding: 4,
  },
  commentLikesText: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    fontSize: 10,
    color: colors.secondaryText,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  replyLikesText: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    fontSize: 9,
    color: colors.secondaryText,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  showRepliesButton: {
    marginTop: 8,
  },
  showRepliesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 5,
  },
  showRepliesText: {
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  commentTextEditable: {
    fontSize: 14,
    color: colors.primaryText,
    lineHeight: 18,
    marginBottom: 8,
    padding: 4,
    minHeight: 18,
    backgroundColor: colors.primaryAccent,
    borderRadius: 8,
  },
  replyTextEditable: {
    fontSize: 13,
    color: colors.primaryText,
    lineHeight: 16,
    marginBottom: 6,
    padding: 4,
    minHeight: 16,
    backgroundColor: colors.primaryAccent,
    borderRadius: 8,
  },
  // Bottom Sheet Styles (matching profile bottom sheet styling)
  bottomSheetBackground: {
    backgroundColor: colors.primaryAccent,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  bottomSheetIndicator: {
    backgroundColor: colors.secondaryText,
    width: 50,
  },
  bottomSheetModalContent: {
    flex: 1,
    padding: 10,
    zIndex: 2,
  },
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
    paddingBottom: 12,
  },
  bottomSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
  },
  bottomSheetOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.whiteOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bottomSheetOptionTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  bottomSheetOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  deleteIconBackground: {
    backgroundColor: colors.whiteOverlay,
  },
  deleteOptionText: {
    color: colors.notification || '#ff4a4a',
  },
  editedText: {
    fontSize: 11,
    color: colors.secondaryText,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  // Empty comments styles
  emptyCommentsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  emptyCommentsIcon: {
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyCommentsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyCommentsSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
  },
});
