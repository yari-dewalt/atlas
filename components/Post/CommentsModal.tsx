import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Easing,
  TouchableWithoutFeedback,
  PanResponder,
  ActivityIndicator,
  Alert,
  TouchableOpacity
} from 'react-native';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../constants/colors';
import { Comment, addComment, deleteComment, editComment, fetchComments, likeComment, pinComment, unpinComment } from '../../utils/postUtils';
import { useAuthStore } from '../../stores/authStore';
import CachedAvatar from '../CachedAvatar';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import ProBadge from '../ProBadge';

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
  onCommentAdded?: () => void;
  postOwnerId?: string;
}

const CommentsModal: React.FC<CommentsModalProps> = ({ 
  visible, 
  onClose, 
  postId, 
  onCommentAdded,
  postOwnerId
}) => {
  const [isPostOwner, setIsPostOwner] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likingCommentId, setLikingCommentId] = useState<string | null>(null);
  const { profile, session } = useAuthStore();
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedCommentText, setEditedCommentText] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const suggestedEmojis = ['🔥', '💯', '💪', '🏋️', '⚡️', '🏆', '🥩', '📈'];
  const [lastTap, setLastTap] = useState<number | null>(null);

  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const MAX_LINES = 3;
  const MAX_CHARS = 120; // Approximation of 3 lines of text
  const [visibleRepliesMap, setVisibleRepliesMap] = useState<Map<string, number>>(new Map());
  const REPLIES_BATCH_SIZE = 5; // Number of replies to show in each batch

  const showMoreReplies = (commentId: string, totalReplies: number) => {
    setVisibleRepliesMap(prev => {
      const newMap = new Map(prev);
      // If not set yet, start with the first batch
      const currentlyVisible = prev.get(commentId) || 0;
      // Increase by batch size but don't exceed total
      const newVisible = Math.min(currentlyVisible + REPLIES_BATCH_SIZE, totalReplies);
      newMap.set(commentId, newVisible);
      return newMap;
    });
  };
  
  // Add a function to hide all replies
  const hideAllReplies = (commentId: string) => {
    setVisibleRepliesMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(commentId); // Remove the entry to hide all replies
      return newMap;
    });
  };

  // Add this function to toggle expanded state
  const toggleCommentExpansion = (commentId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  // Add this function to check if text should be truncated
  const shouldTruncateText = (text: string): boolean => {
    return text.length > MAX_CHARS || text.split('\n').length > MAX_LINES;
    // Check if the text has more than MAX_LINES of lines or more than MAX_CHARS characters
  };

  // Add this function to get truncated text
  const getTruncatedText = (text: string): string => {
    if (!shouldTruncateText(text)) return text;
    
    // First check if we need to truncate based on lines
    const lines = text.split('\n');
    if (lines.length > MAX_LINES) {
      // Truncate based on line count
      return lines.slice(0, MAX_LINES).join('\n') + '...';
    }
    
    // If we get here, we need to truncate based on character count
    if (text.length > MAX_CHARS) {
      // Try to find a space to truncate nicely
      const truncateAt = text.substring(0, MAX_CHARS).lastIndexOf(' ');
      
      // If there are no spaces or the last space is too early, just cut at MAX_CHARS
      if (truncateAt === -1 || truncateAt < MAX_CHARS * 0.7) {
        return text.substring(0, MAX_CHARS) + '...';
      } else {
        return text.substring(0, truncateAt) + '...';
      }
    }
    
    return text;
  };

  const handleCommentPress = (comment: Comment) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // milliseconds
    
    if (lastTap && (now - lastTap) < DOUBLE_TAP_DELAY) {
      // Double tap detected
      // Only like if the comment is not already liked
      if (!comment.is_liked && session?.user?.id) {
        handleLikeComment(comment);
      }
      // Reset last tap
      setLastTap(null);
    } else {
      // This is the first tap
      setLastTap(now);
    }
  };

  const handlePinComment = async (comment: Comment) => {
    if (!session?.user?.id || !isPostOwner) return;
    
    try {
      if (comment.pinned) {
        await unpinComment(comment.id, postId, session.user.id);
      } else {
        await pinComment(comment.id, postId, session.user.id);
      }
      
      // Refresh comments to show the updated pinned status
      await loadComments();
    } catch (error) {
      console.error('Error toggling pin status:', error);
      Alert.alert('Error', 'Failed to update pin status');
    }
  };

  const handleDeleteComment = async (comment: Comment) => {
    if (!session?.user?.id) return;
    
    // Check if user has permission to delete this comment
    const canDelete = isPostOwner || comment.user_id === session.user.id;
    
    if (!canDelete) {
      Alert.alert('Error', 'You do not have permission to delete this comment');
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
              }
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('Error', 'Failed to delete comment');
            }
          }
        }
      ]
    );
  };

  const startEditingComment = (comment: Comment) => {
    if (!session?.user?.id || comment.user_id !== session.user.id) return;
    
    setEditingCommentId(comment.id);
    setEditedCommentText(comment.text);
    setIsEditing(true);
  };
  
  const cancelEditing = () => {
    setEditingCommentId(null);
    setEditedCommentText('');
    setIsEditing(false);
  };
  
  const saveEditedComment = async () => {
    if (!session?.user?.id || !editingCommentId || !editedCommentText.trim()) return;
    
    setIsEditing(true);
    try {
      const updatedComment = await editComment(editingCommentId, session.user.id, editedCommentText.trim());
      
      // Update the UI
      setComments(prev => 
        prev.map(c => {
          if (c.id === editingCommentId) {
            return {
              ...c,
              text: updatedComment.text
            };
          }
          
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map(r => {
                if (r.id === editingCommentId) {
                  return {
                    ...r,
                    text: updatedComment.text
                  };
                }
                return r;
              })
            };
          }
          
          return c;
        })
      );
      
      // Reset editing state
      cancelEditing();
    } catch (error) {
      console.error('Error editing comment:', error);
      Alert.alert('Error', 'Failed to update comment');
    } finally {
      setIsEditing(false);
    }
  };
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {},
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) {
          handleClose();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (session?.user?.id && postOwnerId) {
      setIsPostOwner(session.user.id === postOwnerId);
    }
  }, [session?.user?.id, postOwnerId]);

  useEffect(() => {
    if (!visible) {
      setLastTap(null);
      setExpandedComments(new Set());
      setVisibleRepliesMap(new Map());
      setEditingCommentId(null);
      setEditedCommentText('');
      setIsEditing(false);
    }
    
    return () => {
      setLastTap(null);
    };
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      loadComments();
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
    } else if (modalVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible, slideAnim]);

  const loadComments = async () => {
    if (!postId) return;
    
    setLoading(true);
    try {
      const data = await fetchComments(postId, session?.user?.id);
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Error', 'Could not load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      onClose();
      setExpandedComments(new Set());
      setVisibleRepliesMap(new Map());
      setEditingCommentId(null);
      setEditedCommentText('');
      setIsEditing(false);
    });
  };

  const handleProfilePress = (userId: string) => {
    handleClose();
    router.push(`/profile/${userId}`);
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !session?.user?.id) return;
    
    setIsSubmitting(true);
    try {
      const parentId = replyingTo ? replyingTo.id : undefined;
      const commentText = newComment.trim();
      
      const newCommentData = await addComment(
        postId, 
        session.user.id, 
        commentText, 
        parentId
      );
      
      if (replyingTo) {
        // Add to replies
        setComments(prevComments => 
          prevComments.map(comment => {
            if (comment.id === replyingTo.id) {
              return {
                ...comment,
                replies: [...(comment.replies || []), newCommentData]
              };
            }
            return comment;
          })
        );
      } else {
        // Add as a top-level comment
        setComments(prevComments => [newCommentData, ...prevComments]);
      }
      
      setNewComment('');
      setReplying(false);
      setReplyingTo(null);
      
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikeComment = async (comment: Comment) => {
    if (!session?.user?.id) {
      Alert.alert('Please sign in to like comments');
      return;
    }
    
    setLikingCommentId(comment.id);
    try {
      // Add haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Optimistically update UI
      const newLikedState = !comment.is_liked;
      
      // Update the comment in state
      const updateComment = (c: Comment): Comment => {
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
      Alert.alert('Error', 'Failed to update like status');
    } finally {
      setLikingCommentId(null);
    }
  };

  const startReplying = (comment: Comment) => {
    setReplying(true);
    setReplyingTo(comment);
    setNewComment(`@${comment.user?.username || ''} `);
  };

  const formatCommentDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours < 1) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        return `${diffMinutes}m ago`;
      }
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      const month = date.toLocaleString('default', { month: 'short' });
      const day = date.getDate();
      return `${month} ${day}`;
    }
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const isExpanded = expandedComments.has(item.id);
    const needsTruncation = shouldTruncateText(item.text);
    const displayText = isExpanded || !needsTruncation ? item.text : getTruncatedText(item.text);
    
    // Get the total number of replies
    const totalReplies = item.replies?.length || 0;
    const showAllReplies = totalReplies <= 3;
    
    // Determine how many replies to show
    const visibleRepliesCount = visibleRepliesMap.get(item.id) || 0;
    
    // Get the replies to show based on the visible count
    const repliesToShow = totalReplies > 0
      ? (showAllReplies 
        ? item.replies 
        : item.replies?.slice(0, visibleRepliesCount) || [])
      : [];
    
    // Calculate remaining replies
    const remainingReplies = totalReplies - visibleRepliesCount;
    
    // Determine if we should show the replies section
    const showRepliesSection = totalReplies > 0;
    
    // Button for showing initial replies when none are visible yet
    const initialRepliesButton = () => (
      totalReplies > 3 ? (
        <TouchableOpacity
                activeOpacity={0.5} 
          style={styles.showRepliesButton}
          onPress={() => showMoreReplies(item.id, totalReplies)}
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
              // Show more replies
              showMoreReplies(item.id, totalReplies);
            } else {
              // Hide all replies
              hideAllReplies(item.id);
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

    const renderPinOption = () => {
      if (!isPostOwner) return null;
      
      return (
        <TouchableOpacity
                activeOpacity={0.5} 
          style={styles.pinButton} 
          onPress={() => handlePinComment(item)}
        >
          <IonIcon 
            name={item.pinned ? "bookmark" : "bookmark-outline"} 
            size={16} 
            color={item.pinned ? colors.brand : colors.secondaryText} 
          />
          <Text style={[
            styles.pinButtonText,
            item.pinned && { color: colors.brand }
          ]}>
            {item.pinned ? 'Pinned' : 'Pin'}
          </Text>
        </TouchableOpacity>
      );
    };

    const renderCommentActions = (comment: Comment, isReply: boolean = false) => {
      const isCommentOwner = session?.user?.id === comment.user_id;
      
      if (!isCommentOwner && !isPostOwner) return null;
      
      return (
        <View style={styles.commentActionsDropdown}>
          {isCommentOwner && (
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.commentActionButton}
              onPress={() => startEditingComment(comment)}
            >
              <IonIcon name="pencil" size={14} color={colors.secondaryText} />
              <Text style={styles.commentActionText}>Edit</Text>
            </TouchableOpacity>
          )}
          
          {(isCommentOwner || isPostOwner) && (
            <TouchableOpacity
                activeOpacity={0.5} 
              style={[styles.commentActionButton, styles.deleteButton]}
              onPress={() => handleDeleteComment(comment)}
            >
              <IonIcon name="trash" size={14} color={colors.errorText || '#ff4a4a'} />
              <Text style={[styles.commentActionText, styles.deleteText]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    };
    
    return (
      <TouchableWithoutFeedback onPress={() => handleCommentPress(item)}>
        <View style={[
          styles.commentContainer, 
          replyingTo?.id === item.id && { backgroundColor: colors.secondaryAccent }
        ]}>
          {item.pinned && (
            <View style={styles.pinnedBadge}>
              <IonIcon name="bookmark" size={12} color={colors.brand} />
              <Text style={styles.pinnedText}>Pinned by creator</Text>
            </View>
          )}

          <TouchableOpacity
                activeOpacity={0.5} onPress={() => handleProfilePress(item.user?.id)}>
            <CachedAvatar
              path={item.user?.avatar_url}
              size={36}
              style={styles.commentAvatar}
              fallbackIconName="person-circle"
              fallbackIconColor={colors.secondaryText}
            />
          </TouchableOpacity>
          
          <View style={styles.commentContent}>
            {/* Comment header and content */}
            <View style={styles.commentHeader}>
              <View style={styles.commentUsernameRow}>
                <TouchableOpacity
                  activeOpacity={0.5} onPress={() => handleProfilePress(item.user?.id)}>
                  <Text style={styles.commentUsername}>
                    {item.user?.name || item.user?.username || 'User'}
                  </Text>
                </TouchableOpacity>
                {item.user?.subscription_tier === 'pro' && <ProBadge />}
              </View>
              <Text style={styles.commentDate}>{formatCommentDate(item.created_at)}</Text>

              {(session?.user?.id === item.user_id || isPostOwner) && (
                <View style={{ position: 'relative' }}>
                  <TouchableOpacity
                activeOpacity={0.5} 
                    style={styles.optionsButton}
                    onPress={() => {
                      // Toggle dropdown visibility by setting editingCommentId
                      if (editingCommentId === item.id) {
                        setEditingCommentId(null);
                      } else {
                        setEditingCommentId(item.id);
                        setEditedCommentText(item.text);
                      }
                    }}
                  >
                    <IonIcon name="ellipsis-horizontal" size={16} color={colors.secondaryText} />
                  </TouchableOpacity>
                  {editingCommentId === item.id && !isEditing && renderCommentActions(item)}
                </View>
              )}
            </View>

            {editingCommentId === item.id && isEditing ? (
              <View style={styles.editCommentContainer}>
                <TextInput
                  style={styles.editCommentInput}
                  value={editedCommentText}
                  onChangeText={setEditedCommentText}
                  multiline
                  autoFocus
                />
                <View style={styles.editCommentButtons}>
                  <TouchableOpacity
                activeOpacity={0.5} 
                    style={styles.editButton}
                    onPress={cancelEditing}
                  >
                    <Text style={styles.editButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                activeOpacity={0.5} 
                    style={[styles.editButton, styles.saveButton]}
                    onPress={saveEditedComment}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
            <View style={styles.commentMiddleContainer}>
              <View style={styles.commentTextContainer}>
                <Text style={styles.commentText}>{displayText}</Text>
                {needsTruncation && (
                  <TouchableOpacity
                activeOpacity={0.5} onPress={() => toggleCommentExpansion(item.id)}>
                    <Text style={styles.seeMoreText}>
                      {isExpanded ? 'See less...' : 'See more...'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.commentLikes}>
                <TouchableOpacity
                activeOpacity={0.5} 
                  onPress={() => handleLikeComment(item)}
                  style={styles.commentLikesButton}
                  disabled={likingCommentId === item.id}
                >
                    <IonIcon 
                      name={item.is_liked ? "heart" : "heart-outline"} 
                      size={18} 
                      color={item.is_liked ? colors.notification : colors.secondaryText} 
                    />
                </TouchableOpacity>
                {item.likes_count > 0 && (
                  <TouchableOpacity
                activeOpacity={0.5}>
                    <Text style={styles.commentLikesText}>{item.likes_count}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>)}

            <View style={styles.commentActions}>
              <TouchableOpacity
                activeOpacity={0.5} onPress={() => startReplying(item)}>
                <Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>
              {renderPinOption()}
            </View>
            {/* Initial show replies button - only for >3 replies and when none are visible yet */}
            {showRepliesSection && !showAllReplies && visibleRepliesCount === 0 && initialRepliesButton()}
            
            {/* Show replies section */}
            {showRepliesSection && (showAllReplies || visibleRepliesCount > 0) && (
              <View style={styles.repliesContainer}>
                {/* Render the visible replies */}
                {repliesToShow.map(reply => {
                  const isReplyExpanded = expandedComments.has(reply.id);
                  const replyNeedsTruncation = shouldTruncateText(reply.text);
                  const replyDisplayText = isReplyExpanded || !replyNeedsTruncation 
                    ? reply.text 
                    : getTruncatedText(reply.text);
                  
                  return (
                    <TouchableWithoutFeedback key={reply.id} onPress={() => handleCommentPress(reply)}>
                      <View style={styles.replyItem}>
                        <CachedAvatar
                          path={reply.user?.avatar_url}
                          size={28}
                          style={styles.replyAvatar}
                          fallbackIconName="person-circle"
                          fallbackIconColor={colors.secondaryText}
                        />
                        <View style={styles.replyContent}>
                          <View style={styles.commentHeader}>
                            <View style={styles.commentUsernameRow}>
                              <Text style={styles.commentUsername}>
                                {reply.user?.name || reply.user?.username || 'User'}
                              </Text>
                              {reply.user?.subscription_tier === 'pro' && <ProBadge />}
                            </View>
                            <Text style={styles.commentDate}>{formatCommentDate(reply.created_at)}</Text>

                            {(session?.user?.id === item.user_id || isPostOwner) && (
                              <View style={{ position: 'relative' }}>
                                <TouchableOpacity
                activeOpacity={0.5} 
                                  style={styles.optionsButton}
                                  onPress={() => {
                                    // Toggle dropdown visibility by setting editingCommentId
                                    if (editingCommentId === item.id) {
                                      setEditingCommentId(null);
                                    } else {
                                      setEditingCommentId(item.id);
                                      setEditedCommentText(item.text);
                                    }
                                  }}
                                >
                                  <IonIcon name="ellipsis-horizontal" size={16} color={colors.secondaryText} />
                                </TouchableOpacity>
                                {editingCommentId === item.id && !isEditing && renderCommentActions(item)}
                              </View>
                            )}
                          </View>

                          {/* Show editing UI if this reply is being edited */}
                          {editingCommentId === reply.id && isEditing ? (
                            <View style={styles.editCommentContainer}>
                              <TextInput
                                style={styles.editCommentInput}
                                value={editedCommentText}
                                onChangeText={setEditedCommentText}
                                multiline
                                autoFocus
                              />
                              <View style={styles.editCommentButtons}>
                                <TouchableOpacity
                activeOpacity={0.5} 
                                  style={styles.editButton}
                                  onPress={cancelEditing}
                                >
                                  <Text style={styles.editButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                activeOpacity={0.5} 
                                  style={[styles.editButton, styles.saveButton]}
                                  onPress={saveEditedComment}
                                >
                                  <Text style={styles.saveButtonText}>Save</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                          <View style={styles.commentMiddleContainer}>
                            <View style={styles.commentTextContainer}>
                              <Text style={styles.commentText}>{replyDisplayText}</Text>
                              {replyNeedsTruncation && (
                                <TouchableOpacity
                activeOpacity={0.5} onPress={() => toggleCommentExpansion(reply.id)}>
                                  <Text style={styles.seeMoreText}>
                                    {isReplyExpanded ? 'See less...' : 'See more...'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            <View style={styles.commentLikes}>
                              <TouchableOpacity
                activeOpacity={0.5} 
                                onPress={() => handleLikeComment(reply)}
                                style={styles.commentLikesButton}
                                disabled={likingCommentId === reply.id}
                              >
                                  <IonIcon 
                                    name={reply.is_liked ? "heart" : "heart-outline"} 
                                    size={18} 
                                    color={reply.is_liked ? colors.notification : colors.secondaryText} 
                                  />
                              </TouchableOpacity>
                              {reply.likes_count > 0 && (
                                <TouchableOpacity
                activeOpacity={0.5}>
                                  <Text style={styles.commentLikesText}>{reply.likes_count}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>)}

                          <View style={styles.commentActions}>
                            <TouchableOpacity
                activeOpacity={0.5} onPress={() => startReplying(item)}>
                              <Text style={styles.actionText}>Reply</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </TouchableWithoutFeedback>
                  );
                })}
                
                {/* "Show more replies" button at the end of the replies list - only for >3 replies */}
                {!showAllReplies && visibleRepliesCount > 0 && moreRepliesButton()}
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
                activeOpacity={0.5} style={styles.overlay} onPress={handleClose}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [600, 0],
                })
              }],
              opacity: slideAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.5, 0.8, 1],
              })
            }
          ]}
        >
          <TouchableOpacity
                activeOpacity={0.5} onPress={() => {}} style={styles.modalContent}>
            <View 
              style={styles.modalHeader} 
              {...panResponder.panHandlers}
            >
              <View style={styles.modalHandleBar} />
              <Text style={styles.modalTitle}>Comments</Text>
            </View>
            
            {loading ? (
              <View style={styles.loadingContainer}>
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptySubtext}>Be the first to comment</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                renderItem={renderComment}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.commentsContainer}
                showsVerticalScrollIndicator={false}
              />
            )}
            
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.commentInputContainer}
              keyboardVerticalOffset={240}
            >
              <View style={styles.inputArea}>
                <View style={[styles.emojisContainer, replying && { paddingBottom: 20 }]}>
                  {suggestedEmojis.map((emoji, index) => (
                    <TouchableOpacity
                activeOpacity={0.5} key={index} onPress={() => setNewComment(newComment + emoji)}>
                      <Text style={styles.emoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.inputWrapper}>
                  <CachedAvatar
                    path={profile?.avatar_url}
                    size={36}
                    style={styles.commentAvatar}
                    fallbackIconName="person-circle"
                    fallbackIconColor={colors.secondaryText}
                  />
                  <View style={{ flex: 1 }}>
                    {replying && replyingTo && (
                      <View style={styles.replyTextContainer}>
                        <Text style={styles.replyingToText}>
                          Replying to {replyingTo.user?.username || 'user'}
                        </Text>
                        <TouchableOpacity
                activeOpacity={0.5} onPress={() => { 
                          setReplying(false); 
                          setReplyingTo(null);
                          setNewComment('');
                        }}>
                          <IonIcon name="close" size={16} color={colors.secondaryText} />
                        </TouchableOpacity>
                      </View>
                    )}
                    <View style={[
                      styles.inputContainer, 
                      replying && { 
                        minHeight: 40, 
                        borderTopLeftRadius: 0, 
                        borderTopRightRadius: 0, 
                        marginBottom: 16 
                      }
                    ]}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder={`Add a comment${profile ? ` as ${profile.username}` : ''}...`}
                        placeholderTextColor={colors.secondaryText}
                        value={newComment}
                        onChangeText={setNewComment}
                        multiline
                        editable={!isSubmitting}
                      />
                      <TouchableOpacity
                activeOpacity={0.5} 
                        onPress={handleSubmitComment} 
                        disabled={!newComment.trim() || isSubmitting}
                        style={[
                          styles.sendButton, 
                          (!newComment.trim() || isSubmitting) && styles.sendButtonDisabled
                        ]}
                      >
                          <IonIcon 
                            name="arrow-up" 
                            size={18} 
                            color={!newComment.trim() ? colors.secondaryText : colors.primaryText} 
                          />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Keep your existing styles and add these:
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  replyAvatar: {
    marginRight: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.primaryAccent,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '70%',
    width: '100%',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.secondaryAccent,
  },
  modalHandleBar: {
    position: 'absolute',
    top: 8,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.secondaryText,
    alignSelf: 'center',
  },
  modalTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primaryText,
  },
  shareButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  commentsContainer: {
    paddingBottom: 20,
  },
  commentContainer: {
    flexDirection: 'row',
    padding: 16,
  },
  commentMiddleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  commentAvatar: {
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
    gap: 4,
  },
  commentHeader: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  commentUsernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primaryText,
  },
  commentDate: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  commentLikes: {
    alignItems: 'center',
    gap: 2,
    marginTop: -8,
  },
  commentLikesButton: {
    minWidth: 30,
    minHeight: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentLikesText: {
    fontWeight: 'bold',
    color: colors.secondaryText,
    fontSize: 12,
  },
  commentInputContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.secondaryAccent,
    padding: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 40,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.secondaryAccent,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 4,
  },
  commentInput: {
    justifyContent: 'center',
    flex: 1,
    color: colors.primaryText,
    paddingRight: 10,
    maxHeight: 100,
    marginBottom: 4,
  },
  sendButton: {
    marginTop: 'auto',
    width: 40,
    height: 30,
    borderRadius: 50,
    backgroundColor: colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.primaryAccent,
  },
  inputArea: {
    gap: 10,
  },
  emojisContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emoji: {
    fontSize: 24
  },
  replyingToText: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  replyTextContainer: {
    borderColor: colors.secondaryAccent,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentTextContainer: {
    flex: 1,
    maxWidth: '90%',
  },
  commentText: {
    fontSize: 14,
    color: colors.primaryText,
    lineHeight: 20,
  },
  seeMoreText: {
    fontSize: 14,
    color: colors.secondaryText,
    marginTop: 4,
    fontWeight: '500',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 16,
  },
  actionText: {
    fontWeight: 'bold',
    color: colors.secondaryText,
    fontSize: 12,
  },
  showRepliesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8, 
    gap: 5,
  },
  showRepliesButton: {
  },
  showRepliesText: {
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  replyCountText: {
    color: colors.secondaryText,
    fontSize: 12,
    marginTop: 4,
  },
  repliesContainer: {
    marginTop: 8,
  },
  replyContent: {
    flex: 1,
  },
  replyItem: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 4,
  },
  pinnedCommentContainer: {
    backgroundColor: `${colors.brand}10`, // Semi-transparent brand color
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
  },
  pinnedBadge: {
    position: 'absolute',
    top: 4,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.brand}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pinnedText: {
    fontSize: 10,
    color: colors.brand,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  pinButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinButtonText: {
    fontWeight: 'bold',
    color: colors.secondaryText,
    fontSize: 12,
    marginLeft: 4,
  },
  optionsButton: {
    padding: 4,
  },
  commentActionsDropdown: {
    backgroundColor: colors.secondaryAccent,
    borderRadius: 8,
    padding: 4,
    position: 'absolute',
    left: 0,
    top: 30,
    width: 120,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: colors.secondaryAccent,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  commentActionText: {
    color: colors.primaryText,
    fontSize: 14,
  },
  deleteButton: {
    borderTopWidth: 1,
    borderTopColor: colors.primaryAccent,
  },
  deleteText: {
    color: colors.notification,
  },
  editCommentContainer: {
    backgroundColor: colors.secondaryAccent,
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  editCommentInput: {
    color: colors.primaryText,
    fontSize: 14,
    padding: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editCommentButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  editButtonText: {
    color: colors.secondaryText,
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: colors.brand,
  },
  saveButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default CommentsModal;