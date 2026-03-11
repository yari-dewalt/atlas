// stores/messageStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

// Types
export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  deleted: boolean;
  sender?: {
    id: string;
    username: string;
    name?: string | null;
    avatar_url?: string | null;
  };
};

export type Participant = {
  id: string;
  username: string;
  name?: string | null;
  avatar_url?: string | null;
};

export type Conversation = {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  participants: Participant[];
};

type MessageStore = {
  conversations: Conversation[];
  currentConversation: string | null;
  messages: Message[];
  loading: boolean;
  sending: boolean;
  loadingMore: boolean;
  hasMoreMessages: boolean;
  
  // Actions
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string, reset?: boolean) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (content: string, mediaUrl?: string, mediaType?: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  createConversation: (userIds: string[]) => Promise<string | null>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  getOrCreateDirectConversation: (userId: string) => Promise<string | null>;
  subscribeToMessages: () => (() => void);
  leaveConversation: (conversationId: string) => Promise<boolean>;
  addUsersToConversation: (conversationId: string, userIds: string[]) => Promise<boolean>;
};

export const useMessageStore = create<MessageStore>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  loading: false,
  sending: false,
  loadingMore: false,
  hasMoreMessages: true,
  
  fetchConversations: async () => {
    const { session } = useAuthStore.getState();
    if (!session?.user) return;
    
    try {
      set({ loading: true });
      
      // Get all conversations where user is a participant
      const { data: participations, error: participationsError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, unread_count')
        .eq('user_id', session.user.id);
        
      if (participationsError) throw participationsError;
      
      if (!participations || participations.length === 0) {
        set({ conversations: [], loading: false });
        return;
      }
      
      // Get the conversation details
      const conversationIds = participations.map(p => p.conversation_id);
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });
        
      if (conversationsError) throw conversationsError;
      
      if (!conversationsData) {
        set({ conversations: [], loading: false });
        return;
      }
      
      // For each conversation, get other participants
      const formattedConversations = await Promise.all(
        conversationsData.map(async (conversation) => {
          const { data: participants, error: participantsError } = await supabase
            .from('conversation_participants')
            .select(`
              user_id,
              profiles:user_id(id, username, name, avatar_url)
            `)
            .eq('conversation_id', conversation.id);
            
          if (participantsError) throw participantsError;
          
          // Find unread count for this conversation
          const unreadData = participations.find(p => 
            p.conversation_id === conversation.id
          );
          
          return {
            id: conversation.id,
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
            last_message_preview: conversation.last_message_preview || '',
            last_message_at: conversation.last_message_at,
            unread_count: unreadData?.unread_count || 0,
            participants: participants
              .filter(p => p.profiles.id !== session.user.id) // Exclude current user
              .map(p => ({
                id: p.profiles.id,
                username: p.profiles.username,
                name: p.profiles.name,
                avatar_url: p.profiles.avatar_url
              }))
          };
        })
      );
      
      set({ conversations: formattedConversations, loading: false });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      set({ loading: false });
    }
  },
  
  fetchMessages: async (conversationId: string, reset = true) => {
    const { session } = useAuthStore.getState();
    if (!session?.user?.id) return;
    
    try {
      set({ 
        loading: reset,
        currentConversation: conversationId,
        messages: reset ? [] : get().messages 
      });
      
      // Get messages for this conversation
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(id, username, name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (error) throw error;
      
      set({ 
        messages: (data || []).reverse(),
        loading: false,
        hasMoreMessages: data && data.length === 20
      });
      
      // Mark conversation as read
      await get().markConversationAsRead(conversationId);
      
    } catch (error) {
      console.error('Error fetching messages:', error);
      set({ loading: false });
    }
  },
  
  loadMoreMessages: async () => {
    const { currentConversation, messages, loadingMore, hasMoreMessages } = get();
    
    if (!currentConversation || loadingMore || !hasMoreMessages || messages.length === 0) return;
    
    try {
      set({ loadingMore: true });
      
      // Get oldest message timestamp
      const oldestMessage = messages[0];
      
      // Get messages older than our oldest message
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(id, username, name, avatar_url)
        `)
        .eq('conversation_id', currentConversation)
        .lt('created_at', oldestMessage.created_at)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (error) throw error;
      
      // Add messages to the beginning of the array
      set({ 
        messages: [...(data || []).reverse(), ...messages],
        loadingMore: false,
        hasMoreMessages: data && data.length === 20
      });
      
    } catch (error) {
      console.error('Error loading more messages:', error);
      set({ loadingMore: false });
    }
  },
  
  sendMessage: async (content, mediaUrl, mediaType) => {
    const { currentConversation, messages } = get();
    const { session } = useAuthStore.getState();
    
    if (!currentConversation || !session?.user) return false;
    
    try {
      set({ sending: true });
      
      // Create the message
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: currentConversation,
          sender_id: session.user.id,
          content,
          media_url: mediaUrl || null,
          media_type: mediaType || null
        })
        .select('id, created_at')
        .single();
        
      if (error) throw error;
      
      // Get the user's profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, name, avatar_url')
        .eq('id', session.user.id)
        .single();
        
      if (profileError) throw profileError;
      
      // Optimistically update the UI
      const newMessage = {
        id: data.id,
        conversation_id: currentConversation,
        sender_id: session.user.id,
        content,
        created_at: data.created_at,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        deleted: false,
        sender: {
          id: profile.id,
          username: profile.username,
          name: profile.name,
          avatar_url: profile.avatar_url
        }
      };
      
      set({
        messages: [...messages, newMessage],
        sending: false
      });

      // Send push notifications to other participants (non-blocking)
      try {
        const { conversations } = get();
        const conversation = conversations.find(c => c.id === currentConversation);
        if (conversation?.participants?.length) {
          const { sendDirectMessagePushNotification } = await import('../utils/pushNotificationHelpers');
          for (const participant of conversation.participants) {
            await sendDirectMessagePushNotification(participant.id, session.user.id, currentConversation);
          }
        }
      } catch (err) {
        console.warn('[Push] DM push failed (non-critical):', err);
      }

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      set({ sending: false });
      return false;
    }
  },
  
  deleteMessage: async (messageId) => {
    const { messages } = get();
    const { session } = useAuthStore.getState();
    
    if (!session?.user) return false;
    
    try {
      // Update the message (setting content to null and deleted to true)
      const { error } = await supabase
        .from('messages')
        .update({
          content: null,
          deleted: true
        })
        .eq('id', messageId)
        .eq('sender_id', session.user.id);
        
      if (error) throw error;
      
      // Update the UI
      set({
        messages: messages.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: null, deleted: true }
            : msg
        )
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  },
  
  createConversation: async (userIds) => {
    const { session } = useAuthStore.getState();
    if (!session?.user) return null;
    
    try {
      // Create the conversation
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .insert({
          created_by: session.user.id
        })
        .select()
        .single();
        
      if (conversationError) throw conversationError;
      
      // Add all participants including current user
      const allParticipants = [...userIds, session.user.id];
      const participantRows = allParticipants.map(userId => ({
        conversation_id: conversation.id,
        user_id: userId
      }));
      
      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert(participantRows);
        
      if (participantsError) throw participantsError;
      
      // Refresh conversations list
      await get().fetchConversations();
      
      return conversation.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  },
  
  getOrCreateDirectConversation: async (userId) => {
    const { session } = useAuthStore.getState();
    const { conversations } = get();
    
    if (!session?.user) return null;
    
    try {
      // Check if direct conversation already exists (1-on-1)
      const existingConversation = conversations.find(c => 
        c.participants.length === 1 && 
        c.participants.some(p => p.id === userId)
      );
      
      if (existingConversation) {
        return existingConversation.id;
      }
      
      // Create new conversation
      return await get().createConversation([userId]);
      
    } catch (error) {
      console.error('Error getting or creating conversation:', error);
      return null;
    }
  },
  
  markConversationAsRead: async (conversationId) => {
    const { session } = useAuthStore.getState();
    const { conversations } = get();
    
    if (!session?.user) return;
    
    try {
      // Update the participant row to mark as read
      const { error } = await supabase
        .from('conversation_participants')
        .update({
          unread_count: 0,
          last_read_at: new Date().toISOString()
        })
        .eq('conversation_id', conversationId)
        .eq('user_id', session.user.id);
        
      if (error) throw error;
      
      // Update local state
      set({
        conversations: conversations.map(conv =>
          conv.id === conversationId
            ? { ...conv, unread_count: 0 }
            : conv
        )
      });
      
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  },
  
  leaveConversation: async (conversationId) => {
    const { session } = useAuthStore.getState();
    const { conversations, currentConversation } = get();
    
    if (!session?.user) return false;
    
    try {
      // Remove user from conversation participants
      const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', session.user.id);
        
      if (error) throw error;
      
      // Update local state - remove conversation
      set({
        conversations: conversations.filter(conv => conv.id !== conversationId),
        currentConversation: currentConversation === conversationId ? null : currentConversation,
        messages: currentConversation === conversationId ? [] : get().messages
      });
      
      return true;
    } catch (error) {
      console.error('Error leaving conversation:', error);
      return false;
    }
  },
  
  addUsersToConversation: async (conversationId, userIds) => {
    const { session } = useAuthStore.getState();
    
    if (!session?.user) return false;
    
    try {
      // Create participant entries
      const participantRows = userIds.map(userId => ({
        conversation_id: conversationId,
        user_id: userId
      }));
      
      const { error } = await supabase
        .from('conversation_participants')
        .insert(participantRows);
        
      if (error) throw error;
      
      // Refresh conversations to update participants
      await get().fetchConversations();
      
      return true;
    } catch (error) {
      console.error('Error adding users to conversation:', error);
      return false;
    }
  },
  
  subscribeToMessages: () => {
    const { session } = useAuthStore.getState();
    if (!session?.user) return () => {};
    
    // Create a channel for real-time updates
    const channel = supabase.channel('messaging-changes');
    
    // Subscribe to new messages
    channel.on(
      'postgres_changes',
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
      },
      async (payload) => {
        const { currentConversation, messages, fetchConversations } = get();
        const newMessage = payload.new as Message;
        
        // If it's for the current conversation, add it to messages
        if (currentConversation === newMessage.conversation_id) {
          // Don't add if message is already in the list
          const alreadyExists = messages.some(m => m.id === newMessage.id);
          
          if (!alreadyExists) {
            // Get sender details
            const { data: sender } = await supabase
              .from('profiles')
              .select('id, username, name, avatar_url')
              .eq('id', newMessage.sender_id)
              .single();
              
            // Add message to state with sender info
            set({
              messages: [...messages, {
                ...newMessage,
                sender
              }]
            });
            
            // Mark as read if receiving a message in the current conversation
            if (newMessage.sender_id !== session.user.id) {
              await get().markConversationAsRead(newMessage.conversation_id);
            }
          }
        } else {
          // If it's a different conversation, refresh conversations list
          // to update unread counts and last message previews
          fetchConversations();
        }
      }
    )
    .subscribe();
    
    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
    };
  }
}));